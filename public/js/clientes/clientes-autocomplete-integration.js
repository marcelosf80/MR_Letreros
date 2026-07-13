/**
 * INTEGRACIÓN DE AUTOCOMPLETADO DE CLIENTES
 * Para usar en gremio.html y clientes.html
 * 
 * Agregar este script después de cargar data-manager-extension.js
 */

(function() {
    'use strict';
    
    console.log('[AUTOCOMPLETE-CLIENTES] 🔄 Inicializando...');
    
    let clientesCache = [];
    let autocompleteTimeout = null;
    
    // Función para cargar clientes
    async function loadClientesForAutocomplete() {
        try {
            const response = await fetch('/api/clientes');
            if (response.ok) {
                clientesCache = await response.json();
                console.log('[AUTOCOMPLETE-CLIENTES] ✅ Clientes cargados:', clientesCache.length);
            }
        } catch (error) {
            console.error('[AUTOCOMPLETE-CLIENTES] Error cargando clientes:', error);
        }
    }
    
    // Función para mostrar sugerencias
    function showSuggestions(input, suggestions) {
        // Remover sugerencias previas
        removeSuggestions();
        
        if (suggestions.length === 0) return;
        
        const container = document.createElement('div');
        container.id = 'clienteSuggestions';
        container.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, rgba(30, 30, 40, 0.98), rgba(20, 20, 30, 0.98));
            border: 1px solid rgba(99, 102, 241, 0.5);
            border-radius: 8px;
            margin-top: 5px;
            max-height: 300px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        `;
        
        suggestions.forEach(cliente => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 12px;
                cursor: pointer;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                transition: background 0.2s;
            `;
            
            item.innerHTML = `
                <div style="font-weight: 600; color: var(--text-light); margin-bottom: 4px;">
                    ${cliente.tipo === 'gremio' ? '🟢' : '🔵'} ${cliente.nombre}
                </div>
                <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.6);">
                    ${cliente.telefono ? `📱 ${cliente.telefono}` : ''}
                    ${cliente.email ? ` • 📧 ${cliente.email}` : ''}
                </div>
            `;
            
            item.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(99, 102, 241, 0.2)';
            });
            
            item.addEventListener('mouseleave', function() {
                this.style.background = 'transparent';
            });
            
            item.addEventListener('click', function() {
                selectCliente(cliente);
                removeSuggestions();
            });
            
            container.appendChild(item);
        });
        
        // Posicionar container
        const parent = input.parentElement;
        parent.style.position = 'relative';
        parent.appendChild(container);
    }
    
    function removeSuggestions() {
        const existing = document.getElementById('clienteSuggestions');
        if (existing) {
            existing.remove();
        }
    }
    
    function selectCliente(cliente) {
        // Llenar campos del formulario
        document.getElementById('clientName').value = cliente.nombre || '';
        
        const phoneInput = document.getElementById('clientPhone');
        if (phoneInput) phoneInput.value = cliente.telefono || '';
        
        const emailInput = document.getElementById('clientEmail');
        if (emailInput) emailInput.value = cliente.email || '';
        
        const addressInput = document.getElementById('clientAddress');
        if (addressInput) addressInput.value = cliente.direccion || '';
        
        console.log('[AUTOCOMPLETE-CLIENTES] ✅ Cliente seleccionado:', cliente.nombre);
    }
    
    // Función para buscar clientes
    function searchClientes(query) {
        if (!query || query.length < 2) {
            removeSuggestions();
            return;
        }
        
        const searchTerm = query.toLowerCase();
        const matches = clientesCache.filter(c => 
            (c.nombre || '').toLowerCase().includes(searchTerm) ||
            (c.telefono || '').toLowerCase().includes(searchTerm) ||
            (c.email || '').toLowerCase().includes(searchTerm)
        ).slice(0, 5); // Máximo 5 sugerencias
        
        const input = document.getElementById('clientName');
        showSuggestions(input, matches);
    }
    
    // Configurar autocompletado
    function setupAutocomplete() {
        const clientNameInput = document.getElementById('clientName');
        if (!clientNameInput) {
            console.warn('[AUTOCOMPLETE-CLIENTES] Input clientName no encontrado');
            return;
        }
        
        console.log('[AUTOCOMPLETE-CLIENTES] ✅ Autocompletado configurado');
        
        // Evento input con debounce
        clientNameInput.addEventListener('input', function() {
            clearTimeout(autocompleteTimeout);
            autocompleteTimeout = setTimeout(() => {
                searchClientes(this.value);
            }, 300);
        });
        
        // Cerrar sugerencias al hacer click fuera
        document.addEventListener('click', function(e) {
            if (e.target !== clientNameInput) {
                removeSuggestions();
            }
        });
        
        // Prevenir envío de formulario con Enter
        clientNameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const suggestions = document.getElementById('clienteSuggestions');
                if (suggestions && suggestions.firstChild) {
                    suggestions.firstChild.click();
                }
            }
        });
    }
    
    // Agregar botón para ir a gestión de clientes
    function addManageClientsButton() {
        const clientNameInput = document.getElementById('clientName');
        if (!clientNameInput) return;
        
        const parent = clientNameInput.parentElement;
        if (!parent) return;
        
        // Verificar si ya existe el botón
        if (document.getElementById('btnManageClients')) return;
        
        const button = document.createElement('button');
        button.id = 'btnManageClients';
        button.type = 'button';
        button.className = 'btn btn-secondary btn-small';
        button.style.marginLeft = '10px';
        button.innerHTML = '👥 Gestionar';
        button.title = 'Abrir gestión de clientes';
        
        button.addEventListener('click', function() {
            window.open('clientes-gestion.html', '_blank');
        });
        
        parent.appendChild(button);
    }
    
    // Inicializar cuando el DOM esté listo
    async function init() {
        // Esperar a que cargue el DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        // Cargar clientes
        await loadClientesForAutocomplete();
        
        // Configurar autocompletado
        setTimeout(() => {
            setupAutocomplete();
            addManageClientsButton();
        }, 500);
    }
    
    // Iniciar
    init();
    
    // Recargar clientes cuando se muestre la ventana
    window.addEventListener('focus', loadClientesForAutocomplete);
    
    console.log('[AUTOCOMPLETE-CLIENTES] ✅ Módulo cargado');
    
})();
