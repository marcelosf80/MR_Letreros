// ==================== SISTEMA GREMIO v3.6 - MAIN ====================

document.addEventListener('DOMContentLoaded', () => {
  
  // ==================== PARCHES INICIALES ====================
  
  // Parche para preciosManager.addPrecio si no existe
  if (window.preciosManager) {
    if (!window.preciosManager.addPrecio) {
      console.log('[PARCHE] ⚠️ addPrecio no existe, creando...');
      
      window.preciosManager.addPrecio = async function(precioData) {
        try {
          console.log('[addPrecio PARCHEADO] Datos recibidos:', precioData);
          
          // Validar campos requeridos por el validador interno
          if (!precioData.pricePublico) {
            precioData.pricePublico = precioData.priceGremio * 1.3; // Default +30%
            console.log('[addPrecio PARCHEADO] pricePublico calculado automáticamente:', precioData.pricePublico);
          }
          
          if (!precioData.unit) {
            precioData.unit = 'Unidad';
            console.log('[addPrecio PARCHEADO] unit asignado:', precioData.unit);
          }
          
          // Asignar ID si no existe
          if (!precioData.id) {
            precioData.id = Date.now();
          }
          
          // Validar con el validador interno si existe
          if (typeof this.validarPrecio === 'function') {
            console.log('[addPrecio PARCHEADO] Validando con validador interno...');
            const validacion = this.validarPrecio(precioData);
            
            if (!validacion.valido) {
              console.error('[addPrecio PARCHEADO] Errores de validación:', validacion.errores);
              return false;
            }
            
            console.log('[addPrecio PARCHEADO] ✅ Validación pasada');
          }
          
          // Obtener lista actual
          let lista = await this.getPrecios();
          console.log('[addPrecio PARCHEADO] Lista actual:', lista.length, 'precios');
          
          // Agregar nuevo precio
          lista.push(precioData);
          console.log('[addPrecio PARCHEADO] Nueva lista:', lista.length, 'precios');
          
          // Guardar
          const resultado = await this.savePrecios(lista);
          console.log('[addPrecio PARCHEADO] Resultado:', resultado);
          
          return resultado;
        } catch (e) {
          console.error('[addPrecio PARCHEADO] Error:', e);
          console.error('[addPrecio PARCHEADO] Stack:', e.stack);
          return false;
        }
      };
      
      console.log('[PARCHE] ✅ Función addPrecio creada correctamente');
    } else {
      console.log('[PARCHE] ✅ addPrecio ya existe, no se necesita parche');
    }
  } else {
    console.error('[PARCHE] ❌ preciosManager no está disponible');
  }
  // =================================================================
  
  console.log('✅ Todos los managers están disponibles');
  console.log('=================================');
  
  // ==================== VARIABLES GLOBALES ====================
  
  let productsInQuotation = [];
  let currentClientId = null;
  let currentClientData = null;
  let allClients = [];

// ==================== CHECKBOXES LACA Y PEGADO ====================

const includeLaca = document.getElementById('includeLaca');
const includePegado = document.getElementById('includePegado');
const lacaPriceGroup = document.getElementById('lacaPriceGroup');
const pegadoPriceGroup = document.getElementById('pegadoPriceGroup');

includeLaca.addEventListener('change', (e) => {
  lacaPriceGroup.style.display = e.target.checked ? 'block' : 'none';
  if (!e.target.checked) {
    document.getElementById('lacaPrice').value = '0';
  }
});

includePegado.addEventListener('change', (e) => {
  pegadoPriceGroup.style.display = e.target.checked ? 'block' : 'none';
  if (!e.target.checked) {
    document.getElementById('pegadoPrice').value = '0';
  }
});

// ==================== MODALES ====================

function setupModal(modalId, openBtnId, closeBtnId, cancelBtnId = null) {
  const modal = document.getElementById(modalId);
  const openBtn = document.getElementById(openBtnId);
  const closeBtn = document.getElementById(closeBtnId);
  
  if (openBtn) {
    openBtn.addEventListener('click', () => modal.classList.add('active'));
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }
  if (cancelBtnId) {
    const cancelBtn = document.getElementById(cancelBtnId);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
    }
  }
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
  
  return modal;
}

const configModal = setupModal('configModal', 'btnConfig', 'btnCloseConfig');
const searchClientModal = setupModal('searchClientModal', 'btnSearchClient', 'btnCloseSearchClient');
const productModal = setupModal('productModal', 'btnAddProduct', 'btnCloseProduct', 'btnCancelProduct');
const priceModal = setupModal('priceModal', 'btnAddPrice', 'btnClosePrice', 'btnCancelPrice');
const costoModal = setupModal('costoModal', 'btnAddCosto', 'btnCloseCosto', 'btnCancelCosto');

// ==================== BUSCAR CLIENTES ====================

const searchClientInput = document.getElementById('searchClientInput');

document.getElementById('btnSearchClient').addEventListener('click', async () => {
  searchClientModal.classList.add('active');
  await loadClientsForSearch();
});

searchClientInput.addEventListener('input', (e) => {
  filterClients(e.target.value);
});

async function loadClientsForSearch() {
  try {
    allClients = await window.dataManager.getClients();
    displayClientsInSearch(allClients);
  } catch (error) {
    console.error('Error cargando clientes:', error);
    document.getElementById('clientSearchResults').innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Error cargando clientes</p>';
  }
}

function displayClientsInSearch(clients) {
  const container = document.getElementById('clientSearchResults');
  
  if (!clients || clients.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay clientes guardados</p>';
    return;
  }
  
  container.innerHTML = clients.map(client => `
    <div class="client-list-item" data-client-id="${client.id}" style="cursor: pointer;">
      <h4>${client.name}</h4>
      <p>${client.contact || 'Sin contacto'}</p>
    </div>
  `).join('');
  
  // Agregar event listeners a cada item
  container.querySelectorAll('.client-list-item').forEach(item => {
    item.addEventListener('click', function() {
      const clientId = this.getAttribute('data-client-id');
      selectClient(clientId);
    });
  });
}

function filterClients(searchTerm) {
  if (!searchTerm) {
    displayClientsInSearch(allClients);
    return;
  }
  
  const filtered = allClients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.contact && client.contact.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  displayClientsInSearch(filtered);
}

async function selectClient(clientId) {
  try {
    const client = allClients.find(c => c.id === clientId);
    if (!client) {
      alert('❌ Cliente no encontrado');
      return;
    }
    
    currentClientId = clientId;
    currentClientData = client;
    document.getElementById('clientId').value = clientId;
    document.getElementById('clientName').value = client.name;
    document.getElementById('clientContact').value = client.contact || '';
    document.getElementById('clientNotes').value = client.notes || '';
    
    await loadClientHistory(clientId);
    
    searchClientModal.classList.remove('active');
    searchClientInput.value = '';
    
    alert('✅ Cliente cargado: ' + client.name);
  } catch (error) {
    console.error('Error seleccionando cliente:', error);
    alert('❌ Error al cargar cliente');
  }
}

// ==================== HISTORIAL ====================

async function loadClientHistory(clientId) {
  try {
    const history = await window.dataManager.getClientHistory(clientId);
    const historyCard = document.getElementById('historyCard');
    const historyList = document.getElementById('historyList');
    
    if (!history || history.length === 0) {
      historyCard.style.display = 'block';
      historyList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay cotizaciones guardadas para este cliente</p>';
      return;
    }
    
    historyCard.style.display = 'block';
    historyList.innerHTML = history.map((item, index) => {
      const statusBadge = item.approved ? 
        '<span style="background: rgba(81, 207, 102, 0.2); color: #51CF66; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">✓ Aprobada</span>' : 
        '<span style="background: rgba(255, 193, 7, 0.2); color: #FFC107; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">⏳ Pendiente</span>';
      
      const actionButtons = !item.approved ? `
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-small btn-edit-quotation" data-quotation-index="${index}">✏️ Editar</button>
          <button class="btn btn-success btn-small btn-approve-quotation" data-quotation-index="${index}">✓ Aprobar</button>
        </div>
      ` : '';
      
      return `
        <div class="product-item" style="margin-bottom: 1rem;">
          <div class="product-info" style="flex: 1;">
            <h4>Cotización #${index + 1} ${statusBadge}</h4>
            <div class="product-details">
              Fecha: ${new Date(item.date).toLocaleDateString('es-AR')}<br>
              Productos: ${item.products ? item.products.length : 0}
            </div>
            <div class="product-price">Total: $${(item.total || 0).toFixed(2)}</div>
          </div>
          ${actionButtons}
        </div>
      `;
    }).join('');
    
    // Agregar event listeners a los botones
    historyList.querySelectorAll('.btn-edit-quotation').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-quotation-index'));
        editQuotation(index);
      });
    });
    
    historyList.querySelectorAll('.btn-approve-quotation').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-quotation-index'));
        approveQuotationFromHistory(index);
      });
    });
  } catch (error) {
    console.error('Error cargando historial:', error);
  }
}

