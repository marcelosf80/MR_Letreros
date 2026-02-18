/**
 * ========================================
 * SIDEBAR UNIVERSAL - JAVASCRIPT
 * ========================================
 * Sistema de navegación lateral para todos los módulos
 */

(function () {
  'use strict';

  console.log('[SIDEBAR] 🚀 Inicializando sidebar universal...');

  // Configuración del sidebar
  const SIDEBAR_CONFIG = {
    companyName: 'MR Letreros',
    tagline: 'Sistema de Gestión Integral',
    logo: 'img/logo.png',

    // Información de la empresa
    companyInfo: {
      phone: '📞 +54 9 342 6136868',
      email: '✉️ info@mrletreros.com',
      location: '📍 Santa Fe, Argentina'
    },

    // Usuario actual (puedes cambiar dinámicamente)
    user: (function () {
      try {
        const u = JSON.parse(localStorage.getItem('mr_user'));
        return {
          name: u ? u.nombre : 'Usuario',
          role: u ? u.rol : 'invitado', // 'superadmin', 'admin', 'vendedor', etc.
          avatar: '👤'
        };
      } catch (e) {
        return { name: 'Invitado', role: 'invitado', avatar: '👤' };
      }
    })(),

    // Módulos del sistema
    modules: [
      {
        section: 'Cotizaciones',
        items: [
          {
            id: 'gremio',
            icon: '🟢',
            label: 'Sistema Gremio',
            desc: 'Precios mayoristas',
            url: 'gremio.html'
          },
          {
            id: 'clientes',
            icon: '🔵',
            label: 'Sistema Clientes',
            desc: 'Precios públicos',
            url: 'clientes.html'
          }
        ]
      },
      {
        section: 'Gestión',
        items: [
          {
            id: 'clientes-gestion',
            icon: '👥',
            label: 'Base de Clientes',
            desc: 'CRUD de clientes',
            url: 'clientes-gestion.html'
          },
          {
            id: 'trabajos',
            icon: '🔨',
            label: 'Trabajos',
            desc: 'Trabajos aprobados',
            url: 'trabajos.html'
          }
        ]
      },
      {
        section: 'Configuración',
        items: [
          {
            id: 'precios',
            icon: '💰',
            label: 'Precios',
            desc: 'Gremio y Cliente',
            url: 'precios.html'
          },
          {
            id: 'costos',
            icon: '💳',
            label: 'Costos',
            desc: 'Materiales y servicios',
            url: 'costos.html'
          },
          {
            id: 'materiales',
            icon: '📦',
            label: 'Materiales',
            desc: 'Inventario de rollos',
            url: 'materiales.html'
          },
          {
            id: 'terceros',
            icon: '🔧',
            label: 'Terceros',
            desc: 'Servicios externos',
            url: 'terceros.html'
          },
          {
            id: 'mantenimiento',
            icon: '🧹',
            label: 'Mantenimiento',
            desc: 'Limpieza de datos',
            url: 'mantenimiento.html'
          }
        ]
      },
      {
        section: 'Análisis',
        items: [
          {
            id: 'rendimientos',
            icon: '📊',
            label: 'Dashboard',
            desc: 'Análisis financiero',
            url: 'rendimientos.html'
          }
        ]
      },
      {
        section: 'Herramientas',
        items: [
          {
            id: 'vectores',
            icon: '✏️',
            label: 'Visor Vectores',
            desc: 'Calcular perímetros',
            url: 'vector/index.html'
          }
        ]
      },
      {
        section: 'Usuario',
        items: [
          {
            id: 'usuarios',
            icon: '👥',
            label: 'Gestión Usuarios',
            desc: 'Admin',
            url: 'usuarios.html',
            roles: ['superadmin', 'admin'] // Solo visible para estos roles
          },
          {
            id: 'perfil',
            icon: '👤',
            label: 'Mi Perfil',
            desc: 'Cuenta y seguridad',
            url: 'perfil.html'
          }
        ]
      }
    ]
  };

  /**
   * Genera el HTML del sidebar
   */
  function generateSidebarHTML() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    return `
      <!-- Sidebar Universal -->
      <aside class="app-sidebar" id="appSidebar">
        <!-- Header -->
        <div class="sidebar-header">
          <div class="sidebar-logo-section">
            <img src="${SIDEBAR_CONFIG.logo}" alt="${SIDEBAR_CONFIG.companyName}" class="sidebar-logo">
            <div class="sidebar-title">
              <div class="sidebar-company-name">${SIDEBAR_CONFIG.companyName}</div>
              <div class="sidebar-tagline">${SIDEBAR_CONFIG.tagline}</div>
            </div>
            <button class="sidebar-toggle" id="sidebarToggle" title="Contraer menú">
              <span>◀</span>
            </button>
          </div>
          
          <div class="sidebar-company-info">
            <div class="company-info-item">
              <span class="company-info-icon">${SIDEBAR_CONFIG.companyInfo.phone.split(' ')[0]}</span>
              <span>${SIDEBAR_CONFIG.companyInfo.phone.substring(2)}</span>
            </div>
            <div class="company-info-item">
              <span class="company-info-icon">${SIDEBAR_CONFIG.companyInfo.email.split(' ')[0]}</span>
              <span>${SIDEBAR_CONFIG.companyInfo.email.substring(2)}</span>
            </div>
            <div class="company-info-item">
              <span class="company-info-icon">${SIDEBAR_CONFIG.companyInfo.location.split(' ')[0]}</span>
              <span>${SIDEBAR_CONFIG.companyInfo.location.substring(2)}</span>
            </div>
          </div>
        </div>
        
        <!-- Navegación -->
        <nav class="sidebar-nav">
          ${SIDEBAR_CONFIG.modules.map(section => `
            <div class="nav-section">
              <div class="nav-section-title">${section.section}</div>
              ${section.items.map(item => {
      // Verificar permisos de rol para mostrar el item
      if (item.roles) {
        const userRole = SIDEBAR_CONFIG.user.role || 'invitado'; // Default
        if (!item.roles.includes(userRole)) return '';
      }

      const isActive = currentPage === item.url ||
        (item.url.includes('/') && currentPage.includes(item.id));
      return `
                  <a href="${item.url}" 
                     class="nav-item ${isActive ? 'active' : ''}" 
                     data-tooltip="${item.label}">
                    <span class="nav-item-icon">${item.icon}</span>
                    <div class="nav-item-content">
                      <span class="nav-item-label">${item.label}</span>
                      <span class="nav-item-desc">${item.desc}</span>
                    </div>
                  </a>
                `;
    }).join('')}
            </div>
          `).join('')}
          
          <!-- Home -->
          <div class="nav-section">
            <a href="index.html" class="nav-item ${currentPage === 'index.html' ? 'active' : ''}" data-tooltip="Inicio">
              <span class="nav-item-icon">🏠</span>
              <div class="nav-item-content">
                <span class="nav-item-label">Inicio</span>
                <span class="nav-item-desc">Página principal</span>
              </div>
            </a>
          </div>
        </nav>
        
        <!-- Footer -->
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="sidebar-user-avatar">${SIDEBAR_CONFIG.user.avatar}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${SIDEBAR_CONFIG.user.name}</div>
              <div class="sidebar-user-role">${SIDEBAR_CONFIG.user.role}</div>
            </div>
            <button onclick="AUTH.logout()" title="Cerrar Sesión" style="
                background: transparent;
                border: none;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 0.5rem;
                color: #94a3b8;
                margin-left: auto;
                transition: color 0.2s;
            " onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
              🚪
            </button>
          </div>
        </div>
      </aside>
      
      <!-- Overlay para móvil -->
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      
      <!-- Botón móvil -->
      <button class="mobile-menu-btn" id="mobileMenuBtn">
        <div class="hamburger">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>
    `;
  }

  /**
   * Inicializa el sidebar
   */
  function initSidebar() {
    // Agregar clase al body
    document.body.classList.add('has-sidebar');

    // Insertar HTML del sidebar al inicio del body
    document.body.insertAdjacentHTML('afterbegin', generateSidebarHTML());

    // Elementos
    const sidebar = document.getElementById('appSidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const overlay = document.getElementById('sidebarOverlay');
    // Estado colapsado (guardar en localStorage)
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      document.body.classList.add('sidebar-collapsed');
      toggleBtn.querySelector('span').textContent = '▶';
    }
    // Toggle desktop
    toggleBtn.addEventListener('click', () => {
      const collapsed = sidebar.classList.toggle('collapsed');
      document.body.classList.toggle('sidebar-collapsed');
      // Cambiar el ícono del botón
      const iconSpan = toggleBtn.querySelector('span');
      if (collapsed) {
        iconSpan.textContent = '▶';
        toggleBtn.title = 'Expandir menú';
      } else {
        iconSpan.textContent = '◀';
        toggleBtn.title = 'Contraer menú';
      }

      localStorage.setItem('sidebarCollapsed', collapsed);
    });

    // Toggle móvil
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
        mobileBtn.classList.toggle('active');
      });
      // Cerrar al hacer click en overlay
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        mobileBtn.classList.remove('active');
      });
      // Cerrar al navegar
      document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
            mobileBtn.classList.remove('active');
          }
        });
      });
    }
    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        if (mobileBtn) mobileBtn.classList.remove('active');
      }
    });

    // Highlight active item based on URL
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('href') === currentPath) {
        item.classList.add('active');
      }
    });

    // Global ESC to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
          activeModal.classList.remove('active');
        }
      }
    });

    console.log('[SIDEBAR] ✅ Sidebar inicializado');
  }

  // Auto-inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
  } else {
    initSidebar();
  }

  // Exponer API global
  window.MRSidebar = {
    toggle: () => document.getElementById('sidebarToggle')?.click(),
    collapse: () => {
      const sidebar = document.getElementById('appSidebar');
      if (sidebar && !sidebar.classList.contains('collapsed')) {
        document.getElementById('sidebarToggle')?.click();
      }
    },
    expand: () => {
      const sidebar = document.getElementById('appSidebar');
      if (sidebar && sidebar.classList.contains('collapsed')) {
        document.getElementById('sidebarToggle')?.click();
      }
    }
  };

})();
