const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const supabase = require('./src/config/supabase');

const app = express();

// ================= MIDDLEWARE =================
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
app.use(express.static(path.join(__dirname, 'public')));

// ================= ROUTES =================
const authRoutes = require('./src/routes/auth');
const leadsRoutes = require('./src/routes/leads');
const publicRoutes = require('./src/routes/public');
const saasRoutes = require('./src/routes/saas');
const metaAuthRoutes = require('./src/routes/metaAuth');
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

// ================= 404 HANDLER =================
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});


// ================= SERVER START =================
async function logSupabaseConnectionStatus() {
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
        console.error('Supabase connection check failed:', error.message);
    }
}

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log('Server running on port ' + PORT);
        console.log('API: http://localhost:' + PORT);
        console.log('Frontend: http://localhost:' + PORT + '/');
        logSupabaseConnectionStatus();
        startBackgroundRunner({ intervalMs: Number(process.env.BACKGROUND_INTERVAL_MS) || 5000 });
    });
}

module.exports = app;
