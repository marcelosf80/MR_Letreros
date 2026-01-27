/**
 * ========================================
 * MODAL SYSTEM - Sistema Unificado
 * ========================================
 * Maneja todos los modales automáticamente
 * Versión: 6.0
 */

(function() {
  'use strict';

  console.log('[MODAL-SYSTEM] 🚀 Inicializando...');

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('[MODAL-SYSTEM] DOM listo, configurando modales...');

    // Auto-detectar y configurar todos los modales
    autoConfigureModals();

    // Configurar modales especiales
    configureSpecialModals();

    // Listener global para ESC
    document.addEventListener('keydown', handleEscKey);

    console.log('[MODAL-SYSTEM] ✅ Sistema activado');
  }

  /**
   * Auto-configura modales detectando botones btnAdd*
   */
  function autoConfigureModals() {
    const addButtons = document.querySelectorAll('[id^="btnAdd"]');

    addButtons.forEach(btn => {
      const btnId = btn.id;
      const baseName = btnId.replace('btnAdd', '');

      // Posibles IDs del modal
      const possibleModalIds = [
        baseName.toLowerCase() + 'Modal',
        baseName.charAt(0).toLowerCase() + baseName.slice(1) + 'Modal',
        'modal' + baseName
      ];

      let modal = null;
      for (const id of possibleModalIds) {
        modal = document.getElementById(id);
        if (modal) break;
      }

      if (modal && !btn.hasAttribute('data-modal-configured')) {
        setupModal(btn, modal, baseName);
      }
    });
  }

  /**
   * Configura modales con nombres especiales
   */
  function configureSpecialModals() {
    const specialPairs = [
      { btn: 'btnAddMaterial', modal: 'materialModal' },
      { btn: 'btnAddTercero', modal: 'terceroModal' },
      { btn: 'btnAddProduct', modal: 'addProductModal' },
      { btn: 'btnAddCosto', modal: 'costoModal' },
      { btn: 'btnAddPrice', modal: 'priceModal' },
      { btn: 'btnAddGasto', modal: 'gastoModal' },
      { btn: 'btnAddCliente', modal: 'clienteModal' },
      { btn: 'btnAgregarPrecio', modal: 'precioModal' }
    ];

    specialPairs.forEach(({ btn, modal }) => {
      const button = document.getElementById(btn);
      const modalEl = document.getElementById(modal);

      if (button && modalEl && !button.hasAttribute('data-modal-configured')) {
        setupModal(button, modalEl, modal.replace('Modal', ''));
      }
    });
  }

  /**
   * Configura un modal completo con todos sus eventos
   */
  function setupModal(button, modal, baseName) {
    const modalId = modal.id;

    console.log(`[MODAL-SYSTEM] ✅ Configurando: ${button.id} -> ${modalId}`);

    // Marcar como configurado
    button.setAttribute('data-modal-configured', 'true');

    // Botón abrir
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openModal(modal);
    });

    // Buscar botones de cierre
    const closeButtons = [
      ...modal.querySelectorAll('[id^="btnClose"]'),
      ...modal.querySelectorAll('[id^="btnCancel"]'),
      ...modal.querySelectorAll('.btn-close'),
      ...modal.querySelectorAll('.close-modal')
    ];

    closeButtons.forEach(closeBtn => {
      if (!closeBtn.hasAttribute('data-close-configured')) {
        closeBtn.setAttribute('data-close-configured', 'true');
        closeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeModal(modal);
        });
      }
    });

    // Click fuera del modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  }

  /**
   * Abre un modal
   */
  function openModal(modal) {
    console.log(`[MODAL-SYSTEM] Abriendo: ${modal.id}`);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevenir scroll del body
  }

  /**
   * Cierra un modal
   */
  function closeModal(modal) {
    console.log(`[MODAL-SYSTEM] Cerrando: ${modal.id}`);
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restaurar scroll
  }

  /**
   * Cierra todos los modales abiertos
   */
  function closeAllModals() {
    const openModals = document.querySelectorAll('.modal.active');
    openModals.forEach(modal => closeModal(modal));
  }

  /**
   * Maneja la tecla ESC
   */
  function handleEscKey(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      closeAllModals();
    }
  }

  // Exponer funciones globalmente si es necesario
  window.MRModals = {
    open: openModal,
    close: closeModal,
    closeAll: closeAllModals
  };

})();
