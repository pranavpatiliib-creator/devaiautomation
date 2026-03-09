const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

module.exports = router;
