// ================= DASHBOARD FUNCTIONS =================

async function loadLeads() {
    const token = localStorage.getItem("token");

    try {
        const leads = await API.getLeads(token);

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

async function updateStatus(id, status) {
    const token = localStorage.getItem("token");
    try {
        await API.updateLead(id, status, token);
    } catch (err) {
        console.error("Update status error:", err);
        alert("Error updating status");
    }
}

async function updateNote(id, note) {
    const token = localStorage.getItem("token");
    try {
        await API.updateLeadNote(id, note, token);
    } catch (err) {
        console.error("Update note error:", err);
        alert("Error updating note");
    }
}

function generateLeadLink() {
    const userId = getUserId();
    const link = `${window.location.origin}/form?user=${userId}`;
    document.getElementById("leadLink").innerText = link;
    document.getElementById("qrcode").innerHTML = "";

    new QRCode(document.getElementById("qrcode"), {
        text: link,
        width: 180,
        height: 180
    });
}

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

function copyLeadLink() {
    const link = document.getElementById("leadLink").innerText;
    navigator.clipboard.writeText(link);
    alert("Link copied to clipboard");
}

// Initialize dashboard
function initDashboard() {
    const businessName = localStorage.getItem("businessName");
    const name = localStorage.getItem("name");
    const token = localStorage.getItem("token");

    // Redirect to login if not authenticated
    if (!token) {
        window.location = "/login";
        return;
    }

    // Show business name
    if (document.getElementById("businessTitle")) {
        document.getElementById("businessTitle").innerText = "Welcome to " + businessName + " Dashboard";
    }

    // Show user name
    if (document.getElementById("userName")) {
        document.getElementById("userName").innerText = name;
    }

    // Load leads
    if (document.getElementById("table")) {
        loadLeads();
    }
}

// Run on page load if dashboard elements exist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById("table")) {
            initDashboard();
        }
    });
} else {
    if (document.getElementById("table")) {
        initDashboard();
    }
}
