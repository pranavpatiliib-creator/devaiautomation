// ================= UTILITY FUNCTIONS =================

function getUserId() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.id;
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
    localStorage.removeItem("businessName");
    localStorage.removeItem("name");
    localStorage.removeItem("profession");
}

function redirectIfNotAuthenticated() {
    if (!isAuthenticated()) {
        window.location = "/login";
    }
}
