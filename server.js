const dns = require('dns');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Prefer IPv4 to avoid intermittent IPv6/NAT64 timeouts (common on some networks/ISPs).
// Must run before any outbound fetch (e.g., Supabase/Meta/OpenAI).
if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

// Best-effort default timeout for outbound fetch (Supabase/Meta/OpenAI).
// Only applies when callers don't pass their own AbortSignal.
try {
    const originalFetch = global.fetch;
    const timeoutMs = Number(process.env.FETCH_TIMEOUT_MS) || 30000;
    if (typeof originalFetch === 'function' && typeof AbortSignal?.timeout === 'function' && timeoutMs > 0) {
        global.fetch = (input, init = {}) => {
            if (init && init.signal) return originalFetch(input, init);
            return originalFetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
        };
    }
} catch (_) { }

const supabase = require('./src/config/supabase');

const app = express();

function formatSupabaseStartupError(error) {
    const parts = [];
    const message = error?.message || 'Unknown Supabase error';
    parts.push(message);

    if (error?.details) {
        parts.push(error.details);
    }

    const cause = error?.cause;
    if (cause?.code) {
        parts.push(`Cause: ${cause.code}`);
    }

    if (Array.isArray(cause?.errors) && cause.errors.length > 0) {
        const endpoints = cause.errors
            .map((item) => {
                if (!item?.address || !item?.port) return null;
                return `${item.address}:${item.port}${item.code ? ` (${item.code})` : ''}`;
            })
            .filter(Boolean);

        if (endpoints.length > 0) {
            parts.push(`Endpoints: ${endpoints.join(', ')}`);
        }
    }

    if (cause?.code === 'EACCES') {
        parts.push('Outbound HTTPS access appears blocked by the local environment, firewall, proxy, or sandbox.');
    }

    return parts.join('\n');
}

function resolveTrustProxySetting(value) {
    if (value === undefined || value === null || value === '') {
        return 1;
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;

    const asNumber = Number(normalized);
    if (Number.isFinite(asNumber)) {
        return asNumber;
    }

    return value;
}

app.set('trust proxy', resolveTrustProxySetting(process.env.TRUST_PROXY));

// ================= MIDDLEWARE =================
// Compress text-based responses (HTML/JSON/CSS/JS) to reduce transfer time.
app.use(compression());

const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true); // same-origin / curl / server-to-server
        if (allowedOrigins.length === 0) return callback(null, true);
        return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Serve static files BEFORE routes - critical for CSS/JS loading
app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
        const lower = String(filePath).toLowerCase();
        // Conservative caching: improves repeat loads without risking "stuck" deployments.
        if (/\.(css|js)$/.test(lower)) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
        } else if (/\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf)$/.test(lower)) {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
        }
    }
}));

// ================= ROUTES =================
const authRoutes = require('./src/routes/auth');
const leadsRoutes = require('./src/routes/leads');
const publicRoutes = require('./src/routes/public');
const saasRoutes = require('./src/routes/saas');
const metaAuthRoutes = require('./src/routes/metaAuth');
const metaWebhookRoutes = require('./src/routes/metaWebhooks');
const whatsappWebhookRoutes = require('./src/routes/whatsappWebhooks');
const postsRoutes = require('./src/routes/posts');
const autoReplyRoutes = require('./src/routes/autoReply');
const { startBackgroundRunner } = require('./src/workers/backgroundRunner');
// Register routes
app.use('/api', authRoutes);
app.use('/api', publicRoutes);
app.use('/api', leadsRoutes);
app.use('/api', saasRoutes);
app.use('/api', metaAuthRoutes);
app.use('/api', postsRoutes);
app.use('/api', autoReplyRoutes);
app.use('/webhooks', metaWebhookRoutes);
app.use('/webhooks', whatsappWebhookRoutes);

// ================= SERVE VIEWS =================
// Page routes (must be after API routes to avoid conflicts)
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.get('/login', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.get('/signup', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'views/signup.html'));
});

app.get('/dashboard', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'views/dashboard.html'));
});

app.get('/forgot-password', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'views/forgot-password.html'));
});

app.get('/reset', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'views/reset.html'));
});

app.get('/form', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'views/form.html'));
});

app.get('/privacy', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'views/privacy.html'));
});

// ================= 404 HANDLER =================
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
    if (err?.type === 'request.aborted' || err?.code === 'ECONNABORTED') {
        const sizeInfo = err?.expected ? ` (${err.received || 0}/${err.expected} bytes received)` : '';
        console.warn(`Request aborted by client: ${req.method} ${req.originalUrl}${sizeInfo}`);
        if (!res.headersSent) {
            return res.status(499).json({ error: 'Request aborted by client' });
        }
        return;
    }

    if (err?.type === 'entity.too.large' || err?.status === 413) {
        if (!res.headersSent) {
            return res.status(413).json({ error: 'Request payload too large' });
        }
        return;
    }

    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});


// ================= SERVER START =================
async function logSupabaseConnectionStatus() {
    if (process.env.SUPABASE_SKIP_CONNECTION_CHECK === 'true') {
        console.log('Skipping Supabase connection check');
        return;
    }

    try {
        const { error, status, statusText } = await supabase
            .from('users')
            .select('id')
            .limit(1);

        if (error) {
            const code = error.code ? ` (${error.code})` : '';
            const message = error.message || 'Unknown Supabase error';
            console.error(`Supabase connection check failed${code}: ${message}`);
            if (status || statusText) {
                console.error(`Supabase HTTP status: ${status || ''} ${statusText || ''}`.trim());
            }
            return;
        }

        console.log('Supabase connected successfully');
    } catch (error) {
        console.error(`Supabase connection check failed:\n${formatSupabaseStartupError(error)}`);
    }
}

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log('Server running on port ' + PORT);
        console.log('API: http://localhost:' + PORT);
        console.log('Frontend: http://localhost:' + PORT + '/');
        logSupabaseConnectionStatus();
        // Default to a less aggressive poll to avoid unnecessary DB load on small instances.
        startBackgroundRunner({ intervalMs: Number(process.env.BACKGROUND_INTERVAL_MS) || 30000 });
    });
}

module.exports = app;
