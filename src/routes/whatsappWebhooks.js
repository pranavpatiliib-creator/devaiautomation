const express = require('express');

const supabase = require('../config/supabase');
const autoReplyService = require('../services/autoReplyService');
const { webhookInboundLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || '';

function safeText(value, maxLength = 2000) {
    return String(value || '').trim().slice(0, maxLength);
}

async function findTenantByPhoneNumberId(phoneNumberId) {
    const id = safeText(phoneNumberId, 128);
    if (!id) return null;

    const { data, error } = await supabase
        .from('channel_connections')
        .select('tenant_id,channel,page_id,metadata')
        .eq('channel', 'whatsapp')
        .or([`page_id.eq.${id}`, `metadata->>phone_number_id.eq.${id}`].join(','))
        .limit(10);

    if (error && error.code !== 'PGRST205') throw error;
    if (!Array.isArray(data) || !data.length) return null;

    const direct = data.find((row) => String(row.page_id || '') === id);
    if (direct) return direct;

    const byMeta = data.find((row) => String(row.metadata?.phone_number_id || '') === id);
    return byMeta || null;
}

async function ensureCustomer(tenantId, senderId) {
    const { data: existing, error: existingError } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('channel', 'whatsapp')
        .eq('sender_id', senderId)
        .maybeSingle();

    if (existingError && existingError.code !== 'PGRST205') throw existingError;
    if (existing?.id) return existing.id;

    const { data: created, error: createError } = await supabase
        .from('customers')
        .insert({
            tenant_id: tenantId,
            channel: 'whatsapp',
            sender_id: senderId,
            name: null,
            phone: senderId
        })
        .select('id')
        .single();

    if (createError && createError.code !== 'PGRST205') throw createError;
    return created?.id || null;
}

async function hasIncomingMessage(tenantId, senderId, messageId) {
    if (!messageId) return false;

    const { data, error } = await supabase
        .from('conversations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('channel', 'whatsapp')
        .eq('sender_id', senderId)
        .eq('direction', 'incoming')
        .eq('message_id', messageId)
        .maybeSingle();

    if (error && error.code !== 'PGRST205') throw error;
    return Boolean(data?.id);
}

router.get('/whatsapp', webhookInboundLimiter, (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token && token === WHATSAPP_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }

    return res.status(403).send('Verification failed');
});

router.post('/whatsapp', webhookInboundLimiter, async (req, res) => {
    try {
        const payload = req.body || {};
        const entries = Array.isArray(payload.entry) ? payload.entry : [];

        for (const entry of entries) {
            const changes = Array.isArray(entry?.changes) ? entry.changes : [];
            for (const change of changes) {
                const value = change?.value || {};
                const phoneNumberId = safeText(value?.metadata?.phone_number_id, 128);
                const messages = Array.isArray(value?.messages) ? value.messages : [];

                if (!phoneNumberId || !messages.length) continue;

                const connection = await findTenantByPhoneNumberId(phoneNumberId);
                if (!connection?.tenant_id) continue;

                for (const message of messages) {
                    const senderId = safeText(message?.from, 128); // wa_id (phone number)
                    const messageId = safeText(message?.id, 190);
                    const messageText = safeText(message?.text?.body, 2000);

                    if (!senderId || !messageText) continue;

                    const duplicate = await hasIncomingMessage(connection.tenant_id, senderId, messageId);
                    if (duplicate) continue;

                    const customerId = await ensureCustomer(connection.tenant_id, senderId);
                    const { data: conversation, error: convError } = await supabase
                        .from('conversations')
                        .insert({
                            tenant_id: connection.tenant_id,
                            customer_id: customerId,
                            channel: 'whatsapp',
                            sender_id: senderId,
                            message: messageText,
                            direction: 'incoming',
                            intent: 'incoming',
                            state: 'incoming',
                            message_id: messageId || null
                        })
                        .select('id')
                        .single();

                    if (convError && convError.code !== 'PGRST205') throw convError;

                    await autoReplyService.enqueueAutoReplyJob({
                        tenantId: connection.tenant_id,
                        customerId,
                        channel: 'whatsapp',
                        senderId,
                        incomingMessageId: messageId || null,
                        incomingMessage: messageText,
                        incomingConversationId: conversation?.id || null
                    });
                }
            }
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('WhatsApp webhook processing failed:', error);
        return res.status(200).json({ received: true });
    }
});

module.exports = router;

