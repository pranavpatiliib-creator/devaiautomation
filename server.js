const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// Serve static files BEFORE routes - critical for CSS/JS loading
app.use(express.static(path.join(__dirname, 'public')));

// ================= ROUTES =================
const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const publicRoutes = require('./routes/public');

// Register routes
app.use('/api', authRoutes);
app.use('/api', leadsRoutes);
app.use('/api', publicRoutes);

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
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ API: http://localhost:${PORT}`);
    console.log(`✓ Frontend: http://localhost:${PORT}/`);

});
