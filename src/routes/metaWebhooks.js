const express = require('express');

const supabase = require('../config/supabase');
const autoReplyService = require('../services/autoReplyService');
const { webhookInboundLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || '';

function safeText(value, maxLength = 2000) {
    return String(value || '').trim().slice(0, maxLength);
}

async function findTenantByPageContext(entryId, recipientId) {
    const pageIds = [entryId, recipientId].filter(Boolean).map((value) => String(value));
    if (!pageIds.length) return null;

    const { data, error } = await supabase
        .from('channel_connections')
        .select('tenant_id,channel,page_id,metadata')
        .in('channel', ['facebook', 'instagram'])
        .or(pageIds.map((value) => `page_id.eq.${value}`).join(','))
        .limit(10);

    if (error && error.code !== 'PGRST205') throw error;
    if (!Array.isArray(data) || !data.length) return null;

    const byDirectPage = data.find((row) => pageIds.includes(String(row.page_id || '')));
    if (byDirectPage) return byDirectPage;

    const byMetadataPage = data.find((row) => pageIds.includes(String(row.metadata?.facebook_page_id || '')));
    return byMetadataPage || null;
}

async function ensureCustomer(tenantId, channel, senderId) {
    const { data: existing, error: existingError } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('channel', channel)
        .eq('sender_id', senderId)
        .maybeSingle();

    if (existingError && existingError.code !== 'PGRST205') throw existingError;
    if (existing?.id) return existing.id;

    const { data: created, error: createError } = await supabase
        .from('customers')
        .insert({
            tenant_id: tenantId,
            channel,
            sender_id: senderId,
            name: null,
            phone: null
        })
        .select('id')
        .single();

    if (createError && createError.code !== 'PGRST205') throw createError;
    return created?.id || null;
}

async function hasIncomingMessage(tenantId, channel, senderId, messageId) {
    if (!messageId) return false;

    const { data, error } = await supabase
        .from('conversations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('channel', channel)
        .eq('sender_id', senderId)
        .eq('direction', 'incoming')
        .eq('message_id', messageId)
        .maybeSingle();

    if (error && error.code !== 'PGRST205') throw error;
    return Boolean(data?.id);
}

async function storeIncomingMessage({ tenantId, channel, senderId, text, messageId }) {
    const customerId = await ensureCustomer(tenantId, channel, senderId);
    const alreadyExists = await hasIncomingMessage(tenantId, channel, senderId, messageId);
    if (alreadyExists) return { duplicate: true, conversationId: null, customerId };

    const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
            tenant_id: tenantId,
            customer_id: customerId,
            channel,
            sender_id: senderId,
            message: text,
            direction: 'incoming',
            intent: 'incoming',
            state: 'incoming',
            message_id: messageId || null
        })
        .select('id')
        .single();

    if (convError && convError.code !== 'PGRST205') throw convError;

    await autoReplyService.enqueueAutoReplyJob({
        tenantId,
        customerId,
        channel,
        senderId,
        incomingMessageId: messageId || null,
        incomingMessage: text,
        incomingConversationId: conversation?.id || null
    });

    return { duplicate: false, conversationId: conversation?.id || null, customerId };
}

router.get('/meta', webhookInboundLimiter, (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token && token === META_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }

    return res.status(403).send('Verification failed');
});

router.post('/meta', webhookInboundLimiter, async (req, res) => {
    try {
        const payload = req.body || {};
        const entries = Array.isArray(payload.entry) ? payload.entry : [];

        for (const entry of entries) {
            const entryId = safeText(entry?.id, 128);
            const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];

            for (const event of messaging) {
                const senderId = safeText(event?.sender?.id, 128);
                const recipientId = safeText(event?.recipient?.id, 128);
                const messageText = safeText(event?.message?.text, 2000);
                const messageId = safeText(event?.message?.mid, 190);

                if (!senderId || !messageText) {
                    continue;
                }

                // Skip echoes (outgoing messages reflected by Meta).
                if (event?.message?.is_echo === true) {
                    continue;
                }

                const connection = await findTenantByPageContext(entryId, recipientId);
                if (!connection?.tenant_id) {
                    continue;
                }

                const channel = connection.channel === 'instagram' ? 'instagram' : 'facebook';
                await storeIncomingMessage({
                    tenantId: connection.tenant_id,
                    channel,
                    senderId,
                    text: messageText,
                    messageId
                });
            }
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('Meta webhook processing failed:', error);
        // Return 200 to avoid aggressive retry storms on temporary parsing/storage errors.
        return res.status(200).json({ received: true });
    }
});

module.exports = router;

