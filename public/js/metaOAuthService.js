const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const secretCrypto = require('./secretCrypto');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_REDIRECT_URI = process.env.META_REDIRECT_URI; // e.g. https://yourdomain.com/auth/meta/callback
const META_SCOPES = ['pages_messaging', 'pages_read_engagement', 'pages_manage_metadata'].join(',');

// Step 1 — Generate OAuth authorization URL
function getAuthUrl(tenantId) {
  const state = Buffer.from(JSON.stringify({ tenantId, ts: Date.now() })).toString('base64');
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    scope: META_SCOPES,
    response_type: 'code',
    state,
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}

// Step 2 — Exchange code for access token (called from OAuth callback route)
async function handleCallback(code, state) {
  let tenantId;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    tenantId = decoded.tenantId;
    if (Date.now() - decoded.ts > 10 * 60 * 1000) throw new Error('State expired');
  } catch {
    throw new Error('Invalid OAuth state');
  }

  // Exchange code for short-lived user access token
  const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
    params: {
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: META_REDIRECT_URI,
      code,
    },
  });
  const shortLivedToken = tokenRes.data.access_token;

  // Exchange for long-lived token
  const longRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  });
  const longLivedToken = longRes.data.access_token;

  // Fetch pages this user manages
  const pagesRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
    params: { access_token: longLivedToken, fields: 'id,name,access_token' },
  });
  const pages = pagesRes.data.data || [];

  // Persist encrypted page tokens
  for (const page of pages) {
    const encrypted = secretCrypto.encrypt(page.access_token);
    await supabase.from('meta_channels').upsert({
      tenant_id: tenantId,
      page_id: page.id,
      page_name: page.name,
      access_token_enc: encrypted,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,page_id' });
  }

  return { tenantId, pagesConnected: pages.length };
}

// Retrieve decrypted page access token for a tenant + page
async function getPageToken(tenantId, pageId) {
  const { data, error } = await supabase
    .from('meta_channels')
    .select('access_token_enc')
    .eq('tenant_id', tenantId)
    .eq('page_id', pageId)
    .single();
  if (error || !data) throw new Error('Meta channel not found');
  return secretCrypto.decrypt(data.access_token_enc);
}

module.exports = { getAuthUrl, handleCallback, getPageToken };
