const supabasePublic = require('../config/supabasePublic');

// Optional shared secret for internal JWT usage (e.g., short-lived OAuth state tokens).
const SECRET = process.env.JWT_SECRET;

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const cookieHeader = req.headers.cookie || '';
    const cookieToken = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('auth_token='))
        ?.slice('auth_token='.length);

    const normalizedCookieToken = cookieToken ? decodeURIComponent(cookieToken) : '';

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : (authHeader || normalizedCookieToken || '');

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token.' });
    }

    supabasePublic.auth.getUser(token)
        .then(({ data, error }) => {
            if (error || !data?.user) {
                return res.status(401).json({ error: 'Invalid token' });
            }

            req.user = {
                id: data.user.id,
                email: data.user.email || null
            };
            next();
        })
        .catch((err) => {
            console.warn('Supabase token verification failed:', err?.message || err);
            res.status(401).json({ error: 'Invalid token' });
        });
}

module.exports = { verifyToken };
module.exports.SECRET = SECRET;
