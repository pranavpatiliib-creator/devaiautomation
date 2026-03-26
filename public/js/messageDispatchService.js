const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ─── Channel adapters (lazy-loaded to avoid circular deps) ───────────────────
function getAdapter(channel) {
  switch (channel) {
    case 'meta':
      return require('./metaService');
    case 'twilio':
    case 'whatsapp':
      return require('./twilioService'); // add when ready
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }
}

// ─── Resolve page/number for this tenant+channel ─────────────────────────────
async function resolveChannelConfig(tenantId, channel) {
  if (channel === 'meta') {
    const { data } = await supabase
      .from('meta_channels')
      .select('page_id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();
    if (!data) throw new Error('No Meta channel configured for this tenant');
    return { pageId: data.page_id };
  }

  if (channel === 'twilio' || channel === 'whatsapp') {
    const { data } = await supabase
      .from('twilio_channels')
      .select('from_number')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();
    if (!data) throw new Error('No Twilio channel configured for this tenant');
    return { fromNumber: data.from_number };
  }

  return {};
}

// ─── Main dispatch ─────────────────────────────────────────────────────────────
async function dispatch({ tenantId, channel, contactId, text }) {
  const config = await resolveChannelConfig(tenantId, channel);
  const adapter = getAdapter(channel);

  switch (channel) {
    case 'meta':
      return adapter.sendMessage({
        tenantId,
        pageId: config.pageId,
        recipientId: contactId,
        text,
      });

    case 'twilio':
    case 'whatsapp':
      return adapter.sendMessage({
        to: contactId,
        from: config.fromNumber,
        body: text,
      });

    default:
      throw new Error(`No dispatch handler for channel: ${channel}`);
  }
}

// ─── Auto-reply pipeline ───────────────────────────────────────────────────────
// Called after an inbound message is saved — decides whether to auto-reply
async function maybeAutoReply({ tenantId, conversationId, inboundText, channel, contactId }) {
  try {
    const aiReplyService = require('./aiReplyService');
    const inboxService = require('./inboxService');

    // Check tenant auto-reply toggle
    const { data: config } = await supabase
      .from('ai_configs')
      .select('auto_reply_enabled, menu_config')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!config?.auto_reply_enabled) return;

    // Try menu flow first
    let replyText = null;
    if (config.menu_config) {
      replyText = aiReplyService.handleMenuFlow(inboundText, config.menu_config);
    }

    // Fall back to AI
    if (!replyText) {
      const result = await aiReplyService.generateReply({ tenantId, conversationId, inboundText });
      if (!result) return; // AI disabled or no reply
      replyText = result.text;
    }

    // Send the auto-reply
    await inboxService.sendReply(tenantId, conversationId, {
      text: replyText,
      agentId: null, // null = system/bot
    });

    console.log(`[AutoReply] Sent to conversation ${conversationId}`);
  } catch (err) {
    console.error('[AutoReply] Failed:', err.message);
    // Never throw — auto-reply failure must not break inbound flow
  }
}

module.exports = { dispatch, maybeAutoReply };
