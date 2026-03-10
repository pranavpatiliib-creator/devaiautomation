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

        // Move lost leads to bottom
        leads.sort((a, b) => {
            const statusA = (a.status || "").toLowerCase();
            const statusB = (b.status || "").toLowerCase();

            if (statusA === "lost") return 1;
            if (statusB === "lost") return -1;
            return 0;
        });

        leads.forEach(lead => {

            const status = (lead.status || "new").toLowerCase();

            let rowClass = "newLead";

            if (status === "contacted") rowClass = "contacted";
            if (status === "converted") rowClass = "converted";
            if (status === "lost") rowClass = "lost";

            if (status === "converted") converted++;

            const leadDate = new Date(lead.id).toDateString();
            if (leadDate === todayDate) today++;

            const row = document.createElement("tr");
            row.className = rowClass;

            row.innerHTML = `
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
            `;

            table.appendChild(row);

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
    console.log("User ID:", userId);   // debug

    if (!userId) {
        alert("User ID not found. Please login again.");
        return;
    }

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

// Export leads to Excel
async function exportLeads() {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Session expired. Please login again.");
        return;
    }

    try {
        const response = await fetch("/api/leads/export", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Export failed: ${response.statusText}`);
        }

        // Get the blob from response
        const blob = await response.blob();

        // Create a temporary URL for the file
        const url = window.URL.createObjectURL(blob);

        // Create a temporary link and click it
        const a = document.createElement("a");
        a.href = url;
        a.download = `leads_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error("Export error:", error);
        alert("Failed to export leads: " + error.message);
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
