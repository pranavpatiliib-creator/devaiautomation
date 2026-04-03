const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error) {
    const code = error?.cause?.code || error?.code;
    if (code && ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED'].includes(code)) {
        return true;
    }
    const message = String(error?.message || '');
    return /fetch failed/i.test(message);
}

function createRetryingFetch(baseFetch, {
    retries = Number(process.env.SUPABASE_FETCH_RETRIES) || 2,
    minDelayMs = Number(process.env.SUPABASE_FETCH_RETRY_MIN_MS) || 200,
    maxDelayMs = Number(process.env.SUPABASE_FETCH_RETRY_MAX_MS) || 2000
} = {}) {
    if (typeof baseFetch !== 'function') {
        return baseFetch;
    }

    return async (input, init = {}) => {
        let attempt = 0;
        let lastError = null;

        while (attempt <= retries) {
            try {
                return await baseFetch(input, init);
            } catch (error) {
                lastError = error;
                if (attempt >= retries || !isRetryableFetchError(error)) {
                    throw error;
                }
                const backoff = Math.min(maxDelayMs, minDelayMs * Math.pow(2, attempt));
                const jitter = Math.floor(backoff * 0.3 * Math.random());
                await sleep(backoff + jitter);
                attempt += 1;
            }
        }

        throw lastError;
    };
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        global: {
            fetch: createRetryingFetch(global.fetch)
        }
    }
);

module.exports = supabase;
