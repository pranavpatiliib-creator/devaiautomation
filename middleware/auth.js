const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'mysecretkey';

function verifyToken(req, res, next) {
    const token = req.headers.authorization;

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
