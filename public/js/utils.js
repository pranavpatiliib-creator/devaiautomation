// ================= UTILITY FUNCTIONS =================

function getUserId() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
        const payloadSegment = token.split(".")[1] || "";
        const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
        const payload = JSON.parse(atob(padded));
        return payload.id;
    } catch (err) {
        console.error("Error decoding token:", err);
        return null;
    }
}

function getTenantId() {
    const cached = localStorage.getItem("tenantId");
    if (cached) return cached;

    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
        const payloadSegment = token.split(".")[1] || "";
        const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
        const payload = JSON.parse(atob(padded));
        return payload.tenantId || null;
    } catch (err) {
        console.error("Error decoding token:", err);
        return null;
    }
}

function getToken() {
    return localStorage.getItem("token");
}

function isAuthenticated() {
    return !!getToken();
}

function clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("tenantId");
    localStorage.removeItem("businessName");
    localStorage.removeItem("name");
    localStorage.removeItem("profession");
}

function redirectIfNotAuthenticated() {
    if (!isAuthenticated()) {
        window.location = "/login";
    }
}
