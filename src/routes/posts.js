const express = require('express');
const router = express.Router();

const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const rateLimiter = require('../middleware/rateLimiter');
const { asTrimmedString, asNullableIsoDate, asInt, requireFields } = require('../utils/validation');
const logger = require('../utils/appLogger');

router.use(verifyToken, requireTenant);
// This route file defines endpoints for managing social media posts, including creating, updating, deleting, and scheduling posts. It also includes an endpoint for retrieving post attempts. The routes validate input data, handle database interactions with Supabase, and implement error handling for various scenarios, such as missing fields or database errors. The endpoints are protected with authentication and tenant resolution middleware to ensure that only authorized users can access and modify their own posts.
function isMissingTableError(error) {
    return error?.code === 'PGRST205';
}
// Marks a post as posted after successful dispatch, updating its status and timestamps accordingly.
function normalizePlatform(value) {
    return asTrimmedString(value, 50).toLowerCase();
}
// Records an attempt to post, including the status, any error messages, and relevant payload data for debugging and analytics purposes.
function normalizeStatus(value) {
    return asTrimmedString(value, 30).toLowerCase();
}
// Marks a post as successfully posted, updating its status to 'posted' and clearing any retry information.
const ALLOWED_PLATFORMS = new Set(['facebook', 'instagram', 'whatsapp', 'linkedin', 'twitter', 'x', 'generic']);
const ALLOWED_STATUSES = new Set(['draft', 'scheduled', 'posted', 'failed', 'retrying', 'canceled']);
// Computes an exponential backoff delay in seconds based on the number of attempts, with a base delay and a maximum cap to prevent excessively long delays.
router.get('/posts', async (req, res) => {
    try {
        const status = normalizeStatus(req.query.status);
        const limit = asInt(req.query.limit, 50, { min: 1, max: 200 });

        let query = supabase
            .from('social_posts')
            .select('*')
            .eq('tenant_id', req.tenantId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (status && ALLOWED_STATUSES.has(status)) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.json(data || []);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'social_posts table is missing. Run schema migration.' });
        }
        console.error('Load posts error:', error);
        return res.status(500).json({ error: 'Failed to load posts' });
    }
});
// Marks a post as successfully posted, updating its status to 'posted' and clearing any retry information.
router.post('/posts', rateLimiter, async (req, res) => {
    try {
        const missing = requireFields(req.body, ['platform', 'content']);
        if (missing.length) {
            return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
        }

        const platform = normalizePlatform(req.body.platform);
        const resolvedPlatform = ALLOWED_PLATFORMS.has(platform) ? platform : 'generic';
        const content = asTrimmedString(req.body.content, 4000);
        if (!content) return res.status(400).json({ error: 'Content is required' });

        const scheduledAt = asNullableIsoDate(req.body.scheduled_at || req.body.scheduledAt);
        const status = scheduledAt ? 'scheduled' : 'draft';
        const mediaUrls = Array.isArray(req.body.media_urls || req.body.mediaUrls)
            ? req.body.media_urls || req.body.mediaUrls
            : null;

        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
            .from('social_posts')
            .insert({
                tenant_id: req.tenantId,
                platform: resolvedPlatform,
                content,
                media_urls: mediaUrls,
                status,
                scheduled_at: scheduledAt,
                updated_at: nowIso
            })
            .select('*')
            .single();

        if (error) throw error;

        await logger.logAutomation({
            tenantId: req.tenantId,
            workflowName: 'social_post',
            status: 'created',
            payload: { post_id: data.id, platform: resolvedPlatform, status }
        });

        return res.json({ success: true, post: data });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'social_posts table is missing. Run schema migration.' });
        }
        console.error('Create post error:', error);
        return res.status(500).json({ error: 'Failed to create post' });
    }
});
// Computes an exponential backoff delay in seconds based on the number of attempts, with a base delay and a maximum cap to prevent excessively long delays.
router.put('/posts/:id', rateLimiter, async (req, res) => {
    try {
        const postId = req.params.id;
        const updates = {};
//
        if (req.body.platform !== undefined) {
            const platform = normalizePlatform(req.body.platform);
            updates.platform = ALLOWED_PLATFORMS.has(platform) ? platform : 'generic';
        }

        if (req.body.content !== undefined) {
            const content = asTrimmedString(req.body.content, 4000);
            if (!content) return res.status(400).json({ error: 'Content cannot be empty' });
            updates.content = content;
        }

        if (req.body.media_urls !== undefined || req.body.mediaUrls !== undefined) {
            const mediaUrls = req.body.media_urls || req.body.mediaUrls;
            updates.media_urls = Array.isArray(mediaUrls) ? mediaUrls : null;
        }

        if (req.body.scheduled_at !== undefined || req.body.scheduledAt !== undefined) {
            updates.scheduled_at = asNullableIsoDate(req.body.scheduled_at || req.body.scheduledAt);
        }

        if (req.body.status !== undefined) {
            const status = normalizeStatus(req.body.status);
            if (!ALLOWED_STATUSES.has(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            updates.status = status;
        }

        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('social_posts')
            .update(updates)
            .eq('tenant_id', req.tenantId)
            .eq('id', postId)
            .select('*')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Post not found' });

        return res.json({ success: true, post: data });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'social_posts table is missing. Run schema migration.' });
        }
        console.error('Update post error:', error);
        return res.status(500).json({ error: 'Failed to update post' });
    }
});
// Computes an exponential backoff delay in seconds based on the number of attempts, with a base delay and a maximum cap to prevent excessively long delays.
router.delete('/posts/:id', rateLimiter, async (req, res) => {
    try {
        const { error } = await supabase
            .from('social_posts')
            .delete()
            .eq('tenant_id', req.tenantId)
            .eq('id', req.params.id);

        if (error) throw error;

        return res.json({ success: true });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'social_posts table is missing. Run schema migration.' });
        }
        console.error('Delete post error:', error);
        return res.status(500).json({ error: 'Failed to delete post' });
    }
});
// Computes an exponential backoff delay in seconds based on the number of attempts, with a base delay and a maximum cap to prevent excessively long delays.
router.post('/posts/:id/schedule', rateLimiter, async (req, res) => {
    try {
        const scheduledAt = asNullableIsoDate(req.body.scheduled_at || req.body.scheduledAt);
        if (!scheduledAt) return res.status(400).json({ error: 'scheduled_at is required' });

        const { data, error } = await supabase
            .from('social_posts')
            .update({
                scheduled_at: scheduledAt,
                status: 'scheduled',
                next_retry_at: null,
                last_error: null,
                updated_at: new Date().toISOString()
            })
            .eq('tenant_id', req.tenantId)
            .eq('id', req.params.id)
            .select('*')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Post not found' });

        return res.json({ success: true, post: data });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'social_posts table is missing. Run schema migration.' });
        }
        console.error('Schedule post error:', error);
        return res.status(500).json({ error: 'Failed to schedule post' });
    }
});
// Marks a post as successfully posted, updating its status to 'posted' and clearing any retry information.
router.post('/posts/:id/publish', rateLimiter, async (req, res) => {
    try {
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
            .from('social_posts')
            .update({
                status: 'scheduled',
                scheduled_at: nowIso,
                next_retry_at: null,
                last_error: null,
                updated_at: nowIso
            })
            .eq('tenant_id', req.tenantId)
            .eq('id', req.params.id)
            .select('*')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Post not found' });

        return res.json({ success: true, post: data });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'social_posts table is missing. Run schema migration.' });
        }
        console.error('Publish post error:', error);
        return res.status(500).json({ error: 'Failed to queue post for publishing' });
    }
});
// Marks a post as successfully posted, updating its status to 'posted' and clearing any retry information.
router.get('/posts/:id/attempts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('social_post_attempts')
            .select('*')
            .eq('tenant_id', req.tenantId)
            .eq('post_id', req.params.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        return res.json(data || []);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'social_post_attempts table is missing. Run schema migration.' });
        }
        console.error('Load post attempts error:', error);
        return res.status(500).json({ error: 'Failed to load post attempts' });
    }
});

module.exports = router;

