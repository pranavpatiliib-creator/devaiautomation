function decodeJwtPayload(token) {
    if (!token) return null;

    try {
        const payloadSegment = token.split('.')[1];
        const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        return JSON.parse(atob(padded));
    } catch (error) {
        return null;
    }
}
function setFeedback(element, message, type = 'error') {
    if (!element) return;
    element.className = `form-feedback ${type}`;
    element.textContent = message || '';
}
function getAuthMessageElement() {
    const existing = document.getElementById('authMessage');
    if (existing) return existing;

    const card = document.querySelector('.card');
    if (!card) return null;

    const el = document.createElement('div');
    el.id = 'authMessage';
    el.className = 'form-feedback';
    el.setAttribute('aria-live', 'polite');

    const button = card.querySelector('button');
    if (button) {
        card.insertBefore(el, button);
    } else {
        card.appendChild(el);
    }

    return el;
}

function isStrongPassword(password) {
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    return passwordPattern.test(password);
}

function getUserId() {
    const token = localStorage.getItem('token');
    const payload = decodeJwtPayload(token);
    return payload?.id || null;
}

async function logout() {
    try {
        await API.logout();
    } catch (error) {
        console.error('Logout request failed:', error);
    } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('tenantId');
        localStorage.removeItem('businessName');
        localStorage.removeItem('name');
        localStorage.removeItem('profession');
        window.location = '/login';
    }
}

async function signup() {
    const signupBtn = document.getElementById('signupBtn');
    const spinner = document.getElementById('spinner');
    const feedback = getAuthMessageElement();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value.trim();
    const profession = document.getElementById('profession').value.trim();
    const businessName = document.getElementById('businessName').value.trim();
    const businessPhone = document.getElementById('businessPhone').value.trim();
    const location = document.getElementById('location').value.trim();
    const services = document.getElementById('services').value.trim();
    const website = document.getElementById('website').value.trim();

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
        setFeedback(feedback, 'Please fill all fields.', 'error');
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        setFeedback(feedback, 'Please enter a valid email address.', 'error');
        return;
    }

    const phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(businessPhone)) {
        setFeedback(feedback, 'Phone number must be 10 digits.', 'error');
        return;
    }

    if (!isStrongPassword(password)) {
        setFeedback(feedback, 'Password must include uppercase, lowercase, number and special character.', 'error');
        return;
    }

    setFeedback(feedback, '', 'info');
    if (signupBtn) signupBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';

    try {
        await API.signup({
            name,
            email,
            password,
            profession,
            businessName,
            businessPhone,
            location,
            services,
            website
        });

        setFeedback(feedback, 'Account created successfully. Redirecting to login...', 'success');
        setTimeout(() => {
            window.location = '/login';
        }, 700);
    } catch (error) {
        setFeedback(feedback, error.message || 'Signup failed', 'error');
    } finally {
        if (signupBtn) signupBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
    }
}

async function login() {
    const feedback = getAuthMessageElement();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        setFeedback(feedback, 'Please enter email and password.', 'error');
        return;
    }

    try {
        setFeedback(feedback, '', 'info');
        const data = await API.login(email, password);

        localStorage.setItem('token', data.token);
        localStorage.setItem('tenantId', data.tenantId || '');
        localStorage.setItem('businessName', data.businessName || '');
        localStorage.setItem('name', data.name || '');
        localStorage.setItem('profession', data.profession || '');

        setFeedback(feedback, 'Login successful. Redirecting...', 'success');
        window.location = '/dashboard';
    } catch (error) {
        setFeedback(feedback, error.message || 'Login failed', 'error');
    }
}

async function forgotPassword() {
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message');
    const resetLinkBox = document.getElementById('resetLinkBox');
    if (resetLinkBox) {
        resetLinkBox.style.display = 'none';
        resetLinkBox.innerHTML = '';
    }

    if (!email) {
        setFeedback(message, 'Please enter your email.', 'error');
        return;
    }

    try {
        const data = await API.forgotPassword(email);
        setFeedback(message, data.message || 'Reset link generated.', 'success');

        if (resetLinkBox && data.resetLink) {
            resetLinkBox.style.display = 'block';
            resetLinkBox.innerHTML = `<a href=\"${data.resetLink}\">Click here to reset password</a>`;
        }
    } catch (error) {
        setFeedback(message, error.message || 'Could not connect to server.', 'error');
    }
}

async function resetPassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const message = document.getElementById('message');
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
        setFeedback(message, 'Invalid reset link.', 'error');
        return;
    }

    if (!newPassword || !confirmPassword) {
        setFeedback(message, 'Please fill in both fields.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        setFeedback(message, 'Passwords do not match.', 'error');
        return;
    }

    if (!isStrongPassword(newPassword)) {
        setFeedback(message, 'Password must include uppercase, lowercase, number and special character.', 'error');
        return;
    }

    try {
        const data = await API.resetPassword(token, newPassword);
        setFeedback(message, data.message || 'Password reset successful.', 'success');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    } catch (error) {
        setFeedback(message, error.message || 'Could not connect to server.', 'error');
    }
}
