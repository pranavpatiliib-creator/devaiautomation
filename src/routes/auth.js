const express = require('express');
const router = express.Router();

const AuthController = require('../controllers/authController');
const rateLimiter = require('../middleware/rateLimiter');
const { authEmailLimiter } = require('../middleware/rateLimiter');

router.post('/signup', rateLimiter, AuthController.signup);
router.post('/login', rateLimiter, AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', authEmailLimiter, AuthController.forgotPassword);
router.post('/reset-password', rateLimiter, AuthController.resetPassword);

module.exports = router;
