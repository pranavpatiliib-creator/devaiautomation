// ================= ENVIRONMENT CONFIGURATION =================
const API_BASE_URL =
    (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1")
        ? "http://localhost:5000"
        : "https://devaiautomation.onrender.comm";



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



// ================= SIGNUP =================
async function signup() {

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const profession = document.getElementById("profession").value;

    const businessName = document.getElementById("businessName").value;
    const businessPhone = document.getElementById("businessPhone").value;
    const location = document.getElementById("location").value;
    const services = document.getElementById("services").value;
    const website = document.getElementById("website").value;

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
        alert("Error connecting to server. Please check your connection.");
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

        localStorage.setItem("token", data.token);

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



// ================= GENERATE LEAD LINK =================

function generateLeadLink() {

    const userId = getUserId();

    const formPath = window.location.pathname.replace('dashboard.html', 'form.html');
    const link = `${window.location.origin}${formPath}?user=${userId}`;

    document.getElementById("leadLink").innerText = link;

}



// ================= LOGOUT =================

function logout() {

    localStorage.removeItem("token");

    window.location = "login.html";

}



// ================= PUBLIC FORM SUBMIT =================

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



// ================= LOAD DASHBOARD =================

if (document.getElementById("table")) {
    loadLeads();
}