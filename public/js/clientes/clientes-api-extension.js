/**
 * EXTENSIÓN DE DATA MANAGER - API de Clientes
 * Agregar estos métodos al archivo data-manager-extension.js
 */

// ==================== MÉTODOS PARA AGREGAR ====================

// Agregar en la clase DataManagerExtension:

async getClientes() {
  try {
    const clientes = await this.request('/api/clientes');
    console.log('[DATA-MANAGER] Clientes obtenidos:', clientes.length);
    return clientes;
  } catch (error) {
    console.error('[DATA-MANAGER] Error obteniendo clientes:', error);
    return [];
  }
}

async saveClientes(clientes) {
  try {
    const result = await this.request('/api/clientes', 'POST', clientes);
    console.log('[DATA-MANAGER] Clientes guardados');
    return result;
  } catch (error) {
    console.error('[DATA-MANAGER] Error guardando clientes:', error);
    throw error;
  }
}

async getClienteById(id) {
  try {
    const clientes = await this.getClientes();
    return clientes.find(c => c.id === id);
  } catch (error) {
    console.error('[DATA-MANAGER] Error obteniendo cliente:', error);
    return null;
  }
}

async searchClientes(query) {
  try {
    const clientes = await this.getClientes();
    const searchTerm = query.toLowerCase();
    
    return clientes.filter(c => 
      (c.nombre || '').toLowerCase().includes(searchTerm) ||
      (c.telefono || '').toLowerCase().includes(searchTerm) ||
      (c.email || '').toLowerCase().includes(searchTerm)
    );
  } catch (error) {
    console.error('[DATA-MANAGER] Error buscando clientes:', error);
    return [];
  }
}

// ==================== ENDPOINT DEL SERVIDOR ====================

/*
Agregar en server.js:

// Endpoint: Obtener clientes
app.get('/api/clientes', (req, res) => {
  try {
    const clientesPath = path.join(DATA_DIR, 'clientes.json');
    
    if (!fs.existsSync(clientesPath)) {
      // Crear archivo vacío si no existe
      fs.writeFileSync(clientesPath, JSON.stringify([], null, 2));
      return res.json([]);
    }
    
    const data = fs.readFileSync(clientesPath, 'utf8');
    const clientes = JSON.parse(data);
    res.json(clientes);
  } catch (error) {
    console.error('Error leyendo clientes:', error);
    res.status(500).json({ error: 'Error al leer clientes' });
  }
});

// Endpoint: Guardar clientes
app.post('/api/clientes', (req, res) => {
  try {
    const clientes = req.body;
    
    if (!Array.isArray(clientes)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }
    
    const clientesPath = path.join(DATA_DIR, 'clientes.json');
    fs.writeFileSync(clientesPath, JSON.stringify(clientes, null, 2));
    
    console.log('✅ Clientes guardados:', clientes.length);
    res.json({ success: true, count: clientes.length });
  } catch (error) {
    console.error('Error guardando clientes:', error);
    res.status(500).json({ error: 'Error al guardar clientes' });
  }
});
*/
