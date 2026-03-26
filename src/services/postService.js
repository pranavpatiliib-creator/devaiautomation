const supabase = require('../config/supabase');
const logger = require('../utils/appLogger');

function computeBackoffSeconds(attempt) {
    const base = Math.min(60 * 30, 5 * Math.pow(2, Math.max(0, attempt))); // cap 30m
    const jitter = Math.floor(Math.random() * 5);
    return base + jitter;
}
// Utility function to safely convert values to strings for logging or storage.
async function recordAttempt({ tenantId, postId, status, error, payload }) {
    try {
        await supabase.from('social_post_attempts').insert({
            tenant_id: tenantId,
            post_id: postId,
            status,
            error: error ? String(error).slice(0, 2000) : null,
            payload: payload ?? {}
        });
    } catch (err) {
        logger.error('social_post_attempts insert failed', err?.message);
    }
}
// Placeholder function to dispatch a post to the appropriate social media platform. In a real implementation, this would contain logic to interface with platform APIs (e.g., Facebook, Twitter, Instagram).

async function dispatchPost(_post) {
    // Platform integrations are intentionally modular; implement per platform later.
    // For now, we mark as posted and log the payload for observability.
    return { success: true, external_id: null };
}
// Mark a post as successfully posted, clearing any retry state.
async function markPostPosted({ tenantId, postId }) {
    const { error } = await supabase
        .from('social_posts')
        .update({
            status: 'posted',
            posted_at: new Date().toISOString(),
            last_error: null,
            next_retry_at: null,
            updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('id', postId);
    if (error) throw error;
}
// Mark a post as failed and schedule retry if attempts remain, or mark as permanently failed if max attempts reached.
async function markPostFailed({ tenantId, postId, attempts, maxAttempts, errorMessage }) {
    const now = new Date();
    const reachedMax = attempts >= maxAttempts;
    const nextRetryAt = reachedMax
        ? null
        : new Date(now.getTime() + computeBackoffSeconds(attempts) * 1000).toISOString();

    const { error } = await supabase
        .from('social_posts')
        .update({
            status: reachedMax ? 'failed' : 'retrying',
            attempts,
            next_retry_at: nextRetryAt,
            last_error: String(errorMessage || 'Unknown error').slice(0, 2000),
            updated_at: now.toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('id', postId);

    if (error) throw error;
}
// Main function to process due social posts. This will be called by a scheduler (e.g., every minute) to ensure timely posting.
async function processDuePosts({ limit = 10 } = {}) {
    const nowIso = new Date().toISOString();
    const { data: due, error } = await supabase
        .from('social_posts')
        .select('*')
        .in('status', ['scheduled', 'retrying'])
        .or(`scheduled_at.lte.${nowIso},next_retry_at.lte.${nowIso}`)
        .order('scheduled_at', { ascending: true })
        .limit(limit);

    if (error) {
        if (error.code === 'PGRST205') return { processed: 0 }; // missing table
        throw error;
    }

    let processed = 0;
    for (const post of due || []) {
        processed += 1;
        const attempts = (post.attempts || 0) + 1;
        const maxAttempts = post.max_attempts || 5;

        try {
            const { error: lockError } = await supabase
                .from('social_posts')
                .update({ attempts, updated_at: new Date().toISOString() })
                .eq('id', post.id)
                .eq('tenant_id', post.tenant_id)
                .in('status', ['scheduled', 'retrying']);
            if (lockError) throw lockError;

            const result = await dispatchPost(post);
            if (!result?.success) {
                throw new Error(result?.error || 'Post dispatch failed');
            }

            await markPostPosted({ tenantId: post.tenant_id, postId: post.id });
            await recordAttempt({ tenantId: post.tenant_id, postId: post.id, status: 'success', payload: { result } });
            await logger.logAutomation({
                tenantId: post.tenant_id,
                workflowName: 'social_post',
                status: 'success',
                payload: { post_id: post.id, platform: post.platform }
            });
        } catch (err) {
            await recordAttempt({
                tenantId: post.tenant_id,
                postId: post.id,
                status: 'failure',
                error: err?.message || String(err),
                payload: { platform: post.platform }
            });
            await logger.logAutomation({
                tenantId: post.tenant_id,
                workflowName: 'social_post',
                status: 'failure',
                payload: { post_id: post.id, error: err?.message || String(err) }
            });
            await markPostFailed({
                tenantId: post.tenant_id,
                postId: post.id,
                attempts,
                maxAttempts,
                errorMessage: err?.message || String(err)
            });
        }
    }

    return { processed };
}

module.exports = {
    processDuePosts
};

