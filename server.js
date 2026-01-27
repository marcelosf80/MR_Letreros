// ==================== SERVER.JS - MR LETREROS ====================
// Servidor Node.js para sistema de cotizaciones con red local compartida
// Versión: 4.0 - Sistema completo Gremio + Clientes + Precios + Costos

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// ==================== CONFIGURACIÓN DE RUTAS ====================

const BASE_PATH = 'C:\\MR_Letreros';
const DATA_DIR = path.join(BASE_PATH, 'datos_mr_letreros');
const PUBLIC_DIR = path.join(BASE_PATH, 'public');

// Archivos de datos principales
const FILES = {
  gremio_clientes: path.join(DATA_DIR, 'gremio_clientes.json'),
  gremio_data: path.join(DATA_DIR, 'gremio_cotizaciones.json'),
  clientes_clientes: path.join(DATA_DIR, 'clientes_clientes.json'),
  clientes_data: path.join(DATA_DIR, 'clientes_cotizaciones.json'),
  precios: path.join(DATA_DIR, 'gremio_precios_db.json'),
  costos: path.join(DATA_DIR, 'gremio_costos_db.json'),
  gastos: path.join(DATA_DIR, 'mr_letreros_gastos.json'),
  materiales: path.join(DATA_DIR, 'gremio_materiales.json'),
  categorias: path.join(DATA_DIR, 'gremio_categorias.json'),
  terceros: path.join(DATA_DIR, 'gremio_terceros.json')
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(PUBLIC_DIR));

// ==================== INICIALIZACIÓN ====================

async function initializeDataStructure() {
  try {
    console.log('🚀 Iniciando servidor MR Letreros...');
    
    // Crear directorios
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(PUBLIC_DIR, { recursive: true });
    
    // Crear archivos iniciales si no existen
    for (const [name, filepath] of Object.entries(FILES)) {
      try {
        await fs.access(filepath);
        console.log(`   ✅ ${name}: existe`);
      } catch {
        await fs.writeFile(filepath, JSON.stringify([], null, 2));
        console.log(`   📝 ${name}: creado`);
      }
    }
    
    console.log('');
    console.log('✅ Estructura de datos inicializada');
    console.log('📁 Datos: ' + DATA_DIR);
    console.log('📁 Web: ' + PUBLIC_DIR);
    console.log('');
    console.log('🌐 Servidor corriendo en:');
    console.log(`   Local: http://localhost:${PORT}`);
    console.log(`   Red: http://${getLocalIP()}:${PORT}`);
    console.log('');
    console.log('💡 Otras PCs pueden acceder usando:');
    console.log(`   http://${getLocalIP()}:${PORT}`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Error al inicializar:', error);
  }
}

// Obtener IP local
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// ==================== FUNCIONES HELPER ====================

async function readJSON(filepath) {
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error leyendo ${filepath}:`, error.message);
    return [];
  }
}

async function writeJSON(filepath, data) {
  try {
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error escribiendo ${filepath}:`, error.message);
    return false;
  }
}

// ==================== ENDPOINTS GREMIO CLIENTES ====================

app.get('/api/gremio/clientes', async (req, res) => {
  const data = await readJSON(FILES.gremio_clientes);
  res.json(data);
});

app.post('/api/gremio/clientes', async (req, res) => {
  const clientes = await readJSON(FILES.gremio_clientes);
  clientes.push(req.body);
  const success = await writeJSON(FILES.gremio_clientes, clientes);
  res.json({ success, data: req.body });
});

app.put('/api/gremio/clientes/:id', async (req, res) => {
  const clientes = await readJSON(FILES.gremio_clientes);
  const index = clientes.findIndex(c => c.id === req.params.id);
  if (index !== -1) {
    clientes[index] = { ...clientes[index], ...req.body };
    await writeJSON(FILES.gremio_clientes, clientes);
    res.json({ success: true, data: clientes[index] });
  } else {
    res.status(404).json({ success: false, error: 'Cliente no encontrado' });
  }
});

app.delete('/api/gremio/clientes/:id', async (req, res) => {
  const clientes = await readJSON(FILES.gremio_clientes);
  const filtered = clientes.filter(c => c.id !== req.params.id);
  await writeJSON(FILES.gremio_clientes, filtered);
  res.json({ success: true });
});

