const rateLimit = require('express-rate-limit');
const ipKeyGenerator = typeof rateLimit.ipKeyGenerator === 'function' ? rateLimit.ipKeyGenerator : null;

function createLimiter({ windowMs, max, message }) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message
    });
}

function createEmailLimiter({ windowMs, max, message }) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message,
        keyGenerator(req) {
            const ip = ipKeyGenerator ? ipKeyGenerator(req) : (req.ip || 'unknown');
            const email = String(req.body?.email || '').trim().toLowerCase();
            // Combine IP + email to prevent both targeted and spray abuse.
            return `${ip}:${email || 'no-email'}`;
        }
    });
}

const limiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many requests. Please try again later.'
});

const apiLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.API_RATE_LIMIT_MAX) || 300,
    message: 'Too many requests. Please slow down and try again.'
});

const authEmailLimiter = createEmailLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many email requests. Please wait before trying again.'
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

const webhookInboundLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 600,
    message: 'Too many webhook requests. Please retry later.'
});

module.exports = limiter;
module.exports.apiLimiter = apiLimiter;
module.exports.authEmailLimiter = authEmailLimiter;
module.exports.connectionReadLimiter = connectionReadLimiter;
module.exports.connectionWriteLimiter = connectionWriteLimiter;
module.exports.oauthStartLimiter = oauthStartLimiter;
module.exports.oauthCallbackLimiter = oauthCallbackLimiter;
module.exports.webhookInboundLimiter = webhookInboundLimiter;
