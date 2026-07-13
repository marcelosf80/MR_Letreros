// public/js/tareas-internas.js

let tareas = [];
let taskModal;
let currentAttachments = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar modal
    taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
    
    await loadTareas();
    setupDragAndDrop();
    setupFileUpload();
});

async function loadTareas() {
    try {
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('kanbanBoard').style.display = 'none';

        const token = localStorage.getItem('mr_token');
        const res = await fetch('/api/tareas', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Error al cargar tareas');
        
        tareas = await res.json();
        renderKanban();

        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('kanbanBoard').style.display = 'flex';
    } catch (error) {
        console.error(error);
        alert('Error al cargar las tareas');
    }
}

function renderKanban() {
    // Limpiar columnas
    document.getElementById('col-pendiente').innerHTML = '';
    document.getElementById('col-en_proceso').innerHTML = '';
    document.getElementById('col-completado').innerHTML = '';
    
    let countP = 0, countE = 0, countC = 0;

    tareas.forEach(tarea => {
        const card = createCard(tarea);
        const col = document.getElementById(`col-${tarea.estado}`);
        if (col) {
            col.appendChild(card);
            if(tarea.estado === 'pendiente') countP++;
            if(tarea.estado === 'en_proceso') countE++;
            if(tarea.estado === 'completado') countC++;
        }
    });

    document.getElementById('count-pendiente').textContent = countP;
    document.getElementById('count-en_proceso').textContent = countE;
    document.getElementById('count-completado').textContent = countC;

    // Actualizar notificador inferior
    document.getElementById('notif-pendientes').textContent = countP;
    document.getElementById('notif-completados').textContent = countC;
    
    if (tareas.length > 0) {
        // Encontrar la más reciente por fecha de creación
        const lastTask = [...tareas].sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion))[0];
        document.getElementById('notif-last-added').innerHTML = `Última agregada: <strong class="text-primary">${escapeHTML(lastTask.titulo)}</strong>`;
        document.getElementById('taskNotifier').style.setProperty('display', 'flex', 'important');
    } else {
        document.getElementById('taskNotifier').style.setProperty('display', 'none', 'important');
    }
}

function createCard(tarea) {
    const div = document.createElement('div');
    div.className = 'task-card';
    div.draggable = true;
    div.dataset.id = tarea.id;
    
    const date = new Date(tarea.fechaCreacion).toLocaleDateString();
    const attachmentsCount = tarea.archivos ? tarea.archivos.length : 0;
    
    let attachHTML = '';
    if (attachmentsCount > 0) {
        attachHTML = `<div class="task-attachments" title="${attachmentsCount} archivo(s)">
            📎 ${attachmentsCount}
        </div>`;
    }

    div.innerHTML = `
        <div class="task-title">${escapeHTML(tarea.titulo)}</div>
        <div class="task-desc">${escapeHTML(tarea.descripcion || 'Sin instrucciones adicionales...')}</div>
        <div class="task-footer">
            <div class="text-truncate" style="max-width: 120px;" title="Creado por: ${tarea.creadoPor}">👤 ${tarea.creadoPor}</div>
            <div style="display:flex; gap:10px;">
                ${attachHTML}
                <div>📅 ${date}</div>
            </div>
        </div>
    `;

    // Eventos
    div.addEventListener('dragstart', (e) => {
        div.classList.add('dragging');
        e.dataTransfer.setData('text/plain', tarea.id);
    });

    div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
    });

    div.addEventListener('click', () => {
        openEditTaskModal(tarea.id);
    });

    return div;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// ================= DRAG & DROP KANBAN =================

