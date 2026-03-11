const Lead = require('../models/Lead');

class LeadsController {
    static async getLeads(req, res) {
        try {
            const userLeads = await Lead.findByUserId(req.user.id);
            res.json(userLeads);
        } catch (err) {
            console.error('Get leads error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static async addLead(req, res) {
        try {
            const { name, phone, service } = req.body;

            // Validate required fields
            if (!name || !phone || !service) {
                return res.status(400).json({ error: 'name, phone, and service are required' });
            }

            const newLead = await Lead.create({
                userId: req.user.id,
                name,
                phone,
                service,
                status: 'New',
                note: ''
            });

            res.json({ success: true, lead: newLead });
        } catch (err) {
            console.error('Add lead error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static async updateLead(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { status } = req.body;

            const lead = await Lead.findById(id);
            if (!lead || Number(lead.userId) !== Number(req.user.id)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            await Lead.update(id, { status });
            res.json({ success: true });
        } catch (err) {
            console.error('Update lead error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static async updateLeadNote(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { note } = req.body;

            const lead = await Lead.findById(id);
            if (!lead || Number(lead.userId) !== Number(req.user.id)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            await Lead.update(id, { note });
            res.json({ success: true });
        } catch (err) {
            console.error('Update lead note error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static async deleteLead(req, res) {
        try {
            const id = parseInt(req.params.id);

            const lead = await Lead.findById(id);
            if (!lead || Number(lead.userId) !== Number(req.user.id)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            await Lead.delete(id);
            res.json({ success: true });
        } catch (err) {
            console.error('Delete lead error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = LeadsController;
