const supabase = require('../utils/supabaseClient');

class Message {
  /**
   * Create a new message in a conversation
   */
  static async create({ conversationId, platform, senderType, messageText, messageId, status = 'delivered' }) {
    const { data: message, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        platform,
        sender_type: senderType, // 'customer' or 'business'
        message_text: messageText,
        message_id: messageId,
        status, // 'sent', 'delivered', 'read'
        created_at: new Date()
      }])
      .select()
      .single();
      
    if (error) {
      console.error('[INBOX] Error storing message:', error);
      throw error;
    }
    
    console.log('[INBOX] Message stored:', message.id);
    return message;
  }

  /**
   * Get all messages for a specific conversation
   */
  static async getByConversation(conversationId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error('[INBOX] Error getting messages:', error);
      throw error;
    }
    
    return data;
  }

  /**
   * Update message status (sent, delivered, read) based on webhook events
   */
  static async updateStatus(messageId, status) {
    const { data, error } = await supabase
      .from('messages')
      .update({ status })
      .eq('message_id', messageId)
      .select()
      .single();
      
    if (error) {
      console.error(`[INBOX] Error updating message status to ${status}:`, error);
      throw error;
    }
    
    return data;
  }
}

module.exports = Message;
