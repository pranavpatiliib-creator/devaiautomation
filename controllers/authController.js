const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { SECRET } = require('../middleware/auth');

const resetTokens = {};

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

            // Normalize email - trim and lowercase
            const normalizedEmail = (email || '').trim().toLowerCase();

            if (
                !name ||
                !normalizedEmail ||
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

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(normalizedEmail)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            const phonePattern = /^[0-9]{10}$/;
            if (!phonePattern.test(businessPhone)) {
                return res.status(400).json({ error: 'Phone number must be 10 digits' });
            }

            const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
            if (!passwordPattern.test(password)) {
                return res.status(400).json({
                    error: 'Password must contain uppercase, lowercase, number and special character'
                });
            }

            const existingUser = await User.findByEmail(normalizedEmail);
            if (existingUser) {
                return res.status(400).json({ error: 'User already exists' });
            }

            const hashedPassword = User.hashPassword(password);
            await User.create({
                name,
                email: normalizedEmail,
                password: hashedPassword,
                profession,
                businessName,
                businessPhone,
                location,
                services,
                website
            });

            return res.json({ success: true });
        } catch (err) {
            console.error('❌ Signup error:', err);
            console.error('Error message:', err.message);
            console.error('Error code:', err.code);
            console.error('Full error:', JSON.stringify(err, null, 2));
            return res.status(500).json({ error: 'Server error: ' + err.message });
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body;

            // Normalize email - trim and lowercase
            const normalizedEmail = (email || '').trim().toLowerCase();

            console.log('🔍 Login attempt for email:', normalizedEmail);
            const user = await User.findByEmail(normalizedEmail);
            if (!user) {
                console.error('❌ User not found:', normalizedEmail);
                return res.status(404).json({ error: 'User not found' });
            }

            console.log('✓ User found:', user.email);

            const isValid = User.validatePassword(password, user.password);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            const token = jwt.sign({ id: user.id }, SECRET);
            return res.json({
                success: true,
                token,
                name: user.name,
                profession: user.profession,
                businessName: user.businessName
            });
        } catch (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const user = await User.findByEmail(email);

            if (!user) {
                return res.status(404).json({ message: 'Email not found' });
            }

            const token = crypto.randomBytes(32).toString('hex');
            const expiry = Date.now() + 15 * 60 * 1000;
            resetTokens[token] = { email, expiry };

            return res.json({
                message: 'Reset link generated',
                resetLink: `/reset?token=${token}`
            });
        } catch (err) {
            console.error('Forgot password error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    static async resetPassword(req, res) {
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

            const user = await User.findByEmail(tokenData.email);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const hashedPassword = User.hashPassword(newPassword);
            await User.update(user.id, { password: hashedPassword });

            delete resetTokens[token];
            return res.json({ message: 'Password reset successful' });
        } catch (err) {
            console.error('Reset password error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = AuthController;
