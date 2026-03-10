const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const LeadsController = require('../controllers/leadsController');
const { verifyToken } = require('../middleware/auth');

router.get('/leads', verifyToken, LeadsController.getLeads);
router.post('/lead', verifyToken, LeadsController.addLead);
router.put('/lead/:id', verifyToken, LeadsController.updateLead);
router.put('/lead-note/:id', verifyToken, LeadsController.updateLeadNote);
router.delete('/lead/:id', verifyToken, LeadsController.deleteLead);

// Export leads to Excel - accessible at /api/leads/export
router.get('/leads/export', verifyToken, (req, res) => {
    try {
        const leadsPath = path.join(__dirname, '../data/leads.json');
        const leadsData = fs.readFileSync(leadsPath, 'utf8');
        const leads = JSON.parse(leadsData);

        // Create workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(leads);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="leads_${Date.now()}.xlsx"`);
        res.send(buffer);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export leads', message: error.message });
    }
});

module.exports = router;
