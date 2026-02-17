// JS para Gestión de Usuarios

const USERS_API = '/api/users';

async function loadUsers() {
    try {
        const res = await AUTH.fetch(USERS_API);
        if (!res.ok) throw new Error('Error cargando usuarios');
        const users = await res.json();
        renderUsers(users);
    } catch (error) {
        console.error(error);
        alert('No se pudieron cargar los usuarios. Verifica tus permisos.');
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.nombre}</td>
            <td>${u.usuario}</td>
            <td><span class="role-badge role-${u.rol}">${u.rol}</span></td>
            <td>${u.activo ? '<span style="color:#4ade80">Activo</span>' : '<span style="color:#f87171">Inactivo</span>'}</td>
            <td class="actions">
                <button class="btn btn-secondary btn-small" onclick="editUser('${u.id}')">✏️</button>
                <button class="btn btn-secondary btn-small" onclick="openPwdModal('${u.id}')">🔑</button>
                <button class="btn btn-danger btn-small" onclick="deleteUser('${u.id}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal Logic
let isEditing = false;

function openNewUserModal() {
    isEditing = false;
    document.getElementById('modalTitle').innerText = 'Nuevo Usuario';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('usuario').disabled = false;
    document.getElementById('passwordGroup').style.display = 'block';
    document.getElementById('password').required = true;

    document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

async function saveUser() {
    const id = document.getElementById('userId').value;
    const nombre = document.getElementById('nombre').value;
    const usuario = document.getElementById('usuario').value;
    const password = document.getElementById('password').value;
    const rol = document.getElementById('rol').value;
    const activo = document.getElementById('activo').value === 'true';

    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${USERS_API}/${id}` : USERS_API;

    const body = { nombre, usuario, rol, activo };
    if (!isEditing) body.password = password;

    try {
        const res = await AUTH.fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            closeUserModal();
            loadUsers();
        } else {
            const err = await res.json();
            alert('Error: ' + err.error);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    }
}

// Edit User
window.editUser = async (id) => {
    isEditing = true;
    document.getElementById('modalTitle').innerText = 'Editar Usuario';
    // Load user data first if needed, but we can ideally pass object or fetch single.
    // For simplicity, fetching list or finding in DOM/Cache is common.
    // Let's re-fetch list to be safe or find in current memory if we stored it globally.
    // Simplified: Fetch invalid approach without state? No, we need state.
    // Let's clear form and alert for this MVP step.

    // Better: Fetch single user or filter from current list.
    // Since we don't store list globally in this snippet, let's fetch list again and find.
    const res = await AUTH.fetch(USERS_API);
    const users = await res.json();
    const u = users.find(user => user.id === id);

    if (u) {
        document.getElementById('userId').value = u.id;
        document.getElementById('nombre').value = u.nombre;
        document.getElementById('usuario').value = u.usuario;
        document.getElementById('usuario').disabled = true; // Don't change username
        document.getElementById('rol').value = u.rol;
        document.getElementById('activo').value = u.activo.toString();

        document.getElementById('passwordGroup').style.display = 'none';
        document.getElementById('password').required = false;

        document.getElementById('userModal').classList.add('active');
    }
};

// Admin Change Password
window.openPwdModal = (id) => {
    document.getElementById('pwdUserId').value = id;
    document.getElementById('newPassword').value = '';
    document.getElementById('pwdModal').classList.add('active');
};

window.adminChangePassword = async () => {
    const id = document.getElementById('pwdUserId').value;
    const password = document.getElementById('newPassword').value;

    if (!password) return alert('Ingresa una contraseña');

    try {
        const res = await AUTH.fetch(`${USERS_API}/${id}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (res.ok) {
            document.getElementById('pwdModal').classList.remove('active');
            alert('Contraseña actualizada');
        } else {
            alert('Error al actualizar contraseña');
        }
    } catch (error) {
        alert('Error de conexión');
    }
};

window.deleteUser = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

    try {
        const res = await AUTH.fetch(`${USERS_API}/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadUsers();
        } else {
            const err = await res.json();
            alert('Error: ' + err.error);
        }
    } catch (error) {
        alert('Error al eliminar');
    }
};

// Init
document.addEventListener('DOMContentLoaded', loadUsers);
