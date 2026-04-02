function showSubmitMessage(message, type = "info") {
    const messageEl = document.getElementById("submitMessage");
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.className = `submit-message ${type}`;
}
async function submitLead() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("user");

    const nameInput = document.getElementById("name");
    const phoneInput = document.getElementById("phone");
    const serviceInput = document.getElementById("service");
    const submitBtn = document.getElementById("submitBtn");

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const service = serviceInput.value.trim();

    if (!userId) {
        showSubmitMessage("Invalid form link. Missing user id.", "error");
        return;
    }

    if (!name || !phone || !service) {
        showSubmitMessage("Please fill in name, phone, and service.", "error");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    showSubmitMessage("Submitting your lead...", "info");

    try {
        const response = await fetch("/api/public/lead", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: userId,
                name,
                phone,
                service
            })
        });

        let data = {};
        try {
            data = await response.json();
        } catch (parseError) {
            console.error("Failed to parse lead response:", parseError);
        }

        if (!response.ok || !data.success) {
            const errorMessage = data.error || "Failed to submit lead. Please try again.";
            console.error("Lead submit failed:", data);
            showSubmitMessage(errorMessage, "error");
            return;
        }

        showSubmitMessage("Lead submitted successfully. Thank you!", "success");
        nameInput.value = "";
        phoneInput.value = "";
        serviceInput.value ="";
    } catch (error) {
        console.error("Lead submit request error:", error);
        showSubmitMessage("Network error. Please try again.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
    }
}
