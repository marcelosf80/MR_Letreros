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
    
    
    // ==================== FUNCIONES CATEGORÍAS DINÁMICAS ====================
    
    window.loadCategoriasProducto = async function() {
      try {
        const select = document.getElementById('categorySelect');
        if (!select) {
          console.warn('[loadCategoriasProducto] categorySelect no encontrado');
          return;
        }

        await costosManager.loadCostos();
        const productos = costosManager.getAllProducts();
        
        if (!Array.isArray(productos)) {
          console.error('[loadCategoriasProducto] getAllProducts no retornó array');
          return;
        }
        
        const categorias = [...new Set(productos.map(p => p.category))].filter(Boolean);
        
        select.innerHTML = '<option value="">Seleccionar categoría...</option>';
        
        categorias.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat;
          option.textContent = cat;
          select.appendChild(option);
        });
        
        console.log(`✅ ${categorias.length} categorías cargadas`);
      } catch (error) {
        console.error('[loadCategoriasProducto] Error:', error);
        alert('Error al cargar categorías. Por favor recarga la página.');
      }
    };
    
    window.loadProductosPorCategoria = async function() {
      try {
        const categoriaSelect = document.getElementById('categorySelect');
        const productSelect = document.getElementById('productSelect');
        const priceInput = document.getElementById('productPrice');
        
        if (!categoriaSelect || !productSelect || !priceInput) {
          console.warn('[loadProductosPorCategoria] Elementos no encontrados');
          return;
        }
        
        const categoria = categoriaSelect.value;
        
        if (!categoria) {
          productSelect.innerHTML = '<option value="">Primero selecciona categoría...</option>';
          productSelect.disabled = true;
          document.getElementById('productPrice').value = '';
          window.ocultarServicios();
          return;
        }
        
        await costosManager.loadCostos();
        const productos = costosManager.getAllProducts();
        const filtrados = productos.filter(p => p.category === categoria);
        
        productSelect.innerHTML = '<option value="">Seleccionar producto...</option>';
        
        filtrados.forEach(prod => {
          const option = document.createElement('option');
          option.value = prod.id;
          option.textContent = prod.name;
          productSelect.appendChild(option);
        });
        
        productSelect.disabled = false;
        window.mostrarServiciosSegunCategoria(categoria);
        
        console.log(`✅ ${filtrados.length} productos`);
      } catch (error) {
        console.error('[loadProductosPorCategoria] Error:', error);
        alert('Error al cargar productos. Por favor intenta de nuevo.');
      }
    };
    
    window.loadPrecioAutomatico = async function() {
      try {
        const categoria = document.getElementById('categorySelect').value;
        const productoId = document.getElementById('productSelect').value;
        
        if (!categoria || !productoId) {
          document.getElementById('productPrice').value = '';
          return;
        }
        
        const precios = await preciosManager.getPrecios();
        const precio = precios.find(p => p.category === categoria);
        
        if (precio) {
          document.getElementById('productPrice').value = precio.priceGremio;
        } else {
          document.getElementById('productPrice').value = '';
        }
        
        if (window.updateResumenPrecios) window.updateResumenPrecios();
      } catch (error) {
        console.error('[loadProductosPorCategoria] Error:', error);
        alert('Error al cargar productos. Por favor intenta de nuevo.');
      }
    };
    
    window.mostrarServiciosSegunCategoria = function(categoria) {
      const catLower = categoria.toLowerCase();
      const serviciosGenerales = document.getElementById('serviciosGenerales');
      const serviciosLonas = document.getElementById('serviciosLonas');
      
      if (!serviciosGenerales || !serviciosLonas) return;
      
      if (catLower.includes('vinil') || catLower.includes('vinyl')) {
        serviciosGenerales.style.display = 'grid';
      } else {
        serviciosGenerales.style.display = 'none';
        const laca = document.getElementById('includeLaca');
        const pegado = document.getElementById('includePegado');
        if (laca) laca.checked = false;
        if (pegado) pegado.checked = false;
      }
      
      if (catLower.includes('lona') || catLower.includes('banner')) {
        serviciosLonas.style.display = 'grid';
      } else {
        serviciosLonas.style.display = 'none';
        ['includeEstructura', 'includeTensado', 'includeCartelCompleto'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.checked = false;
        });
      }
      
      if (window.updateResumenPrecios) window.updateResumenPrecios();
    };
    
    window.ocultarServicios = function() {
      const serviciosGenerales = document.getElementById('serviciosGenerales');
      const serviciosLonas = document.getElementById('serviciosLonas');
      
      if (serviciosGenerales) serviciosGenerales.style.display = 'none';
      if (serviciosLonas) serviciosLonas.style.display = 'none';
      
      ['includeLaca', 'includePegado', 'includeEstructura', 'includeTensado', 'includeCartelCompleto'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
      });
    };
    
    window.updateResumenPrecios = function() {
      const quantity = parseFloat(document.getElementById('productQuantity')?.value) || 0;
      const unitPrice = parseFloat(document.getElementById('productPrice')?.value) || 0;
      const baseTotal = quantity * unitPrice;
      
      let serviciosTotal = 0;
      
      if (document.getElementById('includeLaca')?.checked) serviciosTotal += 500;
      if (document.getElementById('includePegado')?.checked) serviciosTotal += 300;
      if (document.getElementById('includeEstructura')?.checked) serviciosTotal += 1500;
      if (document.getElementById('includeTensado')?.checked) serviciosTotal += 800;
      if (document.getElementById('includeCartelCompleto')?.checked) serviciosTotal += 3000;
      
      const total = baseTotal + serviciosTotal;
      console.log(`Total: $${total}`);
    };
    
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

    // Hook para cargar categorías al abrir modal
    document.getElementById('btnAddProduct').addEventListener('click', function() {
      setTimeout(() => {
        if (document.getElementById('productModal').classList.contains('active')) {
          loadCategoriasProducto();
        }
      }, 100);
    }, true);
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
        allClients = await dataManager.getClients();
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
        <div class="client-list-item" onclick="selectClient('${client.id}')">
          <h4>${client.name}</h4>
          <p>${client.contact || 'Sin contacto'}</p>
        </div>
      `).join('');
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
        const history = await dataManager.getClientHistory(clientId);
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
              <button class="btn btn-secondary btn-small" onclick="editQuotation(${index})">✏️ Editar</button>
              <button class="btn btn-success btn-small" onclick="approveQuotationFromHistory(${index})">✓ Aprobar</button>
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
      } catch (error) {
        console.error('Error cargando historial:', error);
      }
    }

    async function editQuotation(index) {
      try {
        const history = await dataManager.getClientHistory(currentClientId);
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
        const history = await dataManager.getClientHistory(currentClientId);
        const quotation = history[index];
        
        if (!quotation || quotation.approved) {
          alert('⚠️ Esta cotización ya está aprobada');
          return;
        }
        
        quotation.approved = true;
        quotation.approvedDate = new Date().toISOString();
        quotation.approvedBy = 'Sistema';
        
        const success = await dataManager.updateHistoryEntry(currentClientId, index, quotation);
        
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
      const quantity = parseFloat(document.getElementById('productQuantity').value);
      const price = parseFloat(document.getElementById('productPrice').value);
      const notes = document.getElementById('productNotes').value;
      const includeLacaChecked = document.getElementById('includeLaca').checked;
      const includePegadoChecked = document.getElementById('includePegado').checked;
      const lacaPrice = includeLacaChecked ? parseFloat(document.getElementById('lacaPrice').value) || 0 : 0;
      const pegadoPrice = includePegadoChecked ? parseFloat(document.getElementById('pegadoPrice').value) || 0 : 0;
      
      if (!select.value || !quantity || !price) {
        alert('⚠️ Completá todos los campos obligatorios');
        return;
      }
      
      const baseTotal = quantity * price;
      const totalWithExtras = baseTotal + lacaPrice + pegadoPrice;
      
      const product = {
        id: Date.now(),
        name: select.options[select.selectedIndex].text,
        category: select.value,
        quantity: quantity,
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
      
      select.value = '';
      document.getElementById('productQuantity').value = '1';
      document.getElementById('productPrice').value = '';
      document.getElementById('productNotes').value = '';
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
        let details = `Cantidad: ${p.quantity} | Precio: $${p.unitPrice.toFixed(2)}`;
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
        
        const savedClient = await dataManager.saveClient(client);
        if (savedClient) {
          const clients = await dataManager.getClients();
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
      
      const success = await dataManager.saveQuotation(finalClientId, quotation);
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

    async function generatePDF(cot = null) {
      if (!window.jspdf) {
        alert('⚠️ Error: La librería PDF no se ha cargado correctamente.');
        return;
      }

      // Si no se pasa una cotización, usamos la actual del estado global
      const data = typeof cot === 'object' && cot !== null ? cot : {
        cliente: {
          nombre: document.getElementById('clientName')?.value || 'Cliente General',
          telefono: document.getElementById('clientPhone')?.value || '',
          email: document.getElementById('clientEmail')?.value || '',
          direccion: document.getElementById('clientAddress')?.value || ''
        },
        productos: typeof productsInQuotation !== 'undefined' ? productsInQuotation : [],
        totalCliente: typeof currentTotals !== 'undefined' ? (currentTotals.totalCliente || currentTotals.total || 0) : 0,
        subtotal: typeof currentTotals !== 'undefined' ? (currentTotals.subtotal || 0) : 0,
        iva: typeof currentTotals !== 'undefined' ? (currentTotals.iva || 0) : 0,
        descuentoEspecial: typeof currentTotals !== 'undefined' ? (currentTotals.descuentoEspecial || 0) : 0,
        fecha: new Date().toISOString(),
        fechaEntrega: document.getElementById('deliveryDate')?.value || ''
      };

      try {
        const generator = new PDFGenerator();
        const doc = await generator.generateGremioQuote(data);
        const fileName = `Cotizacion_MR_${(data.cliente?.nombre || 'Gremio').replace(/[^a-z0-9]/gi, '_')}.pdf`;
        doc.save(fileName);
        alert('✅ PDF generado correctamente');
      } catch (error) {
        console.error('[GREMIO] Error al generar PDF:', error);
        alert('❌ Error al generar el PDF: ' + error.message);
      }
    }


    // Continúa en el siguiente mensaje...

    // ==================== PRECIOS ====================
    
    const preciosManager = {
      async getPrecios() {
        try {
          const response = await fetch('/api/gremio/precios');
          if (response.ok) return await response.json();
          return [];
        } catch (error) {
          console.error('Error obteniendo precios:', error);
          return [];
        }
      },

      async savePrecios(precios) {
        try {
          const response = await fetch('/api/gremio/precios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(precios)
          });
          return response.ok;
        } catch (error) {
          console.error('Error guardando precios:', error);
          return false;
        }
      }
    };

    document.getElementById('btnSavePrice').addEventListener('click', async () => {
      const name = document.getElementById('priceName').value.trim();
      const category = document.getElementById('priceCategory').value;
      const unit = document.getElementById('priceUnit').value;
      const priceGremioInput = document.getElementById('priceGremio').value.trim();
      const pricePublicoInput = document.getElementById('pricePublico').value.trim();
      const discountInput = document.getElementById('priceDiscount').value.trim();
      
      if (!name || !category || !priceGremioInput) {
        alert('⚠️ Completá los campos obligatorios:\n- Nombre del producto\n- Categoría\n- Precio Gremio');
        return;
      }
      
      const priceGremio = parseFloat(priceGremioInput);
      const pricePublico = pricePublicoInput ? parseFloat(pricePublicoInput) : 0;
      const discount = discountInput ? parseFloat(discountInput) : 0;
      
      if (isNaN(priceGremio) || priceGremio <= 0) {
        alert('⚠️ El precio Gremio debe ser un número válido mayor a 0');
        return;
      }
      
      if (pricePublicoInput && (isNaN(pricePublico) || pricePublico < 0)) {
        alert('⚠️ El precio Público debe ser un número válido');
        return;
      }
      
      if (discountInput && (isNaN(discount) || discount < 0 || discount > 100)) {
        alert('⚠️ El descuento debe ser un número entre 0 y 100');
        return;
      }

      const precios = await preciosManager.getPrecios();
      const editingId = getEditingPriceId();
      
      if (editingId) {
        // MODO EDICIÓN
        const index = precios.findIndex(p => p.id === editingId);
        if (index !== -1) {
          precios[index] = {
            ...precios[index],
            name,
            category,
            unit,
            priceGremio,
            pricePublico,
            discount,
            updated: new Date().toISOString()
          };
        }
      } else {
        // MODO NUEVO
        precios.push({
        id: 'precio_' + Date.now(),
        name,
        category,
        unit,
        priceGremio,
        pricePublico,
        discount,
        created: new Date().toISOString()
      });
    }

    const success = await preciosManager.savePrecios(precios);
      if (success) {
        alert('✅ Precio guardado correctamente');
        document.getElementById('priceName').value = '';
        document.getElementById('priceCategory').value = '';
        document.getElementById('priceGremio').value = '';
        document.getElementById('pricePublico').value = '';
        document.getElementById('priceDiscount').value = '0';
        priceModal.classList.remove('active');
        loadPricesList();
      } else {
        alert('❌ Error al guardar precio');
      }
    });

    async function loadPricesList() {
      const precios = await preciosManager.getPrecios();
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
              Gremio: $${p.priceGremio.toFixed(2)} | Público: $${p.pricePublico.toFixed(2)} | ${p.unit}
              ${p.discount > 0 ? `<br>Descuento: ${p.discount}%` : ''}
            </div>
          </div>
          <button class="btn btn-danger btn-small" onclick="deletePrecio('${p.id}')">🗑️</button>
        </div>
      `).join('');
    }

    async function deletePrecio(id) {
      if (confirm('¿Eliminar este precio?')) {
        const precios = await preciosManager.getPrecios();
        const filtered = precios.filter(p => p.id !== id);
        const success = await preciosManager.savePrecios(filtered);
        if (success) {
          alert('✅ Precio eliminado');
          loadPricesList();
        }
      }
    }

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
      
      const success = await costosManager.addProduct(product);
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
      await costosManager.loadCostos();
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
        const clients = await dataManager.getClients();
        let totalApproved = 0;
        let totalPending = 0;
        let countApproved = 0;
        let countPending = 0;

        for (const client of clients) {
          const history = await dataManager.getClientHistory(client.id);
          
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
        await costosManager.loadCostos();
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
        console.error('[loadCategoriasProducto] Error:', error);
        alert('Error al cargar categorías. Por favor recarga la página.');
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
      
      const success = await dataManager.saveClient(client);
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
      const success = await dataManager.exportClients();
      if (success) {
        alert('✅ Clientes exportados');
      } else {
        alert('❌ Error al exportar');
      }
    }

    async function exportAllData() {
      const success = await dataManager.exportAllData();
      if (success) {
        alert('✅ Datos exportados');
      } else {
        alert('❌ Error al exportar');
      }
    }

    // ==================== INICIALIZACIÓN ====================
    
    // Cargar categorías al abrir modal de precios
    document.getElementById('btnAddPrice').addEventListener('click', () => {
      loadCategoriesIntoSelect();
    });
    
    loadTheme();
    loadCostosList();
    loadPricesList();
    updateStatistics();
    
    console.log('✅ Sistema Gremio v3.6 CORREGIDO iniciado correctamente');