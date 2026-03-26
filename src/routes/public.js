const express = require('express');
const router = express.Router();

const supabase = require('../config/supabase');
// This route file defines a public endpoint for receiving new leads from external sources. It validates the input, associates the lead with the correct tenant based on the provided user_id, and inserts the lead into the database. The endpoint includes error handling for various scenarios, ensuring that appropriate responses are returned for missing fields, tenant lookup failures, and database insertion errors.
function sanitizeLeadText(value, maxLength = 255) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, maxLength);
}
// Public endpoint to receive new leads from external sources (e.g., website forms, third-party integrations). It expects a JSON body with user_id, name, phone, and service fields. The endpoint validates the input, associates the lead with the correct tenant based on the user_id, and inserts the lead into the database with a default status of 'new'. It also includes error handling for missing fields, tenant lookup failures, and database insertion errors, returning appropriate HTTP status codes and messages for each case.
router.post('/public/lead', async (req, res) => {
    try {
        const userId = String(req.body.user_id || '').trim();
        const name = sanitizeLeadText(req.body.name, 120);
        const phone = sanitizeLeadText(req.body.phone, 30);
        const service = sanitizeLeadText(req.body.service, 120);

        if (!userId || !name || !phone || !service) {
            return res.status(400).json({
                success: false,
                error: 'user_id, name, phone, and service are required'
            });
        }

        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

        if (tenantError) {
            throw tenantError;
        }

        if (!tenant) {
            return res.status(404).json({
                success: false,
                error: 'Tenant not found for the provided user'
            });
        }

        const { data, error } = await supabase
            .from('leads')
            .insert({
                tenant_id: tenant.id,
                name,
                phone,
                service,
                status: 'new',
                note: ''
            })
            .select('id,tenant_id,name,phone,service,status,note,created_at')
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to insert lead'
            });
        }

        return res.status(201).json({
            success: true,
            lead: data
        });
    } catch (err) {
        console.error('Unexpected error in /public/lead:', err);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;
