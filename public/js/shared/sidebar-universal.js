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
    logo: 'img/logo_negro.png',

    // Información de la empresa
    companyInfo: {
      phone: '📞 +54 9 342 4050011',
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
            id: 'presupuesto-gen',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
            label: 'Crear Presupuesto',
            desc: 'Generador de presupuestos',
            url: 'presupuesto-gen.html'
          },
          {
            id: 'cotizaciones',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>`,
            label: 'Ver Presupuestos',
            desc: 'Seguimiento y aprobación',
            url: 'cotizaciones.html'
          }
        ]
      },
      {
        section: 'Gestión',
        items: [
          {
            id: 'clientes-gestion',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
            label: 'Base de Clientes',
            desc: 'CRUD de clientes',
            url: 'clientes-gestion.html'
          },
          {
            id: 'trabajos',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
            label: 'Trabajos',
            desc: 'Trabajos aprobados',
            url: 'trabajos.html'
          },
          {
            id: 'planilla-trabajos',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>`,
            label: 'Planilla Costos',
            desc: 'Costos y ganancias',
            url: 'planilla-trabajos.html'
          },
          {
            id: 'tareas-internas',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
            label: 'Tareas',
            desc: 'Anotaciones e instrucc.',
            url: 'tareas-internas.html'
          }
        ]
      },
      {
        section: 'Configuración',
        items: [
          {
            id: 'precios',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
            label: 'Precios',
            desc: 'Gremio y Cliente',
            url: 'precios.html'
          },
          {
            id: 'costos',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg>`,
            label: 'Costos',
            desc: 'Materiales y servicios',
            url: 'costos.html'
          },
          {
            id: 'materiales',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
            label: 'Materiales',
            desc: 'Inventario de rollos',
            url: 'materiales.html'
          },
          {
            id: 'terceros',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
            label: 'Terceros',
            desc: 'Servicios externos',
            url: 'terceros.html'
          },
          {
            id: 'mantenimiento',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
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
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>`,
            label: 'Dashboard',
            desc: 'Análisis financiero',
            url: 'rendimientos.html',
            roles: ['superadmin']
          },
          {
            id: 'gastos',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
            label: 'Gastos',
            desc: 'Registro de egresos',
            url: 'gastos.html',
            roles: ['superadmin', 'admin', 'vendedor']
          }
        ]
      },
      {
        section: 'Herramientas',
        items: [
          {
            id: 'gremio',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><rect x="3" y="3" width="18" height="10" rx="2"/></svg>`,
            label: 'Sistema Gremio',
            desc: 'Precios mayoristas',
            url: 'gremio.html'
          },
          {
            id: 'clientes',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
            label: 'Sistema Clientes',
            desc: 'Precios públicos',
            url: 'clientes.html'
          },
          {
            id: 'chatbot-admin',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
            label: 'WhatsApp Bot',
            desc: 'Configurar chatbot',
            url: 'chatbot-admin.html'
          },
          {
            id: 'vectorizador',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
            label: 'Herramientas IA',
            desc: 'Ampliar, Recortar y Vector',
            url: 'vectorizador.html'
          },
          {
            id: 'nesting-polifan',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><rect x="7" y="7" width="4" height="4"/><rect x="13" y="7" width="4" height="4"/><rect x="7" y="13" width="10" height="4"/></svg>`,
            label: 'Nesting Polifan',
            desc: 'Optimización de planchas',
            url: 'nesting-polifan.html'
          },
          {
            id: 'calculador-vectores',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
            label: 'Costo Vectorial',
            desc: 'Cálculo por diseño',
            url: 'calculador-vectores.html'
          },
          {
            id: 'cotizador-acrilicos',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H9H8"/></svg>`,
            label: 'Cotizador Acrílicos',
            desc: 'Cálculo por placa y corte',
            url: 'cotizador-acrilicos.html'
          },
          {
            id: 'led-wizard',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5.5 5.5 0 0 0 12.5 3a5.5 5.5 0 0 0-5.5 5.5c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5m1 2h2m-3 3h4"/></svg>`,
            label: 'Calculadora LED',
            desc: 'Distribución y consumo',
            url: 'led-wizard.html'
          },
          {
            id: 'renderizador-3d',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/><line x1="20.73" y1="6.96" x2="12" y2="12"/><line x1="3.27" y1="6.96" x2="12" y2="12"/></svg>`,
            label: 'Render 3D',
            desc: 'Muestras Clientes',
            url: 'renderizador-3d.html'
          },
          {
            id: 'marketing',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
            label: 'Marketing IG',
            desc: 'Posteos automáticos',
            url: 'marketing.html'
          }
        ]
      },
      {
        section: 'Usuario',
        items: [
          {
            id: 'usuarios',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
            label: 'Gestión Usuarios',
            desc: 'Admin',
            url: 'usuarios.html',
            roles: ['superadmin', 'admin']
          },
          {
            id: 'db-explorer',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
            label: 'Base de Datos',
            desc: 'Explorador SQLite',
            url: 'db-explorer.html',
            roles: ['superadmin', 'admin']
          },
          {
            id: 'perfil',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
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
                     data-tooltip="${item.label}"
                     data-label="${item.label}">
                    <span class="sb-shimmer-layer"></span>
                    <span class="nav-item-icon">${item.icon}</span>
                    <div class="nav-item-content">
                      <span class="nav-item-label">${item.label}</span>
                      <span class="nav-item-desc" id="nav-desc-${item.id}">${item.desc}</span>
                    </div>
                  </a>
                `;
    }).join('')}
            </div>
          `).join('')}
          
          <!-- Home -->
          <div class="nav-section">
            <a href="index.html" class="nav-item ${currentPage === 'index.html' ? 'active' : ''}" data-tooltip="Inicio" data-label="Inicio">
              <span class="sb-shimmer-layer"></span>
              <span class="nav-item-icon" style="color:currentColor"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="sb-icon-gradient"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
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
            <div style="display:flex; gap:0.5rem;">
              <button id="themeToggleBtn" title="Cambiar Tema" class="btn-theme-sidebar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              </button>
              <button onclick="AUTH.logout()" title="Cerrar Sesión" class="btn-logout-sidebar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
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

    // Asignar índice de animación escalonada a cada nav item
    document.querySelectorAll('.nav-item').forEach((item, idx) => {
      item.style.setProperty('--i', idx);
    });

    // Highlight active item based on URL
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('href') === currentPath) {
        item.classList.add('active');
      }
    });

    // Theme toggle logic (unified for all pages)
    const applyTheme = (isLight) => {
      if (isLight) {
        document.body.classList.add('light-theme');
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      } else {
        document.body.classList.remove('light-theme');
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      }
    };

    // Initialize theme, handling legacy keys
    const savedTheme = localStorage.getItem('theme') || localStorage.getItem('mr_theme') || localStorage.getItem('mx_theme') || 'dark';
    applyTheme(savedTheme === 'light');

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        applyTheme(!isLight);
      });
    }

    // Cargar notificador de tareas
    fetchSidebarTareasNotif();

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

  async function fetchSidebarTareasNotif() {
    try {
        const token = localStorage.getItem('mr_token');
        if (!token) return;
        
        // Fetch Tareas
        const resTareas = await fetch('/api/tareas', { headers: { 'Authorization': `Bearer ${token}` } });
        if (resTareas.ok) {
            const tareas = await resTareas.json();
            if (tareas && tareas.length > 0) {
                let pendientes = 0;
                let enProceso = 0;
                tareas.forEach(t => {
                    if(t.estado === 'pendiente') pendientes++;
                    if(t.estado === 'en_proceso') enProceso++;
                });

                const descTareas = document.getElementById('nav-desc-tareas-internas');
                if (descTareas && (pendientes > 0 || enProceso > 0)) {
                    descTareas.innerHTML = `<span style="color:#fbbf24; font-weight:bold;">⏳ ${pendientes}</span> &nbsp; <span style="color:#f59e0b; font-weight:bold;">🔧 ${enProceso}</span>`;
                    // Forzar visibilidad sin hover
                    descTareas.style.opacity = '0.9';
                    descTareas.style.maxHeight = '20px';
                    descTareas.style.transform = 'translateY(0)';
                    descTareas.style.marginTop = '1px';
                }
            }
        }

        // Fetch Trabajos
        const resTrabajos = await fetch('/api/trabajos', { headers: { 'Authorization': `Bearer ${token}` } });
        if (resTrabajos.ok) {
            const trabajos = await resTrabajos.json();
            if (trabajos && trabajos.length > 0) {
                let pendientes = 0;
                let enProceso = 0;
                trabajos.forEach(t => {
                    if(t.estado === 'pendiente') pendientes++;
                    if(t.estado === 'en_proceso') enProceso++;
                });

                const descTrabajos = document.getElementById('nav-desc-trabajos');
                if (descTrabajos && (pendientes > 0 || enProceso > 0)) {
                    descTrabajos.innerHTML = `<span style="color:#fbbf24; font-weight:bold;">⏳ ${pendientes}</span> &nbsp; <span style="color:#f59e0b; font-weight:bold;">🔧 ${enProceso}</span>`;
                    // Forzar visibilidad sin hover
                    descTrabajos.style.opacity = '0.9';
                    descTrabajos.style.maxHeight = '20px';
                    descTrabajos.style.transform = 'translateY(0)';
                    descTrabajos.style.marginTop = '1px';
                }
            }
        }
    } catch(err) {
        // Silencioso, no rompe la UI
    }
  }

  // Auto-inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
  } else {
    initSidebar();
  }

  /**
   * ============================================================
   * 🔔 NOTIFICACIONES EN TIEMPO REAL (SOCKET.IO)
   * ============================================================
   */
  function initRealTimeNotifications() {
    // 1. Cargar el script de Socket.io dinámicamente si no existe
    if (typeof io === 'undefined') {
      const script = document.createElement('script');
      script.src = '/socket.io/socket.io.js';
      script.onload = () => setupSocket();
      document.head.appendChild(script);
    } else {
      setupSocket();
    }

    function setupSocket() {
      const socket = io();
      window.mrSocket = socket; // Expose globally for other modules
      
      // Dispatch an event to let other scripts know socket is ready
      const event = new CustomEvent('mrSocketReady', { detail: socket });
      window.dispatchEvent(event);

      console.log('[NOTIFICACIONES] 🔌 Conectado al servidor de tiempo real');

      // Pedir permiso para notificaciones de escritorio
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }

      // Escuchar nuevos pedidos
      socket.on('new_order', (data) => {
        console.log('📦 Nuevo pedido recibido:', data);
        
        // Mostrar notificación de navegador
        if (Notification.permission === 'granted') {
          const notification = new Notification(data.title, {
            body: data.message,
            icon: '/img/logo_negro.png',
            tag: data.workId // Evitar duplicados
          });

          notification.onclick = () => {
            window.location.href = 'trabajos.html';
            window.focus();
          };
        }

        // También reproducir sonido si estamos en el dashboard
        const audio = new Audio('/sounds/notification.mp3');
        audio.play().catch(e => console.log('Bloqueo de audio por navegador'));
      });
    }
  }

  // Inicializar notificaciones
  initRealTimeNotifications();

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
