const axios = require('axios');
const crypto = require('crypto');

const supabase = require('../config/supabase');
const { getPageToken } = require('./metaOAuthService');
const inboxService = require('./inboxService');

const META_APP_SECRET = process.env.META_APP_SECRET;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

function verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
}

async function handleWebhook(req, res) {
    const sig = req.headers['x-hub-signature-256'];
    if (!validateSignature(req.rawBody || JSON.stringify(req.body), sig)) {
        return res.sendStatus(403);
    }

    res.sendStatus(200);

    const body = req.body;
    if (body.object !== 'page') return;

    for (const entry of body.entry || []) {
        const pageId = entry.id;
        const tenantId = await getTenantByPageId(pageId);
        if (!tenantId) continue;

        for (const event of entry.messaging || []) {
            await processMessagingEvent(tenantId, pageId, event);
        }
    }
}

async function processMessagingEvent(tenantId, pageId, event) {
    try {
        if (event.message && !event.message.is_echo) {
            await inboxService.handleInbound({
                tenantId,
                channel: 'meta',
                contactId: event.sender.id,
                contactName: await getContactName(event.sender.id, pageId, tenantId),
                text: event.message.text || '[attachment]',
                externalMessageId: event.message.mid
            });
        }
    } catch (err) {
        console.error('[Legacy Meta] processMessagingEvent error:', err.message);
    }
}

async function sendMessage({ tenantId, pageId, recipientId, text }) {
    const accessToken = await getPageToken(tenantId, pageId);

    const res = await axios.post(
        'https://graph.facebook.com/v19.0/me/messages',
        {
            recipient: { id: recipientId },
            message: { text },
            messaging_type: 'RESPONSE'
        },
        { params: { access_token: accessToken } }
    );

    return res.data;
}

function validateSignature(rawBody, sigHeader) {
    if (!sigHeader) return false;
    const expected = 'sha256=' + crypto
        .createHmac('sha256', META_APP_SECRET)
        .update(rawBody)
        .digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
    } catch {
        return false;
    }
}

async function getTenantByPageId(pageId) {
    const { data } = await supabase
        .from('meta_channels')
        .select('tenant_id')
        .eq('page_id', pageId)
        .single();
    return data?.tenant_id || null;
}

async function getContactName(userId, pageId, tenantId) {
    try {
        const accessToken = await getPageToken(tenantId, pageId);
        const res = await axios.get(`https://graph.facebook.com/v19.0/${userId}`, {
            params: { fields: 'name', access_token: accessToken }
        });
        return res.data.name || userId;
    } catch {
        return userId;
    }
}

module.exports = { verifyWebhook, handleWebhook, sendMessage };

