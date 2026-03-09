// ================= API CONFIGURATION =================

const API_BASE_URL =
    (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1")
        ? "http://localhost:5000"
        : "https://devaiautomation.onrender.com";

// ================= API CALLS =================

class API {
    static async post(endpoint, body) {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return res.json();
    }

    static async get(endpoint, token = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = token;
        }
        const res = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
        return res.json();
    }

    static async put(endpoint, body, token) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': token
        };
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body)
        });
        return res.json();
    }

    static async delete(endpoint, token) {
        const headers = { 'Authorization': token };
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers
        });
        return res.json();
    }

    // Auth endpoints
    static async signup(data) {
        return this.post('/signup', data);
    }

    static async login(email, password) {
        return this.post('/login', { email, password });
    }

    static async forgotPassword(email) {
        return this.post('/forgot-password', { email });
    }

    static async resetPassword(token, newPassword) {
        return this.post('/reset-password', { token, newPassword });
    }

    // Leads endpoints
    static async getLeads(token) {
        return this.get('/leads', token);
    }

    static async addLead(data, token) {
        return this.post('/lead', data);
    }

    static async updateLead(id, status, token) {
        return this.put(`/lead/${id}`, { status }, token);
    }

    static async updateLeadNote(id, note, token) {
        return this.put(`/lead-note/${id}`, { note }, token);
    }

    static async deleteLead(id, token) {
        return this.delete(`/lead/${id}`, token);
    }

    // Public endpoints
    static async submitPublicLead(userId, name, phone, service) {
        return this.post('/lead-public', {
            userId,
            name,
            phone,
            service
        });
    }
}
