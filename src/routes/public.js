const express = require('express');
const router = express.Router();

const supabase = require('../config/supabase');

router.post('/public/lead', async (req, res) => {
    try {
        const { user_id, name, phone, service } = req.body;

        if (!user_id || !name || !phone || !service) {
            return res.status(400).json({
                success: false,
                error: 'user_id, name, phone, and service are required'
            });
        }

        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('id')
            .eq('user_id', user_id)
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
            .select('id,tenant_id,name,phone,service,status,note,created_at');

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to insert lead'
            });
        }

        return res.status(201).json({
            success: true,
            data
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
