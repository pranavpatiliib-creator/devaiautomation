const { findTenantByUserId } = require('../services/tenantService');

async function requireTenant(req, res, next) {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const tenant = await findTenantByUserId(req.user.id);
        if (!tenant) {
            return res.status(403).json({ error: 'No tenant found for this user' });
        }

        req.tenant = tenant;
        req.tenantId = tenant.id;
        next();
    } catch (error) {
        console.error('Tenant resolution error:', error);
        return res.status(500).json({ error: 'Failed to resolve tenant context' });
    }
}

module.exports = {
    requireTenant
};
