const supabase = require('../config/supabase');
// Service layer for tenant-related operations, including finding, creating, and retrieving tenant information based on user context.
async function findTenantByUserId(userId) {
    // Unified model (requested): keep tenant.id as-is, and merge user profile fields into tenants.
    // Link via tenants.user_id = auth.uid().
    let { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    // If the tenants table doesn't have user_id (older/partial schema), fall back to id lookup.
    if (error && error.code === '42703') {
        ({ data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', userId)
            .limit(1)
            .maybeSingle());
    }

    if (error) throw error;
    return data || null;
}
// Create a new tenant for the user with default values, allowing overrides for specific fields.
async function createDefaultTenantForUser(user, tenantOverrides = {}) {
    const row = {
        user_id: user.id,
        name: user.name || null,
        email: user.email || null,
        profession: user.profession || null,
        business_name: tenantOverrides.business_name || user.businessName || `${user.name}'s Business`,
        business_phone: user.businessPhone || null,
        location: user.location || null,
        services: user.services || null,
        website: user.website || null,
        industry: tenantOverrides.industry || user.profession || null,
        whatsapp_number: tenantOverrides.whatsapp_number || user.businessPhone || null,
        fb_page_id: tenantOverrides.fb_page_id || null,
        instagram_id: tenantOverrides.instagram_id || null
    };

    // Insert a tenant row. If some columns don't exist yet, retry with a minimal set.
    let response = await supabase.from('tenants').insert(row).select('*').single();

    if (response.error && response.error.code === '42703') {
        const minimalRow = {
            user_id: user.id,
            business_name: tenantOverrides.business_name || user.businessName || `${user.name}'s Business`,
            industry: tenantOverrides.industry || user.profession || null,
            whatsapp_number: tenantOverrides.whatsapp_number || user.businessPhone || null,
            fb_page_id: tenantOverrides.fb_page_id || null,
            instagram_id: tenantOverrides.instagram_id || null
        };
        response = await supabase.from('tenants').insert(minimalRow).select('*').single();
    }

    if (response.error) throw response.error;
    return response.data;
}
// Get the tenant for a user, creating one if it doesn't exist. This is useful for ensuring that tenant context is always available in routes that require it.
async function getOrCreateTenantForUser(user, tenantOverrides = {}) {
    const existing = await findTenantByUserId(user.id);
    if (existing) {
        return existing;
    }

    return createDefaultTenantForUser(user, tenantOverrides);
}

module.exports = {
    findTenantByUserId,
    createDefaultTenantForUser,
    getOrCreateTenantForUser
};
