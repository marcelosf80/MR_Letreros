// ==================== SERVER.JS - MR LETREROS ====================
// Servidor Node.js para sistema de cotizaciones con red local compartida
// Versión: 4.0 - Sistema completo Gremio + Clientes + Precios + Costos

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process'); // Módulo para ejecutar otros programas

const app = express();
const PORT = 3000;

let pythonCmd = 'python'; // Comando por defecto, se actualizará si se detecta 'py'

// ==================== CONFIGURACIÓN DE RUTAS ====================

const BASE_PATH = 'C:\\MR_Letreros';
const DATA_DIR = path.join(BASE_PATH, 'datos_mr_letreros');
const PUBLIC_DIR = path.join(BASE_PATH, 'public');

// Archivos de datos principales
const FILES = {
  gremio_clientes: path.join(DATA_DIR, 'gremio', 'clientes.json'),
  gremio_data: path.join(DATA_DIR, 'gremio', 'cotizaciones.json'),  
  clientes_data: path.join(DATA_DIR, 'clientes', 'cotizaciones.json'),
  clientes: path.join(DATA_DIR, 'clientes.json'), // Unificar aquí
  precios: path.join(DATA_DIR, 'gremio_precios_db.json'),
  costos: path.join(DATA_DIR, 'gremio_costos_db.json'),
  gastos: path.join(DATA_DIR, 'mr_letreros_gastos.json'),
  materiales: path.join(DATA_DIR, 'gremio_materiales.json'),
  categorias: path.join(DATA_DIR, 'gremio_categorias.json'),
  terceros: path.join(DATA_DIR, 'gremio_terceros.json'),
  trabajos: path.join(DATA_DIR, 'trabajos.json'),
  business_rules: path.join(DATA_DIR, 'business-rules.json')
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
    await fs.mkdir(path.join(DATA_DIR, 'gremio'), { recursive: true });
    await fs.mkdir(path.join(DATA_DIR, 'clientes'), { recursive: true });
    
    // Crear archivos iniciales si no existen
    for (const [name, filepath] of Object.entries(FILES)) {
      try {
        await fs.access(filepath);
        console.log(`   ✅ ${name}: existe`);
      } catch {
        let initialData = [];
        if (name === 'trabajos') {
            initialData = { works: [], notifications: [] };
        } else if (name === 'business_rules') {
            initialData = { idealMargin: 35, deliveryStandardDays: 4, vipThreshold: 500000, priceStagnationDays: 30 };
        }
        
        await fs.writeFile(filepath, JSON.stringify(initialData, null, 2));
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

// Función para verificar si Python está disponible
async function checkPython() {
  return new Promise((resolve) => {
    console.log('🔍 Verificando la instalación de Python...');
    
    // Función auxiliar para probar un comando
    const tryCommand = (cmd) => {
        return new Promise(r => {
            const p = spawn(cmd, ['--version']);
            p.on('error', () => r(false));
            p.on('close', code => r(code === 0));
        });
    };

    (async () => {
        // 1. Intentar con 'py' (Lanzador de Windows, evita conflictos con Inkscape)
        if (await tryCommand('py')) {
             console.log('   ✅ Python encontrado (Lanzador "py").');
             pythonCmd = 'py';
             resolve(true);
             return;
        }
        
        // 2. Intentar con 'python' estándar
        if (await tryCommand('python')) {
             console.log('   ✅ Python encontrado (Comando "python").');
             pythonCmd = 'python';
             resolve(true);
             return;
        }

        console.error('   ❌ No se encontró una instalación de Python válida.');
        resolve(false);
    })();
  });
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

// ==================== ENDPOINT REGLAS DE NEGOCIO ====================

app.get('/api/business-rules', async (req, res) => {
  const data = await readJSON(FILES.business_rules);
  res.json(data);
});

// ==================== ENDPOINT ESTADÍSTICAS ====================

app.get('/api/statistics/today', async (req, res) => {
  try {
    const gremioData = await readJSON(FILES.gremio_data);
    const clientesData = await readJSON(FILES.clientes_data);
    
    const today = new Date().toISOString().split('T')[0];
    
    const gremioToday = gremioData.filter(item => {
      const date = item.date || item.fecha;
      return date && date.startsWith(today) && (item.approved === true || item.estado === 'aprobada');
    });
    
    const clientesToday = clientesData.filter(item => {
      const date = item.date || item.fecha;
      return date && date.startsWith(today) && (item.approved === true || item.estado === 'aprobada');
    });
    
    const facturadoGremio = gremioToday.reduce((sum, item) => sum + (parseFloat(item.total || item.totalCliente) || 0), 0);
    const facturadoClientes = clientesToday.reduce((sum, item) => sum + (parseFloat(item.total || item.totalCliente) || 0), 0);
    
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
    const trabajosData = await readJSON(FILES.trabajos);
    
    // 1. Calcular desglose por categorías de productos (Ventas)
    const breakdown = {};
    
    const processQuotes = (quotes) => {
      quotes.forEach(q => {
        // Normalizar estado de aprobación (soporta formato nuevo y viejo)
        const isApproved = q.approved === true || q.estado === 'aprobada';
        if (!isApproved) return;
        
        const items = q.items || q.productos || [];
        
        if (items.length > 0) {
          items.forEach(item => {
            // Normalizar campos
            const cat = item.category || item.categoria || 'Sin Categoría';
            const venta = parseFloat(item.total || item.price || 0);
            const costo = parseFloat(item.costoTotal || item.totalCosto || 0);
            
            if (!breakdown[cat]) breakdown[cat] = { categoria: cat, ingresos: 0, costos: 0, cantidad: 0 };
            breakdown[cat].ingresos += venta;
            breakdown[cat].costos += costo;
            breakdown[cat].cantidad += (parseFloat(item.quantity || item.cantidad) || 1);
          });
        } else {
          // Cotizaciones antiguas sin items detallados o fallos de estructura
          const cat = 'General';
          const venta = parseFloat(q.total || q.totalCliente || 0);
          const costo = parseFloat(q.costoTotal || 0);
          
          if (!breakdown[cat]) breakdown[cat] = { categoria: cat, ingresos: 0, costos: 0, cantidad: 1 };
          breakdown[cat].ingresos += venta;
          breakdown[cat].costos += costo;
        }
      });
    };
    
    processQuotes(gremioData);
    processQuotes(clientesData);
    
    const categorias = Object.values(breakdown).map(c => ({
      ...c,
      ganancia: c.ingresos - c.costos,
      margen: c.ingresos > 0 ? ((c.ingresos - c.costos) / c.ingresos * 100) : 0
    })).sort((a, b) => b.ingresos - a.ingresos);
    
    // 2. Calcular Totales Generales
    const totalIngresos = categorias.reduce((sum, c) => sum + c.ingresos, 0);
    
    // 3. Gastos Operativos (Todo lo que sea egreso en gastos.json)
    const gastosTotales = gastos
      .filter(g => g.tipo !== 'ingreso')
      .reduce((sum, g) => sum + Math.abs(parseFloat(g.monto) || 0), 0);
    
    // Desglose de gastos por categoría de gasto
    const gastosPorCategoria = {};
    gastos.filter(g => g.tipo !== 'ingreso').forEach(g => {
        const cat = g.categoria || 'General';
        if (!gastosPorCategoria[cat]) gastosPorCategoria[cat] = 0;
        gastosPorCategoria[cat] += (parseFloat(g.monto) || 0);
    });

    // 4. Calcular Pendiente a Cobrar (Desde Trabajos)
    let pendienteCobrar = 0;
    if (trabajosData && trabajosData.works) {
        pendienteCobrar = trabajosData.works.reduce((sum, w) => {
            return sum + (parseFloat(w.balance) || 0);
        }, 0);
    }
    
    res.json({
      resumen: {
        ingresos: totalIngresos,
        gastosOperativos: gastosTotales,
        gananciaNeta: totalIngresos - gastosTotales,
        margenTotal: totalIngresos > 0 ? ((totalIngresos - gastosTotales) / totalIngresos * 100) : 0,
        pendienteCobrar: pendienteCobrar
      },
      porCategoria: categorias,
      gastosDetalle: gastosPorCategoria
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

// ==================== ENDPOINT PARA PROCESADO DE ARCHIVOS CON PYTHON ====================

app.post('/api/process-file', (req, res) => {
    const pythonProcess = spawn(pythonCmd, ['file_processor.py']);

    let resultData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
        resultData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0 || errorData) {
            // Intenta parsear el error por si Python envió un JSON
            try {
                const errJson = JSON.parse(errorData);
                console.error(`Error del script de Python (file_processor.py): ${errJson.error}`);
                res.status(500).json({ error: 'Error durante el procesamiento del archivo.', details: errJson.error });
                return;
            } catch (e) {
                // Si no es JSON, es un error del sistema
                console.error(`Error del script de Python (file_processor.py): ${errorData}`);
                res.status(500).json({ error: 'Error durante el procesamiento del archivo.', details: errorData });
            }
        } else {
            try {
                const result = JSON.parse(resultData);
                res.json(result);
            } catch (e) {
                res.status(500).json({ error: 'Fallo al leer el resultado del script de Python.' });
            }
        }
    });

    pythonProcess.stdin.write(JSON.stringify(req.body));
    pythonProcess.stdin.end();
});

// ==================== ENDPOINT PARA NESTING CON PYTHON ====================

app.post('/api/nesting/solve', (req, res) => {
    // 1. Ejecuta el script de Python como un proceso hijo
    const pythonProcess = spawn(pythonCmd, ['nesting_solver.py']);

    let resultData = '';
    let errorData = '';

    // 2. Escucha la salida de datos del script (el resultado JSON)
    pythonProcess.stdout.on('data', (data) => {
        resultData += data.toString();
    });

    // 3. Escucha si hay errores durante la ejecución del script
    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    // 4. Cuando el script de Python termina, se ejecuta este bloque
    pythonProcess.on('close', (code) => {
        if (code !== 0 || errorData) {
            console.error(`Error del script de Python: ${errorData}`);
            res.status(500).json({ error: 'Error durante el proceso de nesting en el servidor.', details: errorData });
        } else {
            try {
                // 5. Si todo salió bien, parsea el resultado y lo envía de vuelta al navegador
                const result = JSON.parse(resultData);
                res.json(result);
            } catch (e) {
                console.error(`Error al parsear la salida de Python: ${e}`);
                res.status(500).json({ error: 'Fallo al leer el resultado del script de Python.' });
            }
        }
    });

    // 6. Envía los datos que llegaron del navegador (las piezas) al script de Python
    try {
        pythonProcess.stdin.write(JSON.stringify(req.body));
        pythonProcess.stdin.end();
    } catch (error) {
        console.error('Error al escribir en el stdin de Python:', error);
        res.status(500).json({ error: 'No se pudieron enviar los datos al proceso de Python.' });
    }
});

// ==================== ENDPOINTS DE TRABAJOS ====================

app.get('/api/trabajos', async (req, res) => {
    const filePath = FILES.trabajos;
    try {
        // Si no existe, devolver estructura vacía
        try {
            await fs.access(filePath);
        } catch {
            return res.json({ works: [], notifications: [] });
        }

        let data = await readJSON(filePath);
        
        // Si es un array (por inicialización por defecto o error), convertir a objeto
        if (Array.isArray(data)) {
            data = { works: [], notifications: [] };
        }
        
        // Asegurar estructura
        if (!data.works) data.works = [];
        if (!data.notifications) data.notifications = [];
        res.json(data);
    } catch (error) {
        console.error('Error leyendo trabajos:', error);
        res.status(500).json({ error: 'Error leyendo trabajos' });
    }
});

app.post('/api/trabajos', async (req, res) => {
    const filePath = FILES.trabajos;
    const success = await writeJSON(filePath, req.body);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Error guardando trabajos' });
    }
});

// ==================== GESTIÓN DE CLIENTES ====================

// Endpoint unificado para la gestión de clientes
app.get('/api/clientes', async (req, res) => {
    const filePath = FILES.clientes;
    
    try {
        // Crear archivo si no existe
        try {
            await fs.access(filePath);
        } catch {
            await writeJSON(filePath, []);
            console.log('   📝 clientes.json creado');
        }
        
        const data = await readJSON(filePath);
        res.json(data);
    } catch (error) {
        console.error('❌ Error leyendo clientes:', error);
        res.status(500).json({ error: 'Error leyendo clientes' });
    }
});

// Este endpoint ahora maneja tanto la creación de un nuevo cliente como la actualización de toda la lista.
app.post('/api/clientes', async (req, res) => {
    const filePath = FILES.clientes;
    
    try {
        const incomingData = req.body;
        
        // Si el body es un array, se asume que es la lista completa de clientes para guardar.
        if (Array.isArray(incomingData)) {
            await writeJSON(filePath, incomingData);
            console.log(`✅ Lista de clientes guardada: ${incomingData.length} registros`);
            return res.json({ success: true });
        }
        // Si es un objeto, se asume que es un nuevo cliente para agregar a la lista.
        const clientes = await readJSON(filePath);
        clientes.push(incomingData);
        await writeJSON(filePath, clientes);
        res.json({ success: true, data: incomingData });
    } catch (error) {
        console.error('❌ Error guardando clientes:', error);
        res.status(500).json({ error: 'Error guardando clientes' });
    }
});

app.put('/api/clientes/:id', async (req, res) => {
    const filePath = FILES.clientes;
    try {
        const clientes = await readJSON(filePath);
        const index = clientes.findIndex(c => c.id === req.params.id);
        if (index !== -1) {
            clientes[index] = { ...clientes[index], ...req.body };
            await writeJSON(filePath, clientes);
            res.json({ success: true, data: clientes[index] });
        } else {
            res.status(404).json({ success: false, error: 'Cliente no encontrado' });
        }
    } catch (error) {
        console.error('❌ Error actualizando cliente:', error);
        res.status(500).json({ error: 'Error actualizando cliente' });
    }
});

app.delete('/api/clientes/:id', async (req, res) => {
    const filePath = FILES.clientes;
    try {
        const clientes = await readJSON(filePath);
        const filtered = clientes.filter(c => c.id !== req.params.id);
        await writeJSON(filePath, filtered);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error eliminando cliente:', error);
        res.status(500).json({ error: 'Error eliminando cliente' });
    }
});

// ==================== ENDPOINT RESETEO TOTAL Y PARCIAL ====================

app.post('/api/system/reset/:section?', async (req, res) => {
    const section = req.params.section;
    
    try {
        // Si no hay sección o es 'all', reseteo total
        if (!section || section === 'all') {
            console.log('⚠️ [API] Solicitud de reseteo TOTAL recibida');
            for (const [name, filepath] of Object.entries(FILES)) {
                let initialData = [];
                if (name === 'trabajos') {
                    initialData = { works: [], notifications: [] };
                } else if (name === 'business_rules') {
                    initialData = { idealMargin: 35, deliveryStandardDays: 4, vipThreshold: 500000, priceStagnationDays: 30 };
                }
                await writeJSON(filepath, initialData);
            }
            console.log('✅ [API] Sistema reseteado correctamente');
            return res.json({ success: true, message: 'Sistema reseteado completamente' });
        }

        // Reseteo parcial de una sección específica
        if (FILES[section]) {
            console.log(`⚠️ [API] Solicitud de reseteo PARCIAL: ${section}`);
            const filepath = FILES[section];
            let initialData = [];
            
            if (section === 'trabajos') {
                initialData = { works: [], notifications: [] };
            } else if (section === 'business_rules') {
                initialData = { idealMargin: 35, deliveryStandardDays: 4, vipThreshold: 500000, priceStagnationDays: 30 };
            }
            
            await writeJSON(filepath, initialData);
            return res.json({ success: true, message: `Sección ${section} limpiada correctamente` });
        } else {
            return res.status(400).json({ error: 'Sección no válida' });
        }
    } catch (error) {
        console.error('❌ [API] Error reseteando:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== INICIAR SERVIDOR ====================

initializeDataStructure().then(() => {
  // Verificar Python antes de iniciar el servidor web
  checkPython().then(pythonOk => {
    if (!pythonOk) {
      console.error('\n⚠️ ADVERTENCIA: La función de nesting en el servidor (Python) NO funcionará.');
      console.error('   Por favor, instala Python y asegúrate de que esté en el PATH del sistema.\n');
    }
    app.listen(PORT, '0.0.0.0', () => {
      // El mensaje principal ya se muestra en initializeDataStructure
    });
  });
});

// Manejo de errores
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Promesa rechazada:', error);
});
