const inboxService = require('./inboxService');

// GET /api/inbox/conversations
async function getConversations(req, res) {
  try {
    const tenantId = req.user.tenant_id;
    const { page = 1, limit = 20, status } = req.query;
    const conversations = await inboxService.listConversations(tenantId, { page: parseInt(page), limit: parseInt(limit), status });
    res.json({ success: true, data: conversations });
  } catch (err) {
    console.error('getConversations error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
}

// GET /api/inbox/conversations/:id/messages
async function getMessages(req, res) {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { before, limit = 30 } = req.query;
    const messages = await inboxService.listMessages(tenantId, id, { before, limit: parseInt(limit) });
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error('getMessages error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
}

// POST /api/inbox/conversations/:id/reply
async function sendReply(req, res) {
  try {
    const tenantId = req.user.tenant_id;
    const agentId = req.user.id;
    const { id } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ success: false, error: 'Reply text is required' });
    const message = await inboxService.sendReply(tenantId, id, { text, agentId });
    res.json({ success: true, data: message });
  } catch (err) {
    console.error('sendReply error:', err);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
}

// PATCH /api/inbox/conversations/:id/status
async function updateStatus(req, res) {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['open', 'resolved', 'pending'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
    const conversation = await inboxService.updateConversationStatus(tenantId, id, status);
    res.json({ success: true, data: conversation });
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
}

// POST /api/inbox/conversations/:id/assign
async function assignAgent(req, res) {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { agentId } = req.body;
    const conversation = await inboxService.assignConversation(tenantId, id, agentId);
    res.json({ success: true, data: conversation });
  } catch (err) {
    console.error('assignAgent error:', err);
    res.status(500).json({ success: false, error: 'Failed to assign agent' });
  }
}

module.exports = { getConversations, getMessages, sendReply, updateStatus, assignAgent };