// ==================== ENDPOINTS GREMIO COTIZACIONES ====================

app.get('/api/gremio/data', async (req, res) => {
  const data = await readJSON(FILES.gremio_data);
  res.json(data);
});

app.post('/api/gremio/data', async (req, res) => {
  const success = await writeJSON(FILES.gremio_data, req.body);
  res.json({ success });
});

// ==================== ENDPOINTS CLIENTES CLIENTES ====================

app.get('/api/clientes/clientes', async (req, res) => {
  const data = await readJSON(FILES.clientes_clientes);
  res.json(data);
});

app.post('/api/clientes/clientes', async (req, res) => {
  const clientes = await readJSON(FILES.clientes_clientes);
  clientes.push(req.body);
  const success = await writeJSON(FILES.clientes_clientes, clientes);
  res.json({ success, data: req.body });
});

app.put('/api/clientes/clientes/:id', async (req, res) => {
  const clientes = await readJSON(FILES.clientes_clientes);
  const index = clientes.findIndex(c => c.id === req.params.id);
  if (index !== -1) {
    clientes[index] = { ...clientes[index], ...req.body };
    await writeJSON(FILES.clientes_clientes, clientes);
    res.json({ success: true, data: clientes[index] });
  } else {
    res.status(404).json({ success: false, error: 'Cliente no encontrado' });
  }
});

app.delete('/api/clientes/clientes/:id', async (req, res) => {
  const clientes = await readJSON(FILES.clientes_clientes);
  const filtered = clientes.filter(c => c.id !== req.params.id);
  await writeJSON(FILES.clientes_clientes, filtered);
  res.json({ success: true });
});

// ==================== ENDPOINTS CLIENTES COTIZACIONES ====================

app.get('/api/clientes/data', async (req, res) => {
  const data = await readJSON(FILES.clientes_data);
  res.json(data);
});

app.post('/api/clientes/data', async (req, res) => {
  const success = await writeJSON(FILES.clientes_data, req.body);
  res.json({ success });
});

// ==================== ENDPOINTS PRECIOS ====================

app.get('/api/precios', async (req, res) => {
  const data = await readJSON(FILES.precios);
  res.json(data);
});

app.post('/api/precios', async (req, res) => {
  const success = await writeJSON(FILES.precios, req.body);
  res.json({ success });
});

// ==================== ENDPOINTS COSTOS ====================

app.get('/api/costos', async (req, res) => {
  const data = await readJSON(FILES.costos);
  res.json(data);
});

app.post('/api/costos', async (req, res) => {
  const success = await writeJSON(FILES.costos, req.body);
  res.json({ success });
});

// ==================== ENDPOINTS GASTOS ====================

app.get('/api/gastos', async (req, res) => {
  const data = await readJSON(FILES.gastos);
  res.json(data);
});

app.post('/api/gastos', async (req, res) => {
  const success = await writeJSON(FILES.gastos, req.body);
  res.json({ success });
});

// ==================== ENDPOINTS MATERIALES ====================

app.get('/api/materiales', async (req, res) => {
  const data = await readJSON(FILES.materiales);
  res.json(data);
});

