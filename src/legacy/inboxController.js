const inboxService = require('./inboxService');

function resolveTenantId(req) {
    return req.tenantId || req.tenant?.id || req.user?.tenant_id || null;
}

async function getConversations(req, res) {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { page = 1, limit = 20, status } = req.query;
        const conversations = await inboxService.listConversations(tenantId, {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            status
        });
        res.json({ success: true, data: conversations });
    } catch (err) {
        console.error('getConversations error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
    }
}

async function getMessages(req, res) {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { id } = req.params;
        const { before, limit = 30 } = req.query;
        const messages = await inboxService.listMessages(tenantId, id, { before, limit: parseInt(limit, 10) });
        res.json({ success: true, data: messages });
    } catch (err) {
        console.error('getMessages error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
}

async function sendReply(req, res) {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { id } = req.params;
        const { text } = req.body || {};
        if (!text) return res.status(400).json({ success: false, error: 'Missing text' });

        const message = await inboxService.sendReply(tenantId, id, { text, agentId: req.user?.id || null });
        res.json({ success: true, data: message });
    } catch (err) {
        console.error('sendReply error:', err);
        res.status(500).json({ success: false, error: 'Failed to send reply' });
    }
}

async function updateStatus(req, res) {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { id } = req.params;
        const { status } = req.body || {};
        if (!status) return res.status(400).json({ success: false, error: 'Missing status' });

        const conversation = await inboxService.updateConversationStatus(tenantId, id, status);
        res.json({ success: true, data: conversation });
    } catch (err) {
        console.error('updateStatus error:', err);
        res.status(500).json({ success: false, error: 'Failed to update status' });
    }
}

async function assign(req, res) {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { id } = req.params;
        const { agentId } = req.body || {};
        if (!agentId) return res.status(400).json({ success: false, error: 'Missing agentId' });

        const conversation = await inboxService.assignConversation(tenantId, id, agentId);
        res.json({ success: true, data: conversation });
    } catch (err) {
        console.error('assign error:', err);
        res.status(500).json({ success: false, error: 'Failed to assign conversation' });
    }
}

module.exports = {
    getConversations,
    getMessages,
    sendReply,
    updateStatus,
    assign
};

