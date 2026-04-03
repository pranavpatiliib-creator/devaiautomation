const { getOrCreateTenantForUser } = require('../services/tenantService');
const supabase = require('../config/supabase');
const supabasePublic = require('../config/supabasePublic');
const { createClient } = require('@supabase/supabase-js');
// Utility function to normalize email addresses by trimming whitespace and converting to lowercase, ensuring consistent handling of email inputs across the application.
function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}
// Validates that a password meets strength requirements: at least 8 characters, including uppercase, lowercase, number, and special character.
function isStrongPassword(password) {
    const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    return pattern.test(String(password || ''));
}
function getAuthCookieOptions(req) {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const isSecure = req.secure || forwardedProto === 'https';

    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
    };
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

            const { data: signUpData, error: signUpError } = await supabasePublic.auth.signUp({
                email: normalizedEmail,
                password,
                options: {
                    data: {
                        name,
                        profession,
                        businessName,
                        businessPhone,
                        location,
                        services,
                        website
                    }
                }
            });

            if (signUpError) {
                const message = signUpError.message || 'Signup failed';
                const status = /already|exists/i.test(message) ? 400 : 500;
                return res.status(status).json({ error: message });
            }

            const authUser = signUpData?.user;
            if (!authUser?.id) {
                return res.status(500).json({ error: 'Signup failed (missing Supabase user)' });
            }

            const newUser = {
                id: authUser.id,
                name,
                email: normalizedEmail,
                profession,
                businessName,
                businessPhone,
                location,
                services,
                website
            };

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

            const { data: signInData, error: signInError } = await supabasePublic.auth.signInWithPassword({
                email: normalizedEmail,
                password
            });

            if (signInError || !signInData?.session?.access_token || !signInData?.user?.id) {
                return res.status(401).json({ error: signInError?.message || 'Invalid email or password' });
            }

            const authUser = signInData.user;
            const token = signInData.session.access_token;

            const user = {
                id: authUser.id,
                name: authUser.user_metadata?.name || authUser.email || 'User',
                email: authUser.email,
                profession: authUser.user_metadata?.profession || null,
                businessName: authUser.user_metadata?.businessName || null,
                businessPhone: authUser.user_metadata?.businessPhone || null,
                location: authUser.user_metadata?.location || null,
                services: authUser.user_metadata?.services || null,
                website: authUser.user_metadata?.website || null
            };

            const tenant = await getOrCreateTenantForUser(user, {
                business_name: user.businessName,
                industry: user.profession,
                whatsapp_number: user.businessPhone
            });

            res.cookie('auth_token', token, getAuthCookieOptions(req));

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

            const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
            const redirectTo = `${baseUrl}/reset`;

            const { error } = await supabasePublic.auth.resetPasswordForEmail(normalizedEmail, {
                redirectTo
            });

            if (error) {
                const message = error.message || 'Failed to start password reset';
                if (/rate limit/i.test(message) || /too many/i.test(message)) {
                    return res.status(429).json({ error: 'Too many reset attempts. Please wait and try again.' });
                }
                return res.status(500).json({ error: message });
            }

            return res.json({
                message: 'If an account exists for this email, a reset email has been sent.'
            });
        } catch (err) {
            console.error('Forgot password error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    static async resetPassword(req, res) {
        try {
            const { accessToken, newPassword } = req.body;
            if (!accessToken || !newPassword) {
                return res.status(400).json({ error: 'accessToken and newPassword are required' });
            }

            if (!isStrongPassword(newPassword)) {
                return res.status(400).json({
                    error: 'Password must contain uppercase, lowercase, number and special character'
                });
            }

            // Use a short-lived Supabase recovery access token to update the user password.
            const scopedClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                },
                global: {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                }
            });

            const { data, error } = await scopedClient.auth.updateUser({ password: newPassword });
            if (error || !data?.user) {
                return res.status(400).json({ error: error?.message || 'Invalid or expired reset token' });
            }

            return res.json({ message: 'Password reset successful' });
        } catch (err) {
            console.error('Reset password error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    static async logout(req, res) {
        try {
            res.clearCookie('auth_token', {
                ...getAuthCookieOptions(req),
                maxAge: undefined
            });

            return res.json({ success: true });
        } catch (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = AuthController;