app.post('/api/materiales', async (req, res) => {
  try {
    console.log('[MATERIALES-POST] Recibiendo POST');
    console.log('[MATERIALES-POST] Tipo de datos:', Array.isArray(req.body) ? 'Array' : 'Objeto');
    console.log('[MATERIALES-POST] Cantidad:', Array.isArray(req.body) ? req.body.length : 1);
    
    // Si es un array, guardar directamente
    if (Array.isArray(req.body)) {
      console.log('[MATERIALES-POST] Guardando array completo...');
      const success = await writeJSON(FILES.materiales, req.body);
      console.log('[MATERIALES-POST] ✅ Guardado exitoso:', success);
      res.json({ success });
    } else {
      // Si es un objeto único, agregarlo al array
      console.log('[MATERIALES-POST] Agregando objeto único al array...');
      let materiales = await readJSON(FILES.materiales);
      if (!Array.isArray(materiales)) {
        materiales = [];
      }
      materiales.push(req.body);
      const success = await writeJSON(FILES.materiales, materiales);
      console.log('[MATERIALES-POST] ✅ Objeto agregado, guardado exitoso:', success);
      res.json({ success });
    }
  } catch (error) {
    console.error('[MATERIALES-POST] ❌ Error en POST /api/materiales:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ENDPOINTS CATEGORÍAS ====================

app.get('/api/categorias', async (req, res) => {
  const data = await readJSON(FILES.categorias);
  console.log('[CATEGORÍAS API] GET /api/categorias. Datos:', data);
  res.json(Array.isArray(data) ? data : []);
});

app.post('/api/categorias', async (req, res) => {
  try {
    let categorias = await readJSON(FILES.categorias);
    if (!Array.isArray(categorias)) {
      categorias = [];
    }
    
    if (Array.isArray(req.body)) {
      // Si es un array, guardar directamente
      const success = await writeJSON(FILES.categorias, req.body);
      res.json({ success });
    } else if (req.body.categoria) {
      // Si es un objeto con 'categoria', agregarlo si no existe
      if (!categorias.includes(req.body.categoria)) {
        categorias.push(req.body.categoria);
        categorias.sort();
      }
      const success = await writeJSON(FILES.categorias, categorias);
      res.json({ success });
    } else {
      res.status(400).json({ success: false, error: 'Formato inválido' });
    }
  } catch (error) {
    console.error('Error en POST /api/categorias:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/categorias/:categoria', async (req, res) => {
  try {
    let categorias = await readJSON(FILES.categorias);
    if (!Array.isArray(categorias)) {
      categorias = [];
    }
    
    categorias = categorias.filter(c => c !== decodeURIComponent(req.params.categoria));
    const success = await writeJSON(FILES.categorias, categorias);
    res.json({ success });
  } catch (error) {
    console.error('Error en DELETE /api/categorias:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ENDPOINTS TERCEROS ====================


app.get('/api/terceros', async (req, res) => {
  const data = await readJSON(FILES.terceros);
  res.json(data);
});

app.post('/api/terceros', async (req, res) => {
  const success = await writeJSON(FILES.terceros, req.body);
  res.json({ success });
});

// ==================== ENDPOINT ESTADÍSTICAS ====================

app.get('/api/statistics/today', async (req, res) => {
  try {
    const gremioData = await readJSON(FILES.gremio_data);
    const clientesData = await readJSON(FILES.clientes_data);
    
    const today = new Date().toISOString().split('T')[0];
    
    const gremioToday = gremioData.filter(item => 
      item.date && item.date.startsWith(today) && item.approved === true
    );
    
    const clientesToday = clientesData.filter(item => 
      item.date && item.date.startsWith(today) && item.approved === true
    );
    
    const facturadoGremio = gremioToday.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    const facturadoClientes = clientesToday.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    
    res.json({
      total: gremioToday.length + clientesToday.length,
      gremio: gremioToday.length,
      clientes: clientesToday.length,
      facturado: facturadoGremio + facturadoClientes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rendimientos', async (req, res) => {
  try {
    const gremioData = await readJSON(FILES.gremio_data);
    const clientesData = await readJSON(FILES.clientes_data);
    const gastos = await readJSON(FILES.gastos);
    
    const gremioAprobadas = gremioData.filter(item => item.approved === true);
    const clientesAprobadas = clientesData.filter(item => item.approved === true);
    
    const ingresosGremio = gremioAprobadas.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    const ingresosClientes = clientesAprobadas.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    const totalIngresos = ingresosGremio + ingresosClientes;
    
    const totalGastos = gastos.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
    
    const ganancia = totalIngresos - totalGastos;
    const margen = totalIngresos > 0 ? (ganancia / totalIngresos) * 100 : 0;
    
    res.json({
      ingresos: totalIngresos,
      gastos: totalGastos,
      ganancia: ganancia,
      margen: margen
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ENDPOINT DE HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Servidor MR Letreros funcionando correctamente'
  });
});

// ==================== INICIAR SERVIDOR ====================

initializeDataStructure().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    // El mensaje ya se muestra en initializeDataStructure
  });
});

// Manejo de errores
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Promesa rechazada:', error);
});
