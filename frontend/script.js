// ================= ENVIRONMENT CONFIGURATION =================
const API_BASE_URL =
    (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1")
        ? "http://localhost:5000"
        : "https://devaiautomation.onrender.com";



// ================= SUBMIT LEAD (Dashboard User Only) =================

async function submitLeadDashboard() {

    const token = localStorage.getItem("token");

    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;
    const service = document.getElementById("service").value;

    try {

        const res = await fetch(`${API_BASE_URL}/lead`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
                Authorization: token
            },

            body: JSON.stringify({ name, phone, service })

        });

        if (!res.ok) {
            throw new Error(`Server error: ${res.status}`);
        }

        const data = await res.json();

        alert("Lead submitted!");

    } catch (err) {

        console.error("Submit lead error:", err);
        alert("Error: " + err.message);

    }

}



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
    const passwordPattern =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

    if (!passwordPattern.test(password)) {
        alert(
            "Password must be at least 8 characters and include uppercase, lowercase, number and special character."
        );
        return;
    }

    // 5️⃣ Disable button + show spinner
    signupBtn.disabled = true;
    spinner.style.display = "inline-block";

    try {

        const res = await fetch(`${API_BASE_URL}/signup`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name,
                email,
                password,
                profession,
                businessName,
                businessPhone,
                location,
                services,
                website
            })

        });

        const data = await res.json();

        if (data.error) {

            alert(data.error);

        } else {

            alert("Account created successfully");
            window.location = "login.html";

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



// ================= LOGIN =================
async function login() {

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const res = await fetch(`${API_BASE_URL}/login`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })

        });

        const data = await res.json();

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

        window.location = "dashboard.html";

    } catch (err) {

        console.error("Login error:", err);
        alert("Error connecting to server. Please check your connection.");

    }

}



// ================= LOAD LEADS =================

