/**
 * GASTOS-MAIN.JS
 * Lógica para la gestión de gastos accesible para Vendedores, Admins y Superadmins.
 */

(function () {
    'use strict';

    let allGastos = [];

    // Elementos del DOM
    const gastListEl = document.getElementById('gastList');
    const totalGastosEl = document.getElementById('totalGastos');
    const countGastosEl = document.getElementById('countGastos');

    /**
     * Inicialización
     */
    async function init() {
        console.log('[GASTOS] 🚀 Inicializando...');

        const user = JSON.parse(localStorage.getItem('mr_user')) || {};
        const isVendedor = user.rol === 'vendedor';

        // Si es vendedor, ajustar etiquetas para ser honestos con los datos filtrados
        if (isVendedor) {
            const labelTotal = document.querySelector('.stat-label'); // "Total Gastos (Mes)"
            if (labelTotal) labelTotal.textContent = 'Mis Gastos (Mes)';
            
            const cardHeader = document.querySelector('.card-title'); // "Historial de Egresos"
            if (cardHeader) cardHeader.textContent = 'Mis Gastos Registrados';
        }

        // Cargar fecha actual por defecto en el modal
        document.getElementById('gastoFecha').value = new Date().toISOString().split('T')[0];

        await loadGastos();
    }

    /**
     * Cargar lista de gastos desde el servidor
     */
    async function loadGastos() {
        try {
            gastListEl.innerHTML = '<p class="empty-state">Cargando gastos...</p>';

            // Usar el manager para obtener gastos
            const data = await window.mrDataManager.getGastos();
            allGastos = Array.isArray(data) ? data : [];

            renderGastos();
            updateSummary();
        } catch (err) {
            console.error('[GASTOS] Error cargando:', err);
            gastListEl.innerHTML = `<p class="empty-state" style="color:var(--danger);">Error al cargar: ${err.message}</p>`;
        }
    }

    /**
     * Renderizar la lista en el HTML
     */
    function renderGastos() {
        if (allGastos.length === 0) {
            gastListEl.innerHTML = '<p class="empty-state">No hay gastos registrados</p>';
            return;
        }

        // Ordenar por fecha descendente
        const sorted = [...allGastos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        let html = `
            <table class="gastos-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th style="text-align:right;">Monto</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sorted.forEach((g, index) => {
            const id = g.id || `_index_${allGastos.indexOf(g)}`;
            html += `
                <tr>
                    <td class="fecha">${fmtDate(g.fecha)}</td>
                    <td style="font-weight:500;">${g.descripcion || g.concepto || 'Sin descripción'}</td>
                    <td class="monto" style="text-align:right;">$${fmt(g.monto)}</td>
                    <td style="text-align:right;">
                        <button class="btn btn-secondary btn-small" onclick="deleteGasto('${id}')" title="Eliminar">🗑️ Eliminar</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        gastListEl.innerHTML = html;
    }

    /**
     * Actualizar totales del encabezado
     */
    function updateSummary() {
        const total = allGastos.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
        totalGastosEl.textContent = `$${fmt(total)}`;
        countGastosEl.textContent = allGastos.length;
    }

    /**
     * Guardar nuevo gasto
     */
    window.saveGasto = async function () {
        const desc = document.getElementById('gastoDesc').value.trim();
        const monto = parseFloat(document.getElementById('gastoMonto').value);
        const fecha = document.getElementById('gastoFecha').value;

        if (!desc || isNaN(monto) || !fecha) {
            alert('Por favor complete todos los campos obligatorios (*)');
            return;
        }

        const btn = document.getElementById('btnSaveGasto');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        try {
            const user = JSON.parse(localStorage.getItem('mr_user')) || {};
            const nuevoGasto = {
                id: `gasto_${Date.now()}`,
                descripcion: desc,
                monto: monto,
                fecha: fecha,
                usuario: user.usuario || 'unknown'
            };

            const updatedList = [...allGastos, nuevoGasto];
            const success = await window.mrDataManager.saveGastos(updatedList);

            if (success) {
                allGastos = updatedList;
                closeGastoModal();
                renderGastos();
                updateSummary();
                // Limpiar form
                document.getElementById('gastoDesc').value = '';
                document.getElementById('gastoMonto').value = '';
            } else {
                throw new Error('El servidor no confirmó el guardado');
            }
        } catch (err) {
            alert('Error al guardar: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 Guardar Gasto';
        }
    };

    /**
     * Eliminar gasto
     */
    window.deleteGasto = async function (id) {
        if (!confirm('¿Está seguro de eliminar este gasto?')) return;

        try {
            let newList;
            if (id.startsWith('_index_')) {
                const idx = parseInt(id.replace('_index_', ''));
                newList = allGastos.filter((_, i) => i !== idx);
            } else {
                newList = allGastos.filter(g => g.id !== id);
            }

            const success = await window.mrDataManager.saveGastos(newList);
            if (success) {
                allGastos = newList;
                renderGastos();
                updateSummary();
            }
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
        }
    };

    /**
     * Modales
     */
    window.openGastoModal = function () {
        document.getElementById('gastoModal').classList.add('active');
    };

    window.closeGastoModal = function () {
        document.getElementById('gastoModal').classList.remove('active');
    };

    // Auxiliares
    function fmt(val) {
        return new Intl.NumberFormat('es-AR').format(val || 0);
    }

    function fmtDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-AR');
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
