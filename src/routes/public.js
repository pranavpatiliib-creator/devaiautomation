const express = require('express');
const router = express.Router();

const PublicController = require('../controllers/publicController');

router.post('/form', PublicController.submitForm);

module.exports = router;