async function loadLeads() {

    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${API_BASE_URL}/leads`, {
            headers: {
                Authorization: token
            }
        });

        if (!res.ok) {
            throw new Error(`Server error: ${res.status}`);
        }

        const leads = await res.json();

        const table = document.getElementById("table");

        table.innerHTML = "";

        let total = leads.length;
        let today = 0;
        let converted = 0;

        const todayDate = new Date().toDateString();

        leads.forEach(lead => {

            if (lead.status === "Converted") {
                converted++;
            }

            const leadDate = new Date(lead.id).toDateString();

            if (leadDate === todayDate) {
                today++;
            }

            table.innerHTML += `
<tr>

<td>${lead.name}</td>

<td>${lead.phone}</td>

<td>${lead.service}</td>

<td>
<select onchange="updateStatus(${lead.id}, this.value)">

<option ${(lead.status || "New") === "New" ? "selected" : ""}>New</option>
<option ${lead.status === "Contacted" ? "selected" : ""}>Contacted</option>
<option ${lead.status === "Converted" ? "selected" : ""}>Converted</option>
<option ${lead.status === "Lost" ? "selected" : ""}>Lost</option>

</select>
</td>

<td>
<input 
value="${lead.note || ""}" 
onchange="updateNote(${lead.id}, this.value)"
placeholder="Add note">
</td>

</tr>
`;

        });

        document.getElementById("totalLeads").innerText = total;
        document.getElementById("todayLeads").innerText = today;
        document.getElementById("convertedLeads").innerText = converted;
    } catch (err) {
        console.error("Load leads error:", err);
        alert("Error loading leads: " + err.message);
    }

}



// ================= UPDATE STATUS =================

async function updateStatus(id, status) {

    const token = localStorage.getItem("token");

    await fetch(`${API_BASE_URL}/lead/${id}`, {

        method: "PUT",

        headers: {
            "Content-Type": "application/json",
            Authorization: token
        },

        body: JSON.stringify({ status })

    });

}



// ================= UPDATE NOTE =================

async function updateNote(id, note) {

    const token = localStorage.getItem("token");

    await fetch(`${API_BASE_URL}/lead-note/${id}`, {

        method: "PUT",

        headers: {
            "Content-Type": "application/json",
            Authorization: token
        },

        body: JSON.stringify({ note })

    });

}



// ================= GET USER ID FROM TOKEN =================

function getUserId() {

    const token = localStorage.getItem("token");

    const payload = JSON.parse(atob(token.split(".")[1]));

    return payload.id;

}



// ================= COPY LEAD LINK =================

function copyLeadLink() {
    const link = document.getElementById("leadLink").innerText;
    navigator.clipboard.writeText(link);
    alert("Link copied to clipboard");
}



// ================= GENERATE LEAD LINK =================
function generateLeadLink() {

    const userId = getUserId();

    const formPath = window.location.pathname.replace('dashboard.html', 'form.html');

    const link = `${window.location.origin}${formPath}?user=${userId}`;

    document.getElementById("leadLink").innerText = link;

    // clear previous QR
    document.getElementById("qrcode").innerHTML = "";

    // generate QR
    new QRCode(document.getElementById("qrcode"), {
        text: link,
        width: 180,
        height: 180
    });

}
// genrate the qr code

function generateQR() {

    const link = document.getElementById("leadLink").innerText;

    if (!link) {
        alert("Generate link first");
        return;
    }

    document.getElementById("qrcode").innerHTML = "";

    new QRCode(document.getElementById("qrcode"), {
        text: link,
        width: 200,
        height: 200
    });

}
// download the qr code
function downloadQR() {

    const img = document.querySelector("#qrcode img");

    if (!img) {
        alert("Generate QR code first");
        return;
    }

    const link = document.createElement("a");
    link.href = img.src;
    link.download = "lead-form-qr.png";
    link.click();
}
// ================= LOGOUT =================

function logout() {

    localStorage.removeItem("token");

    window.location = "login.html";

}
// forgot pssword
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
        const res = await fetch('http://localhost:5000/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (res.ok) {
            message.className = 'success';
            message.textContent = 'Reset link generated! Click the link below.';
            // Show reset link (remove in production - send via email instead)
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
//reset password
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
        const res = await fetch('http://localhost:5000/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });

        const data = await res.json();

        if (res.ok) {
            message.className = 'success';
            message.textContent = 'Password reset successful! Redirecting to login...';
            setTimeout(() => window.location.href = 'login.html', 2000);
        } else {
            message.className = 'error';
            message.textContent = data.message || 'Something went wrong.';
        }
    } catch (err) {
        message.className = 'error';
        message.textContent = 'Could not connect to server.';
    }
}
// ================= PUBLIC FORM SUBMIT ===============

async function submitLead() {

    const urlParams = new URLSearchParams(window.location.search);

    const userId = urlParams.get("user");

    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;
    const service = document.getElementById("service").value;

    try {
        const res = await fetch(`${API_BASE_URL}/lead-public`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                userId,
                name,
                phone,
                service
            })

        });

        if (!res.ok) {
            throw new Error(`Server error: ${res.status}`);
        }

        alert("Submitted successfully");
    } catch (err) {
        console.error("Submit lead error:", err);
        alert("Error submitting form: " + err.message);
    }

}
// Load user data in dashboard

const businessName = localStorage.getItem("businessName");
const name = localStorage.getItem("name");
const token = localStorage.getItem("token");

// Show business name
if (document.getElementById("businessTitle")) {
    document.getElementById("businessTitle").innerText =
        "Welcome to " + businessName + " Dashboard";
}

// Show user name
if (document.getElementById("userName")) {
    document.getElementById("userName").innerText = name;
}
if (window.location.pathname.includes("dashboard") && !token) {
    window.location = "login.html";
}

// ================= LOAD DASHBOARD =================

if (document.getElementById("table")) {
    loadLeads();
}
