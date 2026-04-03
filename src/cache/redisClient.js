const { createClient } = require('redis');

let clientPromise = null;

function isRedisEnabled() {
    const raw = process.env.REDIS_CACHE_ENABLED;
    if (raw === undefined || raw === null || raw === '') return false;
    return String(raw).trim().toLowerCase() === 'true';
}

async function getRedisClient() {
    if (!isRedisEnabled()) return null;

    if (!clientPromise) {
        clientPromise = (async () => {
            const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
            const client = createClient({ url });

            client.on('error', (err) => {
                console.warn('Redis client error:', err?.message || err);
            });

            await client.connect();
            console.log('Redis cache connected');
            return client;
        })().catch((err) => {
            console.warn('Redis cache disabled (connection failed):', err?.message || err);
            clientPromise = null;
            return null;
        });
    }

    return clientPromise;
}

module.exports = {
    getRedisClient
};

