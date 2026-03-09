const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { SECRET } = require('../middleware/auth');

let resetTokens = {};

class AuthController {
    static async signup(req, res) {
        try {
            const {
                name,
                email,
                password,
                profession,
                businessName,
                businessPhone,
                location,
                services,
                website
            } = req.body;

            // 1️⃣ Check empty fields
            if (
                !name ||
                !email ||
                !password ||
                !profession ||
                !businessName ||
                !businessPhone ||
                !location ||
                !services ||
                !website
            ) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            // 2️⃣ Email validation
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            // 3️⃣ Phone validation (10 digits)
            const phonePattern = /^[0-9]{10}$/;
            if (!phonePattern.test(businessPhone)) {
                return res.status(400).json({ error: 'Phone number must be 10 digits' });
            }

            // 4️⃣ Password strength
            const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
            if (!passwordPattern.test(password)) {
                return res.status(400).json({
                    error: 'Password must contain uppercase, lowercase, number and special character'
                });
            }

            // 5️⃣ Check if email already exists
            if (User.findByEmail(email)) {
                return res.status(400).json({ error: 'User already exists' });
            }

            // 6️⃣ Hash password and create user
            const hashedPassword = User.hashPassword(password);
            const newUser = User.create({
                name,
                email,
                password: hashedPassword,
                profession,
                businessName,
                businessPhone,
                location,
                services,
                website
            });

            res.json({ success: true });
        } catch (err) {
            console.error('Signup error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body;

            const user = User.findByEmail(email);
            if (!user) {
                return res.json({ error: 'User not found' });
            }

            const valid = User.validatePassword(password, user.password);
            if (!valid) {
                return res.json({ error: 'Invalid password' });
            }

            const token = jwt.sign({ id: user.id }, SECRET);
            res.json({
                success: true,
                token,
                profession: user.profession,
                businessName: user.businessName
            });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const user = User.findByEmail(email);

            if (!user) {
                return res.status(404).json({ message: 'Email not found' });
            }

            const token = crypto.randomBytes(32).toString('hex');
            const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
            resetTokens[token] = { email, expiry };

            const resetLink = `/reset?token=${token}`;
            res.json({
                message: 'Reset link generated',
                resetLink
            });
        } catch (err) {
            console.error('Forgot password error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            const tokenData = resetTokens[token];

            if (!tokenData) {
                return res.status(400).json({ message: 'Invalid or expired token' });
            }

            if (Date.now() > tokenData.expiry) {
                delete resetTokens[token];
                return res.status(400).json({ message: 'Token expired. Please try again.' });
            }

            const user = User.findByEmail(tokenData.email);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const hashedPassword = User.hashPassword(newPassword);
            User.update(user.id, { password: hashedPassword });

            delete resetTokens[token];
            res.json({ message: 'Password reset successful' });
        } catch (err) {
            console.error('Reset password error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = AuthController;
