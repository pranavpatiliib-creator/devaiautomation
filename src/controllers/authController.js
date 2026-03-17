const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User');
const { SECRET } = require('../middleware/auth');
const { getOrCreateTenantForUser } = require('../services/tenantService');

const resetTokens = {};

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

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

            const normalizedEmail = normalizeEmail(email);

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

            const newUser = await User.create({
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

            const tenant = await getOrCreateTenantForUser(newUser, {
                business_name: businessName,
                industry: profession,
                whatsapp_number: businessPhone
            });

            return res.json({
                success: true,
                tenantId: tenant.id
            });
        } catch (err) {
            console.error('Signup error:', err);
            return res.status(500).json({ error: 'Server error: ' + err.message });
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body;
            const normalizedEmail = normalizeEmail(email);

            if (!normalizedEmail || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            const user = await User.findByEmail(normalizedEmail);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const isValid = User.validatePassword(password, user.password);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            const tenant = await getOrCreateTenantForUser(user, {
                business_name: user.businessName,
                industry: user.profession,
                whatsapp_number: user.businessPhone
            });

            const token = jwt.sign(
                {
                    id: user.id,
                    tenantId: tenant.id
                },
                SECRET,
                { expiresIn: '7d' }
            );

            return res.json({
                success: true,
                token,
                tenantId: tenant.id,
                name: user.name,
                profession: user.profession,
                businessName: tenant.business_name || user.businessName
            });
        } catch (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    static async forgotPassword(req, res) {
        try {
            const normalizedEmail = normalizeEmail(req.body.email);
            const user = await User.findByEmail(normalizedEmail);

            if (!user) {
                return res.status(404).json({ message: 'Email not found' });
            }

            const token = crypto.randomBytes(32).toString('hex');
            const expiry = Date.now() + 15 * 60 * 1000;
            resetTokens[token] = { email: normalizedEmail, expiry };

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
