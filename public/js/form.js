// ================= PUBLIC FORM FUNCTIONS =================

async function submitLead() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("user");

    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;
    const service = document.getElementById("service").value;

    if (!name || !phone || !service) {
        alert("Please fill all fields");
        return;
    }

    try {
        const data = await API.submitPublicLead(userId, name, phone, service);

        if (data.success) {
            alert("Submitted successfully! Thank you for your interest.");
            document.getElementById("name").value = "";
            document.getElementById("phone").value = "";
            document.getElementById("service").value = "";
        } else {
            alert("Error submitting form");
        }
    } catch (err) {
        console.error("Submit lead error:", err);
        alert("Error submitting form: " + err.message);
    }
}
