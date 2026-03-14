const express = require('express');
const router = express.Router();
const { verifyWebhook } = require('../utils/webhookVerifier');
const { handleWebhookEvent } = require('../controllers/inboxController');

/**
 * GET /api/webhooks/meta
 * Webhook verification for Meta APIs (FB, IG, WA)
 */
router.get('/meta', verifyWebhook);

/**
 * POST /api/webhooks/meta
 * Process incoming messages and status events
 */
router.post('/meta', handleWebhookEvent);

module.exports = router;
