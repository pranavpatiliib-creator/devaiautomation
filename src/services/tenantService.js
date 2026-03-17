const supabase = require('../config/supabase');

async function findTenantByUserId(userId) {
    const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}

async function createDefaultTenantForUser(user, tenantOverrides = {}) {
    const row = {
        user_id: user.id,
        business_name: tenantOverrides.business_name || user.businessName || `${user.name}'s Business`,
        industry: tenantOverrides.industry || user.profession || null,
        whatsapp_number: tenantOverrides.whatsapp_number || user.businessPhone || null,
        fb_page_id: tenantOverrides.fb_page_id || null,
        instagram_id: tenantOverrides.instagram_id || null
    };

    const { data, error } = await supabase
        .from('tenants')
        .insert(row)
        .select('*')
        .single();

    if (error) {
        throw error;
    }

    return data;
}

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
