const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');

let wss = null;

// Map of tenantId -> Set of WebSocket clients
const tenantClients = new Map();

function init(server) {
  wss = new WebSocketServer({ noServer: true });

  // Upgrade HTTP -> WebSocket with JWT auth
  server.on('upgrade', (request, socket, head) => {
    const { query } = url.parse(request.url, true);
    const token = query.token;

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.tenantId = decoded.tenant_id;
      ws.userId = decoded.id;
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    const { tenantId } = ws;

    // Register client under tenant
    if (!tenantClients.has(tenantId)) tenantClients.set(tenantId, new Set());
    tenantClients.get(tenantId).add(ws);

    console.log(`[WS] Client connected — tenant: ${tenantId}, total: ${tenantClients.get(tenantId).size}`);

    // Heartbeat ping/pong
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
      console.log(`[WS] Client disconnected — tenant: ${tenantId}`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for tenant ${tenantId}:`, err.message);
    });

    // Confirm connection
    ws.send(JSON.stringify({ type: 'connected', tenantId }));
  });

  // Heartbeat interval — prune dead connections every 30s
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  console.log('[WS] WebSocket server initialized');
  return wss;
}

// Handle messages from clients (e.g. typing indicators)
function handleClientMessage(ws, msg) {
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    case 'typing':
      // Broadcast typing indicator to all other clients in same tenant
      broadcast(ws.tenantId, {
        type: 'typing',
        conversationId: msg.conversationId,
        agentId: ws.userId,
      }, ws); // exclude sender
      break;
    default:
      break;
  }
}

// Broadcast an event to all connected clients of a tenant
function broadcast(tenantId, payload, excludeWs = null) {
  const clients = tenantClients.get(tenantId);
  if (!clients || clients.size === 0) return;

  const data = JSON.stringify(payload);
  clients.forEach((ws) => {
    if (ws === excludeWs) return;
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(data);
    }
  });
}

// Send to a specific agent/user within a tenant
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
