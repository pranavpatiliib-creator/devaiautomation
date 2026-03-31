const supabase = require('../config/supabase');
const { decryptSecret } = require('../utils/secretCrypto');

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v19.0';

function buildGraphUrl(path, params) {
    const search = new URLSearchParams(params);
    return `https://graph.facebook.com/${META_GRAPH_VERSION}${path}?${search.toString()}`;
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.error?.message || `Meta request failed (${response.status})`;
        throw new Error(message);
    }
    return data;
}

async function getActiveConnection(tenantId, channel) {
    const { data, error } = await supabase
        .from('channel_connections')
        .select('id,channel,access_token,page_id,phone_number,metadata,is_active,created_at')
        .eq('tenant_id', tenantId)
        .eq('channel', channel)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    if (!data?.access_token || !data?.page_id) {
        throw new Error(`No active ${channel} connection found`);
    }

    return {
        ...data,
        decrypted_access_token: decryptSecret(data.access_token)
    };
}

async function sendMetaTextMessage({ tenantId, channel, recipientId, text }) {
    const connection = await getActiveConnection(tenantId, channel);
    const payload = {
        recipient: { id: String(recipientId) },
        message: { text: String(text) },
        messaging_type: 'RESPONSE'
    };

    const data = await fetchJson(buildGraphUrl('/me/messages', {
        access_token: connection.decrypted_access_token
    }), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    return {
        success: true,
        external_id: data.message_id || null,
        raw: data
    };
}

async function publishFacebookPost({ tenantId, content, mediaUrls }) {
    const connection = await getActiveConnection(tenantId, 'facebook');
    const primaryMediaUrl = Array.isArray(mediaUrls) ? String(mediaUrls[0] || '').trim() : '';

    if (primaryMediaUrl) {
        const data = await fetchJson(buildGraphUrl(`/${connection.page_id}/photos`, {
            url: primaryMediaUrl,
            caption: String(content || ''),
            access_token: connection.decrypted_access_token
        }), { method: 'POST' });

        return { success: true, external_id: data.post_id || data.id || null, raw: data };
    }

    const data = await fetchJson(buildGraphUrl(`/${connection.page_id}/feed`, {
        message: String(content || ''),
        access_token: connection.decrypted_access_token
    }), { method: 'POST' });

    return { success: true, external_id: data.id || null, raw: data };
}

async function publishInstagramPost({ tenantId, content, mediaUrls }) {
    const connection = await getActiveConnection(tenantId, 'instagram');
    const primaryMediaUrl = Array.isArray(mediaUrls) ? String(mediaUrls[0] || '').trim() : '';

    if (!primaryMediaUrl) {
        throw new Error('Instagram publishing requires at least one public image URL');
    }

    const creation = await fetchJson(buildGraphUrl(`/${connection.page_id}/media`, {
        image_url: primaryMediaUrl,
        caption: String(content || ''),
        access_token: connection.decrypted_access_token
    }), { method: 'POST' });

    const published = await fetchJson(buildGraphUrl(`/${connection.page_id}/media_publish`, {
        creation_id: creation.id,
        access_token: connection.decrypted_access_token
    }), { method: 'POST' });

    return { success: true, external_id: published.id || creation.id || null, raw: published };
}

module.exports = {
    getActiveConnection,
    sendMetaTextMessage,
    publishFacebookPost,
    publishInstagramPost
};
