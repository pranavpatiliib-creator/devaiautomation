const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { SECRET } = require('../middleware/auth');
const { getOrCreateTenantForUser } = require('../services/tenantService');
// Utility function to normalize email addresses by trimming whitespace and converting to lowercase, ensuring consistent handling of email inputs across the application.
function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}
// Validates that a password meets strength requirements: at least 8 characters, including uppercase, lowercase, number, and special character.
function isStrongPassword(password) {
    const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    return pattern.test(String(password || ''));
}
// Generates a JWT token for password reset with a short expiration time, embedding the user's email and a specific purpose claim to ensure it's only used for password resets.
function createResetToken(email) {
    return jwt.sign(
        {
            purpose: 'password_reset',
            email: normalizeEmail(email)
        },
        SECRET,
        { expiresIn: '15m' }
    );
}
// Parses and verifies a password reset token, ensuring it has the correct purpose and contains an email. If the token is invalid or expired, it throws an error.
function parseResetToken(token) {
    const decoded = jwt.verify(token, SECRET);
    if (!decoded || decoded.purpose !== 'password_reset' || !decoded.email) {
        throw new Error('Invalid reset token');
    }
    return decoded;
}
// Controller class for handling authentication-related routes, including signup, login, forgot password, and reset password. It interacts with the User model and tenant service to manage user accounts and their associated tenant contexts.
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
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const isValid = User.validatePassword(password, user.password);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid email or password' });
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
            if (!normalizedEmail) {
                return res.status(400).json({ error: 'Email is required' });
            }

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(normalizedEmail)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            const token = createResetToken(normalizedEmail);
            const user = await User.findByEmail(normalizedEmail);

            return res.json({
                message: 'If an account exists for this email, a reset link has been generated.',
                resetLink: user ? `/reset?token=${token}` : null
            });
        } catch (err) {
            console.error('Forgot password error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    static async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            if (!token || !newPassword) {
                return res.status(400).json({ error: 'Token and new password are required' });
            }

            if (!isStrongPassword(newPassword)) {
                return res.status(400).json({
                    error: 'Password must contain uppercase, lowercase, number and special character'
                });
            }

            let decoded;
            try {
                decoded = parseResetToken(token);
            } catch (tokenError) {
                return res.status(400).json({ error: 'Invalid or expired reset token' });
            }

            const user = await User.findByEmail(decoded.email);
            if (!user) {
                return res.status(400).json({ error: 'Invalid or expired reset token' });
            }

            const hashedPassword = User.hashPassword(newPassword);
            await User.update(user.id, { password: hashedPassword });

            return res.json({ message: 'Password reset successful' });
        } catch (err) {
            console.error('Reset password error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = AuthController;