async function editQuotation(index) {
  try {
    const history = await window.dataManager.getClientHistory(currentClientId);
    const quotation = history[index];
    
    if (!quotation || quotation.approved) {
      alert('⚠️ No se puede editar esta cotización');
      return;
    }
    
    productsInQuotation = quotation.products.map(p => ({...p}));
    renderProducts();
    updateTotal();
    
    document.querySelector('.card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    alert('✅ Cotización cargada para editar\n\nPuedes modificar los productos y guardar los cambios.');
  } catch (error) {
    console.error('Error editando cotización:', error);
    alert('❌ Error al cargar cotización');
  }
}

async function approveQuotationFromHistory(index) {
  if (!confirm('¿Aprobar esta cotización?\n\nSe marcará como APROBADA y se contabilizará en rendimientos.')) {
    return;
  }
  
  try {
    const history = await window.dataManager.getClientHistory(currentClientId);
    const quotation = history[index];
    
    if (!quotation || quotation.approved) {
      alert('⚠️ Esta cotización ya está aprobada');
      return;
    }
    
    quotation.approved = true;
    quotation.approvedDate = new Date().toISOString();
    quotation.approvedBy = 'Sistema';
    
    const success = await window.dataManager.updateHistoryEntry(currentClientId, index, quotation);
    
    if (success) {
      alert('✅ COTIZACIÓN APROBADA\n\nSe ha registrado y contabilizado en rendimientos.');
      await loadClientHistory(currentClientId);
      await updateStatistics();
    } else {
      alert('❌ Error al aprobar cotización');
    }
  } catch (error) {
    console.error('Error aprobando cotización:', error);
    alert('❌ Error al aprobar cotización');
  }
}

// ==================== PRODUCTOS ====================

document.getElementById('btnSaveProduct').addEventListener('click', () => {
  const select = document.getElementById('productSelect');
  const width = parseFloat(document.getElementById('productWidth').value) || 0;
  const height = parseFloat(document.getElementById('productHeight').value) || 0;
  const quantity = parseFloat(document.getElementById('productQuantity').value);
  const price = parseFloat(document.getElementById('productPrice').value);
  const notes = document.getElementById('productNotes').value;
  const includeLacaChecked = document.getElementById('includeLaca').checked;
  const includePegadoChecked = document.getElementById('includePegado').checked;
  const lacaPrice = includeLacaChecked ? parseFloat(document.getElementById('lacaPrice').value) || 0 : 0;
  const pegadoPrice = includePegadoChecked ? parseFloat(document.getElementById('pegadoPrice').value) || 0 : 0;
  
  if (!select.value || !quantity || !price) {
    alert('⚠️ Completá producto, cantidad y precio');
    return;
  }
  
  // Calcular cantidad final (m² si hay dimensiones, sino cantidad simple)
  let finalQuantity = quantity;
  let measureDetails = '';
  
  if (width > 0 && height > 0) {
    // Hay dimensiones, calcular m²
    const widthM = width / 100;
    const heightM = height / 100;
    finalQuantity = widthM * heightM * quantity;
    measureDetails = `${width}×${height}cm × ${quantity} = ${finalQuantity.toFixed(4)}m²`;
  } else {
    // Sin dimensiones, cantidad simple
    measureDetails = `${quantity} unidades`;
  }
  
  const baseTotal = finalQuantity * price;
  const totalWithExtras = baseTotal + lacaPrice + pegadoPrice;
  
  const product = {
    id: Date.now(),
    name: select.options[select.selectedIndex].text,
    category: select.value,
    width: width,
    height: height,
    quantity: finalQuantity,
    originalQuantity: quantity,
    measureDetails: measureDetails,
    unitPrice: price,
    baseTotal: baseTotal,
    lacaPrice: lacaPrice,
    pegadoPrice: pegadoPrice,
    total: totalWithExtras,
    notes: notes,
    includeLaca: includeLacaChecked,
    includePegado: includePegadoChecked
  };
  
  productsInQuotation.push(product);
  renderProducts();
  updateTotal();
  
  // Limpiar campos
  select.value = '';
  document.getElementById('productWidth').value = '';
  document.getElementById('productHeight').value = '';
  document.getElementById('productQuantity').value = '1';
  document.getElementById('productPrice').value = '';
  document.getElementById('productNotes').value = '';
  document.getElementById('calculatedInfo').textContent = 'Ingresa dimensiones para calcular m²';
  document.getElementById('includeLaca').checked = false;
  document.getElementById('includePegado').checked = false;
  document.getElementById('lacaPrice').value = '0';
  document.getElementById('pegadoPrice').value = '0';
  lacaPriceGroup.style.display = 'none';
  pegadoPriceGroup.style.display = 'none';
  
  productModal.classList.remove('active');
  alert('✅ Producto agregado');
});

function renderProducts() {
  const container = document.getElementById('productsList');
  if (productsInQuotation.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay productos agregados</p>';
    return;
  }
  
  container.innerHTML = productsInQuotation.map(p => {
    let details = p.measureDetails || `Cantidad: ${p.quantity}`;
    details += ` | Precio: $${p.unitPrice.toFixed(2)}`;
    if (p.includeLaca) details += `<br>✓ Laca: $${p.lacaPrice.toFixed(2)}`;
    if (p.includePegado) details += `<br>✓ Pegado: $${p.pegadoPrice.toFixed(2)}`;
    if (p.notes) details += `<br>Nota: ${p.notes}`;
    
    return `
      <div class="product-item">
        <div class="product-info">
          <h4>${p.name}</h4>
          <div class="product-details">${details}</div>
          <div class="product-price">Total: $${p.total.toFixed(2)}</div>
        </div>
        <button class="btn btn-danger btn-small" onclick="removeProduct(${p.id})">🗑️</button>
      </div>
    `;
  }).join('');
}

function removeProduct(id) {
  if (confirm('¿Eliminar producto?')) {
    productsInQuotation = productsInQuotation.filter(p => p.id !== id);
    renderProducts();
    updateTotal();
  }
}

function updateTotal() {
  const total = productsInQuotation.reduce((sum, p) => sum + p.total, 0);
  document.getElementById('totalAmount').textContent = '$' + total.toFixed(2);
}

// ==================== GUARDAR COTIZACIÓN ====================

document.getElementById('btnSaveQuotation').addEventListener('click', async () => {
  await saveQuotation(false);
});

document.getElementById('btnApproveQuotation').addEventListener('click', async () => {
  if (!confirm('¿Aprobar esta cotización?\n\nSe marcará como APROBADA y se contabilizará en rendimientos.')) {
    return;
  }
  await saveQuotation(true);
});

async function saveQuotation(approved = false) {
  const clientName = document.getElementById('clientName').value.trim();
  const clientId = document.getElementById('clientId').value;
  
  if (!clientName) {
    alert('⚠️ Primero guardá o seleccioná un cliente');
    return;
  }
  
  if (productsInQuotation.length === 0) {
    alert('⚠️ Agregá al menos un producto');
    return;
  }
  
  let finalClientId = clientId;
  if (!finalClientId) {
    const client = {
      name: clientName,
      contact: document.getElementById('clientContact').value.trim(),
      notes: document.getElementById('clientNotes').value.trim()
    };
    
    const savedClient = await window.dataManager.saveClient(client);
    if (savedClient) {
      const clients = await window.dataManager.getClients();
      const newClient = clients.find(c => c.name === clientName);
      finalClientId = newClient ? newClient.id : null;
    }
  }
  
  if (!finalClientId) {
    alert('❌ Error guardando cliente');
    return;
  }
  
  const total = productsInQuotation.reduce((sum, p) => sum + p.total, 0);
  
  const quotation = {
    date: new Date().toISOString(),
    products: productsInQuotation,
    total: total,
    approved: approved
  };
  
  if (approved) {
    quotation.approvedDate = new Date().toISOString();
    quotation.approvedBy = 'Sistema';
  }
  
  const success = await window.dataManager.saveQuotation(finalClientId, quotation);
  if (success) {
    if (approved) {
      alert('✅ COTIZACIÓN APROBADA\n\nSe ha registrado y contabilizado en rendimientos.');
    } else {
      alert('✅ Cotización guardada correctamente');
    }
    
    productsInQuotation = [];
    renderProducts();
    updateTotal();
    await loadClientHistory(finalClientId);
    await updateStatistics();
  } else {
    alert('❌ Error guardando cotización');
  }
}

// ==================== GENERAR PDF ====================

document.getElementById('btnGeneratePDF').addEventListener('click', async () => {
  const clientName = document.getElementById('clientName').value.trim();
  
  if (!clientName) {
    alert('⚠️ Primero ingresá el nombre del cliente');
    return;
  }

  if (productsInQuotation.length === 0) {
    alert('⚠️ Agregá al menos un producto');
    return;
  }

  await generatePDF();
});

async function generatePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  let y = 20;

  doc.setFontSize(22);
  doc.setTextColor(81, 207, 102);
  doc.text('MR LETREROS', pageWidth / 2, y, { align: 'center' });
  
  y += 10;
  doc.setFontSize(16);
  doc.text('COTIZACIÓN SISTEMA GREMIO', pageWidth / 2, y, { align: 'center' });
  
  y += 15;
  doc.setDrawColor(81, 207, 102);
  doc.line(margin, y, pageWidth - margin, y);

  y += 10;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('DATOS DEL CLIENTE', margin, y);
  
  y += 8;
  doc.setFontSize(10);
  const clientName = document.getElementById('clientName').value;
  const clientContact = document.getElementById('clientContact').value;
  const fecha = new Date().toLocaleDateString('es-AR');
  
  doc.text(`Cliente: ${clientName}`, margin, y);
  y += 6;
  doc.text(`Contacto: ${clientContact}`, margin, y);
  y += 6;
  doc.text(`Fecha: ${fecha}`, margin, y);
  
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);

  y += 10;
  doc.setFontSize(12);
  doc.text('DETALLE DE PRODUCTOS', margin, y);
  
  y += 8;
  doc.setFontSize(9);
  
  doc.setFillColor(81, 207, 102);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, pageWidth - 2*margin, 7, 'F');
  doc.text('Producto', margin + 2, y + 5);
  doc.text('Cantidad', margin + 80, y + 5);
  doc.text('Precio Unit.', margin + 110, y + 5);
  doc.text('Total', margin + 150, y + 5);
  
  y += 10;
  doc.setTextColor(0, 0, 0);

  productsInQuotation.forEach((product, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 4, pageWidth - 2*margin, 7, 'F');
    }

    doc.text(product.name, margin + 2, y);
    doc.text(product.quantity.toString(), margin + 80, y);
    doc.text('$' + product.unitPrice.toFixed(2), margin + 110, y);
    doc.text('$' + product.baseTotal.toFixed(2), margin + 150, y);
    
    y += 7;
    
    if (product.includeLaca) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('+ Laca', margin + 5, y);
      doc.text('$' + product.lacaPrice.toFixed(2), margin + 150, y);
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
    }
    
    if (product.includePegado) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('+ Pegado', margin + 5, y);
      doc.text('$' + product.pegadoPrice.toFixed(2), margin + 150, y);
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
    }
  });

  y += 5;
  doc.setDrawColor(81, 207, 102);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  
  y += 8;
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  const total = productsInQuotation.reduce((sum, p) => sum + p.total, 0);
  doc.text('TOTAL:', pageWidth - margin - 60, y);
  doc.setTextColor(81, 207, 102);
  doc.text('$' + total.toFixed(2), pageWidth - margin - 20, y, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont(undefined, 'normal');
  const footerY = doc.internal.pageSize.height - 10;
  doc.text('MR Letreros - Sistema de Cotizaciones v3.5', pageWidth / 2, footerY, { align: 'center' });

  const fileName = `Cotizacion_${clientName.replace(/\s+/g, '_')}_${fecha.replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
  
  alert('✅ PDF generado correctamente');
}

// ==================== PRECIOS ====================

// ==================== CARGAR LISTA DE PRECIOS ====================
// NOTA: Usamos window.preciosManager del archivo externo js/precios-manager.js

async function loadPricesList() {
  const precios = await window.preciosManager.getPrecios();
  const container = document.getElementById('pricesList');
  
  if (precios.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay precios configurados</p>';
    return;
  }

  container.innerHTML = precios.map(p => `
    <div class="product-item">
      <div class="product-info">
        <h4>${p.name}</h4>
        <div class="product-details">
          Gremio: $${(p.priceGremio || 0).toFixed(2)} | Público: $${(p.pricePublico || 0).toFixed(2)} | ${p.unit || 'Unidad'}
          ${p.discount > 0 ? `<br>Descuento: ${p.discount}%` : ''}
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-primary btn-small btn-edit-precio" data-precio-id="${p.id}" title="Editar precio">✏️</button>
        <button class="btn btn-danger btn-small btn-delete-precio" data-precio-id="${p.id}" title="Eliminar precio">🗑️</button>
      </div>
    </div>
  `).join('');
  
  // Agregar event listeners a los botones
  container.querySelectorAll('.btn-edit-precio').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.getAttribute('data-precio-id');
      window.editPrecio(id);
    });
  });
  
  container.querySelectorAll('.btn-delete-precio').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.getAttribute('data-precio-id');
      window.deletePrecio(id);
    });
  });
}

// ==================== EDITAR PRECIO (GLOBAL) ====================

window.editPrecio = async function(id) {
  try {
    const precios = await window.preciosManager.getPrecios();
    const precio = precios.find(p => p.id == id);
    
    if (!precio) {
      alert('❌ Precio no encontrado');
      return;
    }
    
    // Llenar el modal con los datos actuales
    document.getElementById('priceCategory').value = precio.category || '';
    
    // Disparar el evento change para cargar productos
    const categorySelect = document.getElementById('priceCategory');
    categorySelect.dispatchEvent(new Event('change'));
    
    // Esperar un momento para que se carguen los productos
    setTimeout(() => {
      const productSelect = document.getElementById('priceProduct');
      
      // Buscar la opción que coincida con el nombre del producto
      for (let i = 0; i < productSelect.options.length; i++) {
        if (productSelect.options[i].text === precio.name) {
          productSelect.selectedIndex = i;
          break;
        }
      }
      
      document.getElementById('priceGremio').value = precio.priceGremio || 0;
    }, 300);
    
    // Abrir modal
    document.getElementById('priceModal').classList.add('active');
    
    // Cambiar el botón de guardar temporalmente
    const btnSave = document.getElementById('btnSavePrice');
    const originalText = btnSave.textContent;
    btnSave.textContent = '💾 Actualizar Precio';
    
    // Crear función temporal para actualizar
    const updateHandler = async function() {
      try {
        const category = document.getElementById('priceCategory').value;
        const productSelect = document.getElementById('priceProduct');
        const productName = productSelect.options[productSelect.selectedIndex]?.text;
        const precioGremio = parseFloat(document.getElementById('priceGremio').value);
        
        if (!category || !productName || isNaN(precioGremio) || precioGremio <= 0) {
          alert('⚠️ Completa todos los campos correctamente');
          return;
        }
        
        // Actualizar el precio existente
        precio.category = category;
        precio.name = productName;
        precio.priceGremio = precioGremio;
        
        // Guardar lista actualizada
        const success = await window.preciosManager.savePrecios(precios);
        
        if (success) {
          alert('✅ Precio actualizado');
          document.getElementById('priceModal').classList.remove('active');
          loadPricesList();
          
          // Restaurar botón original
          btnSave.textContent = originalText;
          btnSave.onclick = window.originalSavePriceHandler;
        }
      } catch (error) {
        console.error('Error actualizando:', error);
        alert('❌ Error al actualizar');
      }
    };
    
    // Guardar el handler original si no existe
    if (!window.originalSavePriceHandler) {
      window.originalSavePriceHandler = btnSave.onclick;
    }
    
    btnSave.onclick = updateHandler;
    
  } catch (error) {
    console.error('Error en editPrecio:', error);
    alert('❌ Error al editar precio');
  }
};

// ==================== ELIMINAR PRECIO (GLOBAL) ====================

window.deletePrecio = async function(id) {
  if (confirm('¿Eliminar este precio?')) {
    const precios = await window.preciosManager.getPrecios();
    const filtered = precios.filter(p => p.id != id);
    const success = await window.preciosManager.savePrecios(filtered);
    if (success) {
      alert('✅ Precio eliminado');
      loadPricesList();
    }
  }
};

// ==================== COSTOS ====================

const costoMaterial = document.getElementById('costoMaterial');
const costoLabor = document.getElementById('costoLabor');
const costoIndirect = document.getElementById('costoIndirect');
const costoTotal = document.getElementById('costoTotal');

function updateCostoTotal() {
  const material = parseFloat(costoMaterial.value) || 0;
  const labor = parseFloat(costoLabor.value) || 0;
  const indirect = parseFloat(costoIndirect.value) || 0;
  const total = material + labor + indirect;
  costoTotal.textContent = '$' + total.toFixed(2);
}

costoMaterial.addEventListener('input', updateCostoTotal);
costoLabor.addEventListener('input', updateCostoTotal);
costoIndirect.addEventListener('input', updateCostoTotal);

document.getElementById('btnSaveCosto').addEventListener('click', async () => {
  const name = document.getElementById('costoName').value.trim();
  const category = document.getElementById('costoCategory').value.trim();
  const unit = document.getElementById('costoUnit').value;
  const material = parseFloat(costoMaterial.value) || 0;
  const labor = parseFloat(costoLabor.value) || 0;
  const indirect = parseFloat(costoIndirect.value) || 0;
  
  if (!name || !category) {
    alert('⚠️ Completá nombre y categoría');
    return;
  }
  
  const product = {
    id: 'prod_' + Date.now(),
    name,
    category,
    unit,
    costs: { material, labor, indirect, total: material + labor + indirect }
  };
  
  const success = await window.costosManager.addProduct(product);
  if (success) {
    alert('✅ Producto guardado');
    document.getElementById('costoName').value = '';
    document.getElementById('costoCategory').value = '';
    costoMaterial.value = '0';
    costoLabor.value = '0';
    costoIndirect.value = '0';
    updateCostoTotal();
    costoModal.classList.remove('active');
    loadCostosList();
  } else {
    alert('❌ Error al guardar');
  }
});

async function loadCostosList() {
  await window.costosManager.loadCostos();
  const products = costosManager.getAllProducts();
  const container = document.getElementById('costosList');
  
  if (products.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay productos configurados</p>';
    return;
  }
  
  container.innerHTML = products.map(p => `
    <div class="product-item">
      <div class="product-info">
        <h4>${p.name}</h4>
        <div class="product-details">Cat: ${p.category} | ${p.unit}</div>
        <div class="product-price">$${p.costs.total.toFixed(2)}</div>
      </div>
    </div>
  `).join('');
}

// ==================== ESTADÍSTICAS ====================

async function updateStatistics() {
  try {
    const clients = await window.dataManager.getClients();
    let totalApproved = 0;
    let totalPending = 0;
    let countApproved = 0;
    let countPending = 0;

    for (const client of clients) {
      const history = await window.dataManager.getClientHistory(client.id);
      
      history.forEach(quotation => {
        if (quotation.approved) {
          totalApproved += quotation.total || 0;
          countApproved++;
        } else {
          totalPending += quotation.total || 0;
          countPending++;
        }
      });
    }

    document.getElementById('totalApproved').textContent = '$' + totalApproved.toLocaleString('es-AR', {minimumFractionDigits: 2});
    document.getElementById('totalPending').textContent = '$' + totalPending.toLocaleString('es-AR', {minimumFractionDigits: 2});
    document.getElementById('countApproved').textContent = countApproved;
    document.getElementById('countPending').textContent = countPending;

  } catch (error) {
    console.error('Error calculando estadísticas:', error);
  }
}

// ==================== TABS ====================

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tabName).classList.add('active');
    
    if (tabName === 'costos') loadCostosList();
    if (tabName === 'precios') loadPricesList();
    if (tabName === 'materiales' && typeof window.loadMaterialesList === 'function') window.loadMaterialesList();
    if (tabName === 'terceros' && typeof window.loadTercerosList === 'function') window.loadTercerosList();
  });
});

// ==================== TEMA ====================

const btnTheme = document.getElementById('btnTheme');

btnTheme.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const isLight = document.body.classList.contains('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  btnTheme.textContent = isLight ? '☀️' : '🌙';
  updateLogos();
});

function loadTheme() {
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-theme');
    btnTheme.textContent = '☀️';
    updateLogos();
  }
}

function updateLogos() {
  const isLight = document.body.classList.contains('light-theme');
  const logoSrc = isLight ? 'img/logoblack.png' : 'img/logo.png';
  document.getElementById('headerLogo').src = logoSrc;
  document.getElementById('footerLogo').src = logoSrc;
}

// ==================== CARGAR CATEGORÍAS ====================

async function loadCategoriesIntoSelect() {
  try {
    await window.costosManager.loadCostos();
    const products = costosManager.getAllProducts();
    const select = document.getElementById('priceCategory');
    
    select.innerHTML = '<option value="">Seleccionar categoría...</option>';
    
    const categories = [...new Set(products.map(p => p.category))];
    
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    });
    
    if (categories.length === 0) {
      alert('⚠️ No hay categorías en costos.\n\nPrimero crea productos en la pestaña "Costos".');
    } else {
      alert(`✅ ${categories.length} categorías cargadas`);
    }
  } catch (error) {
    console.error('Error cargando categorías:', error);
    alert('❌ Error al cargar categorías');
  }
}

// ==================== GUARDAR CLIENTE ====================

document.getElementById('btnSaveClient').addEventListener('click', saveClient);
document.getElementById('btnSaveConfigClient').addEventListener('click', saveClient);

async function saveClient() {
  const name = document.getElementById('clientName').value.trim() || document.getElementById('configClientName').value.trim();
  const contact = document.getElementById('clientContact').value.trim() || document.getElementById('configClientContact').value.trim();
  
  if (!name) {
    alert('⚠️ Ingresá el nombre del cliente');
    return;
  }
  
  const client = {
    name,
    contact,
    notes: document.getElementById('clientNotes').value.trim() || ''
  };
  
  const success = await window.dataManager.saveClient(client);
  if (success) {
    alert('✅ Cliente guardado');
    document.getElementById('clientName').value = '';
    document.getElementById('clientContact').value = '';
    document.getElementById('clientNotes').value = '';
    document.getElementById('configClientName').value = '';
    document.getElementById('configClientContact').value = '';
  } else {
    alert('❌ Error al guardar');
  }
}

// ==================== EXPORTAR ====================

async function exportClients() {
  const success = await window.dataManager.exportClients();
  if (success) {
    alert('✅ Clientes exportados');
  } else {
    alert('❌ Error al exportar');
  }
}

async function exportAllData() {
  const success = await window.dataManager.exportAllData();
  if (success) {
    alert('✅ Datos exportados');
  } else {
    alert('❌ Error al exportar');
  }
}

// ==================== INICIALIZACIÓN ====================

// ==================== MODAL PRECIOS MEJORADO ====================

// Cargar categorías al abrir modal
document.getElementById('btnAddPrice').addEventListener('click', async () => {
  await loadCategoriesIntoPriceModal();
});

// Función para cargar categorías en el modal de precios
async function loadCategoriesIntoPriceModal() {
  try {
    await window.costosManager.loadCostos();
    const products = costosManager.getAllProducts();
    const categorySelect = document.getElementById('priceCategory');
    
    categorySelect.innerHTML = '<option value="">Seleccionar categoría...</option>';
    
    // Extraer categorías únicas
    const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
    
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
    });
    
    console.log(`✅ ${categories.length} categorías cargadas en modal de precios`);
  } catch (error) {
    console.error('Error cargando categorías:', error);
    alert('❌ Error al cargar categorías');
  }
}

// Cuando se selecciona una categoría, cargar sus productos
document.getElementById('priceCategory').addEventListener('change', async function(e) {
  const categoria = e.target.value;
  const productSelect = document.getElementById('priceProduct');
  
  if (!categoria) {
    productSelect.innerHTML = '<option value="">Primero selecciona una categoría...</option>';
    productSelect.disabled = true;
    return;
  }
  
  try {
    await window.costosManager.loadCostos();
    const products = costosManager.getAllProducts();
    const filtrados = products.filter(p => p.category === categoria);
    
    productSelect.innerHTML = '<option value="">Seleccionar producto...</option>';
    
    filtrados.forEach(prod => {
      const option = document.createElement('option');
      option.value = prod.id;
      option.textContent = prod.name;
      option.dataset.category = prod.category;
      productSelect.appendChild(option);
    });
    
    productSelect.disabled = false;
    
    console.log(`✅ ${filtrados.length} productos cargados para "${categoria}"`);
  } catch (error) {
    console.error('Error cargando productos:', error);
    alert('❌ Error al cargar productos');
  }
});

// ==================== REPARACIÓN FINAL DE PRECIOS ====================

console.log('[PRECIO] Configurando guardado de precios (versión simplificada)...');

const btnSavePrice = document.getElementById('btnSavePrice');

if (!btnSavePrice) {
  console.error('[PRECIO] ❌ Botón btnSavePrice NO encontrado');
} else {
  console.log('[PRECIO] ✅ Botón btnSavePrice encontrado');
  
  btnSavePrice.onclick = async function() {
    try {
      console.log('[PRECIO] Iniciando proceso de guardado...');
      
      // 1. Capturar datos del formulario (SOLO PRECIO GREMIO)
      const category = document.getElementById('priceCategory').value;
      const productSelect = document.getElementById('priceProduct');
      const productId = productSelect.value;
      const productName = productSelect.options[productSelect.selectedIndex]?.text || productId;
      const precioGremio = parseFloat(document.getElementById('priceGremio').value);
      
      console.log('[PRECIO] Datos capturados:', { 
        category, 
        productId,
        productName,
        precioGremio
      });
      
      // 2. Validar que los campos no estén vacíos
      if (!category || !productName) {
        console.warn('[PRECIO] ⚠️ Validación falló: Faltan categoría o producto');
        alert('⚠️ Por favor completa Categoría y Producto.');
        return;
      }
      
      if (isNaN(precioGremio) || precioGremio <= 0) {
        console.warn('[PRECIO] ⚠️ Validación falló: Precio Gremio inválido');
        alert('⚠️ Por favor ingresa un Precio Gremio válido mayor a 0');
        return;
      }
      
      console.log('[PRECIO] ✅ Validaciones pasadas');
      console.log('[PRECIO] 💰 Precio Gremio: $' + precioGremio);
      
      // 3. Crear objeto - SIN precio público, se agrega después en clientes.html
      const nuevoPrecio = {
        id: Date.now(),
        name: productName,
        category: category,
        priceGremio: precioGremio,   // Solo precio gremio
        pricePublico: 0,              // Se configurará en clientes.html
        unit: 'Unidad'
      };
      
      console.log('[PRECIO] Objeto creado:', nuevoPrecio);
      
      // 4. Usar la lógica del manager para guardar
      // Primero obtenemos la lista actual
      console.log('[PRECIO] Obteniendo lista actual...');
      let listaActual = await window.preciosManager.getPrecios();
      console.log('[PRECIO] Lista actual tiene', listaActual.length, 'precios');
      
      // 5. Añadimos el nuevo (CORREGIDO: con let)
      const listaPreciosActualizada = [...listaActual, nuevoPrecio];
      console.log('[PRECIO] Nueva lista tendrá', listaPreciosActualizada.length, 'precios');
      
      // 6. Guardamos usando la función que existe en tu archivo: savePrecios
      console.log('[PRECIO] Llamando a savePrecios...');
      const success = await window.preciosManager.savePrecios(listaPreciosActualizada);
      console.log('[PRECIO] Resultado de savePrecios:', success);
      
      // 7. Mostrar resultado
      if (success) {
        console.log('[PRECIO] ✅ Guardado exitoso');
        
        alert('✅ ¡Precio Gremio guardado con éxito!\n\n' +
              '🎫 Precio Gremio: $' + precioGremio.toLocaleString() + '\n\n' +
              '💡 Configura el precio público en clientes.html');
        
        // Limpiar campos
        document.getElementById('priceGremio').value = '';
        document.getElementById('priceProduct').value = '';
        document.getElementById('priceCategory').value = '';
        
        // Cerrar el modal
        document.getElementById('priceModal').classList.remove('active');
        
        // Recargar la lista visual si la función existe
        if (typeof loadPricesList === 'function') {
          console.log('[PRECIO] Recargando lista visual...');
          loadPricesList();
        }
      } else {
        console.error('[PRECIO] ❌ savePrecios devolvió false');
        alert('❌ Error al guardar el precio.\n\nRevisa la consola para más detalles.');
      }
      
    } catch (error) {
      console.error('[PRECIO] ❌ Error crítico:', error);
      console.error('[PRECIO] Stack:', error.stack);
      alert('❌ Error técnico: ' + error.message);
    }
  };
  
  console.log('[PRECIO] ✅ Listener configurado correctamente');
}

// ==================== FIN MODAL PRECIOS ====================

// ==================== SELECTOR DINÁMICO PARA COTIZACIÓN ====================

async function loadCategoriasParaCotizacion() {
  try {
    console.log('[COTIZACIÓN] Cargando categorías...');
    
    // Verificar que preciosManager existe
    if (!window.preciosManager) {
      console.error('[COTIZACIÓN] preciosManager no está disponible');
      alert('❌ Error: Sistema de precios no inicializado');
      return;
    }
    
    const precios = await window.preciosManager.getPrecios();
    console.log('[COTIZACIÓN] Precios obtenidos:', precios);
    console.log('[COTIZACIÓN] Cantidad de precios:', precios.length);
    
    if (precios.length === 0) {
      console.warn('[COTIZACIÓN] No hay precios configurados');
      const selectCategoria = document.getElementById('productCategory');
      selectCategoria.innerHTML = '<option value="">No hay precios configurados</option>';
      alert('⚠️ No hay precios configurados. Ve a Configuración → Precios y agrega productos primero.');
      return;
    }
    
    // Obtener categorías únicas de los precios
    const categorias = [...new Set(precios.map(p => p.category))].filter(Boolean);
    console.log('[COTIZACIÓN] Categorías únicas:', categorias);
    
    const selectCategoria = document.getElementById('productCategory');
    selectCategoria.innerHTML = '<option value="">Seleccionar categoría...</option>';
    
    categorias.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      selectCategoria.appendChild(option);
      console.log('[COTIZACIÓN] Categoría agregada:', cat);
    });
    
    console.log('[COTIZACIÓN] ✅ Categorías cargadas:', categorias.length);
  } catch (error) {
    console.error('[COTIZACIÓN] Error cargando categorías:', error);
    console.error('[COTIZACIÓN] Stack:', error.stack);
    alert('❌ Error al cargar categorías: ' + error.message);
  }
}

// Event listener: Cuando cambia la categoría, cargar productos
document.getElementById('productCategory').addEventListener('change', async function(e) {
  const categoria = e.target.value;
  const productSelect = document.getElementById('productName');
  const priceInput = document.getElementById('productPrice');
  
  // Limpiar precio
  priceInput.value = '';
  
  if (!categoria) {
    productSelect.innerHTML = '<option value="">Primero selecciona categoría...</option>';
    productSelect.disabled = true;
    return;
  }
  
  try {
    const precios = await window.preciosManager.getPrecios();
    const filtrados = precios.filter(p => p.category === categoria);
    
    productSelect.innerHTML = '<option value="">Seleccionar producto...</option>';
    
    filtrados.forEach(precio => {
      const option = document.createElement('option');
      option.value = precio.id;
      option.textContent = `${precio.name} - $${(precio.priceGremio || 0).toFixed(2)}`;
      option.dataset.precio = precio.priceGremio || 0;
      option.dataset.nombre = precio.name;
      productSelect.appendChild(option);
    });
    
    productSelect.disabled = false;
    console.log('[COTIZACIÓN] Productos cargados:', filtrados.length);
  } catch (error) {
    console.error('[COTIZACIÓN] Error cargando productos:', error);
  }
});

// Event listener: Cuando selecciona producto, llenar precio automáticamente
document.getElementById('productName').addEventListener('change', function(e) {
  const selectedOption = e.target.options[e.target.selectedIndex];
  const precio = selectedOption.dataset.precio;
  
  if (precio) {
    document.getElementById('productPrice').value = precio;
    console.log('[COTIZACIÓN] Precio cargado:', precio);
  }
});

// ==================== CÁLCULO AUTOMÁTICO DE M² ====================

function calculateM2Info() {
  const width = parseFloat(document.getElementById('productWidth').value) || 0;
  const height = parseFloat(document.getElementById('productHeight').value) || 0;
  const quantity = parseFloat(document.getElementById('productQuantity').value) || 1;
  
  const infoSpan = document.getElementById('calculatedInfo');
  
  if (width > 0 && height > 0) {
    // Hay dimensiones, calcular m²
    const widthM = width / 100;
    const heightM = height / 100;
    const m2Total = widthM * heightM * quantity;
    
    infoSpan.innerHTML = `<strong style="color: var(--gremio-color);">${width}×${height}cm = ${m2Total.toFixed(4)} m²</strong>`;
    console.log('[M2] Calculado:', m2Total.toFixed(4), 'm²');
  } else {
    // Sin dimensiones, cantidad simple
    infoSpan.textContent = 'Ingresa dimensiones para calcular m²';
  }
}

// Event listeners para calcular automáticamente
document.getElementById('productWidth').addEventListener('input', calculateM2Info);
document.getElementById('productHeight').addEventListener('input', calculateM2Info);
document.getElementById('productQuantity').addEventListener('input', calculateM2Info);

// ==================== FIN CÁLCULO M² ====================

// Cargar categorías al abrir el modal de producto
// Cargar categorías al abrir el modal de producto (botón principal)
document.getElementById('btnAddProduct').addEventListener('click', () => {
  loadCategoriasParaCotizacion();
});

// También para el botón del fondo (agregar otro producto)
document.getElementById('btnAddProductBottom').addEventListener('click', () => {
  loadCategoriasParaCotizacion();
});

// ==================== FIN SELECTOR COTIZACIÓN ====================

loadTheme();
loadCostosList();
loadPricesList();
updateStatistics();

console.log('✅ Sistema Gremio v3.6 CORREGIDO iniciado correctamente');

}); // FIN DOMContentLoaded
