// ================= AUTHENTICATION FUNCTIONS =================

async function signup() {
    const signupBtn = document.getElementById("signupBtn");
    const spinner = document.getElementById("spinner");

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const profession = document.getElementById("profession").value.trim();
    const businessName = document.getElementById("businessName").value.trim();
    const businessPhone = document.getElementById("businessPhone").value.trim();
    const location = document.getElementById("location").value.trim();
    const services = document.getElementById("services").value.trim();
    const website = document.getElementById("website").value.trim();

    // 1️⃣ Empty field validation
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
        alert("Please fill all fields.");
        return;
    }

    // 2️⃣ Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert("Please enter a valid email address.");
        return;
    }

    // 3️⃣ Phone number validation (10 digits)
    const phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(businessPhone)) {
        alert("Phone number must be 10 digits.");
        return;
    }

    // 4️⃣ Password strength validation
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    if (!passwordPattern.test(password)) {
        alert("Password must be at least 8 characters and include uppercase, lowercase, number and special character.");
        return;
    }

    // 5️⃣ Disable button + show spinner
    signupBtn.disabled = true;
    spinner.style.display = "inline-block";

    try {
        const data = await API.signup({
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

        if (data.error) {
            alert(data.error);
        } else {
            alert("Account created successfully");
            window.location = "/login";
        }
    } catch (err) {
        console.error("Signup error:", err);
        alert("Server connection error.");
    } finally {
        // 6️⃣ Enable button again
        signupBtn.disabled = false;
        spinner.style.display = "none";
    }
}

async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const data = await API.login(email, password);

        if (data.error) {
            alert(data.error);
            return;
        }

        // Save login data
        localStorage.setItem("token", data.token);
        localStorage.setItem("businessName", data.businessName);
        localStorage.setItem("name", data.name);
        localStorage.setItem("profession", data.profession);

        alert("Login successful");
        window.location = "/dashboard";
    } catch (err) {
        console.error("Login error:", err);
        alert("Error connecting to server. Please check your connection.");
    }
}

async function forgotPassword() {
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message');
    const resetLinkBox = document.getElementById('resetLinkBox');

    if (!email) {
        message.className = 'error';
        message.textContent = 'Please enter your email.';
        return;
    }

    try {
        const data = await API.forgotPassword(email);

        if (data.resetLink) {
            message.className = 'success';
            message.textContent = 'Reset link generated! Click the link below.';
            resetLinkBox.style.display = 'block';
            resetLinkBox.innerHTML = `<a href="${data.resetLink}">Click here to reset password</a>`;
        } else {
            message.className = 'error';
            message.textContent = data.message || 'Something went wrong.';
        }
    } catch (err) {
        message.className = 'error';
        message.textContent = 'Could not connect to server.';
    }
}

async function resetPassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const message = document.getElementById('message');

    // Get token from URL
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
        message.className = 'error';
        message.textContent = 'Invalid reset link.';
        return;
    }

    if (!newPassword || !confirmPassword) {
        message.className = 'error';
        message.textContent = 'Please fill in both fields.';
        return;
    }

    if (newPassword !== confirmPassword) {
        message.className = 'error';
        message.textContent = 'Passwords do not match.';
        return;
    }

    if (newPassword.length < 8) {
        message.className = 'error';
        message.textContent = 'Password must be at least 8 characters.';
        return;
    }

    try {
        const data = await API.resetPassword(token, newPassword);

        if (data.message === 'Password reset successful') {
            message.className = 'success';
            message.textContent = 'Password reset successful! Redirecting to login...';
            setTimeout(() => window.location.href = '/login', 2000);
        } else {
            message.className = 'error';
            message.textContent = data.message || 'Something went wrong.';
        }
    } catch (err) {
        message.className = 'error';
        message.textContent = 'Could not connect to server.';
    }
}
function getUserId() {

    const token = localStorage.getItem("token");

    if (!token) return null;

    const payload = JSON.parse(atob(token.split('.')[1]));

    return payload.id;

}
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("businessName");
    localStorage.removeItem("name");
    localStorage.removeItem("profession");
    window.location = "/login";
}
