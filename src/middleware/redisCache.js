const crypto = require('crypto');
const { getRedisClient } = require('../cache/redisClient');

function toPositiveInt(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    if (num <= 0) return fallback;
    return Math.floor(num);
}

function stableStringifyQuery(query) {
    if (!query || typeof query !== 'object') return '';
    const keys = Object.keys(query).sort();
    const parts = [];
    for (const key of keys) {
        const value = query[key];
        if (value === undefined) continue;
        if (Array.isArray(value)) {
            parts.push(`${key}=${value.map((v) => String(v)).sort().join(',')}`);
        } else {
            parts.push(`${key}=${String(value)}`);
        }
    }
    return parts.join('&');
}

function hashKey(input) {
    return crypto.createHash('sha256').update(String(input)).digest('hex').slice(0, 32);
}

const tenantVersionCache = new Map(); // tenantId -> { v, expiresAt }
async function getTenantCacheVersion(redis, tenantId) {
    const now = Date.now();
    const cached = tenantVersionCache.get(tenantId);
    if (cached && cached.expiresAt > now) return cached.v;

    const key = `cache:tenant:${tenantId}:v`;
    const raw = await redis.get(key);
    const v = raw ? Number(raw) : 0;
    const normalized = Number.isFinite(v) ? v : 0;
    tenantVersionCache.set(tenantId, { v: normalized, expiresAt: now + 5000 });
    return normalized;
}

async function bumpTenantCacheVersion(tenantId) {
    const redis = await getRedisClient();
    if (!redis) return false;
    const key = `cache:tenant:${tenantId}:v`;
    try {
        const next = await redis.incr(key);
        tenantVersionCache.set(tenantId, { v: Number(next) || 0, expiresAt: Date.now() + 5000 });
        return true;
    } catch (err) {
        console.warn('Failed to bump tenant cache version:', err?.message || err);
        return false;
    }
}

function cacheGet(options = {}) {
    const ttlSeconds = toPositiveInt(options.ttlSeconds, toPositiveInt(process.env.REDIS_CACHE_TTL_SECONDS, 30));
    const prefix = String(options.prefix || 'cache:http:v1');

    return async (req, res, next) => {
        if (req.method !== 'GET') return next();

        const redis = await getRedisClient();
        if (!redis) {
            res.setHeader('X-Cache', 'BYPASS');
            return next();
        }

        // Allow explicit bypass for debugging.
        const bypass = String(req.headers['x-cache-bypass'] || '').trim().toLowerCase();
        if (bypass === 'true' || bypass === '1' || bypass === 'yes') {
            res.setHeader('X-Cache', 'BYPASS');
            return next();
        }

        const tenantId = req.tenantId || req.tenant?.id || null;
        if (!tenantId) {
            res.setHeader('X-Cache', 'BYPASS');
            return next();
        }

        try {
            const v = await getTenantCacheVersion(redis, tenantId);
            const q = stableStringifyQuery(req.query);
            const rawKey = `${prefix}:t=${tenantId}:v=${v}:p=${req.path}:q=${q}`;
            const cacheKey = `${prefix}:k:${hashKey(rawKey)}`;

            const cached = await redis.get(cacheKey);
            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.status(200).send(cached);
            }

            res.setHeader('X-Cache', 'MISS');

            const originalJson = res.json.bind(res);
            res.json = async (body) => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const payload = JSON.stringify(body ?? null);
                        await redis.set(cacheKey, payload, { EX: ttlSeconds });
                    }
                } catch (err) {
                    console.warn('Redis cache set failed:', err?.message || err);
                }
                return originalJson(body);
            };

            return next();
        } catch (err) {
            console.warn('Redis cache error:', err?.message || err);
            res.setHeader('X-Cache', 'BYPASS');
            return next();
        }
    };
}

function bustOnWrite() {
    return (req, res, next) => {
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
            return next();
        }

        const tenantId = req.tenantId || req.tenant?.id || null;
        if (!tenantId) return next();

        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                bumpTenantCacheVersion(tenantId);
            }
        });

        return next();
    };
}

module.exports = {
    cacheGet,
    bustOnWrite,
    bumpTenantCacheVersion
};

