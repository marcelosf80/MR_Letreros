// JS para Gestión de Usuarios

const USERS_API = '/api/users';

async function loadUsers() {
    try {
        const users = await window.mrDataManager.request(USERS_API);
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

window.openNewUserModal = function() {
    isEditing = false;
    document.getElementById('modalTitle').innerText = 'Nuevo Usuario';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('usuario').disabled = false;
    document.getElementById('passwordGroup').style.display = 'block';
    document.getElementById('password').required = true;

    document.getElementById('userModal').classList.add('active');
}

window.closeUserModal = function() {
    document.getElementById('userModal').classList.remove('active');
}

window.saveUser = async function() {
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
        await window.mrDataManager.request(url, method, body);
        window.closeUserModal();
        loadUsers();
    } catch (error) {
        console.error(error);
        alert('Error: ' + (error.message || 'Error de conexión'));
    }
}

// Edit User
window.editUser = async (id) => {
    isEditing = true;
    document.getElementById('modalTitle').innerText = 'Editar Usuario';
    
    try {
        // Fetch single user for efficiency
        const u = await window.mrDataManager.request(`${USERS_API}/${id}`);

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
    } catch (error) {
        console.error('Error al cargar usuario para editar:', error);
        alert('No se pudo cargar la información del usuario.');
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
        await window.mrDataManager.request(`${USERS_API}/${id}/password`, 'PUT', { password });
        document.getElementById('pwdModal').classList.remove('active');
        alert('Contraseña actualizada');
    } catch (error) {
        console.error(error);
        alert('Error al actualizar contraseña: ' + (error.message || 'Error de conexión'));
    }
};

window.deleteUser = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

    try {
        await window.mrDataManager.request(`${USERS_API}/${id}`, 'DELETE');
        loadUsers();
    } catch (error) {
        console.error(error);
        alert('Error al eliminar: ' + (error.message || 'Error de conexión'));
    }
};

// Init
document.addEventListener('DOMContentLoaded', loadUsers);
