const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error) {
    const code = error?.cause?.code || error?.code;
    if (code && ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) {
        return true;
    }
    const message = String(error?.message || '');
    return /fetch failed/i.test(message) || /timeout/i.test(message);
}

function createRetryingFetch(baseFetch, {
    retries = Number(process.env.SUPABASE_AUTH_FETCH_RETRIES) || 2,
    minDelayMs = Number(process.env.SUPABASE_AUTH_FETCH_RETRY_MIN_MS) || 200,
    maxDelayMs = Number(process.env.SUPABASE_AUTH_FETCH_RETRY_MAX_MS) || 2000
} = {}) {
    if (typeof baseFetch !== 'function') {
        return baseFetch;
    }

    const timeoutMs = Number(process.env.SUPABASE_AUTH_FETCH_TIMEOUT_MS) || Number(process.env.FETCH_TIMEOUT_MS) || 30000;

    return async (input, init = {}) => {
        let attempt = 0;
        let lastError = null;

        while (attempt <= retries) {
            try {
                // Force a saner default timeout for auth calls unless caller provided a signal.
                const withTimeout = (() => {
                    if (!timeoutMs || timeoutMs <= 0) return init;
                    if (init && init.signal) return init;
                    if (typeof AbortSignal?.timeout !== 'function') return init;
                    return { ...init, signal: AbortSignal.timeout(timeoutMs) };
                })();

                return await baseFetch(input, withTimeout);
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

const supabasePublic = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
        global: {
            fetch: createRetryingFetch(global.fetch)
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

module.exports = supabasePublic;
