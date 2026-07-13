// auth.js - Manejo de autenticación global

const AUTH = {
    getToken: () => localStorage.getItem('mr_token'),
    getUser: () => {
        try {
            return JSON.parse(localStorage.getItem('mr_user'));
        } catch (e) { return null; }
    },
    logout: () => {
        console.log('👋 Cerrando sesión...');
        localStorage.removeItem('mr_token');
        localStorage.removeItem('mr_user');
        window.location.href = 'login.html';
    },
    checkAuth: () => {
        const token = localStorage.getItem('mr_token');
        if (!token && !window.location.pathname.includes('login.html')) {
            console.warn('⛔ No hay sesión activa. Redirigiendo al login...');
            window.location.href = 'login.html';
        }
    },
    fetch: async (url, options = {}) => {
        const token = localStorage.getItem('mr_token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(url, { ...options, headers });

        // 401 = token inválido/expirado → cerrar sesión
        // 403 = sin permiso para esa acción → NO cerrar sesión
        if (response.status === 401) {
            AUTH.logout();
            return response;
        }
        if (response.status === 403) {
            return response; // Retornar para que el caller maneje el error
        }

        return response;
    }
};

// Expose globally
window.AUTH = AUTH;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar si hay sesión activa
    AUTH.checkAuth();

    // 2. Manejar el botón de Logout (Salir) - DELEGACIÓN DE EVENTOS
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('#btn-logout, #logout-btn, .btn-logout-sidebar');
        if (btn) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (confirm('¿Cerrar sesión de forma segura?')) {
                AUTH.logout();
            }
        }
    });

    // 3. Cargar información del usuario en el sidebar
    const userInfo = document.getElementById('user-info');
    if (userInfo && AUTH.getToken()) {
        AUTH.fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    userInfo.innerHTML = `
                    <div class="sidebar-user-name">${data.user.nombre || data.user.usuario}</div>
                    <div class="sidebar-user-role">${data.user.rol.toUpperCase()}</div>
                `;
                }
            })
            .catch(err => {
                console.error('⚠️ Error de sesión:', err);
            });
    }
});