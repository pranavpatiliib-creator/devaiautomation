const Lead = require('../models/Lead');

class LeadsController {
    static getLeads(req, res) {
        try {
            const userLeads = Lead.findByUserId(req.user.id);
            res.json(userLeads);
        } catch (err) {
            console.error('Get leads error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static addLead(req, res) {
        try {
            const { name, phone, service } = req.body;

            const newLead = Lead.create({
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

    static updateLead(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { status } = req.body;

            const lead = Lead.findById(id);
            if (!lead || lead.userId !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            Lead.update(id, { status });
            res.json({ success: true });
        } catch (err) {
            console.error('Update lead error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static updateLeadNote(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { note } = req.body;

            const lead = Lead.findById(id);
            if (!lead || lead.userId !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            Lead.update(id, { note });
            res.json({ success: true });
        } catch (err) {
            console.error('Update lead note error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static deleteLead(req, res) {
        try {
            const id = parseInt(req.params.id);

            const lead = Lead.findById(id);
            if (!lead || lead.userId !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            Lead.delete(id);
            res.json({ success: true });
        } catch (err) {
            console.error('Delete lead error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = LeadsController;
