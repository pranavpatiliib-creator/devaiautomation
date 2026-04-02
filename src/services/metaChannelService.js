const supabase = require('../config/supabase');
const { decryptSecret } = require('../utils/secretCrypto');

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v19.0';
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');

function buildGraphUrl(path, params) {
    const search = new URLSearchParams(params);
    return `https://graph.facebook.com/${META_GRAPH_VERSION}${path}?${search.toString()}`;
}

function resolvePublicUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) {
        if (!PUBLIC_BASE_URL) {
            throw new Error('Missing PUBLIC_BASE_URL for resolving public media URLs');
        }
        return `${PUBLIC_BASE_URL}${url}`;
    }
    return url;
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
    const primaryMediaUrl = Array.isArray(mediaUrls) ? resolvePublicUrl(mediaUrls[0]) : '';

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
    const primaryMediaUrl = Array.isArray(mediaUrls) ? resolvePublicUrl(mediaUrls[0]) : '';

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

async function sendWhatsAppTextMessage({ tenantId, recipientId, text }) {
    const connection = await getActiveConnection(tenantId, 'whatsapp');
    const phoneNumberId = String(connection.page_id || '').trim();
    if (!phoneNumberId) {
        throw new Error('WhatsApp connection is missing phone_number_id (stored in channel_connections.page_id)');
    }

    const payload = {
        messaging_product: 'whatsapp',
        to: String(recipientId),
        type: 'text',
        text: { body: String(text) }
    };

    const data = await fetchJson(buildGraphUrl(`/${phoneNumberId}/messages`, {
        access_token: connection.decrypted_access_token
    }), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    return {
        success: true,
        external_id: data?.messages?.[0]?.id || null,
        raw: data
    };
}

module.exports = {
    getActiveConnection,
    sendMetaTextMessage,
    sendWhatsAppTextMessage,
    publishFacebookPost,
    publishInstagramPost
};
