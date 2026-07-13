// ============================================
// CONFIGURACION DE SERVICIOS
// ============================================

const serviciosConfig = {
  // Servicios disponibles con sus categorías
  servicios: [
    {
      id: 'corte_laser',
      nombre: 'Corte Laser',
      categorias: ['MDF', 'Acrilico', 'Madera']
    },
    {
      id: 'impresion',
      nombre: 'Impresion',
      categorias: ['Gran Formato', 'Sublimacion', 'Digital']
    },
    {
      id: 'grabado',
      nombre: 'Grabado',
      categorias: ['Laser', 'CNC', 'Manual']
    },
    {
      id: 'rotulacion',
      nombre: 'Rotulacion',
      categorias: ['Vehicular', 'Fachada', 'Interior']
    }
  ],
  
  // Obtener servicio por ID
  getServicio(id) {
    return this.servicios.find(s => s.id === id);
  },
  
  // Obtener todas las categorías de un servicio
  getCategorias(servicioId) {
    const servicio = this.getServicio(servicioId);
    return servicio ? servicio.categorias : [];
  },
  
  // Obtener todos los servicios
  getServicios() {
    return this.servicios;
  }
};

// Exportar a window
window.serviciosConfig = serviciosConfig;

console.log('[serviciosConfig] Configuración de servicios cargada');
