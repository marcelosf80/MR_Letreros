/**
 * Módulo de Mantenimiento
 * Gestiona la limpieza de datos del sistema
 */

document.addEventListener('DOMContentLoaded', () => {
    renderMaintenanceCards();

    // Logout button
    document.body.addEventListener('click', e => {
        if (e.target.closest('#btn-logout, .btn-logout-sidebar')) {
            e.preventDefault();
            if(confirm('¿Cerrar sesión de forma segura?')) {
                localStorage.removeItem('mr_token');
                window.location.href = 'login.html';
            }
        }
    });
});

const SECTIONS = [
    {
        id: 'gremio_clientes',
        title: 'Clientes Gremio',
        desc: 'Base de datos de clientes del sistema Gremio.',
        icon: '🟢'
    },
    {
        id: 'gremio_data',
        title: 'Cotizaciones Gremio',
        desc: 'Historial de todas las cotizaciones realizadas en Gremio.',
        icon: '📄'
    },
    {
        id: 'clientes',
        title: 'Clientes Finales',
        desc: 'Base de datos unificada de clientes finales.',
        icon: '👥'
    },
    {
        id: 'clientes_data',
        title: 'Cotizaciones Clientes',
        desc: 'Historial de cotizaciones a consumidor final.',
        icon: '🔵'
    },
    {
        id: 'trabajos',
        title: 'Trabajos y Producción',
        desc: 'Lista de trabajos activos, pendientes y finalizados.',
        icon: '🔨'
    },
    {
        id: 'gastos',
        title: 'Gastos y Movimientos',
        desc: 'Registro de ingresos, egresos y movimientos financieros.',
        icon: '💸'
    },
    {
        id: 'precios',
        title: 'Base de Precios',
        desc: 'Configuración de precios de productos Gremio y Público.',
        icon: '💰'
    },
    {
        id: 'costos',
        title: 'Base de Costos',
        desc: 'Configuración de costos de materiales y mano de obra.',
        icon: '💳'
    },
    {
        id: 'materiales',
        title: 'Inventario Materiales',
        desc: 'Stock de rollos y materiales disponibles.',
        icon: '📦'
    },
    {
        id: 'terceros',
        title: 'Servicios Terceros',
        desc: 'Base de datos de proveedores y servicios externos.',
        icon: '🔧'
    }
];

function renderMaintenanceCards() {
    const container = document.getElementById('maintenanceGrid');
    if (!container) return;

    container.innerHTML = SECTIONS.map(section => `
        <div class="maintenance-card">
            <div>
                <div class="card-icon">${section.icon}</div>
                <div class="card-title">${section.title}</div>
                <div class="card-desc">${section.desc}</div>
            </div>
            <button class="btn-clean" onclick="cleanSection('${section.id}', '${section.title}')">
                🗑️ Limpiar Datos
            </button>
        </div>
    `).join('');
}

async function cleanSection(sectionId, sectionTitle) {
    if (!confirm(`⚠️ ¿Estás seguro de que quieres BORRAR TODOS los datos de ${sectionTitle}?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

    // Doble confirmación para seguridad
    if (!confirm(`Confirma nuevamente: Se eliminarán permanentemente los datos de ${sectionTitle}.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/system/reset/${sectionId}`, {
            method: 'POST'
        });

        const result = await response.json();

        if (response.ok && result.success) {
            alert(`✅ ${sectionTitle} limpiado correctamente.`);
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al limpiar la sección: ' + error.message);
    }
}

async function resetAllSystem() {
    const code = prompt("⚠️ PELIGRO: Estás a punto de borrar TODO el sistema.\n\nEscribe 'BORRAR TODO' para confirmar:");
    
    if (!code || code.toUpperCase() !== 'BORRAR TODO') {
        alert('Operación cancelada.');
        return;
    }

    try {
        const response = await fetch('/api/system/reset/all', {
            method: 'POST'
        });

        const result = await response.json();

        if (response.ok && result.success) {
            alert('✅ SISTEMA RESTABLECIDO DE FÁBRICA.\n\nTodos los datos han sido eliminados.');
            window.location.reload();
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al resetear el sistema: ' + error.message);
    }
}

async function backupSystem() {
    try {
        if (window.mrDataManager) {
            await window.mrDataManager.createBackup();
        } else {
            alert('❌ Error: El gestor de datos no está disponible.');
        }
    } catch (error) {
        console.error('Error en backup:', error);
        alert('❌ Error al crear el backup');
    }
}

// Exponer funciones globalmente
window.cleanSection = cleanSection;
window.resetAllSystem = resetAllSystem;
window.backupSystem = backupSystem;