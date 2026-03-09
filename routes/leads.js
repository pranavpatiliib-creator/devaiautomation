const express = require('express');
const router = express.Router();
const LeadsController = require('../controllers/leadsController');
const { verifyToken } = require('../middleware/auth');

router.get('/leads', verifyToken, LeadsController.getLeads);
router.post('/lead', verifyToken, LeadsController.addLead);
router.put('/lead/:id', verifyToken, LeadsController.updateLead);
router.put('/lead-note/:id', verifyToken, LeadsController.updateLeadNote);
router.delete('/lead/:id', verifyToken, LeadsController.deleteLead);

module.exports = router;
