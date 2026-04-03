const { WebSocketServer } = require('ws');
const url = require('url');

const supabasePublic = require('../config/supabasePublic');
const { findTenantByUserId } = require('../services/tenantService');

let wss = null;

// Map of tenantId -> Set of WebSocket clients
const tenantClients = new Map();

function init(server) {
    wss = new WebSocketServer({ noServer: true });

    // Upgrade HTTP -> WebSocket with Supabase Auth token verification.
    server.on('upgrade', (request, socket, head) => {
        (async () => {
            const { query } = url.parse(request.url, true);
            const queryToken = query?.token;

            const cookieHeader = String(request.headers.cookie || '');
            const cookieToken = cookieHeader
                .split(';')
                .map((part) => part.trim())
                .find((part) => part.startsWith('auth_token='))
                ?.slice('auth_token='.length);

            const token = queryToken || (cookieToken ? decodeURIComponent(cookieToken) : '');
            if (!token) return null;

            const { data, error } = await supabasePublic.auth.getUser(token);
            if (error || !data?.user?.id) return null;

            const tenant = await findTenantByUserId(data.user.id);
            if (!tenant?.id) return null;

            return { userId: data.user.id, tenantId: tenant.id };
        })()
            .then((auth) => {
                if (!auth) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }

                wss.handleUpgrade(request, socket, head, (ws) => {
                    ws.tenantId = auth.tenantId;
                    ws.userId = auth.userId;
                    wss.emit('connection', ws, request);
                });
            })
            .catch(() => {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
            });
    });

    wss.on('connection', (ws) => {
        const { tenantId } = ws;

        if (!tenantClients.has(tenantId)) tenantClients.set(tenantId, new Set());
        tenantClients.get(tenantId).add(ws);

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw);
                handleClientMessage(ws, msg);
            } catch {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
            }
        });

        ws.on('close', () => {
            if (tenantClients.has(tenantId)) {
                tenantClients.get(tenantId).delete(ws);
                if (tenantClients.get(tenantId).size === 0) tenantClients.delete(tenantId);
            }
        });

        ws.send(JSON.stringify({ type: 'connected', tenantId }));
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => clearInterval(interval));

    return wss;
}

function handleClientMessage(ws, msg) {
    switch (msg.type) {
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        case 'typing':
            broadcast(ws.tenantId, {
                type: 'typing',
                conversationId: msg.conversationId,
                agentId: ws.userId
            }, ws);
            break;
        default:
            break;
    }
}

function broadcast(tenantId, payload, excludeWs = null) {
    const clients = tenantClients.get(tenantId);
    if (!clients || clients.size === 0) return;

    const data = JSON.stringify(payload);
    clients.forEach((ws) => {
        if (ws === excludeWs) return;
        if (ws.readyState === 1) ws.send(data);
    });
}

function sendToUser(tenantId, userId, payload) {
    const clients = tenantClients.get(tenantId);
    if (!clients) return;
    const data = JSON.stringify(payload);
    clients.forEach((ws) => {
        if (ws.userId === userId && ws.readyState === 1) ws.send(data);
    });
}

function getConnectedCount(tenantId) {
    return tenantClients.get(tenantId)?.size || 0;
}

module.exports = { init, broadcast, sendToUser, getConnectedCount };

