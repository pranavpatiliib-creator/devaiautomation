const supabase = require('../config/supabase');

function getAdapter(channel) {
    switch (channel) {
        case 'meta':
            return require('./metaService');
        case 'twilio':
        case 'whatsapp':
            return require('./twilioService'); // legacy placeholder
        default:
            throw new Error(`Unsupported channel: ${channel}`);
    }
}

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

async function dispatch({ tenantId, channel, contactId, text }) {
    const config = await resolveChannelConfig(tenantId, channel);
    const adapter = getAdapter(channel);

    switch (channel) {
        case 'meta':
            return adapter.sendMessage({
                tenantId,
                pageId: config.pageId,
                recipientId: contactId,
                text
            });
        case 'twilio':
        case 'whatsapp':
            return adapter.sendMessage({
                to: contactId,
                from: config.fromNumber,
                body: text
            });
        default:
            throw new Error(`No dispatch handler for channel: ${channel}`);
    }
}

async function maybeAutoReply({ tenantId, conversationId, inboundText }) {
    try {
        const aiReplyService = require('./aiReplyService');
        const inboxService = require('./inboxService');

        const { data: config } = await supabase
            .from('ai_configs')
            .select('auto_reply_enabled, menu_config')
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (!config?.auto_reply_enabled) return;

        let replyText = null;
        if (config.menu_config) {
            replyText = aiReplyService.handleMenuFlow(inboundText, config.menu_config);
        }

        if (!replyText) {
            const result = await aiReplyService.generateReply({ tenantId, conversationId, inboundText });
            if (!result) return;
            replyText = result.text;
        }

        await inboxService.sendReply(tenantId, conversationId, {
            text: replyText,
            agentId: null
        });
    } catch (err) {
        console.error('[Legacy AutoReply] Failed:', err.message);
    }
}

module.exports = { dispatch, maybeAutoReply };

