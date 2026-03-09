const express = require('express');
const router = express.Router();
const PublicController = require('../controllers/publicController');

router.post('/lead-public', PublicController.submitPublicLead);

module.exports = router;
