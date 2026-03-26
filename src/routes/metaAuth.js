const express = require('express');
const jwt = require('jsonwebtoken');

const supabase = require('../config/supabase');
const { verifyToken, SECRET } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const { oauthStartLimiter, oauthCallbackLimiter } = require('../middleware/rateLimiter');
const { encryptSecret } = require('../utils/secretCrypto');

const router = express.Router();

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v19.0';
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_REDIRECT_URI = process.env.META_REDIRECT_URI;
const META_SCOPES = process.env.META_SCOPES
    || 'pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_messages';

function isMissingColumnError(error, columnName = '') {
    if (error?.code !== '42703') return false;
    if (!columnName) return true;
    return String(error.message || '').includes(columnName);
}

function isMissingTableError(error) {
    return error?.code === 'PGRST205';
}

function isMetaConfigured() {
    return Boolean(META_APP_ID && META_APP_SECRET && META_REDIRECT_URI);
}

function buildMetaOAuthUrl(stateToken) {
    const params = new URLSearchParams({
        client_id: META_APP_ID,
        redirect_uri: META_REDIRECT_URI,
        response_type: 'code',
        scope: META_SCOPES,
        state: stateToken
    });

    return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

async function fetchJson(url) {
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.error?.message || `Meta request failed (${response.status})`;
        throw new Error(message);
    }
    return data;
}

async function upsertConnection({ tenantId, channel, pageId, token, metadata }) {
    let { data: existing, error: existingError } = await supabase
        .from('channel_connections')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('channel', channel)
        .eq('page_id', pageId)
        .maybeSingle();

    if (existingError && isMissingColumnError(existingError, 'metadata')) {
        ({ data: existing, error: existingError } = await supabase
            .from('channel_connections')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('channel', channel)
            .eq('page_id', pageId)
            .maybeSingle());
    }
    if (existingError && !isMissingTableError(existingError)) throw existingError;

    const payload = {
        tenant_id: tenantId,
        channel,
        page_id: pageId,
        access_token: encryptSecret(token),
        is_active: true,
        metadata
    };

    let response;
    if (existing?.id) {
        response = await supabase
            .from('channel_connections')
            .update(payload)
            .eq('id', existing.id)
            .eq('tenant_id', tenantId)
            .select('id,channel,page_id,phone_number,is_active,metadata,created_at')
            .single();
    } else {
        response = await supabase
            .from('channel_connections')
            .insert(payload)
            .select('id,channel,page_id,phone_number,is_active,metadata,created_at')
            .single();
    }

    if (response.error && isMissingColumnError(response.error, 'metadata')) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.metadata;
        if (existing?.id) {
            response = await supabase
                .from('channel_connections')
                .update(fallbackPayload)
                .eq('id', existing.id)
                .eq('tenant_id', tenantId)
                .select('id,channel,page_id,phone_number,is_active,created_at')
                .single();
        } else {
            response = await supabase
                .from('channel_connections')
                .insert(fallbackPayload)
                .select('id,channel,page_id,phone_number,is_active,created_at')
                .single();
        }
        if (!response.error && response.data) {
            response.data.metadata = metadata;
        }
    }

    if (response.error) throw response.error;
    return response.data;
}

router.get('/meta/oauth/start', oauthStartLimiter, verifyToken, requireTenant, (req, res) => {
    try {
        if (!isMetaConfigured()) {
            return res.status(500).json({ error: 'Meta OAuth is not configured. Set META_APP_ID, META_APP_SECRET, META_REDIRECT_URI.' });
        }

        const channel = String(req.query.channel || '').toLowerCase();
        if (!['facebook', 'instagram'].includes(channel)) {
            return res.status(400).json({ error: 'Invalid channel. Use facebook or instagram.' });
        }

        const stateToken = jwt.sign({
            tenantId: req.tenantId,
            userId: req.user.id,
            channel
        }, SECRET, { expiresIn: '10m' });

        return res.json({
            authUrl: buildMetaOAuthUrl(stateToken)
        });
    } catch (error) {
        console.error('Meta OAuth start error:', error);
        return res.status(500).json({ error: 'Failed to start Meta OAuth' });
    }
});

router.get('/meta/oauth/callback', oauthCallbackLimiter, async (req, res) => {
    try {
        if (!isMetaConfigured()) {
            return res.status(500).send('Meta OAuth is not configured.');
        }

        const code = String(req.query.code || '').trim();
        const state = String(req.query.state || '').trim();
        if (!code || !state) {
            return res.status(400).send('Missing code/state');
        }

        const decoded = jwt.verify(state, SECRET);
        const tenantId = decoded?.tenantId;
        const requestedChannel = decoded?.channel;
        if (!tenantId || !requestedChannel) {
            return res.status(400).send('Invalid state');
        }

        const shortTokenPayload = await fetchJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${new URLSearchParams({
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            redirect_uri: META_REDIRECT_URI,
            code
        }).toString()}`);

        const shortLivedToken = shortTokenPayload.access_token;
        const longTokenPayload = await fetchJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            fb_exchange_token: shortLivedToken
        }).toString()}`);

        const longLivedToken = longTokenPayload.access_token;
        const pagesPayload = await fetchJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?${new URLSearchParams({
            access_token: longLivedToken,
            fields: 'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}'
        }).toString()}`);

        const pages = Array.isArray(pagesPayload?.data) ? pagesPayload.data : [];
        if (!pages.length) {
            return res.status(400).send('No Facebook Pages found for this account.');
        }

        const connected = [];
        for (const page of pages) {
            if (requestedChannel === 'facebook') {
                const row = await upsertConnection({
                    tenantId,
                    channel: 'facebook',
                    pageId: String(page.id),
                    token: page.access_token || longLivedToken,
                    metadata: {
                        profile_type: 'facebook_page',
                        page_name: page.name || '',
                        page_picture: page.picture?.data?.url || null,
                        linked_instagram_id: page.instagram_business_account?.id || null
                    }
                });
                connected.push(row);
            }

            if (requestedChannel === 'instagram' && page.instagram_business_account?.id) {
                const ig = page.instagram_business_account;
                const row = await upsertConnection({
                    tenantId,
                    channel: 'instagram',
                    pageId: String(ig.id),
                    token: page.access_token || longLivedToken,
                    metadata: {
                        profile_type: 'instagram_business',
                        username: ig.username || '',
                        name: ig.name || '',
                        profile_picture: ig.profile_picture_url || null,
                        facebook_page_id: page.id || null,
                        facebook_page_name: page.name || ''
                    }
                });
                connected.push(row);
            }
        }

        if (!connected.length) {
            return res.status(400).send('No eligible profiles found for requested channel.');
        }

        const payload = JSON.stringify({
            type: 'meta_oauth_success',
            channel: requestedChannel,
            connectedCount: connected.length
        });

        return res.send(`
<!doctype html>
<html><head><meta charset="utf-8"><title>Connected</title></head>
<body style="font-family: Arial, sans-serif; padding: 24px;">
  <h2>Connection successful</h2>
  <p>You can close this window.</p>
  <script>
    (function () {
      const payload = ${payload};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, window.location.origin);
        }
      } catch (_) {}
      setTimeout(function(){ window.close(); }, 300);
    })();
  </script>
</body></html>`);
    } catch (error) {
        console.error('Meta OAuth callback error:', error);
        return res.status(500).send(`Meta OAuth failed: ${String(error.message || 'Unknown error')}`);
    }
});

module.exports = router;
