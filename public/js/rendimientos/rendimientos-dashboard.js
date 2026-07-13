// ==================== DASHBOARD DE RENDIMIENTOS ====================
// Visualización completa de datos financieros

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DASHBOARD] Iniciando carga de rendimientos...');
    loadRendimientos();
});

async function loadRendimientos() {
    // Buscar un contenedor, si no existe, usar el body (o crear uno específico en tu HTML)
    let container = document.getElementById('dashboard-container');
    if (!container) {
        // Si no hay contenedor específico, buscamos donde inyectarlo
        const mainContent = document.querySelector('.main-content') || document.body;
        container = document.createElement('div');
        container.id = 'dashboard-container';
        mainContent.appendChild(container);
    }
    
    // Inyectar estructura HTML del Dashboard
    container.innerHTML = `
        <div id="dashboard-wrapper" style="padding: 20px; font-family: 'Segoe UI', sans-serif; color: #333;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="margin:0; color: #2c3e50;">📊 Reporte Financiero</h2>
                <button onclick="loadRendimientos()" style="padding:8px 15px; background:#3498db; color:white; border:none; border-radius:4px; cursor:pointer;">🔄 Actualizar</button>
            </div>
            
            <!-- TARJETAS DE RESUMEN -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div class="dash-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 5px solid #4CAF50;">
                    <h3 style="margin: 0; color: #7f8c8d; font-size: 0.9rem; text-transform: uppercase;">Ingresos Totales</h3>
                    <p id="dash-ingresos" style="font-size: 2rem; font-weight: bold; margin: 10px 0; color: #2c3e50;">$0.00</p>
                </div>
                <div class="dash-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 5px solid #F44336;">
                    <h3 style="margin: 0; color: #7f8c8d; font-size: 0.9rem; text-transform: uppercase;">Gastos Totales</h3>
                    <p id="dash-gastos" style="font-size: 2rem; font-weight: bold; margin: 10px 0; color: #2c3e50;">$0.00</p>
                </div>
                <div class="dash-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 5px solid #2196F3;">
                    <h3 style="margin: 0; color: #7f8c8d; font-size: 0.9rem; text-transform: uppercase;">Ganancia Neta</h3>
                    <p id="dash-ganancia" style="font-size: 2rem; font-weight: bold; margin: 10px 0; color: #2c3e50;">$0.00</p>
                </div>
                <div class="dash-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 5px solid #FF9800;">
                    <h3 style="margin: 0; color: #7f8c8d; font-size: 0.9rem; text-transform: uppercase;">Margen Real</h3>
                    <p id="dash-margen" style="font-size: 2rem; font-weight: bold; margin: 10px 0; color: #2c3e50;">0%</p>
                </div>
            </div>

            <!-- TABLAS DE DETALLE -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 20px;">
                
                <!-- TABLA: RENTABILIDAD POR CATEGORÍA -->
                <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h3 style="border-bottom: 2px solid #f1f1f1; padding-bottom: 15px; margin-top: 0; color: #34495e;">📦 Rentabilidad por Producto</h3>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                            <thead>
                                <tr style="background: #f8f9fa; text-align: left; color: #7f8c8d;">
                                    <th style="padding: 12px;">Categoría</th>
                                    <th style="padding: 12px; text-align: right;">Ventas</th>
                                    <th style="padding: 12px; text-align: right;">Costos</th>
                                    <th style="padding: 12px; text-align: right;">Ganancia</th>
                                    <th style="padding: 12px; text-align: center;">%</th>
                                </tr>
                            </thead>
                            <tbody id="table-categorias">
                                <tr><td colspan="5" style="padding: 20px; text-align: center;">Cargando datos...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- TABLA: DESGLOSE DE GASTOS -->
                <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h3 style="border-bottom: 2px solid #f1f1f1; padding-bottom: 15px; margin-top: 0; color: #34495e;">💸 Desglose de Gastos</h3>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                            <thead>
                                <tr style="background: #f8f9fa; text-align: left; color: #7f8c8d;">
                                    <th style="padding: 12px;">Concepto</th>
                                    <th style="padding: 12px; text-align: right;">Monto</th>
                                    <th style="padding: 12px; text-align: right;">% del Total</th>
                                </tr>
                            </thead>
                            <tbody id="table-gastos">
                                <tr><td colspan="3" style="padding: 20px; text-align: center;">Cargando datos...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    try {
        const response = await fetch('/api/rendimientos');
        if (!response.ok) throw new Error('Error en el servidor');
        
        const data = await response.json();
        console.log('[DASHBOARD] Datos recibidos:', data);
        
        // --- ACTUALIZAR TARJETAS ---
        document.getElementById('dash-ingresos').textContent = formatMoney(data.resumen.ingresos);
        document.getElementById('dash-gastos').textContent = formatMoney(data.resumen.gastosOperativos);
        
        const gananciaElem = document.getElementById('dash-ganancia');
        gananciaElem.textContent = formatMoney(data.resumen.gananciaNeta);
        gananciaElem.style.color = data.resumen.gananciaNeta >= 0 ? '#27ae60' : '#c0392b';
        
        document.getElementById('dash-margen').textContent = data.resumen.margenTotal.toFixed(1) + '%';

        // --- ACTUALIZAR TABLA CATEGORÍAS ---
        const catTable = document.getElementById('table-categorias');
        if (data.porCategoria.length === 0) {
            catTable.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">No hay ventas registradas aún</td></tr>';
        } else {
            catTable.innerHTML = data.porCategoria.map(c => `
                <tr style="border-bottom: 1px solid #f1f1f1;">
                    <td style="padding: 12px;">
                        <strong>${c.categoria}</strong>
                        <div style="font-size: 0.8rem; color: #95a5a6;">${c.cantidad} ventas</div>
                    </td>
                    <td style="padding: 12px; text-align: right; color: #2980b9;">${formatMoney(c.ingresos)}</td>
                    <td style="padding: 12px; text-align: right; color: #c0392b;">${formatMoney(c.costos)}</td>
                    <td style="padding: 12px; text-align: right; font-weight: bold; color: ${c.ganancia >= 0 ? '#27ae60' : '#c0392b'}">
                        ${formatMoney(c.ganancia)}
                    </td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="background: ${c.margen >= 30 ? '#e8f8f5' : '#fdedec'}; color: ${c.margen >= 30 ? '#27ae60' : '#c0392b'}; padding: 4px 8px; border-radius: 12px; font-size: 0.85rem; font-weight: bold;">
                            ${c.margen.toFixed(1)}%
                        </span>
                    </td>
                </tr>
            `).join('');
        }

        // --- ACTUALIZAR TABLA GASTOS ---
        const gastosTable = document.getElementById('table-gastos');
        const gastosDetalle = Object.entries(data.gastosDetalle).sort((a, b) => b[1] - a[1]);
        const totalGastos = data.resumen.gastosOperativos;
        
        if (gastosDetalle.length === 0) {
            gastosTable.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #999;">No hay gastos registrados</td></tr>';
        } else {
            gastosTable.innerHTML = gastosDetalle.map(([cat, monto]) => {
                const porcentaje = totalGastos > 0 ? (monto / totalGastos * 100) : 0;
                return `
                <tr style="border-bottom: 1px solid #f1f1f1;">
                    <td style="padding: 12px;">${formatLabel(cat)}</td>
                    <td style="padding: 12px; text-align: right; font-weight: bold; color: #555;">${formatMoney(monto)}</td>
                    <td style="padding: 12px; text-align: right; color: #95a5a6;">${porcentaje.toFixed(1)}%</td>
                </tr>
            `}).join('');
        }

    } catch (error) {
        console.error('[DASHBOARD] Error:', error);
        document.getElementById('dashboard-container').innerHTML = `
            <div style="padding: 20px; text-align: center; color: #c0392b;">
                <h3>❌ Error al cargar datos</h3>
                <p>Asegúrate de que el servidor esté corriendo (INICIAR_SERVIDOR.bat)</p>
                <p>Detalle: ${error.message}</p>
            </div>
        `;
    }
}

// Helpers
function formatMoney(amount) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
}

function formatLabel(text) {
    return text.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
