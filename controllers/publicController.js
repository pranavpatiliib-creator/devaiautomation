const Lead = require('../models/Lead');

class PublicController {
    static async submitPublicLead(req, res) {
        try {
            const { userId, name, phone, service } = req.body;

            // Validate required fields
            if (!userId || !name || !phone || !service) {
                return res.status(400).json({ error: 'userId, name, phone, and service are required' });
            }

            const newLead = await Lead.create({
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
            // Check if error is FK constraint (invalid userId)
            if (err.code === '23503' || err.message.includes('foreign key')) {
                return res.status(400).json({ error: 'Invalid userId' });
            }
            res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = PublicController;
