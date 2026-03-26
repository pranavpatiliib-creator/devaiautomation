const axios = require('axios');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { getPageToken } = require('./metaOAuthService');
const inboxService = require('./inboxService');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

// ─── Webhook verification (GET /webhooks/meta) ────────────────────────────────
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    console.log('[Meta] Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
}

// ─── Incoming webhook events (POST /webhooks/meta) ───────────────────────────
async function handleWebhook(req, res) {
  // Validate signature
  const sig = req.headers['x-hub-signature-256'];
  if (!validateSignature(req.rawBody || JSON.stringify(req.body), sig)) {
    console.warn('[Meta] Invalid webhook signature');
    return res.sendStatus(403);
  }

  res.sendStatus(200); // Respond immediately to avoid timeout

  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of body.entry || []) {
    const pageId = entry.id;
    const tenantId = await getTenantByPageId(pageId);
    if (!tenantId) { console.warn(`[Meta] No tenant for page ${pageId}`); continue; }

    for (const event of entry.messaging || []) {
      await processMessagingEvent(tenantId, pageId, event);
    }
  }
}

async function processMessagingEvent(tenantId, pageId, event) {
  try {
    if (event.message && !event.message.is_echo) {
      // Inbound message from user
      await inboxService.handleInbound({
        tenantId,
        channel: 'meta',
        contactId: event.sender.id,
        contactName: await getContactName(event.sender.id, pageId, tenantId),
        text: event.message.text || '[attachment]',
        externalMessageId: event.message.mid,
      });
    } else if (event.delivery) {
      // Delivery confirmation — update message status
      await updateDeliveryStatus(event.delivery.mids, 'delivered');
    } else if (event.read) {
      // Read receipt
      await updateDeliveryStatus([], 'read', event.read.watermark);
    }
  } catch (err) {
    console.error('[Meta] processMessagingEvent error:', err.message);
  }
}

// ─── Send a message via Meta Messenger ───────────────────────────────────────
async function sendMessage({ tenantId, pageId, recipientId, text }) {
  const accessToken = await getPageToken(tenantId, pageId);

  const res = await axios.post(
    `https://graph.facebook.com/v19.0/me/messages`,
    {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    },
    { params: { access_token: accessToken } }
  );

  return res.data; // { recipient_id, message_id }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
      params: { fields: 'name', access_token: accessToken },
    });
    return res.data.name || userId;
  } catch {
    return userId;
  }
}

async function updateDeliveryStatus(mids = [], status, watermark = null) {
  if (mids.length > 0) {
    await supabase
      .from('messages')
      .update({ status })
      .in('meta->external_id', mids);
  }
}

module.exports = { verifyWebhook, handleWebhook, sendMessage };
