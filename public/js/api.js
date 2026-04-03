const API_BASE_URL = window.location.origin;

class API {
    static async request(endpoint, options = {}) {
        const {
            method = 'GET',
            body,
            token,
            headers = {}
        } = options;

        const finalHeaders = { ...headers };

        if (body !== undefined && !finalHeaders['Content-Type']) {
            finalHeaders['Content-Type'] = 'application/json';
        }

        if (token) {
            finalHeaders.Authorization = `Bearer ${token}`;
        }

        let response;
        try {
            response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method,
                credentials: 'same-origin',
                headers: finalHeaders,
                body: body !== undefined ? JSON.stringify(body) : undefined
            });
        } catch (networkError) {
            throw new Error('Network error. Please check your connection and try again.');
        }

        const contentType = response.headers.get('content-type') || '';

        if (!response.ok) {
            let errorPayload = {};
            if (contentType.includes('application/json')) {
                errorPayload = await response.json();
            } else {
                const rawMessage = await response.text();
                if (rawMessage) {
                    errorPayload.error = rawMessage;
                }
            }

            throw new Error(errorPayload.error || errorPayload.message || `Request failed (${response.status})`);
        }

        if (contentType.includes('application/json')) {
            return response.json();
        }

        return response.text();
    }

    static async download(endpoint, token) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            credentials: 'same-origin',
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!response.ok) {
            throw new Error(`Download failed (${response.status})`);
        }

        return response.blob();
    }

    static signup(data) {
        return this.request('/api/signup', { method: 'POST', body: data });
    }

    static login(email, password) {
        return this.request('/api/login', {
            method: 'POST',
            body: { email, password }
        });
    }

    static forgotPassword(email) {
        return this.request('/api/forgot-password', {
            method: 'POST',
            body: { email }
        });
    }

    static logout() {
        return this.request('/api/logout', {
            method: 'POST'
        });
    }

    static resetPassword(token, newPassword) {
        return this.request('/api/reset-password', {
            method: 'POST',
            body: { accessToken: token, newPassword }
        });
    }

    static submitPublicLead(userId, name, phone, service) {
        return this.request('/api/public/lead', {
            method: 'POST',
            body: {
                user_id: userId,
                name,
                phone,
                service  
            }
        });
    }
}
