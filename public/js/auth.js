
// auth.js - Manejo de autenticación global

const AUTH = {
    getToken: () => localStorage.getItem('mr_token'),
    getUser: () => {
        try {
            return JSON.parse(localStorage.getItem('mr_user'));
        } catch (e) { return null; }
    },
    logout: () => {
        localStorage.removeItem('mr_token');
        localStorage.removeItem('mr_user');
        window.location.href = '/login.html';
    },
    checkAuth: () => {
        const token = localStorage.getItem('mr_token');
        if (!token && window.location.pathname !== '/login.html') {
            window.location.href = '/login.html';
        }
    },
    fetch: async (url, options = {}) => {
        const token = localStorage.getItem('mr_token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 || response.status === 403) {
            AUTH.logout();
            return response;
        }

        return response;
    }
};

// Expose globally
window.AUTH = AUTH;

// Auto-check on load
AUTH.checkAuth();
