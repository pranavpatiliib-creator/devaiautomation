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

function getUserId() {
    const token = localStorage.getItem('token');
    const payload = decodeJwtPayload(token);
    return payload?.id || null;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('businessName');
    localStorage.removeItem('name');
    localStorage.removeItem('profession');
    window.location = '/login';
}

async function signup() {
    const signupBtn = document.getElementById('signupBtn');
    const spinner = document.getElementById('spinner');

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
        alert('Please fill all fields.');
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert('Please enter a valid email address.');
        return;
    }

    const phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(businessPhone)) {
        alert('Phone number must be 10 digits.');
        return;
    }

    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    if (!passwordPattern.test(password)) {
        alert('Password must be at least 8 characters and include uppercase, lowercase, number and special character.');
        return;
    }

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

        alert('Account created successfully');
        window.location = '/login';
    } catch (error) {
        alert(error.message || 'Signup failed');
    } finally {
        if (signupBtn) signupBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
    }
}

async function login() {
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }

    try {
        const data = await API.login(email, password);

        localStorage.setItem('token', data.token);
        localStorage.setItem('tenantId', data.tenantId || '');
        localStorage.setItem('businessName', data.businessName || '');
        localStorage.setItem('name', data.name || '');
        localStorage.setItem('profession', data.profession || '');

        window.location = '/dashboard';
    } catch (error) {
        alert(error.message || 'Login failed');
    }
}

async function forgotPassword() {
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message');
    const resetLinkBox = document.getElementById('resetLinkBox');

    if (!email) {
        if (message) {
            message.className = 'error';
            message.textContent = 'Please enter your email.';
        }
        return;
    }

    try {
        const data = await API.forgotPassword(email);

        if (message) {
            message.className = 'success';
            message.textContent = data.message || 'Reset link generated.';
        }

        if (resetLinkBox && data.resetLink) {
            resetLinkBox.style.display = 'block';
            resetLinkBox.innerHTML = `<a href=\"${data.resetLink}\">Click here to reset password</a>`;
        }
    } catch (error) {
        if (message) {
            message.className = 'error';
            message.textContent = error.message || 'Could not connect to server.';
        }
    }
}

async function resetPassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const message = document.getElementById('message');
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
        if (message) {
            message.className = 'error';
            message.textContent = 'Invalid reset link.';
        }
        return;
    }

    if (!newPassword || !confirmPassword) {
        if (message) {
            message.className = 'error';
            message.textContent = 'Please fill in both fields.';
        }
        return;
    }

    if (newPassword !== confirmPassword) {
        if (message) {
            message.className = 'error';
            message.textContent = 'Passwords do not match.';
        }
        return;
    }

    if (newPassword.length < 8) {
        if (message) {
            message.className = 'error';
            message.textContent = 'Password must be at least 8 characters.';
        }
        return;
    }

    try {
        const data = await API.resetPassword(token, newPassword);
        if (message) {
            message.className = 'success';
            message.textContent = data.message || 'Password reset successful.';
        }
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    } catch (error) {
        if (message) {
            message.className = 'error';
            message.textContent = error.message || 'Could not connect to server.';
        }
    }
}
