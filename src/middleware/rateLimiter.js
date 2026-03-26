const rateLimit = require('express-rate-limit');

function createLimiter({ windowMs, max, message }) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message
    });
}

const limiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many requests. Please try again later.'
});

const connectionReadLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: 'Too many connection read requests. Please slow down.'
});

const connectionWriteLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many connection update requests. Please try again shortly.'
});

const oauthStartLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: 'Too many OAuth start attempts. Please wait and retry.'
});

const oauthCallbackLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: 'Too many OAuth callback attempts. Please retry in a few minutes.'
});

module.exports = limiter;
module.exports.connectionReadLimiter = connectionReadLimiter;
module.exports.connectionWriteLimiter = connectionWriteLimiter;
module.exports.oauthStartLimiter = oauthStartLimiter;
module.exports.oauthCallbackLimiter = oauthCallbackLimiter;
