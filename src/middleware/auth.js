const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
    throw new Error('Missing JWT_SECRET in environment');
}

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

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
}

module.exports = { verifyToken, SECRET };