function setupDragAndDrop() {
    const columns = document.querySelectorAll('.kanban-cards');

    columns.forEach(col => {
        col.addEventListener('dragover', e => {
            e.preventDefault();
            col.classList.add('drag-over');
        });

        col.addEventListener('dragleave', () => {
            col.classList.remove('drag-over');
        });

        col.addEventListener('drop', async e => {
            e.preventDefault();
            col.classList.remove('drag-over');
            
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = col.dataset.status;
            
            const tarea = tareas.find(t => t.id === taskId);
            if (tarea && tarea.estado !== newStatus) {
                tarea.estado = newStatus;
                renderKanban(); // Re-render local optimista
                
                // Guardar en DB
                try {
                    const token = localStorage.getItem('mr_token');
                    await fetch(`/api/tareas/${taskId}`, {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify({ estado: newStatus })
                    });
                } catch (err) {
                    console.error("Error guardando nuevo estado:", err);
                }
            }
        });
    });
}

// ================= MODAL & CRUD =================

function openNewTaskModal() {
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = '';
    document.getElementById('taskModalTitle').textContent = 'Nueva Tarea';
    document.getElementById('btnDeleteTask').style.display = 'none';
    currentAttachments = [];
    renderAttachments();
    taskModal.show();
}

function openEditTaskModal(id) {
    const tarea = tareas.find(t => t.id === id);
    if (!tarea) return;

    document.getElementById('taskId').value = tarea.id;
    document.getElementById('taskTitle').value = tarea.titulo;
    document.getElementById('taskDesc').value = tarea.descripcion || '';
    document.getElementById('taskStatus').value = tarea.estado;
    
    currentAttachments = tarea.archivos ? [...tarea.archivos] : [];
    renderAttachments();

    document.getElementById('taskModalTitle').textContent = 'Editar Tarea';
    document.getElementById('btnDeleteTask').style.display = 'block';
    taskModal.show();
}

async function saveTask() {
    const id = document.getElementById('taskId').value;
    const data = {
        titulo: document.getElementById('taskTitle').value.trim(),
        descripcion: document.getElementById('taskDesc').value.trim(),
        estado: document.getElementById('taskStatus').value,
        archivos: currentAttachments
    };

    if (!data.titulo) {
        alert("El título es obligatorio");
        return;
    }

    try {
        const token = localStorage.getItem('mr_token');
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/tareas/${id}` : `/api/tareas`;

        const res = await fetch(url, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(data)
        });

        if (!res.ok) throw new Error('Error guardando tarea');
        
        taskModal.hide();
        await loadTareas();
    } catch (error) {
        console.error(error);
        alert('Error al guardar');
    }
}

async function deleteTask() {
    const id = document.getElementById('taskId').value;
    if (!id) return;

    if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;

    try {
        const token = localStorage.getItem('mr_token');
        const res = await fetch(`/api/tareas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Error eliminando tarea');
        
        taskModal.hide();
        await loadTareas();
    } catch (error) {
        console.error(error);
        alert('Error al eliminar');
    }
}

// ================= FILE UPLOAD =================

function setupFileUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    });
}

async function handleFiles(files) {
    const token = localStorage.getItem('mr_token');
    document.getElementById('uploadingProgress').style.display = 'block';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('archivo', file);

        try {
            const res = await fetch('/api/tareas/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) throw new Error('Falló subida');
            const data = await res.json();
            
            if (data.success) {
                currentAttachments.push({
                    name: data.filename,
                    url: data.url
                });
            }
        } catch (error) {
            console.error(error);
            alert(`Error al subir ${file.name}`);
        }
    }

    document.getElementById('uploadingProgress').style.display = 'none';
    document.getElementById('fileInput').value = ''; // clear
    renderAttachments();
}

function renderAttachments() {
    const container = document.getElementById('attachmentsList');
    container.innerHTML = '';
    
    currentAttachments.forEach((att, index) => {
        const div = document.createElement('div');
        div.className = 'attachment-item';
        div.innerHTML = `
            <a href="${att.url}" target="_blank">
                📎 ${escapeHTML(att.name)}
            </a>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeAttachment(${index})">
                ❌
            </button>
        `;
        container.appendChild(div);
    });
}

function removeAttachment(index) {
    if (confirm('¿Quitar adjunto de la lista? (No se borrará del servidor inmediatamente)')) {
        currentAttachments.splice(index, 1);
        renderAttachments();
    }
}
