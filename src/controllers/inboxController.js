const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const facebookService = require('../services/facebookService');
const instagramService = require('../services/instagramService');
const whatsappService = require('../services/whatsappService');

/**
 * Handle incoming webhook events for Facebook, Instagram, and WhatsApp
 */
const handleWebhookEvent = async (req, res) => {
  const body = req.body;

  if (body.object === 'page' || body.object === 'instagram') {
    // Facebook or Instagram
    body.entry.forEach(async (entry) => {
      const webhookEvent = entry.messaging ? entry.messaging[0] : null;
      if (webhookEvent) {
        const senderId = webhookEvent.sender.id;
        const recipientId = webhookEvent.recipient.id;
        
        // Ensure this logic maps the SaaS user ID properly.
        // For a real SaaS, we would look up the saas user by recipientId (Page ID/IG ID)
        const userId = req.user?.id || 'saas_user_123'; 
        const platform = body.object === 'page' ? 'facebook' : 'instagram';
        
        if (webhookEvent.message && !webhookEvent.message.is_echo) {
          const messageText = webhookEvent.message.text;
          const messageId = webhookEvent.message.mid;
          
          console.log('[INBOX] Incoming message received');
          
          try {
            // Find or create conversation
            const conversation = await Conversation.findOrCreate({
              userId,
              platform,
              customerId: senderId,
              customerName: 'Customer ' + (senderId.substring(0, 5))
            });

            // Store message
            await Message.create({
              conversationId: conversation.id,
              platform,
              senderType: 'customer',
              messageText,
              messageId
            });

            // Update conversation last message
            await Conversation.updateLastMessage(conversation.id, messageText);
          } catch (error) {
            console.error('[INBOX] Error processing webhook event:', error);
          }
        } else if (webhookEvent.delivery) {
          // Handle delivery status
          console.log('[INBOX] Message deliveries received');
          const messageIds = webhookEvent.delivery.mids;
          if (messageIds) {
            messageIds.forEach(mid => Message.updateStatus(mid, 'delivered'));
          }
        } else if (webhookEvent.read) {
          // Handle read status
          console.log('[INBOX] Message reads received');
          const messageId = webhookEvent.read.mid || 'unknown_mid';
          if (messageId !== 'unknown_mid') {
            await Message.updateStatus(messageId, 'read');
          }
        } else if (webhookEvent.reaction) {
          console.log('[INBOX] Message reactions received');
        }
      }
    });
    res.status(200).send('EVENT_RECEIVED');

  } else if (body.object === 'whatsapp_business_account') {
    // WhatsApp
    body.entry.forEach(async (entry) => {
      const changes = entry.changes[0];
      if (changes.value.messages) {
        const msg = changes.value.messages[0];
        const contact = changes.value.contacts[0];
        const senderId = msg.from;
        
        const userId = req.user?.id || 'saas_user_123'; // Look up by recipient ID
        const platform = 'whatsapp';
        
        if (msg.type === 'text') {
          const messageText = msg.text.body;
          const messageId = msg.id;

          console.log('[INBOX] Incoming message received');

          try {
            const conversation = await Conversation.findOrCreate({
              userId,
              platform,
              customerId: senderId,
              customerName: contact.profile.name || senderId
            });

            await Message.create({
              conversationId: conversation.id,
              platform,
              senderType: 'customer',
              messageText,
              messageId
            });

            await Conversation.updateLastMessage(conversation.id, messageText);
          } catch (error) {
            console.error('[INBOX] Error processing WA webhook event:', error);
          }
        }
      } else if (changes.value.statuses) {
        // Handle WA statuses: sent, delivered, read
        console.log('[INBOX] Message deliveries/reads received for WA');
        const statusObj = changes.value.statuses[0];
        if (statusObj.id && statusObj.status) {
          await Message.updateStatus(statusObj.id, statusObj.status);
        }
      }
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
};

/**
 * Send a reply back to the customer on their respective platform
 */
const replyToMessage = async (req, res) => {
  const { conversationId, message } = req.body;
  const userId = req.user?.id || 'saas_user_123'; // SaaS tenant

  try {
    // 1. Fetch conversation details to know the platform and customerId
    const { data: conversation, error } = await require('../utils/supabaseClient')
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

    if (error || !conversation) {
      return res.status(404).json({ error: 'Conversation not found or unauthorized' });
    }

    const { platform, customer_id: customerId } = conversation;

    // 2. Fetch the SaaS user's Meta access tokens from DB
    // For production, these should be dynamically fetched per tenant
    const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN || 'mock_page_token'; 
    const waAccessToken = process.env.WA_ACCESS_TOKEN || 'mock_wa_token';
    const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1234567890';
    const igBusinessId = process.env.IG_BUSINESS_ID || '1234567890';

    let platformResponse;
    // 3. Route to corresponding platform service
    if (platform === 'facebook') {
      platformResponse = await facebookService.sendMessage(customerId, message, pageAccessToken);
    } else if (platform === 'instagram') {
      platformResponse = await instagramService.sendMessage(igBusinessId, customerId, message, pageAccessToken);
    } else if (platform === 'whatsapp') {
      platformResponse = await whatsappService.sendMessage(waPhoneId, customerId, message, waAccessToken);
    } else {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    // 4. Store the business reply message in our database
    const sentMessageId = platformResponse?.message_id || platformResponse?.messages?.[0]?.id || `reply_${Date.now()}`;
    
    await Message.create({
      conversationId: conversation.id,
      platform,
      senderType: 'business', // Business is replying
      messageText: message,
      messageId: sentMessageId,
      status: 'sent'
    });

    await Conversation.updateLastMessage(conversation.id, message);
    
    console.log('[INBOX] Reply sent');
    return res.status(200).json({ success: true, messageId: sentMessageId });

  } catch (error) {
    console.error('[INBOX] Error sending reply:', error.message);
    return res.status(500).json({ error: 'Failed to send reply' });
  }
};

/**
 * Initiate Meta OAuth Flow
 */
const getAuthUrl = (req, res) => {
  const metaConfig = require('../config/meta');
  
  if (!metaConfig.appId) {
    return res.status(500).json({ error: 'META_APP_ID is not configured' });
  }

  // Permissions for messaging
  // NOTE: Advanced scopes (pages_messaging, instagram_manage_messages, 
  // whatsapp_business_messaging) require Meta App Review.
  // Start with basic scopes for development, then add more after App Review.
  const scopes = [
    'public_profile',
    'email'
  ].join(',');

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${metaConfig.appId}&redirect_uri=${metaConfig.oauthRedirectUri}&scope=${scopes}&state=${req.user?.id || 'demo_state'}`;
  
  // Return the URL for frontend to redirect, or redirect directly
  return res.json({ url: authUrl });
};

/**
 * Handle Meta OAuth Callback
 */
const handleAuthCallback = async (req, res) => {
  const { code, state } = req.query;
  const metaConfig = require('../config/meta');
  const axios = require('axios');
  const supabase = require('../utils/supabaseClient');

  if (!code) {
    return res.status(400).send('Authorization failed. No code provided.');
  }

  try {
    // 1. Exchange the code for a short-lived user access token
    const tokenUrl = `${metaConfig.facebookGraphUrl}/oauth/access_token?client_id=${metaConfig.appId}&redirect_uri=${metaConfig.oauthRedirectUri}&client_secret=${metaConfig.appSecret}&code=${code}`;
    
    const tokenResponse = await axios.get(tokenUrl);
    const shortLivedToken = tokenResponse.data.access_token;

    // 2. Exchange for a long-lived user access token
    const longLivedUrl = `${metaConfig.facebookGraphUrl}/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaConfig.appId}&client_secret=${metaConfig.appSecret}&fb_exchange_token=${shortLivedToken}`;
    const longLivedResponse = await axios.get(longLivedUrl);
    const longLivedToken = longLivedResponse.data.access_token;

    const userId = state || 'saas_user_123';

    // 3. Save token to Supabase integrations table
    // Upsert: update if exists, insert if not
    const { error: upsertError } = await supabase
      .from('integrations')
      .upsert({
        user_id: parseInt(userId),
        platform: 'meta',
        access_token: longLivedToken,
        connected: true,
        connected_at: new Date().toISOString()
      }, { onConflict: 'user_id,platform' });

    if (upsertError) {
      console.error('[OAUTH] Error saving token to DB:', upsertError);
    }

    console.log(`[OAUTH] Successfully connected Meta for user: ${userId}`);

    // Redirect back to dashboard UI
    res.send(`
      <script>
        alert("Platform connected successfully!");
        window.location.href = '/dashboard';
      </script>
    `);

  } catch (error) {
    console.error('[OAUTH] Error exchanging code for token:', error.response?.data || error.message);
    res.status(500).send('Integration failed. Please try again.');
  }
};

/**
 * Get connection status for all platforms
 */
const getConnectionStatus = async (req, res) => {
  const userId = req.user?.id;
  const supabase = require('../utils/supabaseClient');

  try {
    const { data, error } = await supabase
      .from('integrations')
      .select('platform, connected, connected_at')
      .eq('user_id', userId);

    if (error) {
      // Table might not exist yet
      console.error('[INBOX] getConnectionStatus error:', error.message);
      return res.status(200).json({ connections: [] });
    }

    return res.status(200).json({ connections: data || [] });
  } catch (err) {
    console.error('[INBOX] getConnectionStatus error:', err.message);
    return res.status(200).json({ connections: [] });
  }
};

/**
 * Get all conversations for the unified inbox dashboard
 */
const getConversations = async (req, res) => {
  const userId = req.user?.id || 'saas_user_123';
  try {
    const conversations = await Conversation.getAllForUser(userId);
    return res.status(200).json({ conversations });
  } catch (error) {
    console.error('[INBOX] getConversations error:', error.message || error);
    // If the table doesn't exist yet, return empty list gracefully
    return res.status(200).json({ conversations: [] });
  }
};

/**
 * Get all messages for a specific conversation
 */
const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  
  try {
    // In production, verify the conversation belongs to req.user.id
    const messages = await Message.getByConversation(conversationId);
    return res.status(200).json({ messages });
  } catch (error) {
    console.error('[INBOX] getMessages error:', error.message || error);
    // If the table doesn't exist yet, return empty list gracefully
    return res.status(200).json({ messages: [] });
  }
};

module.exports = {
  handleWebhookEvent,
  replyToMessage,
  getAuthUrl,
  handleAuthCallback,
  getConnectionStatus,
  getConversations,
  getMessages
};
