const express = require('express');
const router = express.Router();
const { replyToMessage, getConversations, getMessages, getAuthUrl, handleAuthCallback, getConnectionStatus } = require('../controllers/inboxController');

/**
 * GET /api/inbox/auth/meta
 * Generate Meta OAuth URL and redirect
 */
router.get('/auth/meta', getAuthUrl);

/**
 * GET /api/inbox/auth/meta/callback
 * Handle Meta OAuth redirect with ?code=
 */
router.get('/auth/meta/callback', handleAuthCallback);

// Middleware to verify SaaS user JWT could be added here
const { verifyToken } = require('../middleware/auth');
router.use(verifyToken);

/**
 * GET /api/inbox
 * Returns all user conversations sorted by last message time
 */
router.get('/', getConversations);

/**
 * GET /api/inbox/connections
 * Returns connected platform status for the logged-in user
 */
router.get('/connections', getConnectionStatus);

/**
 * POST /api/inbox/reply
 * Send a reply to a conversation. Body needs conversationId and message text.
 */
router.post('/reply', replyToMessage);

/**
 * GET /api/inbox/:conversationId/messages
 * Fetch all messages for a particular conversation
 */
router.get('/:conversationId/messages', getMessages);

module.exports = router;
