const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
    throw new Error('Missing JWT_SECRET in environment');
}

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

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
