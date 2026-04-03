const express = require('express');
const router = express.Router();

const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const { cacheGet, bustOnWrite } = require('../middleware/redisCache');
const rateLimiter = require('../middleware/rateLimiter');
const { asBoolean, asInt, asTrimmedString, requireFields } = require('../utils/validation');
const autoReplyService = require('../services/autoReplyService');

router.use(verifyToken, requireTenant);
router.use(bustOnWrite());
router.use(cacheGet({ prefix: 'cache:http:autoReply:v1' }));

function isMissingTableError(error) {
    return error?.code === 'PGRST205';
}
// Get current auto-reply settings (protected)
router.get('/auto-reply/settings', async (req, res) => {
    try {
        const settings = await autoReplyService.getSettings(req.tenantId);
        return res.json(settings);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'auto_reply_settings table is missing. Run schema migration.' });
        }
        console.error('Load auto-reply settings error:', error);
        return res.status(500).json({ error: 'Failed to load auto-reply settings' });
    }
});
// Update settings endpoint (protected)
router.put('/auto-reply/settings', rateLimiter, async (req, res) => {
    try {
        const enabled = asBoolean(req.body.enabled, true);
        const aiEnabled = asBoolean(req.body.ai_enabled ?? req.body.aiEnabled, false);
        const delaySeconds = asInt(req.body.delay_seconds ?? req.body.delaySeconds, 0, { min: 0, max: 3600 });

        await autoReplyService.upsertSettings(req.tenantId, {
            enabled,
            ai_enabled: aiEnabled,
            delay_seconds: delaySeconds
        });
        return res.json({ success: true });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'auto_reply_settings table is missing. Run schema migration.' });
        }
        console.error('Update auto-reply settings error:', error);
        return res.status(500).json({ error: 'Failed to update auto-reply settings' });
    }
});

// Internal ingestion endpoint (protected) for testing or platform adapters.
// Expects: { channel, sender_id, message, message_id (optional) }
router.post('/auto-reply/incoming', rateLimiter, async (req, res) => {
    try {
        const missing = requireFields(req.body, ['channel', 'sender_id', 'message']);
        if (missing.length) {
            return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
        }

        const channel = asTrimmedString(req.body.channel, 30).toLowerCase();
        const senderId = asTrimmedString(req.body.sender_id ?? req.body.senderId, 120);
        const messageId = asTrimmedString(req.body.message_id ?? req.body.messageId, 120) || null;
        const message = asTrimmedString(req.body.message, 2000);

        if (!message) return res.status(400).json({ error: 'Message cannot be empty' });

        // Idempotency guard: avoid duplicates on repeated webhook deliveries.
        if (messageId) {
            const { data: existing, error: existingError } = await supabase
                .from('conversations')
                .select('id')
                .eq('tenant_id', req.tenantId)
                .eq('direction', 'incoming')
                .eq('channel', channel)
                .eq('sender_id', senderId)
                .eq('message_id', messageId)
                .maybeSingle();

            if (existingError && !isMissingTableError(existingError)) throw existingError;
            if (existing?.id) {
                return res.json({ success: true, duplicate: true, conversation_id: existing.id });
            }
        }

// Ensure customer exists (dedupe by tenant/channel/sender_id)
        let customerId = null;
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('id')
            .eq('tenant_id', req.tenantId)
            .eq('channel', channel)
            .eq('sender_id', senderId)
            .maybeSingle();

        if (customerError && !isMissingTableError(customerError)) throw customerError;
        if (customer?.id) {
            customerId = customer.id;
        } else {
            const { data: created, error: createError } = await supabase
                .from('customers')
                .insert({
                    tenant_id: req.tenantId,
                    channel,
                    sender_id: senderId,
                    name: null,
                    phone: null
                })
                .select('id')
                .single();
            if (createError && !isMissingTableError(createError)) throw createError;
            customerId = created?.id || null;
        }

        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                tenant_id: req.tenantId,
                customer_id: customerId,
                channel,
                sender_id: senderId,
                message,
                direction: 'incoming',
                intent: 'incoming',
                state: 'incoming',
                message_id: messageId
            })
            .select('id')
            .single();

        if (convError && !isMissingTableError(convError)) throw convError;

        const enqueueResult = await autoReplyService.enqueueAutoReplyJob({
            tenantId: req.tenantId,
            customerId,
            channel,
            senderId,
            incomingMessageId: messageId,
            incomingMessage: message,
            incomingConversationId: conversation?.id || null
        });

        return res.json({ success: true, conversation_id: conversation?.id || null, ...enqueueResult });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'Required tables are missing. Run schema migration.' });
        }
        console.error('Incoming message processing error:', error);
        return res.status(500).json({ error: 'Failed to process incoming message' });
    }
});
// List auto-reply jobs for tenant (protected)
router.get('/auto-reply/jobs', async (req, res) => {
    try {
        const limit = asInt(req.query.limit, 50, { min: 1, max: 200 });
        const { data, error } = await supabase
            .from('auto_reply_jobs')
            .select('*')
            .eq('tenant_id', req.tenantId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return res.json(data || []);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'auto_reply_jobs table is missing. Run schema migration.' });
        }
        console.error('Load auto-reply jobs error:', error);
        return res.status(500).json({ error: 'Failed to load auto-reply jobs' });
    }
});

module.exports = router;
