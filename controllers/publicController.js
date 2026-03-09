const Lead = require('../models/Lead');

class PublicController {
    static submitPublicLead(req, res) {
        try {
            const { userId, name, phone, service } = req.body;

            const newLead = Lead.create({
                userId: Number(userId),
                name,
                phone,
                service,
                status: 'New',
                note: ''
            });

            res.json({ success: true, lead: newLead });
        } catch (err) {
            console.error('Public lead error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = PublicController;
