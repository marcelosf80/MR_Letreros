// ==================== SERVER.JS - MR LETREROS ====================
// Servidor Node.js para sistema de cotizaciones con red local compartida
// Versión: 4.0 - Sistema completo Gremio + Clientes + Precios + Costos

// Cargar variables de entorno desde .env manualmente si existe
try {
  const fsSync = require('fs');
  const envPath = require('path').join(__dirname, '.env');
  if (fsSync.existsSync(envPath)) {
    const envContent = fsSync.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
        const index = trimmedLine.indexOf('=');
        const key = trimmedLine.substring(0, index).trim();
        let val = trimmedLine.substring(index + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    });
  }
} catch (e) {
  console.error('Error al cargar archivo .env:', e.message);
}

const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { spawn, execSync } = require('child_process'); // Módulo para ejecutar otros programas
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('./logger'); // Importar nuestro nuevo logger
const googleSync = require('./google_sync'); // Importar módulo de Google
const db = require('./db'); // SQLite Database
const multer = require('multer'); // Para subida de imágenes
const InstagramAPI = require('./instagram_api'); // Para Marketing
const { Bonjour } = require('bonjour-service'); // mDNS para descubrimiento en red local
const http = require('http'); // Necesario para Socket.io
const { Server } = require('socket.io');

// Auto-instalación de dependencias Node.js
const ensureDependency = (name) => {
  try {
    require.resolve(name);
  } catch (e) {
    console.log(`📦 Instalando dependencia faltante: ${name}...`);
    try {
      execSync(`npm install ${name}`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`❌ Error instalando ${name}:`, err.message);
    }
  }
};

ensureDependency('helmet');
ensureDependency('express-rate-limit');

const helmet = require('helmet'); // Para headers de seguridad
const rateLimit = require('express-rate-limit'); // Para limitar peticiones
const sharp = require('sharp'); // Para procesamiento de imágenes
const OpenAI = require('openai'); // Para conectar con Groq

// Cargar librería de Google Gemini (si está instalada)
let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) { }

// Usar variable de entorno; si no existe, generar un secreto aleatorio (evita el fallback público).
const SECRET_KEY = process.env.JWT_SECRET || require('crypto').randomBytes(48).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET no está definido: se generó un secreto temporal (las sesiones se invalidarán al reiniciar). Defina JWT_SECRET en .env para persistir sesiones.');
}

// ==================== MANEJO DE ERRORES GLOBAL ====================
// Se define al inicio para capturar errores lo antes posible
process.on('uncaughtException', (error) => {
  console.error('🔥 [ERROR CRÍTICO] Excepción no capturada:', error);
  if (typeof logger !== 'undefined') logger.error('❌ Error no capturado', { error: error.stack });
});

process.on('unhandledRejection', (error) => {
  console.error('🔥 [ERROR CRÍTICO] Promesa rechazada:', error);
  if (typeof logger !== 'undefined') logger.error('❌ Promesa rechazada', { error: error.stack });
});

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
  pingTimeout: 60000
});
const PORT = 3000;

// Exportar io para que otros módulos lo usen
app.set('socketio', io);

// FIX seguridad: autenticar el handshake de Socket.IO con el JWT de sesión.
// Antes cualquier cliente de la LAN podía conectarse y recibir datos de trabajos/clientes.
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('Token requerido'));
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Token inválido o expirado'));
  }
});

io.on('connection', (socket) => {
  logger.info(`🔌 PC conectada al sistema (ID: ${socket.id})`);
  socket.on('disconnect', () => {
    // Silencioso
  });
});

let pythonCmd = 'python'; // Comando por defecto, se actualizará si se detecta 'py'

// ==================== CONFIGURACIÓN DE RUTAS ====================

const BASE_PATH = 'C:\\MR_Letreros';
const DATA_DIR = path.join(BASE_PATH, 'datos_mr_letreros');
const PUBLIC_DIR = path.join(BASE_PATH, 'public');
const UPLOADS_TEMP_DIR = path.join(BASE_PATH, 'uploads', 'temp');
const UPLOADS_OUTPUT_DIR = path.join(BASE_PATH, 'uploads', 'output');
const UPLOADS_CLIENTS_DIR = path.join(BASE_PATH, 'uploads', 'clientes');
const UPLOADS_TAREAS_DIR = path.join(BASE_PATH, 'uploads', 'tareas');

// Archivos de datos principales
const FILES = {
  gremio_clientes: path.join(DATA_DIR, 'clientes.json'), // Unificado con clientes.json
  gremio_data: path.join(DATA_DIR, 'gremio', 'cotizaciones.json'),
  clientes_data: path.join(DATA_DIR, 'clientes', 'cotizaciones.json'),
  clientes: path.join(DATA_DIR, 'clientes.json'), // Unificar aquí
  precios: path.join(DATA_DIR, 'gremio_precios_db.json'),
  costos: path.join(DATA_DIR, 'gremio_costos_db.json'),
  gastos: path.join(DATA_DIR, 'mr_letreros_gastos.json'),
  materiales: path.join(DATA_DIR, 'gremio_materiales.json'),
  categorias: path.join(DATA_DIR, 'gremio_categorias.json'),
  terceros: path.join(DATA_DIR, 'gremio_terceros.json'),
  precios_finales: path.join(DATA_DIR, 'gremio_precios_finales.json'),
  trabajos: path.join(DATA_DIR, 'trabajos.json'),
  usuarios: path.join(DATA_DIR, 'usuarios.json'),
  business_rules: path.join(DATA_DIR, 'business-rules.json'),
  bot_prompt: path.join(DATA_DIR, 'bot_whatsapp', 'system_prompt.txt'),
  led_library: path.join(DATA_DIR, 'led_library.json'),
  terceros_manuales: path.join(DATA_DIR, 'terceros_pagos_manuales.json'),
  instagram_settings: path.join(DATA_DIR, 'instagram_settings.json'),
  calc_costos: path.join(DATA_DIR, 'calculadora_costos.json'),
  calc_precios: path.join(DATA_DIR, 'calculadora_precios.json'),
  tareas_internas: path.join(DATA_DIR, 'tareas_internas.json')
};

// Configuración de Multer para subida de imágenes
const upload = multer({
  dest: UPLOADS_TEMP_DIR,
  limits: { fileSize: 150 * 1024 * 1024 } // 150MB límite
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Desactivar CSP para permitir CDNs (Fabric.js, FontAwesome) y estilos inline
  crossOriginEmbedderPolicy: false, // Permitir recursos cruzados necesarios para las imágenes y canvas
  crossOriginResourcePolicy: false // Permitir cargar recursos locales o externos sin bloqueo
}));
app.use(cors());
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request JSON inválido' });
  }
  next(err);
});
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(path.join(BASE_PATH, 'uploads'))); // Servir archivos subidos/generados

// Middleware para loguear peticiones
app.use((req, res, next) => {
  // Ignorar peticiones a archivos estáticos para no hacer spam en la consola
  if (!req.originalUrl.match(/\.(png|jpg|jpeg|gif|css|js|ico|svg|woff2?)$/i)) {
    logger.info('Petición recibida', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    });
  }
  next();
});

// ==================== AUTH MIDDLEWARE ====================

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    logger.warn('Acceso denegado: Token no proporcionado', { ip: req.ip, url: req.originalUrl });
    return res.status(403).json({ error: 'Token requerido' });
  }
  const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;

  try {
    const decoded = jwt.verify(tokenString, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Token inválido o expirado', { token: tokenString.slice(0, 8) + '…', error: err.message, ip: req.ip });
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.rol) {
      return res.status(403).json({ error: 'Acceso denegado: Rol no especificado en el token.' });
    }
    const userRole = req.user.rol.toLowerCase();
    const lowerCaseAllowedRoles = allowedRoles.map(r => r.toLowerCase());

    // Superadmin siempre tiene acceso
    if (userRole === 'superadmin' || lowerCaseAllowedRoles.includes(userRole)) {
      next();
    } else {
      res.status(403).json({ error: 'Acceso denegado: Rol insuficiente' });
    }
  };
};

const requirePermission = (permission) => {
  // Implementación básica o bloqueo por defecto si no está implementado
  return (req, res, next) => {
    // Por ahora, permitimos paso si es superadmin, sino logueamos advertencia
    if (req.user && req.user.rol === 'superadmin') return next();
    logger.warn(`[AUTH] Permiso '${permission}' verificado pero no implementado completamente.`, { user: req.user.usuario });
    next();
  };
};
// ==================== AUTH ROUTES ====================

// Rate Limiter para el login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Limita cada IP a 10 intentos de login por ventana de tiempo
  message: { error: 'Demasiados intentos de login, por favor intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate-limit para endpoints públicos (portal web / cotizador externo / registro gremio)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas peticiones. Intente de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { usuario, password } = req.body;

    // Leer usuario desde SQLite
    let user;
    try {
      user = await db.get({ 
        sql: 'SELECT u.*, c.telefono FROM usuarios u LEFT JOIN clientes c ON u.cliente_id = c.id WHERE u.usuario = ? AND u.activo = 1', 
        params: [usuario] 
      });
    } catch (error) {
      logger.error('Error leyendo usuarios desde SQLite durante login.', { error: error.message });
      return res.status(500).json({ error: 'Error al leer usuarios' });
    }

    if (!user) {
      logger.warn('Intento de login fallido: Usuario no encontrado en SQLite', { usuario, ip: req.ip });
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      logger.warn('Intento de login fallido: Contraseña incorrecta', { usuario, ip: req.ip });
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // activo ya fue filtrado en la query SQL (activo = 1)

    const token = jwt.sign(
      // FIX: incluir 'nombre' (los endpoints de gremio filtran por user.nombre y quedaban vacíos)
      { id: user.id, usuario: user.usuario, rol: user.rol, nombre: user.nombre || '' },
      SECRET_KEY,
      { expiresIn: '3650d' }
    );

    logger.info('Login exitoso', { usuario: user.usuario, rol: user.rol });
    res.json({
      token,
      user: {
        id: user.id,
        usuario: user.usuario,
        nombre: user.nombre,
        rol: user.rol,
        telefono: user.telefono || ''
      }
    });
  } catch (error) {
    logger.error('Error inesperado en la ruta de login', { error: error.stack });
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/auth/verify', verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

app.get('/api/auth/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// ==================== USER MANAGEMENT ROUTES ====================

// GET all users
app.get('/api/users', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const users = await db.all('SELECT id, nombre, usuario, rol, activo, fecha_creacion FROM usuarios ORDER BY fecha_creacion ASC');
    res.json(users.map(u => ({ ...u, activo: u.activo === 1 })));
  } catch (error) {
    logger.error('Error al leer usuarios en /api/users', { error: error.stack });
    res.status(500).json({ error: 'Error al leer usuarios' });
  }
});

// POST create a new user
app.post('/api/users', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { nombre, usuario, password, rol, activo } = req.body;
    if (!nombre || !usuario || !password || !rol)
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    if (password.length < 4)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    if (rol === 'superadmin' && req.user.rol !== 'superadmin') {
      logger.warn('Intento no autorizado de crear superadmin', { by: req.user.usuario });
      return res.status(403).json({ error: 'No tienes permisos para crear un usuario Superadmin' });
    }

    const existing = await db.get({ sql: 'SELECT id FROM usuarios WHERE usuario = ?', params: [usuario] });
    if (existing) return res.status(409).json({ error: 'El nombre de usuario ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newId = `usr_${Date.now()}`;
    const fechaCreacion = new Date().toISOString();

    await db.run(
      'INSERT INTO usuarios (id, nombre, usuario, password, rol, activo, fecha_creacion) VALUES (?,?,?,?,?,?,?)',
      [newId, nombre, usuario, hashedPassword, rol, activo !== false ? 1 : 0, fechaCreacion]
    );
    // Backup JSON
    const allUsers = await db.all('SELECT * FROM usuarios');
    await writeJSON(FILES.usuarios, allUsers.map(u => ({ ...u, activo: u.activo === 1 })));

    res.status(201).json({ id: newId, nombre, usuario, rol, activo: activo !== false, fecha_creacion: fechaCreacion });
  } catch (error) {
    logger.error('Error al crear usuario', { error: error.stack });
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// GET a single user by ID
app.get('/api/users/:id', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const user = await db.get({ sql: 'SELECT id, nombre, usuario, rol, activo, fecha_creacion FROM usuarios WHERE id = ?', params: [req.params.id] });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ...user, activo: user.activo === 1 });
  } catch (error) {
    logger.error('Error al leer un solo usuario', { id: req.params.id, error: error.stack });
    res.status(500).json({ error: 'Error al leer usuario' });
  }
});

// PUT update a user
app.put('/api/users/:id', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rol, activo } = req.body;

    const existing = await db.get({ sql: 'SELECT * FROM usuarios WHERE id = ?', params: [id] });
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (existing.rol === 'superadmin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error: 'No tienes permiso para editar a un superadmin' });
    if (rol === 'superadmin' && req.user.rol !== 'superadmin')
      return res.status(403).json({ error: 'No puedes promover un usuario a Superadmin' });

    const fields = [];
    const values = [];
    if (nombre !== undefined) { fields.push('nombre = ?'); values.push(nombre); }
    if (rol !== undefined) { fields.push('rol = ?'); values.push(rol); }
    if (activo !== undefined) { fields.push('activo = ?'); values.push(activo ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });
    values.push(id);

    await db.run(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`, values);
    // Backup JSON
    const allUsers = await db.all('SELECT * FROM usuarios');
    await writeJSON(FILES.usuarios, allUsers.map(u => ({ ...u, activo: u.activo === 1 })));

    const updated = await db.get({ sql: 'SELECT id, nombre, usuario, rol, activo, fecha_creacion FROM usuarios WHERE id = ?', params: [id] });
    res.json({ ...updated, activo: updated.activo === 1 });
  } catch (error) {
    logger.error('Error al actualizar usuario', { error: error.stack });
    res.status(500).json({ error: 'Error interno al actualizar usuario' });
  }
});

// PUT change user password (self or admin)
app.put('/api/users/:id/password', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const isSelf = req.user.id === id;
    const isAdmin = ['admin', 'superadmin'].includes(req.user.rol?.toLowerCase());
    if (!isSelf && !isAdmin)
      return res.status(403).json({ error: 'No tienes permiso para cambiar esta contraseña' });
    if (!password)
      return res.status(400).json({ error: 'Se requiere una nueva contraseña' });
    if (password.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const existing = await db.get({ sql: 'SELECT * FROM usuarios WHERE id = ?', params: [id] });
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (existing.rol === 'superadmin' && req.user.rol !== 'superadmin' && !isSelf)
      return res.status(403).json({ error: 'No tienes permiso para cambiar la contraseña de un superadmin' });

    const hashed = await bcrypt.hash(password, 10);
    await db.run('UPDATE usuarios SET password = ? WHERE id = ?', [hashed, id]);
    // Backup JSON
    const allUsers = await db.all('SELECT * FROM usuarios');
    await writeJSON(FILES.usuarios, allUsers.map(u => ({ ...u, activo: u.activo === 1 })));
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (error) {
    logger.error('Error al cambiar contraseña', { error: error.stack });
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
});


// DELETE a user
app.delete('/api/users/:id', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === id)
      return res.status(403).json({ error: 'No puedes eliminar tu propia cuenta' });

    const userToDelete = await db.get({ sql: 'SELECT * FROM usuarios WHERE id = ?', params: [id] });
    if (!userToDelete) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (userToDelete.rol === 'superadmin')
      return res.status(403).json({ error: 'No se puede eliminar a un superadmin' });

    await db.run('DELETE FROM usuarios WHERE id = ?', [id]);
    // Backup JSON
    const allUsers = await db.all('SELECT * FROM usuarios');
    await writeJSON(FILES.usuarios, allUsers.map(u => ({ ...u, activo: u.activo === 1 })));
    res.json({ success: true });
  } catch (error) {
    logger.error('Error al eliminar usuario', { error: error.stack });
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});



// ==================== INICIALIZACIÓN ====================

async function initializeDataStructure() {
  try {
    logger.info('🚀 Iniciando servidor MR Letreros...');

    // Crear directorios
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(PUBLIC_DIR, { recursive: true });
    await fs.mkdir(path.join(DATA_DIR, 'gremio'), { recursive: true });
    await fs.mkdir(path.join(DATA_DIR, 'clientes'), { recursive: true });
    await fs.mkdir(UPLOADS_TEMP_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_OUTPUT_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_CLIENTS_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_TAREAS_DIR, { recursive: true });

    // Inicializar SQLite
    logger.info('💾 Inicializando base de datos SQLite...');
    await db.init();

    // Crear archivos iniciales si no existen
    for (const [name, filepath] of Object.entries(FILES)) {
      try {
        await fs.access(filepath);
        logger.info(`   ✅ Archivo de datos '${name}' existe.`);
      } catch {
        let initialData = [];
        if (name === 'trabajos') {
          initialData = { works: [], notifications: [] };
        } else if (name === 'business_rules') {
          initialData = { idealMargin: 35, deliveryStandardDays: 4, vipThreshold: 500000, priceStagnationDays: 30 };
        } else if (name === 'precios_finales') {
          initialData = [
            { nombre: "Cartel Completo (Lona Front + Estructura + Instalación)", precio: 95000, unidad: "m2" }
          ];
        } else if (name === 'terceros_manuales') {
          initialData = [];
        } else if (name === 'instagram_settings') {
          initialData = { pageId: '', accessToken: '' };
        }

        await fs.writeFile(filepath, JSON.stringify(initialData, null, 2));
        logger.info(`   📝 Archivo de datos '${name}' creado.`);
      }
    }

    // Migración masiva inicial de todos los JSON a SQLite
    logger.info('🔄 Iniciando migración masiva de JSON a SQLite...');
    for (const [name, filepath] of Object.entries(FILES)) {
      try {
        const key = path.relative(BASE_PATH, filepath).replace(/\\/g, '/');
        const stats = await fs.stat(filepath);
        const mtimeMs = stats.mtimeMs;

        const row = await db.get(key);
        if (!row || mtimeMs > row.updated_at) {
          const fileData = await fs.readFile(filepath, 'utf-8');
          // Validar JSON
          JSON.parse(fileData);
          await db.set(key, fileData, mtimeMs);
          if (!row) {
            logger.info(`   📥 Migrado a SQLite: ${key}`);
          } else {
            logger.info(`   🔄 Actualizado en SQLite: ${key}`);
          }
        }
      } catch (err) {
        logger.warn(`   ⚠️ No se pudo migrar automaticamente '${name}': ${err.message}`);
      }
    }
    logger.info('✅ Sincronización masiva SQLite completa.');

    logger.info('================================================');
    logger.info('✅ Estructura de datos inicializada');
    logger.info('📁 Datos: ' + DATA_DIR);
    logger.info('📁 Web: ' + PUBLIC_DIR);
    logger.info('================================================');
    logger.info('🌐 Servidor corriendo en:');
    logger.info(`   Local: http://localhost:${PORT}`);
    logger.info(`   Red: http://${getLocalIP()}:${PORT}`);
    logger.info('================================================');

  } catch (error) {
    logger.error('❌ Error fatal durante la inicialización', { error: error.stack });
  }
}

// Función para verificar si Python está disponible
async function checkPython() {
  return new Promise((resolve) => {
    logger.info('🔍 Verificando la instalación de Python...');

    const tryCommand = (cmd) => {
      // FIX: DeprecationWarning by passing a single command string with shell:true and quoting
      return new Promise(resolve => {
        const p = spawn(`"${cmd}" --version`, { shell: true });
        p.on('error', () => resolve(false));
        p.on('close', code => resolve(code === 0));
      });
    };

    (async () => {
      const uname = process.env.USERNAME || process.env.USER || '';
      const commands = [
        path.join(BASE_PATH, '.venv', 'Scripts', 'python.exe'),
        'py', 'python', 'python3',
        `C:\\Python312\\python.exe`, `C:\\Python311\\python.exe`, `C:\\Python310\\python.exe`, `C:\\Python39\\python.exe`, `C:\\Python38\\python.exe`,
        `C:\\Program Files\\Python312\\python.exe`, `C:\\Program Files\\Python311\\python.exe`, `C:\\Program Files\\Python310\\python.exe`, `C:\\Program Files\\Python39\\python.exe`, `C:\\Program Files\\Python38\\python.exe`,
        `C:\\Users\\${uname}\\AppData\\Local\\Programs\\Python\\Python312\\python.exe`, `C:\\Users\\${uname}\\AppData\\Local\\Programs\\Python\\Python311\\python.exe`, `C:\\Users\\${uname}\\AppData\\Local\\Programs\\Python\\Python310\\python.exe`, `C:\\Users\\${uname}\\AppData\\Local\\Programs\\Python\\Python39\\python.exe`, `C:\\Users\\${uname}\\AppData\\Local\\Programs\\Python\\Python38\\python.exe`,
      ];

      let fallbackPython = null;

      for (const cmd of commands) {
        logger.info(`   - Probando comando: "${cmd}"...`);
        if (await tryCommand(cmd)) {
          logger.info(`     ✔️ Comando válido. Verificando librerías...`);
          // Verificar librerías necesarias
          const checkDeps = () => new Promise(r => {
            // FIX: DeprecationWarning
            const p = spawn(`"${cmd}" -c "import vtracer; import PIL; import shapely; import svgpathtools; import numpy; import svg.path; import rembg; import cv2; import requests"`, { shell: true });
            let stderr = '';
            p.stderr.on('data', (data) => stderr += data.toString());
            p.on('close', code => {
              if (code !== 0) {
                logger.warn(`     ❌ Librerías no encontradas para "${cmd}". Error: ${stderr.trim()}`);
              }
              r(code === 0);
            });
            p.on('error', (err) => {
              logger.warn(`     ❌ Error al ejecutar chequeo de librerías para "${cmd}": ${err.message}`);
              r(false)
            });
          });

          if (await checkDeps()) {
            logger.info(`   ✅ Python encontrado con librerías: "${cmd}"`);
            pythonCmd = cmd;
            resolve(true);
            return;
          } else if (process.env.MR_SKIP_PIP_INSTALL === '1') {
            // FIX: permitir desactivar la instalación automática de dependencias al arrancar
            logger.warn(`   ⚠️  Faltan librerías para "${cmd}" pero MR_SKIP_PIP_INSTALL=1: se omite la instalación automática. Instalá manualmente con: pip install -r requirements.txt`);
          } else {
            // LIBRERÍAS NO ENCONTRADAS, INTENTAR INSTALAR
            logger.info(`   ⚠️  Faltan librerías. Intentando instalar dependencias (vtracer, pillow, shapely, svgpathtools, numpy, svg.path, rembg, opencv-python, requests)...`);
            await new Promise(r => {
              const installProcess = spawn(`"${cmd}" -m pip install vtracer pillow shapely svgpathtools numpy svg.path rembg opencv-python requests`, { shell: true });
              installProcess.stdout.on('data', data => logger.info(`[pip] ${data.toString().trim()}`));
              installProcess.stderr.on('data', data => logger.warn(`[pip] ${data.toString().trim()}`));
              installProcess.on('close', code => {
                if (code === 0) {
                  logger.info(`   ✅ Dependencias Python instaladas correctamente.`);
                } else {
                  logger.error(`   ❌ Falló la instalación de dependencias Python.`);
                }
                r(); // Resolve promise regardless of success
              });
            });

            // Volver a chequear después de instalar
            if (await checkDeps()) {
              logger.info(`   ✅ Python encontrado con librerías (después de instalar): "${cmd}"`);
              pythonCmd = cmd;
              resolve(true);
              return;
            }
          }

          if (!fallbackPython) fallbackPython = cmd;
        } else {
          logger.info(`     ❌ Comando no encontrado o inválido.`);
        }
      }

      if (fallbackPython) {
        logger.info(`   ⚠️  Python encontrado: "${fallbackPython}" (pero faltan librerías)`);
        logger.warn('⚠️  Faltan librerías Python (vtracer, pillow). Ejecuta INSTALAR_DEPENDENCIAS.bat');
        pythonCmd = fallbackPython;
        resolve(true);
        return;
      }

      logger.error('   ❌ Python no encontrado. Descargalo en https://python.org/downloads/');
      logger.error('   💡 TIP: Si ya instalaste Python, revisá "Alias de ejecución de aplicaciones" en Configuración de Windows y desactivá los de python.exe');
      logger.error('   ❌ Luego ejecuta: pip install vtracer pillow rembg opencv-python requests');
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
    const key = path.relative(BASE_PATH, filepath).replace(/\\/g, '/');

    // Obtener estadísticas del archivo en disco si existe
    let fileExists = false;
    let mtimeMs = 0;
    try {
      const stats = await fs.stat(filepath);
      fileExists = true;
      mtimeMs = stats.mtimeMs;
    } catch (e) { }

    // Buscar en SQLite
    const row = await db.get(key);

    if (row) {
      if (fileExists && mtimeMs > row.updated_at) {
        // El archivo en disco es más nuevo (ej. fue editado manualmente o por C++)
        logger.info(`🔄 Recargando ${key} desde disco a SQLite (modificación de archivo detectada)`);
        const fileData = await fs.readFile(filepath, 'utf-8');
        let parsed;
        try {
          parsed = JSON.parse(fileData);
        } catch (parseErr) {
          logger.warn(`⚠️ Error al parsear JSON de ${key} en disco: ${parseErr.message}. Usando base de datos SQLite.`);
          return JSON.parse(row.value);
        }
        await db.set(key, fileData, mtimeMs);
        return parsed;
      }
      // Devolver lo que está en la base de datos
      return JSON.parse(row.value);
    } else {
      // Si no está en la base de datos pero existe en disco, migrar a SQLite
      if (fileExists) {
        const fileData = await fs.readFile(filepath, 'utf-8');
        const parsed = JSON.parse(fileData);
        await db.set(key, fileData, mtimeMs);
        return parsed;
      }
      throw new Error(`Archivo no encontrado en base de datos ni en disco: ${filepath}`);
    }
  } catch (error) {
    logger.error(`Error leyendo ${filepath}`, { error: error.message });
    throw error;
  }
}

async function writeJSON(filepath, data) {
  try {
    const key = path.relative(BASE_PATH, filepath).replace(/\\/g, '/');
    const jsonString = JSON.stringify(data, null, 2);
    const now = Date.now();

    // Guardar en SQLite
    await db.set(key, jsonString, now);

    // Guardar en disco (backup y compatibilidad con C++/Google Sync) — escritura atómica
    // FIX: antes fs.writeFile directo; un crash a mitad corrompía el archivo JSON.
    const tmpPath = filepath + '.tmp';
    await fs.writeFile(tmpPath, jsonString);
    try {
      await fs.rename(tmpPath, filepath);
    } catch (renameErr) {
      await fs.writeFile(filepath, jsonString).catch(() => { });
      await fs.unlink(tmpPath).catch(() => { });
    }
    return true;
  } catch (error) {
    logger.error(`Error escribiendo ${filepath}`, { error: error.message });
    return false;
  }
}

async function getQuoteById(quoteId) {
  try {
    const gremioQuotes = await readJSON(FILES.gremio_data).catch(() => []);
    const clientQuotes = await readJSON(FILES.clientes_data).catch(() => []);

    let quote = null;
    if (Array.isArray(gremioQuotes)) {
      quote = gremioQuotes.find(q => String(q.id) === String(quoteId));
    } else if (gremioQuotes && typeof gremioQuotes === 'object') {
      quote = gremioQuotes[quoteId];
    }

    if (!quote) {
      if (Array.isArray(clientQuotes)) {
        quote = clientQuotes.find(q => String(q.id) === String(quoteId));
      } else if (clientQuotes && typeof clientQuotes === 'object') {
        quote = clientQuotes[quoteId];
      }
    }
    return quote;
  } catch (e) {
    logger.error('Error fetching quote by ID', { quoteId, error: e.stack });
    return null;
  }
}

function parseArgentinePrice(str) {
  if (str === null || str === undefined) return 0;
  let s = str.toString().replace(/[^\d\.,]/g, '').trim();
  if (!s) return 0;

  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',') || s.includes('.')) {
    if (/[\.,]\d{3}$/.test(s)) {
      s = s.replace(/[\.,]/g, '');
    } else {
      s = s.replace(',', '.');
    }
  }

  const val = parseFloat(s);
  return isNaN(val) ? 0 : val;
}

async function getJobProductsAndPrices(job, { skipFallbackTotal = false } = {}) {
  const items = [];

  // 1. Parsear notas de detalle o descripción (para pedidos web, Google Sync o unificados)
  let textToParse = '';
  if (job.notes && Array.isArray(job.notes) && job.notes.length > 0) {
    textToParse = job.notes.map(n => n.text || '').join('\n');
  }
  if (!textToParse && job.descripcion) {
    textToParse = job.descripcion;
  }

  if (textToParse) {
    const rawLines = textToParse.replace(/\\n/g, '\n').split(/\r?\n/);
    for (const line of rawLines) {
      let trimmed = line.trim();
      if (!trimmed || trimmed.toLowerCase().startsWith('link') || trimmed.toLowerCase().startsWith('nota') || trimmed.toLowerCase().startsWith('instrucciones')) continue;

      const cleanLine = trimmed.replace(/^(?:ITEM\s*\d+|P#\d+|PRODUCTO\s*\d+|P\d+)\s*:\s*/i, '').replace(/^Detalle:\s*/i, '');

      // Capturar formato "Nombre - $Precio" o "Nombre ($Precio)"
      const match = cleanLine.match(/^(.*?)\s*-\s*(\$?\s*[\d\.,]+)\s*$/i) || cleanLine.match(/^(.*?)\s*\((\$?\s*[\d\.,]+)\)\s*$/i);
      if (match) {
        let name = match[1].replace(/^-\s*/, '').trim();
        const price = match[2].trim().startsWith('$') ? match[2].trim() : `$${match[2].trim()}`;

        let quantity = 1;
        const qtyMatch = name.match(/(?:\s|^|\[)x\s*(\d+)(?:\s|$|\])/i);
        if (qtyMatch) {
          quantity = parseInt(qtyMatch[1]);
          name = name.replace(/(?:\s|^|\[)x\s*\d+(?:\s|$|\])/i, ' ').trim();
        }

        if (name && name.length > 2 && !name.toLowerCase().startsWith('subtotal') && !name.toLowerCase().startsWith('medidas')) {
          items.push({ name, price, quantity });
        }
      }
    }
  }

  // 2. Si tiene quoteId, consultar cotización interna
  if (job.quoteId) {
    const quote = await getQuoteById(job.quoteId);
    if (quote) {
      const categories = quote.multiCategories?.categories || [];
      const productos = quote.productos || [];

      for (const cat of categories) {
        const name = cat.name || 'Componente';
        const price = cat.totalPrice ? `$${Number(cat.totalPrice).toLocaleString('es-AR')}` : '$0';
        const quantity = cat.quantity || cat.cantidad || 1;
        items.push({ name, price, quantity });
      }

      for (const prod of productos) {
        const name = prod.name || prod.nombre || 'Producto';
        const price = (prod.total || prod.price) ? `$${Number(prod.total || prod.price).toLocaleString('es-AR')}` : '$0';
        const quantity = prod.quantity || prod.cantidad || 1;
        items.push({ name, price, quantity });
      }
    }
  }

  // 3. Fallback: descripción del trabajo si no se obtuvo detalle de items
  // skipFallbackTotal=true evita usar job.total como precio del item genérico,
  // porque en trabajos unificados job.total ya contiene la suma de todos los mergedWorks
  // y duplicaría el monto.
  if (items.length === 0 && job.descripcion) {
    const name = job.descripcion;
    const price = (!skipFallbackTotal && job.total) ? `$${Number(job.total).toLocaleString('es-AR')}` : '';

    // Extraer la cantidad de la descripción si contiene " xN"
    let quantity = 1;
    const qtyMatch = name.match(/\s+x\s*(\d+)(?:\s|$)/i);
    let cleanName = name;
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1]);
      cleanName = name.replace(/\s+x\s*\d+(?:\s|$)/i, '').trim();
    }

    items.push({ name: cleanName, price, quantity });
  }

  return items;
}

/**
 * Enriquece un mergedWork parcial buscando los datos completos del trabajo en SQLite.
 * Los mergedWorks almacenados solo tienen {id, clientName, total, descripcion},
 * pero para extraer items necesitamos quoteId, notes, productos_json, etc.
 */
async function enrichMergedWork(mw) {
  if (!mw || !mw.id) return mw;
  // Si ya tiene datos ricos (quoteId o notes), no buscar de nuevo
  if (mw.quoteId || (mw.notes && Array.isArray(mw.notes) && mw.notes.length > 0)) return mw;
  try {
    const fullWork = await db.get({ sql: 'SELECT * FROM trabajos WHERE id = ?', params: [mw.id] });
    if (fullWork) {
      const normalized = normalizarTrabajo(fullWork);
      // Preservar campos originales del mergedWork como fallback
      return { ...mw, ...normalized, id: mw.id };
    }
  } catch (e) {
    logger.warn(`⚠️ No se pudo enriquecer mergedWork ${mw.id}: ${e.message}`);
  }
  return mw;
}

function normalizarTrabajo(w) {
  if (!w) return null;
  return {
    id: w.id,
    quoteId: w.quoteId || w.quote_id,
    clientId: w.clientId || w.cliente_id,
    clientName: w.clientName || w.cliente_nombre,
    clientPhone: w.clientPhone || w.cliente_telefono,
    clientEmail: w.clientEmail || w.cliente_email,
    clientAddress: w.clientAddress || w.cliente_address,
    tipo_cliente: w.tipo_cliente,
    descripcion: w.descripcion,
    total: w.total,
    totalCost: w.totalCost !== undefined ? w.totalCost : w.total_cost,
    profit: w.profit,
    paidAmount: w.paidAmount !== undefined ? w.paidAmount : w.paid_amount,
    balance: w.balance,
    senia: w.senia,
    status: w.status,
    paymentStatus: w.paymentStatus || w.payment_status,
    priority: w.priority,
    deliveryDate: w.deliveryDate || w.delivery_date,
    deliveryStatus: w.deliveryStatus || w.delivery_status,
    actualDeliveryDate: w.actualDeliveryDate || w.actual_delivery_date,
    paidAt: w.paidAt || w.paid_at,
    createdAt: w.createdAt || w.created_at,
    missingFromSheet: Boolean(w.missingFromSheet || w.missing_from_sheet),
    is_merged: w.is_merged ? 1 : 0,
    mergedWorks: (() => {
      if (w.mergedWorks && Array.isArray(w.mergedWorks)) return w.mergedWorks;
      if (typeof w.merged_works_json === 'string') {
        try {
          return JSON.parse(w.merged_works_json);
        } catch (e) { }
      }
      if (Array.isArray(w.merged_works_json)) return w.merged_works_json;
      return [];
    })(),
    productos: (() => {
      if (w.productos && Array.isArray(w.productos)) return w.productos;
      if (typeof w.productos_json === 'string') {
        try {
          return JSON.parse(w.productos_json);
        } catch (e) { }
      }
      if (Array.isArray(w.productos_json)) return w.productos_json;
      return [];
    })(),
    costos: (() => {
      if (w.costos) return w.costos;
      if (typeof w.costos_json === 'string') {
        try {
          return JSON.parse(w.costos_json);
        } catch (e) { }
      }
      if (typeof w.costos_json === 'object') return w.costos_json;
      return { materiales: {}, terceros: {} };
    })(),
    notes: (() => {
      if (w.notes && Array.isArray(w.notes)) return w.notes;
      if (typeof w.notes_json === 'string') {
        try {
          return JSON.parse(w.notes_json);
        } catch (e) { }
      }
      if (Array.isArray(w.notes_json)) return w.notes_json;
      return [];
    })(),
    printed: w.printed === 1 || w.printed === true,
    printedItems: (() => {
      if (w.printedItems && typeof w.printedItems === 'object') return w.printedItems;
      if (typeof w.printed_items_json === 'string') {
        try { return JSON.parse(w.printed_items_json); } catch (e) { }
      }
      return {};
    })(),
    completedItems: (() => {
      if (w.completedItems && typeof w.completedItems === 'object') return w.completedItems;
      if (typeof w.completed_items_json === 'string') {
        try { return JSON.parse(w.completed_items_json); } catch (e) { }
      }
      return {};
    })(),
    billedItems: (() => {
      if (w.billedItems && typeof w.billedItems === 'object') return w.billedItems;
      if (typeof w.billed_items_json === 'string') {
        try { return JSON.parse(w.billed_items_json); } catch (e) { }
      }
      return {};
    })()
  };
}

// Envía un mensaje de WhatsApp vía el bot local (idempotente por msgId + cola pendiente).
// Timeout de 30s (el bot puede tardar hasta ~25s en la cola; 15s causaban falsos aborts
// que duplicaban mensajes vía pending_messages.json).
async function enviarWhatsAppViaBot(phone, message, contexto) {
  const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(-4);
  try {
    const botRes = await fetch('http://127.0.0.1:3001/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, message: message, msgId }),
      signal: AbortSignal.timeout(30000)
    });

    if (botRes.ok) {
      logger.info(`✅ WhatsApp (${contexto}) enviado a ${phone}`);
      return { success: true, msgId };
    }
    const errorText = await botRes.text();
    logger.error(`❌ El bot respondió con error al enviar (${contexto}) a ${phone}: ${errorText}`);
    return { success: false, error: errorText, msgId };
  } catch (botErr) {
    logger.error(`❌ Error de conexión con el bot al enviar (${contexto}) a ${phone}: ${botErr.message}`);
    // GUARDAR EN COLA PENDIENTE (con msgId para dedupe al reconectar)
    try {
      const pendingFile = path.join(DATA_DIR, 'pending_messages.json');
      let pending = [];
      try {
        pending = JSON.parse(await fs.readFile(pendingFile, 'utf-8'));
      } catch (e) { }
      pending.push({ phone: phone, message: message, msgId, date: new Date().toISOString() });
      await fs.writeFile(pendingFile, JSON.stringify(pending, null, 2));
      logger.info(`📥 ${contexto} guardado en cola pendiente para ${phone}`);
    } catch (queueErr) {
      logger.error(`❌ Error al guardar en cola pendiente: ${queueErr.message}`);
    }
    return { success: false, error: botErr.message, queued: true, msgId };
  }
}

async function enviarNotificacionTrabajoListo(trabajo) {
  const job = normalizarTrabajo(trabajo);
  if (!job) {
    return { success: false, error: 'Trabajo no válido.' };
  }

  let phone = job.clientPhone || job.whatsapp || '';
  if (!phone) {
    logger.warn(`⚠️ Trabajo ${job.id} no tiene teléfono registrado (clientPhone/whatsapp)`);
    return { success: false, error: 'El trabajo no tiene un teléfono registrado.' };
  }

  // Normalización robusta para números de Argentina (ej: 0342 154050011 -> 5493424050011)
  let cleanPhone = phone.toString().replace(/\D/g, '');

  // Quitar prefijo de país 54/549 si ya lo tiene para normalizar el resto
  let has54 = false;
  if (cleanPhone.startsWith('54')) {
    cleanPhone = cleanPhone.substring(2);
    has54 = true;
  }
  if (has54 && cleanPhone.startsWith('9')) {
    cleanPhone = cleanPhone.substring(1);
  }

  // Quitar el 0 inicial del código de área
  if (cleanPhone.startsWith('0')) {
    cleanPhone = cleanPhone.substring(1);
  }

  // Quitar el 15 (prefijo móvil de Argentina) si está presente
  if (cleanPhone.length >= 11) {
    if (cleanPhone.substring(2, 4) === '15') {
      cleanPhone = cleanPhone.substring(0, 2) + cleanPhone.substring(4);
    } else if (cleanPhone.substring(3, 5) === '15') {
      cleanPhone = cleanPhone.substring(0, 3) + cleanPhone.substring(5);
    } else if (cleanPhone.substring(4, 6) === '15') {
      cleanPhone = cleanPhone.substring(0, 4) + cleanPhone.substring(6);
    }
  } else if (cleanPhone.length === 11 && cleanPhone.startsWith('15')) {
    cleanPhone = cleanPhone.substring(2);
  }

  // Normalizar a formato internacional 549 + número
  phone = '549' + cleanPhone;

  let mensaje = '';
  try {
    const clientName = job.clientName || job.gremio || 'Cliente';

    // Obtener todos los productos y precios del trabajo principal y unificados
    const isUnified = job.mergedWorks && Array.isArray(job.mergedWorks) && job.mergedWorks.length > 0;
    let allItems = [];
    // Para trabajos unificados, skipFallbackTotal=true evita que el fallback
    // use job.total (ya unificado) como precio de un item genérico, duplicando el monto.
    const mainItems = await getJobProductsAndPrices(job, { skipFallbackTotal: isUnified });
    allItems.push(...mainItems);

    if (isUnified) {
      for (const mw of job.mergedWorks) {
        const enriched = await enrichMergedWork(mw);
        const mwItems = await getJobProductsAndPrices(enriched);
        allItems.push(...mwItems);
      }
    }

    let itemsDetailText = '';
    let calculatedTotal = 0;

    if (allItems.length > 0) {
      itemsDetailText = `📦 *DETALLES DEL PEDIDO:*\n`;
      allItems.forEach(item => {
        const qty = item.quantity || 1;
        const priceLabel = item.price || '';
        if (item.name) {
          itemsDetailText += `👉 *CANTIDAD: ${qty}*  ➔  *${item.name.toUpperCase()}*${priceLabel ? `  _(${priceLabel})_` : ''}\n`;
        }
        const rawPriceNum = parseArgentinePrice(item.price);
        if (rawPriceNum > 0) {
          calculatedTotal += rawPriceNum;
        }
      });
      itemsDetailText += `\n`;
    }

    // Para trabajos unificados, job.total ya contiene la suma correcta del merge.
    // calculatedTotal puede estar inflado (fallback) o parcial (merged sin datos ricos).
    const finalTotalNum = isUnified
      ? Number(job.total || 0)
      : (calculatedTotal > 0 ? Number(calculatedTotal.toFixed(2)) : Number(job.total || 0));
    const total = finalTotalNum ? `$${Number(finalTotalNum).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '';
    const totalLabel = isUnified ? '💰 *Total unificado:*' : '💰 *Total:*';

    mensaje = `*MR Letreros - ¡Tu pedido está listo!* ✅\n\n` +
      `Hola *${clientName}*, te informamos que tu trabajo ya está *terminado y listo para retirar*.\n\n` +
      `${itemsDetailText}` +
      `${total ? `${totalLabel} ${total}\n` : ''}` +
      `📍 *Retiro:* En nuestro taller, en horario de atención.\n\n` +
      `Si necesitás coordinar el envío o tenés alguna consulta, respondé este mensaje.\n\n` +
      `¡Gracias por confiar en nosotros! 🙌`;

    logger.info(`📲 Intentando enviar WhatsApp de retiro a ${phone}...`);
    return enviarWhatsAppViaBot(phone, mensaje, 'notificación de retiro (trabajo listo)');
  } catch (err) {
    logger.error(`❌ Error construyendo notificación de retiro: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function enviarNotificacionCancelacion(trabajo) {
  const job = normalizarTrabajo(trabajo);
  if (!job) {
    return { success: false, error: 'Trabajo no válido.' };
  }

  let phone = job.clientPhone || job.whatsapp || '';
  if (!phone) {
    logger.warn(`⚠️ Trabajo ${job.id} no tiene teléfono registrado para notificar cancelación`);
    return { success: false, error: 'El trabajo no tiene un teléfono registrado.' };
  }

  // Normalización robusta para números de Argentina
  let cleanPhone = phone.toString().replace(/\D/g, '');
  let has54 = false;
  if (cleanPhone.startsWith('54')) { cleanPhone = cleanPhone.substring(2); has54 = true; }
  if (has54 && cleanPhone.startsWith('9')) { cleanPhone = cleanPhone.substring(1); }
  if (cleanPhone.startsWith('0')) { cleanPhone = cleanPhone.substring(1); }
  if (cleanPhone.length >= 11) {
    if (cleanPhone.substring(2, 4) === '15') cleanPhone = cleanPhone.substring(0, 2) + cleanPhone.substring(4);
    else if (cleanPhone.substring(3, 5) === '15') cleanPhone = cleanPhone.substring(0, 3) + cleanPhone.substring(5);
    else if (cleanPhone.substring(4, 6) === '15') cleanPhone = cleanPhone.substring(0, 4) + cleanPhone.substring(6);
  } else if (cleanPhone.length === 11 && cleanPhone.startsWith('15')) {
    cleanPhone = cleanPhone.substring(2);
  }
  phone = '549' + cleanPhone;

  try {
    const clientName = job.clientName || job.gremio || 'Cliente';
    const total = job.total ? `$${Number(job.total).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '';

    const mensaje = `*MR Letreros - Pedido Cancelado* ❌\n\n` +
      `Hola *${clientName}*, te informamos que tu pedido ha sido *cancelado*.\n\n` +
      `${total ? `💰 *Total del pedido:* ${total}\n` : ''}` +
      `Si tenés alguna consulta o creés que esto fue un error, no dudes en respondernos.\n\n` +
      `Lamentamos los inconvenientes. ¡Esperamos verte pronto! 🙌`;

    logger.info(`📲 Enviando notificación de cancelación a ${phone}...`);
    return enviarWhatsAppViaBot(phone, mensaje, 'notificación de cancelación de pedido');
  } catch (err) {
    logger.error(`❌ Error construyendo notificación de cancelación: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function enviarNotificacionConfirmacion(trabajo) {
  const job = normalizarTrabajo(trabajo);
  if (!job) {
    return { success: false, error: 'Trabajo no válido.' };
  }

  let phone = job.clientPhone || job.whatsapp || '';
  if (!phone) {
    logger.warn(`⚠️ Trabajo ${job.id} no tiene teléfono registrado (clientPhone/whatsapp)`);
    return { success: false, error: 'El trabajo no tiene un teléfono registrado.' };
  }

  // Normalización robusta para números de Argentina (ej: 0342 154050011 -> 5493424050011)
  let cleanPhone = phone.toString().replace(/\D/g, '');

  // Quitar prefijo de país 54/549 si ya lo tiene para normalizar el resto
  let has54 = false;
  if (cleanPhone.startsWith('54')) {
    cleanPhone = cleanPhone.substring(2);
    has54 = true;
  }
  if (has54 && cleanPhone.startsWith('9')) {
    cleanPhone = cleanPhone.substring(1);
  }

  // Quitar el 0 inicial del código de área
  if (cleanPhone.startsWith('0')) {
    cleanPhone = cleanPhone.substring(1);
  }

  // Quitar el 15 (prefijo móvil de Argentina) si está presente
  if (cleanPhone.length >= 11) {
    if (cleanPhone.substring(2, 4) === '15') {
      cleanPhone = cleanPhone.substring(0, 2) + cleanPhone.substring(4);
    } else if (cleanPhone.substring(3, 5) === '15') {
      cleanPhone = cleanPhone.substring(0, 3) + cleanPhone.substring(5);
    } else if (cleanPhone.substring(4, 6) === '15') {
      cleanPhone = cleanPhone.substring(0, 4) + cleanPhone.substring(6);
    }
  } else if (cleanPhone.length === 11 && cleanPhone.startsWith('15')) {
    cleanPhone = cleanPhone.substring(2);
  }

  // Normalizar a formato internacional 549 + número
  phone = '549' + cleanPhone;

  let mensaje = '';
  try {
    const clientName = job.clientName || job.gremio || 'Cliente';

    // Obtener todos los productos y precios
    const isUnified = job.mergedWorks && Array.isArray(job.mergedWorks) && job.mergedWorks.length > 0;
    let allItems = [];
    const mainItems = await getJobProductsAndPrices(job, { skipFallbackTotal: isUnified });
    allItems.push(...mainItems);

    if (isUnified) {
      for (const mw of job.mergedWorks) {
        const enriched = await enrichMergedWork(mw);
        const mwItems = await getJobProductsAndPrices(enriched);
        allItems.push(...mwItems);
      }
    }

    let itemsDetailText = '';
    let calculatedTotal = 0;

    if (allItems.length > 0) {
      itemsDetailText = `\n\n*Detalles del pedido:*\n`;
      allItems.forEach(item => {
        const qty = item.quantity || 1;
        const priceLabel = item.price || '';
        if (item.name) {
          itemsDetailText += `👉 *CANTIDAD: ${qty}*  ➔  *${item.name.toUpperCase()}*${priceLabel ? `  _(${priceLabel})_` : ''}\n`;
        }
        const rawPriceNum = parseArgentinePrice(item.price);
        if (rawPriceNum > 0) {
          calculatedTotal += rawPriceNum;
        }
      });
    } else if (job.descripcion) {
      itemsDetailText = `\n\n*Detalle del pedido:*\n${job.descripcion}`;
    }

    // Para trabajos unificados, job.total ya contiene la suma correcta del merge.
    const finalTotalNum = isUnified
      ? Number(job.total || 0)
      : (calculatedTotal > 0 ? Number(calculatedTotal.toFixed(2)) : Number(job.total || 0));
    const total = finalTotalNum ? `$${Number(finalTotalNum).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '';

    mensaje = `*MR Letreros - Confirmación de Recepción* ✅\n\n` +
      `Hola *${clientName}*, confirmamos que hemos recibido tu pedido correctamente.${itemsDetailText}\n\n` +
      `${total ? `💰 *Total Estimado:* ${total}\n` : ''}` +
      `📂 *Estado:* En cola de producción\n\n` +
      `Ya lo hemos ingresado en nuestro sistema administrativo. Ante cualquier duda, podés consultarnos por este medio.\n\n` +
      `¡Muchas gracias por confiar en nosotros!`;

    logger.info(`📲 Intentando enviar WhatsApp de confirmación a ${phone}...`);
    return enviarWhatsAppViaBot(phone, mensaje, 'confirmación de recepción');
  } catch (err) {
    logger.error(`❌ Error construyendo confirmación de recepción: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function enviarNotificacionRecordatorioPago(trabajo) {
  const job = normalizarTrabajo(trabajo);
  if (!job) return { success: false, error: 'Trabajo no válido.' };

  let phone = job.clientPhone || job.whatsapp || '';
  if (!phone) return { success: false, error: 'El trabajo no tiene un teléfono registrado.' };

  let cleanPhone = phone.toString().replace(/\D/g, '');
  let has54 = false;
  if (cleanPhone.startsWith('54')) {
    cleanPhone = cleanPhone.substring(2);
    has54 = true;
  }
  if (has54 && cleanPhone.startsWith('9')) {
    cleanPhone = cleanPhone.substring(1);
  }
  if (cleanPhone.startsWith('0')) {
    cleanPhone = cleanPhone.substring(1);
  }
  phone = '549' + cleanPhone;

  const clientName = job.clientName || job.gremio || 'Cliente';
  const balance = job.balance ? `$${Number(job.balance).toLocaleString('es-AR')}` : '';
  const total = job.total ? `$${Number(job.total).toLocaleString('es-AR')}` : '';

  const mensaje = `*MR Letreros - Recordatorio de Saldo Pendiente* 💳\n\n` +
    `Hola *${clientName}*, te contactamos por tu trabajo entregado en MR Letreros.\n\n` +
    `📌 *Detalle de cuenta:*\n` +
    `• Total del trabajo: *${total}*\n` +
    `• Saldo pendiente: *${balance}*\n\n` +
    `Por favor, cuando te sea posible, envíanos el comprobante de pago o comunicate para coordinarlo.\n\n` +
    `¡Muchas gracias por tu atención! 🙌`;

  try {
    return await enviarWhatsAppViaBot(phone, mensaje, 'recordatorio de pago');
  } catch (err) {
    logger.error(`❌ Error enviando recordatorio de pago: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ==================== ENDPOINTS GREMIO CLIENTES ====================


// Devuelve los precios y catálogo por categoría y producto
app.get('/api/gremio/precios', verifyToken, async (req, res) => {
  try {
    const data = await readJSON(FILES.precios);
    res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    logger.error('Error en GET /api/gremio/precios', { error: error.message });
    res.status(500).json({ error: 'Error al leer los precios de gremio' });
  }
});

// Devuelve SOLO los clientes que están en la hoja GREMIO de la planilla de Google Sheets
app.get('/api/gremio/hoja-clientes', verifyToken, async (req, res) => {
  try {
    const hojaFile = path.join(DATA_DIR, 'gremio_hoja_clientes.json');
    const data = await readJSON(hojaFile);
    res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    logger.warn('gremio_hoja_clientes.json no existe aún, devolviendo vacío');
    res.json([]);
  }
});

app.get('/api/gremio/clientes', verifyToken, async (req, res) => {
  try {
    const data = await readJSON(FILES.gremio_clientes);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/gremio/clientes', { error: error.message });
    res.status(500).json({ error: 'Error al leer los datos de clientes' });
  }
});

app.post('/api/gremio/clientes', verifyToken, async (req, res) => {
  try {
    const clientes = await readJSON(FILES.gremio_clientes);

    // ✅ FIX: Validar duplicados antes de agregar
    const nuevo = req.body;
    const existe = clientes.find(c =>
      (c.nombre || c.name || '').toLowerCase().trim() === (nuevo.nombre || nuevo.name || '').toLowerCase().trim() &&
      (c.telefono || '').replace(/\D/g, '') === (nuevo.telefono || '').replace(/\D/g, '')
    );
    if (existe) return res.status(409).json({ error: 'El cliente ya existe.' });

    clientes.push(req.body);
    const success = await writeJSON(FILES.gremio_clientes, clientes);
    res.json({ success, data: req.body });
  } catch (error) {
    logger.error('Error en POST /api/gremio/clientes', { error: error.message });
    res.status(500).json({ error: 'Error al guardar el cliente' });
  }
});

app.put('/api/gremio/clientes/:id', verifyToken, async (req, res) => {
  try {
    const clientes = await readJSON(FILES.gremio_clientes);
    const index = clientes.findIndex(c => c.id === req.params.id);
    if (index !== -1) {
      clientes[index] = { ...clientes[index], ...req.body };
      await writeJSON(FILES.gremio_clientes, clientes);
      res.json({ success: true, data: clientes[index] });
    } else {
      res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }
  } catch (error) {
    logger.error('Error en PUT /api/gremio/clientes', { error: error.message });
    res.status(500).json({ error: 'Error al actualizar el cliente' });
  }
});

app.delete('/api/gremio/clientes/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const clientes = await readJSON(FILES.gremio_clientes);
    const filtered = clientes.filter(c => c.id !== req.params.id);
    await writeJSON(FILES.gremio_clientes, filtered);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error en DELETE /api/gremio/clientes', { error: error.message });
    res.status(500).json({ error: 'Error al eliminar el cliente' });
  }
});

// ==================== ENDPOINTS GREMIO COTIZACIONES ====================

app.get('/api/gremio/data', verifyToken, async (req, res) => {
  try {
    const data = await readJSON(FILES.gremio_data);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/gremio/data', { error: error.message });
    res.status(500).json({ error: 'Error al leer cotizaciones de gremio' });
  }
});

app.post('/api/gremio/data', verifyToken, async (req, res) => {
  const filePath = FILES.gremio_data;
  try {
    const incomingData = req.body;
    if (Array.isArray(incomingData)) {
      // Si es un array, sobrescribir la lista completa
      await writeJSON(filePath, incomingData);
      logger.info(`✅ Lista de cotizaciones de gremio guardada: ${incomingData.length} registros`);
      return res.json({ success: true });
    } else {
      // Si es un objeto, añadirlo a la lista existente
      const currentData = await readJSON(filePath);
      currentData.push(incomingData);
      await writeJSON(filePath, currentData);
      res.json({ success: true, data: incomingData });
    }
  } catch (error) {
    logger.error('Error en POST /api/gremio/data', { error: error.message });
    res.status(500).json({ error: 'Error al guardar cotización de gremio' });
  }
});

// ==================== ENDPOINTS CLIENTES COTIZACIONES ====================

app.get('/api/clientes/data', verifyToken, async (req, res) => {
  try {
    const data = await readJSON(FILES.clientes_data);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/clientes/data', { error: error.message });
    res.status(500).json({ error: 'Error al leer cotizaciones de clientes' });
  }
});

app.post('/api/clientes/data', verifyToken, async (req, res) => {
  const filePath = FILES.clientes_data;
  try {
    const incomingData = req.body;
    if (Array.isArray(incomingData)) {
      // Si es un array, sobrescribir la lista completa
      await writeJSON(filePath, incomingData);
      logger.info(`✅ Lista de cotizaciones de clientes guardada: ${incomingData.length} registros`);
      return res.json({ success: true });
    } else {
      // Si es un objeto, añadirlo a la lista existente
      const currentData = await readJSON(filePath);
      currentData.push(incomingData);
      await writeJSON(filePath, currentData);
      res.json({ success: true, data: incomingData });
    }
  } catch (error) {
    logger.error('Error en POST /api/clientes/data', { error: error.message });
    res.status(500).json({ error: 'Error al guardar cotización de cliente' });
  }
});


// ==================== ENDPOINTS PRECIOS ====================

// Se hace público para que el bot de WhatsApp pueda consultarlo sin token.
// La edición (POST) sigue protegida.
app.get('/api/precios', async (req, res) => {
  try {
    const data = await readJSON(FILES.precios);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/precios', { error: error.message });
    res.status(500).json({ error: 'Error al leer la lista de precios' });
  }
});

// Redirigir aliases de frontend a los archivos correspondientes
app.get('/api/precios/gremio', async (req, res) => {
  try {
    const data = await readJSON(FILES.precios);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al leer la lista de precios' });
  }
});

app.get('/api/precios/cliente', async (req, res) => {
  try {
    const data = await readJSON(FILES.precios_finales);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al leer precios finales' });
  }
});

app.post('/api/precios', verifyToken, requireRole(['admin', 'vendedor', 'superadmin']), async (req, res) => {
  try {
    const success = await writeJSON(FILES.precios, req.body);
    res.json({ success });
  } catch (error) {
    logger.error('Error en POST /api/precios', { error: error.message });
    res.status(500).json({ error: 'Error al guardar la lista de precios' });
  }
});

// ==================== ENDPOINTS COSTOS ====================

app.get('/api/costos', verifyToken, requireRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const data = await readJSON(FILES.costos);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/costos', { error: error.message });
    res.status(500).json({ error: 'Error al leer la lista de costos' });
  }
});

app.post('/api/costos', verifyToken, requireRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const success = await writeJSON(FILES.costos, req.body);
    res.json({ success });
  } catch (error) {
    logger.error('Error en POST /api/costos', { error: error.message });
    res.status(500).json({ error: 'Error al guardar la lista de costos' });
  }
});

// ==================== ENDPOINTS GASTOS ====================

app.get('/api/gastos', verifyToken, requireRole(['admin', 'superadmin', 'vendedor']), async (req, res) => {
  try {
    let data = await readJSON(FILES.gastos);

    // ✅ SEGURIDAD: Vendedores solo ven sus propios gastos
    if (req.user.rol === 'vendedor') {
      data = data.filter(g => g.usuario === req.user.usuario);
    }

    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/gastos', { error: error.message });
    res.status(500).json({ error: 'Error al leer la lista de gastos' });
  }
});

app.post('/api/gastos', verifyToken, requireRole(['admin', 'superadmin', 'vendedor']), async (req, res) => {
  try {
    if (req.user.rol === 'vendedor') {
      // ✅ SEGURIDAD: Vendedores solo pueden sobreescribir sus propios registros.
      // Combinamos lo que envían con lo que ya existe de otros usuarios para no borrar nada ajeno.
      const allGastos = await readJSON(FILES.gastos);
      const otherGastos = allGastos.filter(g => g.usuario !== req.user.usuario);

      // Aseguramos que cada registro que envían tenga su usuario asignado correctamente
      const userGastos = req.body.map(g => ({ ...g, usuario: req.user.usuario }));

      const finalGastos = [...otherGastos, ...userGastos];
      const success = await writeJSON(FILES.gastos, finalGastos);
      res.json({ success });
    } else {
      const success = await writeJSON(FILES.gastos, req.body);
      res.json({ success });
    }
  } catch (error) {
    logger.error('Error en POST /api/gastos', { error: error.message });
    res.status(500).json({ error: 'Error al guardar la lista de gastos' });
  }
});

// ==================== ENDPOINTS PRECIOS FINALES ====================

app.get('/api/precios-finales', verifyToken, async (req, res) => {
  try {
    // Crear si no existe (lazy init)
    try { await fs.access(FILES.precios_finales); }
    catch { await writeJSON(FILES.precios_finales, []); }

    const data = await readJSON(FILES.precios_finales);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/precios-finales', { error: error.message });
    res.status(500).json({ error: 'Error al leer precios finales' });
  }
});

app.post('/api/precios/cliente', verifyToken, requireRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const success = await writeJSON(FILES.precios_finales, req.body);
    res.json({ success });
  } catch (error) {
    logger.error('Error en POST /api/precios-finales', { error: error.message });
    res.status(500).json({ error: 'Error al guardar precios finales' });
  }
});

// ==================== ENDPOINTS MATERIALES ====================

app.get('/api/materiales', verifyToken, async (req, res) => {
  try {
    const data = await readJSON(FILES.materiales);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/materiales', { error: error.message });
    res.status(500).json({ error: 'Error al leer materiales' });
  }
});

app.post('/api/materiales', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    logger.info('[MATERIALES-POST] Recibiendo POST', {
      dataType: Array.isArray(req.body) ? 'Array' : 'Object',
      count: Array.isArray(req.body) ? req.body.length : 1
    });

    // Si es un array, guardar directamente
    if (Array.isArray(req.body)) {
      const success = await writeJSON(FILES.materiales, req.body);
      console.log('[MATERIALES-POST] ✅ Guardado exitoso:', success);
      res.json({ success });
    } else {
      // Si es un objeto único, agregarlo al array
      logger.info('[MATERIALES-POST] Agregando objeto único al array...');
      let materiales = [];
      try {
        const data = await readJSON(FILES.materiales);
        if (Array.isArray(data)) {
          materiales = data;
        }
      } catch (readError) {
        // Si el archivo no existe, está vacío o corrupto, empezamos con un array vacío.
        logger.warn(`No se pudo leer o parsear ${FILES.materiales}, se creará una lista nueva.`, { error: readError.message });
      }
      materiales.push(req.body);
      const success = await writeJSON(FILES.materiales, materiales);
      logger.info('[MATERIALES-POST] Objeto único agregado y guardado.', { success, newCount: materiales.length });
      res.json({ success });
    }
  } catch (error) {
    logger.error('[MATERIALES-POST] Error en POST /api/materiales', { error: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ENDPOINTS CATEGORÍAS ====================

app.get('/api/categorias', verifyToken, async (req, res) => {
  const data = await readJSON(FILES.categorias);
  logger.info('[CATEGORÍAS API] GET /api/categorias', { count: data.length });
  res.json(Array.isArray(data) ? data : []);
});

app.post('/api/categorias', verifyToken, async (req, res) => {
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
    logger.error('Error en POST /api/categorias', { error: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/categorias/:categoria', verifyToken, async (req, res) => {
  try {
    let categorias = await readJSON(FILES.categorias);
    if (!Array.isArray(categorias)) {
      categorias = [];
    }

    categorias = categorias.filter(c => c !== decodeURIComponent(req.params.categoria));
    const success = await writeJSON(FILES.categorias, categorias);
    res.json({ success });
  } catch (error) {
    logger.error('Error en DELETE /api/categorias', { error: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ENDPOINTS TERCEROS ====================
// (Los duplicados de GET/POST /api/materiales fueron eliminados: Express usa el primero registrado)


app.get('/api/terceros', verifyToken, async (req, res) => {
  try {
    const data = await readJSON(FILES.terceros);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/terceros', { error: error.message });
    res.status(500).json({ error: 'Error al leer terceros' });
  }
});

app.post('/api/terceros', verifyToken, async (req, res) => {
  try {
    const success = await writeJSON(FILES.terceros, req.body);
    res.json({ success });
  } catch (error) {
    logger.error('Error en POST /api/terceros', { error: error.message });
    res.status(500).json({ error: 'Error al guardar terceros' });
  }
});

app.get('/api/terceros/manuales', verifyToken, async (req, res) => {
  try {
    const data = await readJSON(FILES.terceros_manuales);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/terceros/manuales', { error: error.message });
    res.status(500).json({ error: 'Error al leer pagos manuales' });
  }
});

app.post('/api/terceros/manuales', verifyToken, async (req, res) => {
  try {
    const success = await writeJSON(FILES.terceros_manuales, req.body);
    res.json({ success });
  } catch (error) {
    logger.error('Error en POST /api/terceros/manuales', { error: error.message });
    res.status(500).json({ error: 'Error al guardar pagos manuales' });
  }
});

// ==================== ENDPOINTS BOT PROMPT ====================

app.get('/api/bot/prompts-list', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const dir = path.dirname(FILES.bot_prompt);
    try { await fs.access(dir); } catch { return res.json({ files: [] }); }

    const files = await fs.readdir(dir);
    // Filtrar solo archivos .txt
    const txtFiles = files.filter(f => f.endsWith('.txt'));
    res.json({ files: txtFiles });
  } catch (error) {
    logger.error('Error listando prompts', { error: error.message });
    res.status(500).json({ error: 'Error interno al listar prompts' });
  }
});

app.get('/api/bot/prompt', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const filename = req.query.filename || 'system_prompt.txt';
    // Seguridad básica para evitar salir del directorio
    const safeFilename = path.normalize(filename).replace(/^(\.\.[\/\\])+/, '');
    const promptsDir = path.dirname(FILES.bot_prompt);
    const targetPath = path.join(promptsDir, safeFilename);

    // Verificación de Path Traversal
    if (!targetPath.startsWith(promptsDir)) {
      return res.status(400).json({ error: 'Intento de acceso a ruta inválida.' });
    }

    try {
      await fs.access(targetPath);
    } catch {
      return res.json({ prompt: '' }); // Archivo no existe aún
    }
    const prompt = await fs.readFile(targetPath, 'utf-8');
    res.json({ prompt });
  } catch (error) {
    logger.error('Error leyendo prompt del bot', { error: error.message });
    res.status(500).json({ error: 'Error interno al leer el prompt' });
  }
});

app.post('/api/bot/prompt', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { prompt, filename } = req.body;
    if (typeof prompt !== 'string') return res.status(400).json({ error: 'Formato inválido' });

    const targetFilename = filename ? path.normalize(filename).replace(/^(\.\.[\/\\])+/, '') : 'system_prompt.txt';
    const promptsDir = path.dirname(FILES.bot_prompt);
    const targetPath = path.join(promptsDir, targetFilename);

    // Verificación de Path Traversal
    if (!targetPath.startsWith(promptsDir)) {
      return res.status(400).json({ error: 'Intento de escritura en ruta inválida.' });
    }

    const dir = path.dirname(FILES.bot_prompt);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(targetPath, prompt, 'utf-8');
    logger.info('Prompt del bot actualizado por usuario', { user: req.user.usuario, file: targetFilename });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error guardando prompt del bot', { error: error.message });
    res.status(500).json({ error: 'Error interno al guardar el prompt' });
  }
});

app.get('/api/calculadora/costos', async (req, res) => {
  try {
    const data = await readJSON(FILES.calc_costos);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/calculadora/costos', { error: error.message });
    res.status(500).json({ error: 'Error al leer costos de calculadora' });
  }
});

app.post('/api/calculadora/costos', verifyToken, async (req, res) => {
  try {
    const success = await writeJSON(FILES.calc_costos, req.body);
    res.json({ success });
  } catch (error) {
    logger.error('Error en POST /api/calculadora/costos', { error: error.message });
    res.status(500).json({ error: 'Error al guardar costos de calculadora' });
  }
});

app.get('/api/calculadora/precios', async (req, res) => {
  try {
    const data = await readJSON(FILES.calc_precios);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/calculadora/precios', { error: error.message });
    res.status(500).json({ error: 'Error al leer precios de calculadora' });
  }
});

app.post('/api/calculadora/precios', verifyToken, async (req, res) => {
  try {
    const success = await writeJSON(FILES.calc_precios, req.body);
    res.json({ success });
  } catch (error) {
    logger.error('Error en POST /api/calculadora/precios', { error: error.message });
    res.status(500).json({ error: 'Error al guardar precios de calculadora' });
  }
});

// ==================== ENDPOINT REGLAS DE NEGOCIO ====================


app.get('/api/business-rules', verifyToken, async (req, res) => {
  try {
    const data = await readJSON(FILES.business_rules);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/business-rules', { error: error.message });
    res.status(500).json({ error: 'Error al leer las reglas de negocio' });
  }
});

// ==================== ENDPOINT ESTADÍSTICAS ====================

app.get('/api/statistics/today', verifyToken, async (req, res) => {
  try {
    const gremioData = await readJSON(FILES.gremio_data);
    const clientesData = await readJSON(FILES.clientes_data);

    const today = new Date().toISOString().split('T')[0];

    const gremioToday = gremioData.filter(item => {
      const date = item.date || item.fecha;
      return typeof date === 'string' && date.startsWith(today) && (item.approved === true || item.estado === 'aprobada');
    });

    const clientesToday = clientesData.filter(item => {
      const date = item.date || item.fecha;
      return typeof date === 'string' && date.startsWith(today) && (item.approved === true || item.estado === 'aprobada');
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
    logger.error('Error en GET /api/statistics/today', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rendimientos', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    const gremioData = await readJSON(FILES.gremio_data);
    const clientesData = await readJSON(FILES.clientes_data);
    const gastos = await readJSON(FILES.gastos);
    const trabajosData = await readJSON(FILES.trabajos);

    // 1. Calcular desglose por categorías (Ventas) y Lista Detallada
    const breakdown = {};
    const ingresosList = [];

    const processQuotes = (quotes) => {
      quotes.forEach(q => {
        const isApproved = q.approved === true || q.estado === 'aprobada';
        if (!isApproved) return;

        const ventaTotal = parseFloat(q.total || q.totalCliente || q.subtotal || 0);
        const costoTotal = parseFloat(q.costoTotal || 0);

        // Agregar a la lista detallada
        if (ventaTotal > 0) {
          ingresosList.push({
            id: q.id,
            fecha: q.approvedAt || q.fechaAprobacion || q.fecha,
            descripcion: `Venta - #${String(q.id).slice(-6)} (${q.cliente?.nombre || 'S/N'})`,
            monto: ventaTotal,
            tipo: 'automatico'
          });
        }

        const items = q.items || q.productos || [];
        if (items.length > 0) {
          items.forEach(item => {
            const cat = item.category || item.categoria || 'Sin Categoría';
            const venta = parseFloat(item.total || item.price || 0);
            const costo = parseFloat(item.costoTotal || item.totalCosto || 0);

            if (!breakdown[cat]) breakdown[cat] = { categoria: cat, ingresos: 0, costos: 0, cantidad: 0 };
            breakdown[cat].ingresos += venta;
            breakdown[cat].costos += costo;
            breakdown[cat].cantidad += (parseFloat(item.quantity || item.cantidad) || 1);
          });
        } else {
          const cat = 'General';
          if (!breakdown[cat]) breakdown[cat] = { categoria: cat, ingresos: 0, costos: 0, cantidad: 1 };
          breakdown[cat].ingresos += ventaTotal;
          breakdown[cat].costos += costoTotal;
        }
      });
    };

    processQuotes(gremioData);
    processQuotes(clientesData);

    // Trabajos directos
    if (trabajosData && trabajosData.works) {
      trabajosData.works.forEach(w => {
        if (!w.quoteId && (w.status === 'completed' || w.status === 'in_progress' || (w.paidAmount > 0)) && w.total > 0) {
          const cat = 'Trabajos Directos';
          const venta = parseFloat(w.total || 0);
          const costo = parseFloat(w.totalCost || 0);

          if (!breakdown[cat]) breakdown[cat] = { categoria: cat, ingresos: 0, costos: 0, cantidad: 0 };
          breakdown[cat].ingresos += venta;
          breakdown[cat].costos += costo;
          breakdown[cat].cantidad += 1;

          ingresosList.push({
            id: w.id,
            fecha: w.createdAt || new Date().toISOString(),
            descripcion: `Trabajo Directo: ${w.descripcion || w.clientName}`,
            monto: venta,
            tipo: 'automatico'
          });
        }
      });
    }

    // Ingresos manuales (Deduplicar si traen prefijo de automatización)
    const manualIncomes = gastos.filter(g =>
      g.tipo === 'ingreso' &&
      !String(g.id || '').startsWith('ingreso_coti_') // Evitar doble conteo de lo que ya procesamos arriba
    );

    const totalManual = manualIncomes.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);

    manualIncomes.forEach(g => {
      ingresosList.push({
        id: g.id,
        fecha: g.fecha,
        descripcion: g.descripcion,
        monto: parseFloat(g.monto),
        tipo: 'manual'
      });
    });

    const categorias = Object.values(breakdown).map(c => ({
      ...c,
      ganancia: c.ingresos - c.costos,
      margen: c.ingresos > 0 ? ((c.ingresos - c.costos) / c.ingresos * 100) : 0
    })).sort((a, b) => b.ingresos - a.ingresos);

    if (totalManual > 0) {
      categorias.push({
        categoria: 'Ingresos Manuales',
        ingresos: totalManual,
        costos: 0,
        cantidad: manualIncomes.length,
        ganancia: totalManual,
        margen: 100
      });
    }

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
      gastosDetalle: gastosPorCategoria,
      ingresosList: ingresosList // 🔥 Nueva lista detallada unificada
    });
  } catch (error) {
    logger.error('Error en GET /api/rendimientos', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ==================== ENDPOINT DE HEALTH CHECK ====================

// ==================== FUNCIÓN EJECUTAR ACCIÓN ==================== 
// Ejecuta las acciones decididas por la IA sobre el disco
async function ejecutarAccion(accion, datos, trabajosRaw, cotsClientes, cotsGremio) {
  const ts = Date.now();
  const iso = new Date().toISOString();

  switch (accion) {

    case 'guardar_cliente_comun': {
      const clientes = await readJSON(FILES.clientes);
      // ✅ FIX: Validación robusta (Nombre + Teléfono)
      const existe = clientes.find(c =>
        (c.nombre || c.name || '').toLowerCase().trim() === datos.nombre.toLowerCase().trim() &&
        (c.telefono || '').replace(/\D/g, '') === (datos.telefono || '').replace(/\D/g, '')
      );
      if (existe) return { ok: false, error: `Ya existe el cliente "${datos.nombre}"` };
      const nuevo = {
        id: 'cli_' + ts,
        nombre: datos.nombre,
        name: datos.nombre, // Compatibilidad
        telefono: datos.telefono || '',
        email: datos.email || '',
        direccion: datos.direccion || '',
        tipo: 'cliente',
        fechaCreacion: iso
      };
      clientes.push(nuevo);
      await writeJSON(FILES.clientes, clientes);
      logger.info('✅ Asistente guardó cliente común:', datos.nombre);
      return { ok: true, mensaje: `Cliente "${datos.nombre}" guardado como Cliente Común.` };
    }

    case 'guardar_cliente_gremio': {
      const clientes = await readJSON(FILES.clientes);
      // ✅ FIX: Validación robusta
      const existe = clientes.find(c =>
        (c.nombre || c.name || '').toLowerCase().trim() === datos.nombre.toLowerCase().trim() &&
        (c.telefono || '').replace(/\D/g, '') === (datos.telefono || '').replace(/\D/g, '')
      );
      if (existe) return { ok: false, error: `Ya existe el cliente gremio "${datos.nombre}"` };
      const nuevo = {
        id: 'gremio_cli_' + ts,
        nombre: datos.nombre,
        name: datos.nombre, // Compatibilidad
        telefono: datos.telefono || '',
        email: datos.email || '',
        direccion: datos.direccion || '',
        tipo: 'gremio',
        fechaCreacion: iso
      };
      clientes.push(nuevo);
      await writeJSON(FILES.clientes, clientes);
      logger.info('✅ Asistente guardó cliente gremio:', datos.nombre);
      return { ok: true, id: nuevo.id, mensaje: `Cliente "${datos.nombre}" guardado como Gremio.` };
    }

    case 'guardar_cotizacion_cliente':
    case 'guardar_cotizacion_gremio': {
      const esGremio = accion === 'guardar_cotizacion_gremio';
      const archivo = esGremio ? FILES.gremio_data : FILES.clientes_data;
      const m2 = (datos.ancho_cm && datos.alto_cm)
        ? (datos.ancho_cm / 100) * (datos.alto_cm / 100) * (datos.cantidad || 1)
        : 1;
      const totalSinIva = datos.total_sin_iva || datos.precio_unitario || 0;
      const totalFinal = datos.con_iva ? totalSinIva * 1.21 : totalSinIva;

      const cotizacion = {
        id: String(ts),
        clientId: (esGremio ? 'gremio_cli_' : 'cliente_cli_') + (ts + 1),
        cliente: {
          nombre: datos.nombre_cliente,
          telefono: datos.telefono_cliente || '',
          email: '', direccion: ''
        },
        fechaEntrega: '',
        productos: [],
        terceros: [],
        multiCategories: {
          categories: [{
            id: 'cat_' + ts,
            name: datos.descripcion,
            costPerM2: 0,
            pricePerM2: m2 > 0 ? totalSinIva / m2 : totalSinIva,
            totalCost: 0,
            totalPrice: totalSinIva,
            margin: totalSinIva,
            m2: m2
          }],
          sharedDimensions: {
            width: (datos.ancho_cm || 100) / 100,
            height: (datos.alto_cm || 100) / 100,
            totalM2: m2
          },
          inkPriceEnabled: false,
          inkPricePerM2: 0
        },
        costoTotal: 0,
        subtotal: totalSinIva,
        iva: datos.con_iva ? totalSinIva * 0.21 : 0,
        totalCliente: totalFinal,
        ganancia: totalFinal,
        anticipo: totalFinal * 0.6,
        saldo: totalFinal,
        fecha: iso,
        estado: 'pendiente',
        approved: false,
        descripcion: datos.descripcion
      };

      const lista = await readJSON(archivo);
      lista.push(cotizacion);
      await writeJSON(archivo, lista);
      logger.info(`✅ Asistente guardó cotización (${esGremio ? 'gremio' : 'cliente'}):`, datos.nombre_cliente);

      const fmt = n => '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n || 0);
      return {
        ok: true,
        id: cotizacion.id,
        mensaje: `Cotización ID ${cotizacion.id} guardada para ${datos.nombre_cliente}.\nTotal: ${fmt(totalFinal)} | Anticipo 60%: ${fmt(totalFinal * 0.6)}`
      };
    }

    case 'crear_trabajo': {
      const total = datos.total || 0;
      const anticipo = datos.anticipo_cobrado || 0;
      const nuevoTrabajo = {
        id: 'work_' + ts,
        quoteId: datos.cotizacion_id || null,
        clientName: datos.nombre_cliente,
        clientPhone: datos.telefono || '',
        clientEmail: '',
        clientAddress: '',
        total, totalCost: 0, profit: total,
        paidAmount: anticipo,
        balance: total - anticipo,
        status: 'pending',
        paymentStatus: anticipo >= total ? 'paid' : anticipo > 0 ? 'partial' : 'unpaid',
        priority: datos.prioridad || 'normal',
        createdAt: iso,
        deliveryDate: datos.fecha_entrega || null,
        timeline: [{ type: 'created', description: 'Creado por Asistente IA', timestamp: iso }],
        notes: [],
        deliveryStatus: 'pending',
        descripcion: datos.descripcion || ''
      };

      // Si viene de cotización, marcarla como aprobada
      if (datos.cotizacion_id) {
        const esGremio = datos.tipo_cliente === 'gremio';
        const archivo = esGremio ? FILES.gremio_data : FILES.clientes_data;
        const lista = await readJSON(archivo);
        const idx = lista.findIndex(c => c.id === datos.cotizacion_id);
        if (idx !== -1) {
          lista[idx].approved = true;
          lista[idx].estado = 'aprobada';
          lista[idx].fechaAprobacion = iso;
          await writeJSON(archivo, lista);
        }
      }

      // Agregar a trabajos
      const tw = await readJSON(FILES.trabajos);
      if (!tw.works) tw.works = [];
      tw.works.push(nuevoTrabajo);
      await writeJSON(FILES.trabajos, tw);

      logger.info('✅ Asistente creó trabajo:', nuevoTrabajo.id, 'para', datos.nombre_cliente);
      const fmt = n => '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n || 0);
      return {
        ok: true,
        id: nuevoTrabajo.id,
        mensaje: `Trabajo ${nuevoTrabajo.id} creado para ${datos.nombre_cliente}.\nTotal: ${fmt(total)} | Anticipo: ${fmt(anticipo)} | Saldo: ${fmt(total - anticipo)}`
      };
    }

    case 'actualizar_trabajo': {
      const tw = await readJSON(FILES.trabajos);
      let trabajo = datos.trabajo_id
        ? tw.works.find(w => w.id === datos.trabajo_id)
        : tw.works.find(w =>
          w.clientName.toLowerCase().includes(datos.nombre_cliente.toLowerCase()) &&
          w.status !== 'completed'
        ) || tw.works.find(w =>
          w.clientName.toLowerCase().includes(datos.nombre_cliente.toLowerCase())
        );

      if (!trabajo) return { ok: false, error: `No se encontró trabajo de "${datos.nombre_cliente}"` };

      const oldStatus = trabajo.status;

      if (datos.nuevo_estado) {
        trabajo.status = datos.nuevo_estado;
        trabajo.timeline = [...(trabajo.timeline || []), {
          type: 'status_changed',
          description: `Estado → ${datos.nuevo_estado}${datos.nota ? ': ' + datos.nota : ''} (Asistente IA)`,
          timestamp: iso
        }];
        if (datos.nuevo_estado === 'completed') {
          trabajo.deliveryStatus = 'delivered';
          trabajo.actualDeliveryDate = iso;
        }
      }

      await writeJSON(FILES.trabajos, tw);
      logger.info('✅ Asistente actualizó trabajo en JSON:', trabajo.id);

      // Sincronizar en SQLite para mantener compatibilidad
      try {
        await db.run(
          `UPDATE trabajos SET status = ?, delivery_status = ?, actual_delivery_date = ? WHERE id = ?`,
          [trabajo.status, trabajo.deliveryStatus || 'pending', trabajo.actualDeliveryDate || null, trabajo.id]
        );
        logger.info('✅ Asistente sincronizó trabajo en SQLite:', trabajo.id);
      } catch (dbErr) {
        logger.error('❌ Error al actualizar en SQLite por Asistente IA:', dbErr.message);
      }

      // Enviar notificación de retiro si el estado pasa a terminado/listo
      if (datos.nuevo_estado && oldStatus !== datos.nuevo_estado &&
        ['completed', 'ready', 'para_retirar'].includes(datos.nuevo_estado)) {
        await enviarNotificacionTrabajoListo(trabajo);
      }

      return {
        ok: true,
        id: trabajo.id,
        mensaje: `Trabajo de ${trabajo.clientName} actualizado → ${datos.nuevo_estado || 'sin cambio de estado'}`
      };
    }

    case 'registrar_pago': {
      const tw = await readJSON(FILES.trabajos);
      let trabajo = datos.trabajo_id
        ? tw.works.find(w => w.id === datos.trabajo_id)
        : tw.works.find(w =>
          w.clientName.toLowerCase().includes(datos.nombre_cliente.toLowerCase()) &&
          w.status !== 'completed'
        );

      if (!trabajo) return { ok: false, error: `No se encontró trabajo de "${datos.nombre_cliente}"` };

      const nuevoPagado = (trabajo.paidAmount || 0) + datos.monto;
      const nuevoSaldo = Math.max(0, trabajo.total - nuevoPagado);
      trabajo.paidAmount = nuevoPagado;
      trabajo.balance = nuevoSaldo;
      trabajo.paymentStatus = nuevoSaldo <= 0 ? 'paid' : nuevoPagado > 0 ? 'partial' : 'unpaid';
      trabajo.timeline = [...(trabajo.timeline || []), {
        type: 'payment',
        description: `Pago recibido: $${datos.monto.toLocaleString('es-AR')} | Saldo: $${nuevoSaldo.toLocaleString('es-AR')}`,
        timestamp: iso
      }];

      await writeJSON(FILES.trabajos, tw);
      logger.info('✅ Asistente registró pago:', datos.monto, 'para', trabajo.clientName);
      const fmt = n => '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n || 0);
      return {
        ok: true,
        id: trabajo.id,
        mensaje: `Pago de ${fmt(datos.monto)} registrado para ${trabajo.clientName}.\nSaldo restante: ${fmt(nuevoSaldo)}`
      };
    }

    case 'limpiar_clientes': {
      await writeJSON(FILES.clientes, []);
      logger.info('✅ Asistente limpió la lista de clientes');
      return { ok: true, mensaje: 'Lista de clientes vaciada completamente.' };
    }

    case 'eliminar_cliente': {
      const clientes = await readJSON(FILES.clientes);
      const nombreBuscar = (datos.nombre_cliente || '').toLowerCase();
      const idxToDelete = clientes.findIndex(c =>
        (c.nombre || c.name || '').toLowerCase().includes(nombreBuscar) ||
        (c.telefono || '').includes(datos.telefono_cliente || '')
      );

      if (idxToDelete === -1) {
        return { ok: false, error: `No se encontró cliente "${datos.nombre_cliente}"` };
      }

      const deletedClient = clientes[idxToDelete];
      clientes.splice(idxToDelete, 1);
      await writeJSON(FILES.clientes, clientes);
      logger.info('✅ Asistente eliminó cliente:', deletedClient.nombre || deletedClient.name);
      return {
        ok: true,
        mensaje: `Cliente "${deletedClient.nombre || deletedClient.name}" eliminado de la lista.`
      };
    }

    case 'editar_cliente': {
      const clientes = await readJSON(FILES.clientes);
      const nombreBuscar = (datos.nombre_cliente || '').toLowerCase().trim();

      const idx = clientes.findIndex(c =>
        (c.nombre || c.name || '').toLowerCase().trim().includes(nombreBuscar) ||
        (c.telefono || '').includes(datos.telefono_cliente || '')
      );

      if (idx === -1) {
        return { ok: false, error: `No se encontró el cliente "${datos.nombre_cliente}"` };
      }

      const cliente = clientes[idx];
      const cambios = [];

      if (datos.nuevo_tipo) {
        cliente.tipo = datos.nuevo_tipo;
        cambios.push(`Tipo: ${datos.nuevo_tipo}`);
      }
      if (datos.nuevo_nombre) {
        cliente.nombre = datos.nuevo_nombre;
        cliente.name = datos.nuevo_nombre;
        cambios.push(`Nombre: ${datos.nuevo_nombre}`);
      }
      if (datos.nuevo_telefono) {
        cliente.telefono = datos.nuevo_telefono;
        cambios.push(`Tel: ${datos.nuevo_telefono}`);
      }

      await writeJSON(FILES.clientes, clientes);
      logger.info('✅ Asistente editó cliente:', cliente.nombre);
      return {
        ok: true,
        mensaje: `Cliente actualizado correctamente.\n${cambios.join('\n')}`
      };
    }

    case 'agregar_producto_terminado': {
      const precios = await readJSON(FILES.precios_finales);
      const nuevo = {
        nombre: datos.nombre,
        precio: datos.precio || 0,
        unidad: datos.unidad || 'unidad',
        descripcion: datos.descripcion || '',
        categoria: datos.categoria || 'Productos'
      };

      // ✅ Sincronizar categorías
      if (nuevo.categoria) {
        let cats = await readJSON(FILES.categorias);
        if (!cats.includes(nuevo.categoria)) {
          cats.push(nuevo.categoria);
          cats.sort();
          await writeJSON(FILES.categorias, cats);
        }
      }

      precios.push(nuevo);
      await writeJSON(FILES.precios_finales, precios);
      logger.info('✅ Asistente agregó producto terminado:', nuevo.nombre);
      return { ok: true, mensaje: `Producto terminado "${nuevo.nombre}" agregado en categoría "${nuevo.categoria}".` };
    }

    case 'agregar_insumo': {
      const precios = await readJSON(FILES.precios);
      const ts = Date.now();
      const nuevo = {
        productoId: String(ts),
        categoria: datos.categoria || 'General',
        producto: datos.nombre,
        costo: datos.costo || 0,
        area: datos.area || 1,
        precioGremio: datos.precioGremio || (datos.costo * 2.5),
        precioCliente: datos.precioCliente || (datos.costo * 4),
        rentabilidadGremio: "150.00",
        rentabilidadCliente: "300.00",
        createdAt: new Date().toISOString(),
        id: String(ts + 1)
      };

      // ✅ Sincronizar categorías
      if (nuevo.categoria) {
        let cats = await readJSON(FILES.categorias).catch(() => []);
        if (!cats.includes(nuevo.categoria)) {
          cats.push(nuevo.categoria);
          cats.sort();
          await writeJSON(FILES.categorias, cats);
        }
      }

      // Calcular rentabilidad si es posible
      if (nuevo.costo > 0) {
        nuevo.rentabilidadGremio = (((nuevo.precioGremio - nuevo.costo) / nuevo.costo) * 100).toFixed(2);
        nuevo.rentabilidadCliente = (((nuevo.precioCliente - nuevo.costo) / nuevo.costo) * 100).toFixed(2);
      }

      precios.push(nuevo);
      await writeJSON(FILES.precios, precios);
      logger.info('✅ Asistente agregó insumo:', nuevo.producto);
      return { ok: true, mensaje: `Insumo "${nuevo.producto}" guardado exitosamente en categoría "${nuevo.categoria}".` };
    }

    case 'editar_precio': {
      const precios = await readJSON(FILES.precios_finales);
      const idx = precios.findIndex(p => p.nombre.toLowerCase() === (datos.nombre || '').toLowerCase());
      if (idx === -1) return { ok: false, error: `No se encontró precio "${datos.nombre}"` };
      precios[idx] = { ...precios[idx], ...datos.campos }; // campos contiene price/descripcion/unidad
      await writeJSON(FILES.precios_finales, precios);
      logger.info('✅ Asistente editó precio:', precios[idx].nombre);
      return { ok: true, mensaje: `Precio "${precios[idx].nombre}" actualizado.` };
    }

    case 'eliminar_precio': {
      let precios = await readJSON(FILES.precios_finales);
      precios = precios.filter(p => p.nombre.toLowerCase() !== (datos.nombre || '').toLowerCase());
      await writeJSON(FILES.precios_finales, precios);
      logger.info('✅ Asistente eliminó precio:', datos.nombre);
      return { ok: true, mensaje: `Precio "${datos.nombre}" eliminado.` };
    }

    case 'agregar_material': {
      const mats = await readJSON(FILES.materiales);
      const nuevo = { nombre: datos.nombre, costo: datos.costo || 0, unidad: datos.unidad || '' };
      mats.push(nuevo);
      await writeJSON(FILES.materiales, mats);
      logger.info('✅ Asistente agregó material:', nuevo.nombre);
      return { ok: true, mensaje: `Material "${nuevo.nombre}" agregado.` };
    }

    case 'editar_material': {
      const mats = await readJSON(FILES.materiales);
      const idx = mats.findIndex(m => m.nombre.toLowerCase() === (datos.nombre || '').toLowerCase());
      if (idx === -1) return { ok: false, error: `No se encontró material "${datos.nombre}"` };
      mats[idx] = { ...mats[idx], ...datos.campos };
      await writeJSON(FILES.materiales, mats);
      logger.info('✅ Asistente editó material:', mats[idx].nombre);
      return { ok: true, mensaje: `Material "${mats[idx].nombre}" actualizado.` };
    }

    case 'eliminar_material': {
      let mats = await readJSON(FILES.materiales);
      mats = mats.filter(m => m.nombre.toLowerCase() !== (datos.nombre || '').toLowerCase());
      await writeJSON(FILES.materiales, mats);
      logger.info('✅ Asistente eliminó material:', datos.nombre);
      return { ok: true, mensaje: `Material "${datos.nombre}" eliminado.` };
    }

    case 'agregar_gasto': {
      const gastos = await readJSON(FILES.gastos);
      const nuevo = { categoria: datos.categoria || 'General', monto: datos.monto || 0, descripcion: datos.descripcion || '', fecha: new Date().toISOString(), tipo: 'egreso' };
      gastos.push(nuevo);
      await writeJSON(FILES.gastos, gastos);
      logger.info('✅ Asistente registró gasto:', nuevo.categoria, nuevo.monto);
      return { ok: true, mensaje: `Gasto de $${nuevo.monto} registrado en categoría ${nuevo.categoria}.` };
    }

    case 'agregar_categoria': {
      let cats = await readJSON(FILES.categorias);
      if (!Array.isArray(cats)) cats = [];
      if (!cats.includes(datos.categoria)) cats.push(datos.categoria);
      await writeJSON(FILES.categorias, cats);
      logger.info('✅ Asistente agregó categoría:', datos.categoria);
      return { ok: true, mensaje: `Categoría "${datos.categoria}" agregada.` };
    }

    case 'eliminar_categoria': {
      let cats = await readJSON(FILES.categorias);
      cats = cats.filter(c => c !== datos.categoria);
      await writeJSON(FILES.categorias, cats);
      logger.info('✅ Asistente eliminó categoría:', datos.categoria);
      return { ok: true, mensaje: `Categoría "${datos.categoria}" eliminada.` };
    }

    case 'aprobar_cotizacion_cliente':
    case 'aprobar_cotizacion_gremio': {
      const esGremio = accion === 'aprobar_cotizacion_gremio';
      const archivo = esGremio ? FILES.gremio_data : FILES.clientes_data;
      const cotizaciones = await readJSON(archivo);

      const cotIdx = cotizaciones.findIndex(c => c.id === datos.cotizacion_id);
      if (cotIdx === -1) {
        return { ok: false, error: `No se encontró cotización ${datos.cotizacion_id}` };
      }

      const cot = cotizaciones[cotIdx];
      cot.approved = true;
      cot.approvedAt = iso;
      await writeJSON(archivo, cotizaciones);

      // Crear automáticamente un trabajo desde la cotización
      const trabajosData = await readJSON(FILES.trabajos);
      const trabajoExistente = trabajosData.works.find(w => w.quoteId === datos.cotizacion_id);

      if (!trabajoExistente) {
        const nuevoTrabajo = {
          id: 'work_' + ts,
          quoteId: datos.cotizacion_id,
          clientName: cot.cliente.nombre,
          clientPhone: cot.cliente.telefono || '',
          clientEmail: cot.cliente.email || '',
          clientAddress: cot.cliente.direccion || '',
          total: cot.totalCliente || cot.subtotal || 0,
          totalCost: cot.costoTotal || 0,
          profit: (cot.totalCliente || cot.subtotal || 0) - (cot.costoTotal || 0),
          paidAmount: 0,
          balance: cot.totalCliente || cot.subtotal || 0,
          anticipo: datos.anticipo || 0,
          status: 'pending',
          paymentStatus: 'unpaid',
          priority: datos.prioridad || 'normal',
          createdAt: iso,
          timeline: [{
            type: 'created',
            description: 'Trabajo creado automáticamente desde cotización aprobada',
            timestamp: iso
          }],
          notes: [],
          deliveryStatus: 'pending',
          deliveryDate: datos.fecha_entrega || null,
          descripcion: cot.multiCategories?.categories?.[0]?.name || 'Trabajo desde cotización'
        };
        trabajosData.works.push(nuevoTrabajo);
        await writeJSON(FILES.trabajos, trabajosData);
        logger.info('✅ Trabajo creado automáticamente desde cotización:', nuevoTrabajo.id);
      }

      logger.info('✅ Asistente aprobó cotización:', datos.cotizacion_id);
      return {
        ok: true,
        id: datos.cotizacion_id,
        mensaje: `Cotización aprobada y trabajo creado para ${cot.cliente.nombre}. Total: $${(cot.totalCliente || cot.subtotal || 0).toLocaleString('es-AR')}`
      };
    }

    case 'editar_trabajo': {
      const trabajosData = await readJSON(FILES.trabajos);
      let trabajo = datos.trabajo_id
        ? trabajosData.works.find(w => w.id === datos.trabajo_id)
        : trabajosData.works.find(w =>
          w.clientName.toLowerCase().includes((datos.nombre_cliente || '').toLowerCase()) &&
          w.status !== 'completed'
        );

      if (!trabajo) {
        return { ok: false, error: `No se encontró trabajo de "${datos.nombre_cliente || datos.trabajo_id}"` };
      }

      // Actualizar campos permitidos
      const permittedFields = ['status', 'paymentStatus', 'priority', 'deliveryDate', 'notes', 'descripcion', 'deliveryStatus'];
      for (const field of Object.keys(datos)) {
        if (field !== 'trabajo_id' && field !== 'nombre_cliente' && permittedFields.includes(field)) {
          trabajo[field] = datos[field];
        }
      }

      // Agregar timeline entry
      trabajo.timeline = [...(trabajo.timeline || []), {
        type: 'updated',
        description: `Trabajo actualizado: ${Object.keys(datos).filter(k => !['trabajo_id', 'nombre_cliente'].includes(k)).join(', ')}`,
        timestamp: iso
      }];

      await writeJSON(FILES.trabajos, trabajosData);
      logger.info('✅ Asistente editó trabajo:', trabajo.id);
      return { ok: true, id: trabajo.id, mensaje: `Trabajo de ${trabajo.clientName} actualizado.` };
    }

    case 'eliminar_trabajo': {
      const trabajosData = await readJSON(FILES.trabajos);
      let trabajo = datos.trabajo_id
        ? trabajosData.works.find(w => w.id === datos.trabajo_id)
        : trabajosData.works.find(w =>
          w.clientName.toLowerCase().includes((datos.nombre_cliente || '').toLowerCase()) &&
          w.status === 'pending'
        );

      if (!trabajo) {
        return { ok: false, error: `No se encontró trabajo ${datos.trabajo_id || 'de ' + datos.nombre_cliente}` };
      }

      const nombreCliente = trabajo.clientName;
      trabajosData.works = trabajosData.works.filter(w => w.id !== trabajo.id);
      await writeJSON(FILES.trabajos, trabajosData);
      logger.info('✅ Asistente eliminó trabajo:', trabajo.id);
      return { ok: true, id: trabajo.id, mensaje: `Trabajo de ${nombreCliente} eliminado.` };
    }

    default:
      return { ok: false, error: `Acción desconocida: ${accion}` };
  }
}

// ==================== ASISTENTE IA — ENDPOINT DE CHAT ====================
// Proxy hacia Groq para el chat del operador en el panel web.
// Lee la API key del mismo archivo de configuración que usa el bot de WhatsApp.

app.post('/api/ai/chat', verifyToken, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Se requiere el campo messages (array)' });
    }

    // Leer API key desde bot-config.json o variable de entorno
    let groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      try {
        const botConfigPath = path.join(__dirname, 'datos_mr_letreros', 'bot_whatsapp', 'bot_config.json');
        const botConfig = JSON.parse(await fs.readFile(botConfigPath, 'utf-8'));
        groqApiKey = botConfig.groqApiKey;
      } catch (e) { }
    }
    if (!groqApiKey) {
      try {
        const botFile = await fs.readFile(path.join(__dirname, 'whatsapp-bot-gemini.js'), 'utf-8');
        const m1 = botFile.match(/groqApiKey\s*:\s*(?:process\.env\.\w+\s*\|\|\s*)?['"]([^'"]{20,})['"]/);
        const m2 = botFile.match(/(gsk_[A-Za-z0-9_]{20,})/);
        groqApiKey = (m1 && m1[1]) || (m2 && m2[1]) || groqApiKey;
      } catch (e) { }
    }

    if (!groqApiKey || groqApiKey === 'PEGAR_AQUÍ_TU_GROQ_KEY') {
      return res.status(500).json({ error: 'API key de Groq no configurada' });
    }

    // ════════════════════════════════════════════════════════════════════
    // PASO B: Cargar todos los datos del disco
    // ════════════════════════════════════════════════════════════════════
    const [trabajosRaw, clientesComunes, preciosFinales, terceros, cotsClientes, cotsGremio, preciosBase, materiales, categorias] =
      await Promise.all([
        readJSON(FILES.trabajos),
        readJSON(FILES.clientes),
        readJSON(FILES.precios_finales),
        readJSON(FILES.terceros),
        readJSON(FILES.clientes_data),
        readJSON(FILES.gremio_data),
        readJSON(FILES.precios),
        readJSON(FILES.materiales),
        readJSON(FILES.categorias).catch(() => [])
      ]);

    const trabajos = (trabajosRaw && trabajosRaw.works) || [];
    const cotsClientesPend = (Array.isArray(cotsClientes) ? cotsClientes : []).filter(c => !c.approved);
    const cotsGremioPend = (Array.isArray(cotsGremio) ? cotsGremio : []).filter(c => !c.approved);
    const morosos = trabajos.filter(t => (t.balance || 0) > 0);
    const hoy = new Date().toLocaleDateString('es-AR');

    const fmt = n => '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n || 0);

    // Detectar cliente mencionado para incluirlo en contexto
    const lastMsg = messages[messages.length - 1];
    const lastContent = lastMsg && lastMsg.role === 'user' ? (lastMsg.content || '').toLowerCase() : '';
    const clienteMencionado = clientesComunes.find(c =>
      (c.nombre || c.name) && lastContent.includes((c.nombre || c.name).toLowerCase())
    );

    // ════════════════════════════════════════════════════════════════════
    // PASO C: Construir el system prompt con contexto completo + instrucciones de acción
    // ════════════════════════════════════════════════════════════════════

    // PARTE 1 — CONTEXTO DEL NEGOCIO
    const systemPrompt = `Sos el Asistente IA del panel de operación de MR Letreros (gráfica, Santa Fe, Argentina).
Hoy: ${hoy}. Respondé en español, tono profesional.

⚠️ REGLA DE ORO: Antes de guardar un cliente nuevo o cotizar para uno nuevo, SIEMPRE confirmá si es "Gremio" o "Cliente Final". Si no lo sé, PREGUNTÁ (accion: "ninguna"). Si ya existe en la lista, no preguntes.

PRECIOS FIJOS (sin IVA):
${(Array.isArray(preciosFinales) ? preciosFinales : []).slice(0, 50).map(p => `- ${p.nombre}: ${fmt(p.precio)} por ${p.unidad}`).join('\n') || 'No hay precios finales cargados'}

MATERIALES Y PRECIOS BASE (Lista Gremio):
${(Array.isArray(preciosBase) ? preciosBase : []).map(p => `- ${p.producto || p.nombre}: ${fmt(p.precioGremio || p.precio)}`).join('\n')}

COSTOS DE INSUMOS (Para calcular costos internos):
${(Array.isArray(materiales) ? materiales : []).slice(0, 50).map(m => `- ${m.nombre || m.productoNombre}: Costo $${m.costo || m.precioRollo || 0} (${m.unidad || 'u'})`).join('\n')}

CATEGORÍAS EXISTENTES (Usar estas o crear nuevas si es necesario):
${(Array.isArray(categorias) ? categorias : []).join(', ') || 'Sin categorías'}

TRABAJOS ACTIVOS (${trabajos.filter(t => t.status !== 'completed').length}):
${JSON.stringify(trabajos.filter(t => t.status !== 'completed').slice(0, 10).map(t => ({
      id: t.id, cliente: t.clientName, total: t.total,
      saldo: t.balance, estado: t.status, entrega: t.deliveryDate
    })), null, 2)}

CLIENTES REGISTRADOS (${clientesComunes.length}):
${JSON.stringify(
      clientesComunes.slice(0, 10).map(c => ({
        nombre: c.nombre || c.name || '',
        telefono: c.telefono || '',
        tipo: c.tipo || 'cliente'
      })), null, 2
    )}
${clienteMencionado ? `\nCLIENTE EN CONTEXTO (Encontrado por nombre):\n${JSON.stringify({
      nombre: clienteMencionado.nombre || clienteMencionado.name,
      telefono: clienteMencionado.telefono,
      tipo: clienteMencionado.tipo || 'cliente'
    }, null, 2)}` : ''}

CLIENTES CON SALDO PENDIENTE:
${JSON.stringify(morosos.slice(0, 5).map(t => ({
      cliente: t.clientName, tel: t.clientPhone, saldo: t.balance
    })), null, 2)}

COTIZACIONES SIN APROBAR:
Clientes: ${cotsClientesPend.length} | Gremio: ${cotsGremioPend.length}

REGLAS:
- Precios SIN IVA. Si piden factura: +21%.
- Anticipo siempre 60% para iniciar.
- Clientes gremio = mayoristas/imprenteros (sin IVA en cotización).
- Cálculo m²: precio × (ancho_cm/100) × (alto_cm/100) × cantidad.
- CÁLCULO DE COSTOS: Si te piden calcular el costo de un trabajo, sumá los costos de los materiales necesarios basándote en la lista "COSTOS DE INSUMOS".
- VALIDACIÓN: Si piden guardar cliente y falta el tipo (Gremio/Común), respondé preguntando el tipo (accion: "ninguna").

═══ FORMATO DE RESPUESTA OBLIGATORIO ═══
Respondé ÚNICAMENTE con un JSON válido. Sin texto extra. Sin backticks.

{
  "respuesta_texto": "Texto en español para mostrar al operador en el chat. Puede usar markdown.",
  "accion": "ninguna | guardar_cliente_comun | guardar_cliente_gremio | guardar_cotizacion_cliente | guardar_cotizacion_gremio | crear_trabajo | actualizar_trabajo | registrar_pago | aprobar_cotizacion_cliente | aprobar_cotizacion_gremio | editar_trabajo | eliminar_trabajo | limpiar_clientes | eliminar_cliente | agregar_producto_terminado | editar_precio | eliminar_precio | agregar_insumo | editar_material | eliminar_material | agregar_gasto | agregar_categoria | eliminar_categoria",
  "datos": { ... campos según la acción, o null si accion=ninguna }
}

═══ CAMPOS EXACTOS POR ACCIÓN ═══

accion: "guardar_cliente_comun"
datos: { "nombre": string, "telefono": string, "email": string, "direccion": string }

accion: "guardar_cliente_gremio"
datos: { "nombre": string, "telefono": string, "email": string, "direccion": string }

accion: "guardar_cotizacion_cliente" o "guardar_cotizacion_gremio"
datos: {
  "nombre_cliente": string,
  "telefono_cliente": string,
  "descripcion": string,
  "ancho_cm": number,
  "alto_cm": number,
  "cantidad": number,
  "precio_unitario": number,
  "total_sin_iva": number,
  "con_iva": boolean
}

accion: "crear_trabajo"
datos: {
  "nombre_cliente": string,
  "telefono": string,
  "descripcion": string,
  "total": number,
  "anticipo_cobrado": number,
  "fecha_entrega": "YYYY-MM-DD o null",
  "prioridad": "normal | urgent",
  "tipo_cliente": "cliente | gremio",
  "cotizacion_id": "id de la cotización si viene de una, o null"
}

accion: "actualizar_trabajo"
datos: {
  "trabajo_id": "id exacto o null",
  "nombre_cliente": string,
  "nuevo_estado": "pending | in_progress | completed | null",
  "nota": string
}

accion: "registrar_pago"
datos: {
  "trabajo_id": "id exacto o null",
  "nombre_cliente": string,
  "monto": number
}

accion: "limpiar_clientes"
datos: null
(borra la lista COMPLETA de clientes - usar solo si el usuario lo solicita explícitamente)

accion: "eliminar_cliente"
datos: {
  "nombre_cliente": string,
  "telefono_cliente": string (opcional)
}
(borra un cliente específico - requiere confirmación del operador o intención explícita)

accion: "editar_cliente"
datos: {
  "nombre_cliente": string,
  "nuevo_tipo": "cliente | gremio" (opcional),
  "nuevo_nombre": string (opcional),
  "nuevo_telefono": string (opcional),
  "nueva_direccion": string (opcional),
  "nuevo_email": string (opcional)
}
(modifica datos de un cliente existente)

accion: "agregar_producto_terminado"
datos: {
  "nombre": string,
  "precio": number,
  "unidad": string (ej: "unidad", "m2"),
  "descripcion": string (opcional)
}
(USAR ESTO SOLO PARA PRODUCTOS CON PRECIO FINAL FIJO)

accion: "agregar_insumo"
datos: {
  "nombre": string,
  "categoria": string,
  "costo": number,
  "precioGremio": number,
  "precioCliente": number,
  "area": number (ej: 1 o 50)
}
(USAR ESTO PARA MATERIALES O TRABAJOS QUE SE COTIZAN POR M2)

accion: "editar_precio"
datos: {
  "nombre": string,
  "campos": {
    "precio": number (opcional),
    "unidad": string (opcional),
    "descripcion": string (opcional)
  }
}

accion: "eliminar_precio"
datos: {
  "nombre": string
}

accion: "agregar_material"
datos: {
  "nombre": string,
  "costo": number,
  "unidad": string (ej: "kg", "metro", "caja")
}

accion: "editar_material"
datos: {
  "nombre": string,
  "campos": {
    "costo": number (opcional),
    "unidad": string (opcional)
  }
}

accion: "eliminar_material"
datos: {
  "nombre": string
}

accion: "agregar_gasto"
datos: {
  "categoria": string (Ej: "Alquiler de Local", "Servicios", "Materiales"),
  "monto": number,
  "descripcion": string (opcional)
}

accion: "agregar_categoria"
datos: {
  "categoria": string
}

accion: "eliminar_categoria"
datos: {
  "categoria": string
}

accion: "aprobar_cotizacion_cliente" o "aprobar_cotizacion_gremio"
datos: {
  "cotizacion_id": string (IMPORTANTE: el ID numérico exacto de la cotización, ej: "1771254155162"),
  "anticipo": number (opcional),
  "fecha_entrega": "YYYY-MM-DD" (opcional),
  "prioridad": "normal | urgent" (opcional)
}
(aprueba la cotización y crea automáticamente un trabajo)
CUÁNDO USAR: Si el operador dice "aprobá la cotización XYZ", "OK a la cotización", "aprobada la cot ID 123"

accion: "editar_trabajo"
datos: {
  "trabajo_id": string (opcional, si no se proporciona busca por nombre_cliente),
  "nombre_cliente": string (opcional),
  "status": "pending | in_progress | completed" (opcional),
  "paymentStatus": "unpaid | partial | paid" (opcional),
  "priority": "normal | urgent" (opcional),
  "deliveryDate": "YYYY-MM-DD" (opcional),
  "deliveryStatus": "pending | delivered" (opcional),
  "descripcion": string (opcional),
  "notes": string (opcional)
}

accion: "eliminar_trabajo"
datos: {
  "trabajo_id": string (opcional),
  "nombre_cliente": string (opcional)
}
(borra un trabajo - preferentemente en estado pending)

accion: "ninguna"
datos: null

═══ CUÁNDO GUARDAR ═══
- Si el operador dice guardar/registrar/anotar/crear/nueva cotización → guardar
- Si el operador confirma después de ver un presupuesto → guardar
- Si dice "la cotización fue aprobada" o "hacé el trabajo" → crear_trabajo
- Si dice "aprobá la cotización", "OK a la cotización" → aprobar_cotizacion_cliente o aprobar_cotizacion_gremio
- Si dice "marcá como en proceso/terminado/completado" → actualizar_trabajo O editar_trabajo
- Si dice "cambiar estado/prioridad/fecha entrega del trabajo" → editar_trabajo
- Si dice "editá el trabajo X" → editar_trabajo (con los campos específicos)
- Si dice "borra/elimina el trabajo", "sacá el trabajo de la cola" → eliminar_trabajo (solo si está pending)
- Si dice "pagó X" o "cobré X" → registrar_pago
- Si dice "borra los clientes", "limpia la lista", "vaciá clientes" → limpiar_clientes
- Si dice "borra/elimina al cliente X", "sacá a Juan de la lista" → eliminar_cliente
- Si dice "cambiar a gremio/cliente", "corregir tipo", "editar cliente X" → editar_cliente
- Si dice "agregá un producto terminado X por Y" → agregar_producto_terminado
- Si dice "agregá un insumo/precio base X con costo Y" → agregar_insumo
- Si dice "agregá un material" → agregar_material
- Si dice "registrá un gasto" → agregar_gasto (IMPORTANTE: extraer categoria y monto numérico)
- Si dice "agregá una categoría" → agregar_categoria
- Si es consulta/pregunta/cálculo sin confirmación → ninguna`;

    // ════════════════════════════════════════════════════════════════════
    // PASO D: Llamar a Groq con fallback automático a Ollama local
    // ════════════════════════════════════════════════════════════════════
    const OpenAI = require('openai');

    let completion = null;
    let providerUsed = 'groq';

    // — Intento 1: Groq online —
    try {
      const groq = new OpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: groqApiKey
      });
      completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 1500,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      providerUsed = 'groq';
      logger.info('🌐 IA: usando Groq online');
    } catch (groqErr) {
      logger.warn(`⚠️ Groq falló (${groqErr.message}), intentando Ollama local...`);

      // — Intento 2: Ollama local —
      try {
        const botCfgPath = require('path').join(__dirname, 'datos_mr_letreros', 'bot_whatsapp', 'bot_config.json');
        const botCfg = JSON.parse(await fs.readFile(botCfgPath, 'utf-8').catch(() => '{}'));
        const ollamaModel = botCfg.ollamaModel || 'llama3.2:latest';

        const ollama = new OpenAI({
          baseURL: 'http://localhost:11434/v1',
          apiKey: 'ollama'
        });
        // Ollama no siempre soporta json_object, así que usamos prompt directo
        completion = await ollama.chat.completions.create({
          model: ollamaModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          max_tokens: 1500,
          temperature: 0.3
        });
        providerUsed = 'ollama';
        logger.info(`🤖 IA: usando Ollama local (${ollamaModel})`);
      } catch (ollamaErr) {
        logger.error(`❌ Ollama local también falló: ${ollamaErr.message}`);
        throw new Error('Sin conexión a IA (Groq y Ollama fallaron). Verificá tu conexión o que Ollama esté corriendo.');
      }
    }

    const raw = completion.choices[0].message.content.trim();
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const resultado = JSON.parse(clean);
    const { respuesta_texto, accion, datos } = resultado;

    // ════════════════════════════════════════════════════════════════════
    // PASO E: Ejecutar la acción en el disco
    // ════════════════════════════════════════════════════════════════════
    let mensajeFinal = respuesta_texto;
    let accionEjecutada = null;

    try {
      if (accion && accion !== 'ninguna' && datos) {
        accionEjecutada = await ejecutarAccion(accion, datos, trabajosRaw, cotsClientes, cotsGremio);
        if (accionEjecutada.ok) {
          mensajeFinal = respuesta_texto + '\n\n✅ ' + accionEjecutada.mensaje;
        } else {
          mensajeFinal = respuesta_texto + '\n\n❌ Error: ' + accionEjecutada.error;
        }
      }
    } catch (e) {
      logger.error('Error ejecutando acción del asistente:', e.message);
      mensajeFinal = respuesta_texto + '\n\n❌ Error ejecutando la acción: ' + e.message;
    }

    res.json({
      content: mensajeFinal,
      accion_ejecutada: accionEjecutada,
      usage: completion.usage,
      provider_used: providerUsed
    });

  } catch (err) {
    logger.error('Error en /api/ai/chat:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Servidor MR Letreros funcionando correctamente'
  });
});

// Endpoint para obtener la API Key de Gemini (para uso en frontend)
app.get('/api/config/gemini-key', verifyToken, requireRole(['admin', 'vendedor', 'superadmin']), async (req, res) => {
  try {
    const key = await getGeminiApiKey();
    res.json({ key });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener la API Key de Groq (para visión en frontend)
app.get('/api/config/groq-key', verifyToken, requireRole(['admin', 'vendedor', 'superadmin']), async (req, res) => {
  try {
    const key = await getGroqApiKey();
    res.json({ key });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener la API Key de Fireworks (para visión en frontend)
app.get('/api/config/fireworks-key', verifyToken, requireRole(['admin', 'vendedor', 'superadmin']), async (req, res) => {
  try {
    const key = await getFireworksApiKey();
    res.json({ key });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SISTEMA DE VECTORIZACIÓN IA ====================

// ---- Gestión unificada de claves IA (variables de entorno + bot_config.json) ----
// Las claves se pueden cargar desde el panel (apartado "API" del vectorizador) y se
// persisten en bot_config.json (sin tocar .env). Prioridad: variable de entorno → archivo.

const IA_KEYS_DEF = {
  geminiApiKey: {
    env: 'GEMINI_API_KEY',
    etiqueta: 'Google Gemini',
    descripcion: '🎨 Crear con IA · despixelado · análisis',
    formato: 'AIzaSy… (clásica) o AQ.… (nuevo formato)',
    hint: 'La usás en "Crear con IA". Nueva desde aistudio.google.com / Google AI Studio.'
  },
  groqApiKey: {
    env: 'GROQ_API_KEY',
    etiqueta: 'Groq',
    descripcion: 'Análisis de imagen IA',
    formato: 'gsk_…',
    hint: 'Análisis automático de complejidad antes de vectorizar.'
  },
  fireworksApiKey: {
    env: 'FIREWORKS_API_KEY',
    etiqueta: 'Fireworks.ai',
    descripcion: 'Análisis de imagen (alternativo)',
    formato: 'clave de Fireworks',
    hint: 'Solo si Groq/Gemini no están disponibles.'
  },
  removebgApiKey: {
    env: 'REMOVEBG_API_KEY',
    etiqueta: 'remove.bg',
    descripcion: 'Quitar fondo',
    formato: 'clave de remove.bg',
    hint: 'La usás en la pestaña "Quitar Fondo".'
  }
};

const IA_CONFIG_FILE = path.join(DATA_DIR, 'bot_whatsapp', 'bot_config.json');

const IA_KEYS_PLACEHOLDER = /^(PEGAR_AQUÍ.*|SKIP.*)$/i;

async function leerIAConfig() {
  try {
    const cfg = await readJSON(IA_CONFIG_FILE);
    return (cfg && typeof cfg === 'object') ? cfg : {};
  } catch (e) {
    return {};
  }
}

async function getClaveIA(campo) {
  const def = IA_KEYS_DEF[campo];
  if (!def) return null;

  // 1. Variable de entorno (prioridad máxima)
  const envVal = process.env[def.env];
  if (envVal && envVal.trim() && !IA_KEYS_PLACEHOLDER.test(envVal.trim())) {
    return envVal.trim();
  }

  // 2. bot_config.json (guardada desde el panel "API")
  try {
    const cfg = await leerIAConfig();
    const v = cfg && cfg[campo];
    if (typeof v === 'string' && v.trim() && !IA_KEYS_PLACEHOLDER.test(v.trim())) {
      return v.trim();
    }
  } catch (e) { }

  return null;
}

function enmascararClaveIA(clave) {
  if (!clave) return null;
  const s = String(clave);
  if (s.length <= 8) return '••••••';
  return s.slice(0, 4) + '…' + s.slice(-4);
}

// Traduce errores de autenticación de Gemini a mensajes accionables.
// Contexto: Google está migrando las claves AIzaSy… (estándar) a las AQ.…
// (claves de autorización ligadas a service account) y muchas claves AQ. nuevas
// devuelven 401 ACCESS_TOKEN_TYPE_UNSUPPORTED por un problema del rollout de Google.
function mensajeErrorGemini(detalle) {
  const s = String(detalle || '');
  if (/ACCESS_TOKEN_TYPE_UNSUPPORTED|UNAUTHENTICATED/i.test(s)) {
    return 'Google rechazó esta clave (401 ACCESS_TOKEN_TYPE_UNSUPPORTED): las claves nuevas "AQ.…" que genera Google AI Studio están siendo rechazadas por la API de Gemini en muchas cuentas (problema conocido del rollout de claves de autorización de Google). Solución: creá una clave clásica "AIzaSy…" en Google Cloud Console → APIs y servicios → Credenciales → Crear credenciales → Clave de API, y restringila a "Generative Language API" (las claves AIzaSy con restricción siguen funcionando).';
  }
  if (/API key expired|key expired|vencida/i.test(s)) {
    return 'Google indica que la clave está vencida (API key expired). Generá una clave nueva: aistudio.google.com/apikey (si te da una "AQ.…" y sigue fallando, usá Google Cloud Console para crear una "AIzaSy…" con restricción a Generative Language API).';
  }
  if (/API key not valid|INVALID_ARGUMENT|API_KEY_INVALID|invalid api key/i.test(s)) {
    return 'Google indica que la clave no es válida. Revisá que la hayas copiado completa (formato "AIzaSy…" o "AQ.…", sin espacios ni saltos de línea).';
  }
  return null;
}

async function getGroqApiKey() { return getClaveIA('groqApiKey'); }
async function getFireworksApiKey() { return getClaveIA('fireworksApiKey'); }
async function getGeminiApiKey() { return getClaveIA('geminiApiKey'); }

// ---- Endpoints del apartado "API" (vectorizador) ----

// Estado (enmascarado) de las claves configuradas
app.get('/api/config/ai-keys', verifyToken, requireRole(['admin', 'vendedor', 'superadmin']), async (req, res) => {
  try {
    const claves = {};
    for (const campo of Object.keys(IA_KEYS_DEF)) {
      const clave = await getClaveIA(campo);
      claves[campo] = {
        etiqueta: IA_KEYS_DEF[campo].etiqueta,
        descripcion: IA_KEYS_DEF[campo].descripcion,
        formato: IA_KEYS_DEF[campo].formato,
        hint: IA_KEYS_DEF[campo].hint,
        configurada: !!clave,
        enmascarada: enmascararClaveIA(clave)
      };
    }
    res.json({ success: true, claves });
  } catch (error) {
    logger.error('Error leyendo estado de claves IA:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Guardar una o varias claves (vacío = borrar)
app.post('/api/config/ai-keys', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const body = req.body || {};
    const entradas = body.claves || {};
    // soporta también { campo: 'geminiApiKey', valor: '...' }
    if (body.campo && IA_KEYS_DEF[body.campo]) entradas[body.campo] = body.valor ?? '';

    const campos = Object.keys(entradas).filter(c => IA_KEYS_DEF[c]);
    if (!campos.length) {
      return res.status(400).json({ error: 'No se indicó ninguna clave válida.' });
    }

    const cfg = await leerIAConfig();
    let cambios = 0;
    for (const campo of campos) {
      const valor = String(entradas[campo] ?? '').trim();
      if (valor === '') {
        if (Object.prototype.hasOwnProperty.call(cfg, campo)) { delete cfg[campo]; cambios++; }
      } else {
        if (cfg[campo] !== valor) { cfg[campo] = valor; cambios++; }
      }
    }

    if (cambios > 0) {
      const ok = await writeJSON(IA_CONFIG_FILE, cfg);
      if (!ok) return res.status(500).json({ error: 'No se pudo guardar el archivo de configuración.' });
      logger.info('Claves IA actualizadas desde el panel (cantidad de campos: ' + campos.length + ')');
    }

    const claves = {};
    for (const campo of Object.keys(IA_KEYS_DEF)) {
      const clave = await getClaveIA(campo);
      claves[campo] = {
        etiqueta: IA_KEYS_DEF[campo].etiqueta,
        descripcion: IA_KEYS_DEF[campo].descripcion,
        formato: IA_KEYS_DEF[campo].formato,
        hint: IA_KEYS_DEF[campo].hint,
        configurada: !!clave,
        enmascarada: enmascararClaveIA(clave)
      };
    }
    res.json({ success: true, mensaje: 'Claves guardadas correctamente.', claves });
  } catch (error) {
    logger.error('Error guardando claves IA:', error.stack || error.message);
    res.status(500).json({ error: 'Error guardando las claves: ' + error.message });
  }
});

// Probar una clave contra el proveedor (sin exponerla)
app.post('/api/config/ai-keys/test', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { campo, valor } = req.body || {};
    if (!IA_KEYS_DEF[campo]) {
      return res.status(400).json({ error: 'Proveedor desconocido.' });
    }
    const clave = (typeof valor === 'string' && valor.trim()) ? valor.trim() : await getClaveIA(campo);
    if (!clave) {
      return res.status(400).json({ error: 'No hay clave guardada para probar. Guardá una primero.' });
    }

    const probar = async (url, headers) => {
      try {
        const r = await axios.get(url, { headers, timeout: 20000, validateStatus: s => s < 500 });
        if (r.status === 200 || r.status === 201) {
          return { ok: true, mensaje: '✅ Conexión correcta (HTTP ' + r.status + '). La clave es válida.', detalle: '' };
        }
        let detalle = '';
        const d = r.data;
        if (d && d.error) {
          detalle = (d.error && d.error.message) || (typeof d.error === 'string' ? d.error : JSON.stringify(d.error));
        }
        return {
          ok: false,
          detalle,
          mensaje: '❌ El proveedor rechazó la clave (HTTP ' + r.status + ')' + (detalle ? ': ' + String(detalle).slice(0, 300) : '')
        };
      } catch (e) {
        return { ok: false, detalle: e.message || '', mensaje: '❌ Error de conexión: ' + (e.message || 'desconocido') };
      }
    };

    let resultado;
    if (campo === 'geminiApiKey') {
      resultado = await probar('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(clave),
        { 'x-goog-api-key': clave });
      // Si es el error conocido de las claves AQ.… nuevas, explicar la causa y la solución
      if (!resultado.ok) {
        const sugerencia = mensajeErrorGemini(resultado.detalle);
        if (sugerencia) resultado.mensaje = sugerencia;
      }
    } else if (campo === 'groqApiKey') {
      resultado = await probar('https://api.groq.com/openai/v1/models', { Authorization: 'Bearer ' + clave });
    } else if (campo === 'fireworksApiKey') {
      resultado = await probar('https://api.fireworks.ai/inference/v1/models', { Authorization: 'Bearer ' + clave });
    } else if (campo === 'removebgApiKey') {
      resultado = await probar('https://api.remove.bg/v1.0/account', { 'X-Api-Key': clave });
    } else {
      return res.status(400).json({ error: 'Proveedor no soportado para prueba.' });
    }
    res.json(resultado);
  } catch (error) {
    logger.error('Error probando clave IA:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== MÓDULO SECRETARÍA IA (SEGUIMIENTO WHATSAPP) ====================
const SecretariaIAService = require('./secretaria_ia');
const secretariaService = new SecretariaIAService(getGeminiApiKey, getGroqApiKey);

// Obtener leads y notas de seguimiento
app.get('/api/secretaria/leads', verifyToken, async (req, res) => {
  try {
    const data = await secretariaService.getLeadsSecretaria();
    res.json({ success: true, ...data });
  } catch (error) {
    logger.error('Error obteniendo leads de secretaría:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Forzar re-análisis con IA de las conversaciones
app.post('/api/secretaria/analizar', verifyToken, async (req, res) => {
  try {
    const forzar = req.body && req.body.forzar === true;
    const resultado = await secretariaService.actualizarSecretaria(forzar);
    res.json(resultado);
  } catch (error) {
    logger.error('Error en análisis de secretaría IA:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Agregar nota manual a un lead
app.post('/api/secretaria/nota', verifyToken, async (req, res) => {
  try {
    const { numero, nota } = req.body || {};
    if (!numero || !nota) {
      return res.status(400).json({ error: 'Número y nota requeridos.' });
    }
    const autor = req.user ? (req.user.nombre || req.user.usuario) : 'Operador';
    const actualizado = await secretariaService.agregarNotaManual(numero, nota, autor);
    res.json({ success: true, lead: actualizado });
  } catch (error) {
    logger.error('Error agregando nota manual:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Cambiar estado manual del lead (cerrado, descartado, contactado, etc.)
app.post('/api/secretaria/estado', verifyToken, async (req, res) => {
  try {
    const { numero, estado } = req.body || {};
    if (!numero || !estado) {
      return res.status(400).json({ error: 'Número y estado requeridos.' });
    }
    const actualizado = await secretariaService.cambiarEstado(numero, estado);
    res.json({ success: true, lead: actualizado });
  } catch (error) {
    logger.error('Error cambiando estado de secretaría:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Inicializar análisis en segundo plano (arranca 10s después del server y luego cada 15 min)
setTimeout(() => {
  secretariaService.actualizarSecretaria(false).catch(err => {
    logger.warn('[Secretaria IA] Error en escaneo inicial:', err.message);
  });
}, 10000);
setInterval(() => {
  secretariaService.actualizarSecretaria(false).catch(err => {
    logger.warn('[Secretaria IA] Error en escaneo periódico:', err.message);
  });
}, 15 * 60 * 1000);

// 1. Análisis de imagen con Groq (Llama Vision)
async function analizarImagenConGroq(imagePath, prompt) {
  const apiKey = await getGroqApiKey();
  if (!apiKey) throw new Error("API Key de Groq no configurada");

  const groq = new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey });

  const imgBuffer = await fs.readFile(imagePath);
  const base64Image = imgBuffer.toString('base64');

  const completion = await groq.chat.completions.create({
    model: 'llama-3.2-11b-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 1024
  });

  return JSON.parse(completion.choices[0].message.content);
}

// Análisis de imagen con Ollama (local)
async function analizarImagenConOllama(imagePath, prompt) {
  // Ollama corre localmente, no necesita API key.
  // Se asume que está en el puerto por defecto 11434.
  const ollama = new OpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' });

  const imgBuffer = await fs.readFile(imagePath);
  let base64Image;
  const stats = await fs.stat(imagePath);

  // Reducir si es muy grande para la API
  if (stats.size > 3.5 * 1024 * 1024) {
    const reducida = await sharp(imagePath)
      .resize({ width: 1500, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    base64Image = reducida.toString('base64');
  } else {
    base64Image = imgBuffer.toString('base64');
  }

  const completion = await ollama.chat.completions.create({
    model: 'llava:13b', // Modelo recomendado
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 1024
  });

  return JSON.parse(completion.choices[0].message.content);
}


// 1. Análisis de imagen con Fireworks.ai
async function analizarImagenConFireworks(imagePath, promptText) {
  const apiKey = await getFireworksApiKey();
  if (!apiKey) throw new Error("API Key de Fireworks.ai no configurada");

  const fireworks = new OpenAI({ baseURL: 'https://api.fireworks.ai/inference/v1', apiKey });

  const imgBuffer = await fs.readFile(imagePath);
  let base64Image;
  const stats = await fs.stat(imagePath);

  // Reducir si es muy grande para la API
  if (stats.size > 3.5 * 1024 * 1024) {
    const reducida = await sharp(imagePath)
      .resize({ width: 1500, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    base64Image = reducida.toString('base64');
  } else {
    base64Image = imgBuffer.toString('base64');
  }

  const prompt = promptText || `Sos un experto en vectorización. Analizá esta imagen y devolvé JSON:
{
  "tipo_imagen": "logo | foto | icono | texto | ilustracion",
  "descripcion_breve": "descripción corta",
  "colores_dominantes": número,
  "tiene_fondo_blanco": true/false,
  "tiene_texto": true/false,
  "complejidad": "simple | media | compleja",
  "remover_fondo_antes": true/false,
  "necesita_upscale": true/false,
  "params_vtracer": {
    "colormode": "color | binary",
    "hierarchical": "stacked | cutout",
    "mode": "spline | polygon",
    "filter_speckle": 2-10,
    "color_precision": 4-8,
    "layer_difference": 8-32,
    "corner_threshold": 30-90,
    "length_threshold": 3.5-8.0
  },
  "justificacion": "motivo breve"
}`;

  const completion = await fireworks.chat.completions.create({
    model: 'accounts/fireworks/models/llama-v3p2-90b-vision-instruct',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 1024
  });

  return JSON.parse(completion.choices[0].message.content);
}

// 1.b Análisis de imagen con Google Gemini (Respaldo)
async function analizarImagenConGemini(imagePath) {
  if (!GoogleGenerativeAI) throw new Error("La librería @google/generative-ai no está instalada. Ejecuta: npm install @google/generative-ai");

  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error("API Key de Gemini no configurada. Agrega GEMINI_API_KEY en variables de entorno o bot_config.json");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  const imgBuffer = await fs.readFile(imagePath);

  const prompt = `Sos un experto en vectorización. Analizá esta imagen y devolvé JSON:
{
  "tipo_imagen": "logo | foto | icono | texto | ilustracion",
  "descripcion_breve": "descripción corta",
  "colores_dominantes": número,
  "tiene_fondo_blanco": true/false,
  "tiene_texto": true/false,
  "complejidad": "simple | media | compleja",
  "remover_fondo_antes": true/false,
  "necesita_upscale": true/false,
  "params_vtracer": {
    "colormode": "color | binary",
    "hierarchical": "stacked | cutout",
    "mode": "spline | polygon",
    "filter_speckle": 2-10,
    "color_precision": 4-8,
    "layer_difference": 8-32,
    "corner_threshold": 30-90,
    "length_threshold": 3.5-8.0
  },
  "justificacion": "motivo breve"
}`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: imgBuffer.toString("base64"), mimeType: "image/jpeg" } }
  ]);

  return JSON.parse(result.response.text());
}

// 2. Pre-procesamiento con Sharp
async function preprocesarImagen(imagePath, analisis, improveResolution = false, targetWidth = 2000) {
  const outputPath = imagePath + '_processed.png';
  let pipeline = sharp(imagePath);

  if (improveResolution) {
    pipeline = pipeline.resize({ width: targetWidth, withoutEnlargement: false, kernel: sharp.kernel.lanczos3 });
  } else if (analisis.necesita_upscale) {
    pipeline = pipeline.resize({ width: 2000, withoutEnlargement: false, kernel: sharp.kernel.lanczos3 });
  }

  if (analisis.remover_fondo_antes && analisis.tiene_fondo_blanco) {
    if (analisis.params_vtracer && analisis.params_vtracer.colormode === 'binary') {
      pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } }).threshold(240);
    } else {
      pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });
    }
  }

  if (analisis.tiene_texto) {
    pipeline = pipeline.sharpen({ sigma: 1.5, m1: 0.5, m2: 3 });
  }

  await pipeline.png({ compressionLevel: 1 }).toFile(outputPath);
  return outputPath;
}

// 3. Vectorización con VTracer
async function vectorizarConVTracer(imagePngPath, params, outputSvgPath, onSpawn) {
  return new Promise((resolve, reject) => {
    const paramsJson = JSON.stringify(params);
    const scriptPath = path.join(BASE_PATH, 'vectorize.py');

    const proceso = spawn(pythonCmd, [
      scriptPath,
      '--input', imagePngPath,
      '--output', outputSvgPath,
      '--params', paramsJson
    ]);

    if (typeof onSpawn === 'function') onSpawn(proceso);

    let stderr = '';
    proceso.stderr.on('data', d => stderr += d.toString());

    proceso.on('error', (err) => {
      reject(new Error(`Fallo al iniciar VTracer: ${err.message}`));
    });

    proceso.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`VTracer falló: ${stderr}`));
      } else {
        resolve(outputSvgPath);
      }
    });
  });
}

// 3b. Vectorización con StarVector
async function vectorizarConStarVector(imagePngPath, outputSvgPath, onSpawn) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(BASE_PATH, 'vectorize_starvector.py');

    const proceso = spawn(pythonCmd, [
      scriptPath,
      '--input', imagePngPath,
      '--output', outputSvgPath
    ]);

    if (typeof onSpawn === 'function') onSpawn(proceso);

    let stderr = '';
    proceso.stderr.on('data', d => stderr += d.toString());

    proceso.on('error', (err) => {
      reject(new Error(`Fallo al iniciar StarVector: ${err.message}`));
    });

    proceso.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`StarVector falló: ${stderr}`));
      } else {
        resolve(outputSvgPath);
      }
    });
  });
}

// Endpoint: Vectorizar
app.post('/api/vectorizar', verifyToken, upload.single('imagen'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });

  const imagePath = req.file.path;
  const jobId = Date.now().toString();
  const svgFilename = `${jobId}.svg`;
  const svgPath = path.join(UPLOADS_OUTPUT_DIR, svgFilename);
  const method = req.body.method || 'vtracer';
  const improveResolution = req.body.improve_resolution === 'true' || req.body.improve_resolution === true;
  const targetWidth = parseInt(req.body.target_width) || 2000;

  const vectorizerPrompt = `Sos un experto en vectorización. Analizá esta imagen y devolvé JSON:
{
  "tipo_imagen": "logo | foto | icono | texto | ilustracion",
  "descripcion_breve": "descripción corta",
  "colores_dominantes": número,
  "tiene_fondo_blanco": true/false,
  "tiene_texto": true/false,
  "complejidad": "simple | media | compleja",
  "remover_fondo_antes": true/false,
  "necesita_upscale": true/false,
  "params_vtracer": {
    "colormode": "color | binary",
    "hierarchical": "stacked | cutout",
    "mode": "spline | polygon",
    "filter_speckle": 2-10,
    "color_precision": 4-8,
    "layer_difference": 8-32,
    "corner_threshold": 30-90,
    "length_threshold": 3.5-8.0
  },
  "justificacion": "motivo breve"
}`;

  let childProcess = null;

  // Matar el proceso de python si el cliente cancela la petición
  req.on('close', () => {
    if (childProcess) {
      logger.info(`[VECTORIZADOR] Petición cancelada por el usuario. Terminando proceso Python de vectorización...`);
      try {
        childProcess.kill('SIGKILL');
      } catch (err) {
        logger.error(`Error matando proceso de vectorización: ${err.message}`);
      }
    }
  });

  try {
    logger.info(`[VECTORIZADOR] Iniciando trabajo ${jobId} usando método ${method}`, { file: req.file.originalname });

    // Usar Groq (Llama Vision) como primera opción, con fallbacks
    let analisis;
    const defaultAnalisis = {
      tipo_imagen: 'logo',
      descripcion_breve: 'Imagen subida para vectorización',
      colores_dominantes: 4,
      tiene_fondo_blanco: false,
      tiene_texto: false,
      complejidad: 'media',
      remover_fondo_antes: false,
      necesita_upscale: false,
      params_vtracer: {
        colormode: 'color',
        hierarchical: 'stacked',
        mode: 'spline',
        filter_speckle: 4,
        color_precision: 6,
        layer_difference: 16,
        corner_threshold: 60,
        length_threshold: 4.0
      },
      justificacion: 'Análisis estándar por defecto'
    };

    try {
      analisis = await analizarImagenConGroq(imagePath, vectorizerPrompt);
      logger.info(`[VECTORIZADOR] Análisis completado con Groq`);
    } catch (groqError) {
      logger.warn(`[VECTORIZADOR] Falló Groq (${groqError.message}), intentando con Gemini...`);
      try {
        analisis = await analizarImagenConGemini(imagePath);
        logger.info(`[VECTORIZADOR] Análisis completado con Gemini`);
      } catch (geminiError) {
        logger.warn(`[VECTORIZADOR] Falló Gemini (${geminiError.message}), intentando con Fireworks.ai...`);
        try {
          analisis = await analizarImagenConFireworks(imagePath, vectorizerPrompt);
          logger.info(`[VECTORIZADOR] Análisis completado con Fireworks.ai`);
        } catch (fwError) {
          logger.warn(`[VECTORIZADOR] Falló Fireworks (${fwError.message}). Usando análisis por defecto...`);
          analisis = defaultAnalisis;
        }
      }
    }

    const imgProcesada = await preprocesarImagen(imagePath, analisis, improveResolution, targetWidth);

    if (method === 'starvector') {
      logger.info(`[VECTORIZADOR] Procesando con StarVector...`);
      await vectorizarConStarVector(imgProcesada, svgPath, (proc) => childProcess = proc);
    } else {
      logger.info(`[VECTORIZADOR] Procesando con VTracer...`);
      await vectorizarConVTracer(imgProcesada, analisis.params_vtracer, svgPath, (proc) => childProcess = proc);
    }

    // Limpieza temporales
    await fs.unlink(imagePath).catch(() => { });
    await fs.unlink(imgProcesada).catch(() => { });

    res.json({
      success: true,
      job_id: jobId,
      svg_url: `/uploads/output/${svgFilename}`,
      analisis: {
        tipo: analisis.tipo_imagen,
        descripcion: analisis.descripcion_breve,
        colores: analisis.colores_dominantes,
        complejidad: analisis.complejidad,
        justificacion: analisis.justificacion
      }
    });

  } catch (error) {
    logger.error('[VECTORIZADOR] Error', { error: error.message });
    await fs.unlink(imagePath).catch(() => { });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: AI - Quitar Fondo
app.post('/api/ai/remove-bg', verifyToken, upload.single('imagen'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });

  const inputPath = req.file.path;
  const jobId = Date.now().toString();
  const outputFilename = `nobg_${jobId}.png`;
  const outputPath = path.join(UPLOADS_OUTPUT_DIR, outputFilename);

  let childProcess = null;
  req.on('close', () => {
    if (childProcess) {
      logger.info(`[IMAGE-PROCESSOR] Petición cancelada por el usuario. Matando proceso de quitar fondo...`);
      try { childProcess.kill('SIGKILL'); } catch (e) { }
    }
  });

  try {
    const removebgKey = process.env.REMOVEBG_API_KEY || (await leerIAConfig()).removebgApiKey || null;
    const groqKey = await getGroqApiKey();

    logger.info(`[IMAGE-PROCESSOR] Iniciando quitar fondo para ${jobId}`);

    await new Promise((resolve, reject) => {
      const scriptPath = path.join(BASE_PATH, 'image_processor.py');
      const args = [
        scriptPath,
        '--action', 'remove_bg',
        '--input', inputPath,
        '--output', outputPath
      ];

      if (removebgKey) {
        args.push('--removebg_key', removebgKey);
      }
      if (groqKey) {
        args.push('--groq_key', groqKey);
      }

      const proceso = spawn(pythonCmd, args);
      childProcess = proceso;

      let stderr = '';
      proceso.stderr.on('data', d => stderr += d.toString());

      proceso.on('error', (err) => {
        logger.error(`[IMAGE-PROCESSOR] Error inicializando proceso Python: ${err.message}`);
        reject(new Error(`Fallo al iniciar Python: ${err.message}`));
      });

      proceso.on('close', (code) => {
        if (code !== 0) {
          logger.error(`[IMAGE-PROCESSOR] Python devolvió error (code ${code}): ${stderr}`);
          reject(new Error(`Error en Python: ${stderr}`));
        } else {
          logger.info(`[IMAGE-PROCESSOR] Fondo quitado exitosamente para ${jobId}`);
          resolve();
        }
      });
    });

    // Limpiar temporal
    await fs.unlink(inputPath).catch(() => { });

    res.json({
      success: true,
      job_id: jobId,
      url: `/uploads/output/${outputFilename}`,
      message: 'Fondo quitado exitosamente'
    });
  } catch (error) {
    logger.error('[IMAGE-PROCESSOR] Error quitando fondo', { error: error.message });
    await fs.unlink(inputPath).catch(() => { });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: AI - Aumentar Resolución (Upscale)
app.post('/api/ai/upscale', verifyToken, upload.single('imagen'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });

  const inputPath = req.file.path;
  const jobId = Date.now().toString();
  const outputFilename = `upscale_${jobId}.png`;
  const outputPath = path.join(UPLOADS_OUTPUT_DIR, outputFilename);
  const factor = req.body.factor || 2.0;
  const method = req.body.method || 'standard';

  let childProcess = null;
  req.on('close', () => {
    if (childProcess) {
      logger.info(`[IMAGE-PROCESSOR] Petición cancelada por el usuario. Matando proceso de aumento de resolución...`);
      try { childProcess.kill('SIGKILL'); } catch (e) { }
    }
  });

  try {
    logger.info(`[IMAGE-PROCESSOR] Aumentando resolución: ${jobId} (factor ${factor}, modo ${method})`);

    const groqKey = await getGroqApiKey();

    await new Promise((resolve, reject) => {
      const scriptPath = path.join(BASE_PATH, 'image_processor.py');
      const args = [
        scriptPath,
        '--action', 'upscale',
        '--input', inputPath,
        '--output', outputPath,
        '--factor', factor.toString(),
        '--method', method
      ];

      if (groqKey) {
        args.push('--groq_key', groqKey);
      }

      const proceso = spawn(pythonCmd, args);
      childProcess = proceso;

      let stderr = '';
      proceso.stderr.on('data', d => stderr += d.toString());

      proceso.on('error', (err) => {
        logger.error(`[IMAGE-PROCESSOR] Error inicializando proceso Python (upscale): ${err.message}`);
        reject(new Error(`Fallo al iniciar Python: ${err.message}`));
      });

      proceso.on('close', (code) => {
        if (code !== 0) {
          logger.error(`[IMAGE-PROCESSOR] Python (upscale) devolvió error (code ${code}): ${stderr}`);
          reject(new Error(`Error en Python: ${stderr}`));
        } else {
          logger.info(`[IMAGE-PROCESSOR] Upscale completado para ${jobId}`);
          resolve();
        }
      });
    });

    // Limpiar temporal
    await fs.unlink(inputPath).catch(() => { });

    res.json({
      success: true,
      job_id: jobId,
      url: `/uploads/output/${outputFilename}`,
      message: 'Resolución aumentada exitosamente'
    });
  } catch (error) {
    logger.error('[IMAGE-PROCESSOR] Error escalando imagen', { error: error.message });
    await fs.unlink(inputPath).catch(() => { });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: AI - Despixelar / Restaurar Imagen
app.post('/api/ai/depixel', verifyToken, upload.single('imagen'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });

  const inputPath = req.file.path;
  const jobId = Date.now().toString();
  const outputFilename = `depixel_${jobId}.png`;
  const outputPath = path.join(UPLOADS_OUTPUT_DIR, outputFilename);

  let childProcess = null;
  req.on('close', () => {
    if (childProcess) {
      logger.info(`[IMAGE-PROCESSOR] Petición cancelada por el usuario. Matando proceso de despixelado...`);
      try { childProcess.kill('SIGKILL'); } catch (e) { }
    }
  });

  try {
    logger.info(`[IMAGE-PROCESSOR] Despixelando imagen: ${jobId}`);

    await new Promise((resolve, reject) => {
      const scriptPath = path.join(BASE_PATH, 'image_processor.py');
      const args = [
        scriptPath,
        '--action', 'depixel',
        '--input', inputPath,
        '--output', outputPath
      ];

      const proceso = spawn(pythonCmd, args);
      childProcess = proceso;

      let stderr = '';
      proceso.stderr.on('data', d => stderr += d.toString());

      proceso.on('error', (err) => {
        logger.error(`[IMAGE-PROCESSOR] Error inicializando proceso Python (depixel): ${err.message}`);
        reject(new Error(`Fallo al iniciar Python: ${err.message}`));
      });

      proceso.on('close', (code) => {
        if (code !== 0) {
          logger.error(`[IMAGE-PROCESSOR] Python (depixel) devolvió error (code ${code}): ${stderr}`);
          reject(new Error(`Error en Python: ${stderr}`));
        } else {
          logger.info(`[IMAGE-PROCESSOR] Depixel completado para ${jobId}`);
          resolve();
        }
      });
    });

    // Limpiar temporal
    await fs.unlink(inputPath).catch(() => { });

    res.json({
      success: true,
      job_id: jobId,
      url: `/uploads/output/${outputFilename}`,
      message: 'Imagen restaurada exitosamente'
    });
  } catch (error) {
    logger.error('[IMAGE-PROCESSOR] Error al despixelar imagen', { error: error.message });
    await fs.unlink(inputPath).catch(() => { });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GENERACIÓN DE IMÁGENES CON GEMINI (para vectorizar) ====================
// Crea una imagen "lista para vectorizar" a partir de un prompt (usada por la pestaña
// "Crear con IA" del vectorizador). Devuelve la imagen en base64 (data URL).
app.post('/api/ai/generar-imagen', verifyToken, requireRole(['admin', 'vendedor', 'superadmin']), async (req, res) => {
  try {
    const prompt = String((req.body && req.body.prompt) || '').trim();
    if (!prompt) {
      return res.status(400).json({ error: 'Falta el prompt de la imagen' });
    }

    const apiKey = await getGeminiApiKey();
    if (!apiKey || !GoogleGenerativeAI) {
      return res.status(500).json({ error: 'Gemini no está configurado (GEMINI_API_KEY).' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Modelos con salida de imagen (en orden de preferencia)
    const modelos = ['gemini-2.5-flash-image', 'gemini-2.0-flash-preview-image-generation'];
    let ultimoError = null;

    for (const modelo of modelos) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelo,
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        });
        const result = await model.generateContent(prompt);
        const parts = result.response.candidates && result.response.candidates[0] &&
          result.response.candidates[0].content && result.response.candidates[0].content.parts
          ? result.response.candidates[0].content.parts : [];

        const imgPart = parts.find(p => p && p.inlineData && p.inlineData.data && /^image\//.test(p.inlineData.mimeType || ''));
        if (imgPart && imgPart.inlineData.data) {
          logger.info(`🎨 Imagen generada con Gemini (${modelo}), prompt: "${prompt.substring(0, 60)}..."`);
          return res.json({
            success: true,
            modelo,
            mimeType: imgPart.inlineData.mimeType,
            dataUrl: `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`
          });
        }
        const txt = parts.filter(p => p && p.text).map(p => p.text).join(' ').trim();
        if (!imgPart && !txt) ultimoError = new Error(`Modelo ${modelo} no devolvió imagen ni texto`);
        else if (!imgPart) ultimoError = new Error(`Modelo ${modelo} no devolvió imagen (respuesta: ${txt.substring(0, 120)})`);
      } catch (e) {
        ultimoError = e;
        logger.warn(`⚠️ Modelo ${modelo} falló para generar imagen: ${e.message}`);
      }
    }

    logger.error('No se pudo generar imagen con Gemini', { error: ultimoError && ultimoError.message });
    let msgFinal = 'No se pudo generar la imagen con la IA: ' + (ultimoError ? ultimoError.message : 'error desconocido');
    // Si el error es el conocido de las claves AQ.… (nuevo formato de Google), dar la explicación
    const sugerencia = mensajeErrorGemini(ultimoError ? (ultimoError.message + ' ' + (ultimoError.details || '')) : '');
    if (sugerencia) msgFinal = sugerencia;
    return res.status(500).json({ error: msgFinal });
  } catch (error) {
    logger.error('Error generando imagen con Gemini', { error: error.stack });
    res.status(500).json({ error: 'Error interno al generar la imagen' });
  }
});


// Proxy para que el frontend pueda usar Groq Vision de forma segura
app.post('/api/ai/groq-vision', verifyToken, async (req, res) => {
  try {
    const { image_base64, prompt } = req.body;
    if (!image_base64 || !prompt) {
      return res.status(400).json({ error: 'Faltan datos (image_base64, prompt)' });
    }

    const apiKey = await getGroqApiKey();
    if (!apiKey) return res.status(500).json({ error: 'API Key de Groq no configurada' });

    const groq = new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1024
    });

    res.json(JSON.parse(completion.choices[0].message.content));

  } catch (error) {
    logger.error('Error en proxy de Groq Vision', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Guardar en Cliente (soporta SVG y PNG de upscale/depixel/nobg)
app.post('/api/vectorizar/guardar', verifyToken, async (req, res) => {
  try {
    const { jobId, clientId, nombreArchivo } = req.body;
    if (!jobId || !clientId) return res.status(400).json({ error: 'Faltan datos (jobId, clientId)' });

    // Sanitizar para evitar path traversal (jobId es numérico; clientId es alfanumérico)
    if (!/^\d+$/.test(String(jobId))) return res.status(400).json({ error: 'jobId inválido' });
    if (!/^[\w-]+$/.test(String(clientId))) return res.status(400).json({ error: 'clientId inválido' });

    let sourceFile = path.join(UPLOADS_OUTPUT_DIR, `${jobId}.svg`);
    let detectedExt = 'svg';

    try {
      await fs.access(sourceFile);
    } catch {
      // Intentar variantes de imagen PNG
      const pngCandidates = [
        { name: `upscale_${jobId}.png`, ext: 'png' },
        { name: `depixel_${jobId}.png`, ext: 'png' },
        { name: `nobg_${jobId}.png`, ext: 'png' },
        { name: `${jobId}.png`, ext: 'png' }
      ];
      let found = false;
      for (const cand of pngCandidates) {
        const p = path.join(UPLOADS_OUTPUT_DIR, cand.name);
        try {
          await fs.access(p);
          sourceFile = p;
          detectedExt = cand.ext;
          found = true;
          break;
        } catch { }
      }
      if (!found) {
        return res.status(404).json({ error: 'El archivo procesado ha expirado o no existe.' });
      }
    }

    // Crear carpeta del cliente si no existe
    const clientDir = path.join(UPLOADS_CLIENTS_DIR, clientId);
    await fs.mkdir(clientDir, { recursive: true });

    // Definir nombre final
    let finalName = nombreArchivo || `procesado_${jobId}`;
    finalName = finalName.replace(/[^a-z0-9\.\-_ ]/gi, '_').trim(); // Sanitizar
    if (!finalName.toLowerCase().endsWith('.' + detectedExt)) {
      finalName += '.' + detectedExt;
    }

    const destFile = path.join(clientDir, finalName);

    // Copiar archivo
    await fs.copyFile(sourceFile, destFile);

    logger.info(`[GUARDAR-CLIENTE] Archivo guardado en cliente ${clientId}: ${finalName}`);

    res.json({
      success: true,
      path: `/uploads/clientes/${clientId}/${finalName}`,
      message: 'Archivo guardado correctamente en la carpeta del cliente.'
    });

  } catch (e) {
    logger.error('Error guardando archivo en cliente', e);
    res.status(500).json({ error: e.message });
  }
});

// ==================== UTILIDADES PDF ====================

app.post('/api/utils/read-pdf', verifyToken, upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

  try {
    const pdf = require('pdf-parse');
    const dataBuffer = await fs.readFile(req.file.path);
    const data = await pdf(dataBuffer);

    // Limpiar archivo temporal
    await fs.unlink(req.file.path).catch(() => { });

    res.json({
      success: true,
      text: data.text,
      info: { pages: data.numpages, info: data.info }
    });
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => { }); // Limpiar
    logger.error('Error leyendo PDF', { error: error.message });
    res.status(500).json({ error: 'Error al procesar PDF. Asegúrate de tener instalado pdf-parse (npm install pdf-parse).' });
  }
});

app.post('/api/utils/read-image', verifyToken, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });

  try {
    if (!GoogleGenerativeAI) throw new Error("La librería @google/generative-ai no está instalada.");

    const apiKey = await getGeminiApiKey();
    if (!apiKey) throw new Error("API Key de Gemini no configurada.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const imgBuffer = await fs.readFile(req.file.path);
    const mimeType = req.file.mimetype;

    const prompt = `Analiza esta imagen detalladamente.
    
    IMPORTANTE:
    Si detectas que es un COMPROBANTE DE PAGO, TRANSFERENCIA o DEPÓSITO:
    1. Comienza tu respuesta con la frase exacta: "DETECTADO_COMPROBANTE_PAGO".
    2. Extrae el MONTO TOTAL (ej: $10.500).
    3. Extrae la FECHA y HORA.
    4. Busca nombres de personas o empresas (Origen/Destino) y número de operación.
    
    Si NO es un comprobante de pago, simplemente describe la imagen y transcribe el texto visible.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imgBuffer.toString("base64"), mimeType: mimeType } }
    ]);

    // Limpiar archivo temporal
    await fs.unlink(req.file.path).catch(() => { });

    res.json({ success: true, text: result.response.text() });

  } catch (error) {
    await fs.unlink(req.file.path).catch(() => { }); // Limpiar
    logger.error('Error leyendo imagen', { error: error.message });
    res.status(500).json({ error: 'Error al procesar la imagen: ' + error.message });
  }
});

// ==================== LED LIBRARY ENDPOINTS ====================

app.get('/api/led-library', verifyToken, async (req, res) => {
  try {
    // Ensure file exists
    try { await fs.access(FILES.led_library); } catch { await writeJSON(FILES.led_library, []); }

    const lib = await readJSON(FILES.led_library);
    // Return metadata only (exclude heavy canvasJSON)
    const meta = lib.map(({ canvasJSON, ...rest }) => rest);
    res.json(meta);
  } catch (error) {
    logger.error('Error reading LED library', { error: error.message });
    res.status(500).json({ error: 'Error reading library' });
  }
});

app.get('/api/led-library/:id', verifyToken, async (req, res) => {
  try {
    const lib = await readJSON(FILES.led_library);
    const entry = lib.find(e => e.id === req.params.id);
    if (entry) res.json(entry);
    else res.status(404).json({ error: 'Entry not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/led-library', verifyToken, async (req, res) => {
  try {
    let lib = [];
    try { lib = await readJSON(FILES.led_library); } catch { lib = []; }

    const entry = {
      id: 'lib_' + Date.now(),
      fechaGuardado: new Date().toISOString(),
      ...req.body
    };
    lib.push(entry);
    await writeJSON(FILES.led_library, lib);
    res.json({ ok: true, id: entry.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/led-library/:id', verifyToken, async (req, res) => {
  try {
    let lib = await readJSON(FILES.led_library);
    lib = lib.filter(e => e.id !== req.params.id);
    await writeJSON(FILES.led_library, lib);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ENDPOINT PARA PROCESADO DE ARCHIVOS CON PYTHON ====================

app.post('/api/process-file', verifyToken, (req, res) => {
  const scriptPath = path.join(BASE_PATH, 'file_processor.py');
  const pythonProcess = spawn(pythonCmd, [scriptPath]);

  let resultData = '';
  let errorData = '';

  pythonProcess.stdout.on('data', (data) => {
    resultData += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    errorData += data.toString();
  });

  pythonProcess.on('error', (err) => {
    logger.error('Error iniciando Python (file_processor.py)', { error: err.message });
    res.status(500).json({ error: 'Fallo al iniciar el procesador: ' + err.message });
  });

  pythonProcess.on('close', (code) => {
    // Solo fallar si el código de salida es error, ignorar warnings en stderr si code es 0
    if (code !== 0) {
      // Intenta parsear el error por si Python envió un JSON
      try {
        const errJson = JSON.parse(errorData);
        logger.error(`Error del script de Python (file_processor.py): ${errJson.error}`, { details: errorData });
        res.status(500).json({ error: 'Error durante el procesamiento del archivo.', details: errJson.error });
        return;
      } catch (e) {
        // Si no es JSON, es un error del sistema
        logger.error(`Error del script de Python (file_processor.py)`, { details: errorData });
        res.status(500).json({ error: 'Error durante el procesamiento del archivo.', details: errorData });
      }
    } else {
      try {
        const result = JSON.parse(resultData);
        res.json(result);
      } catch (e) {
        logger.error('Fallo al parsear resultado de Python (file_processor.py)', { data: resultData });
        res.status(500).json({ error: 'Fallo al leer el resultado del script de Python.' });
      }
    }
  });

  pythonProcess.stdin.write(JSON.stringify(req.body));
  pythonProcess.stdin.end();
});

// ==================== ENDPOINT PARA NESTING CON PYTHON ====================

app.post('/api/nesting/solve', verifyToken, (req, res) => {
  // 1. Ejecuta el script de Python como un proceso hijo
  const scriptPath = path.join(BASE_PATH, 'nesting_solver.py');
  const pythonProcess = spawn(pythonCmd, [scriptPath]);

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

  pythonProcess.on('error', (err) => {
    logger.error('Error iniciando Python (nesting_solver.py)', { error: err.message });
    res.status(500).json({ error: 'Fallo al iniciar el solver: ' + err.message });
  });

  // 4. Cuando el script de Python termina, se ejecuta este bloque
  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      logger.error(`Error del script de Python (nesting_solver.py)`, { details: errorData });
      res.status(500).json({ error: 'Error durante el proceso de nesting en el servidor.', details: errorData });
    } else {
      try {
        // 5. Si todo salió bien, parsea el resultado y lo envía de vuelta al navegador
        const result = JSON.parse(resultData);
        res.json(result);
      } catch (e) {
        logger.error(`Error al parsear la salida de Python (nesting_solver.py)`, { error: e, data: resultData });
        res.status(500).json({ error: 'Fallo al leer el resultado del script de Python.' });
      }
    }
  });

  // 6. Envía los datos que llegaron del navegador (las piezas) al script de Python
  try {
    pythonProcess.stdin.write(JSON.stringify(req.body));
    pythonProcess.stdin.end();
  } catch (error) {
    logger.error('Error al escribir en el stdin de Python (nesting_solver.py)', { error });
    res.status(500).json({ error: 'No se pudieron enviar los datos al proceso de Python.' });
  }
});

// ==================== ENDPOINT CALCULADOR DE ROLLOS ====================

function parsePieceFilename(filename, fullPath = '') {
  const baseName = path.parse(filename).name;
  // Expresiones regulares para capturar: [Numero]_[Material]_[Ancho]x[Alto] o combinaciones
  const regexPatterns = [
    /^(?:\d+[-_])?\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)[-_](\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)/i,
    /([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)[\s_-]+(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)/i,
    /(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)[-_]([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+)/i
  ];

  let rawMaterial = '';
  let wStr = '';
  let hStr = '';

  for (const regex of regexPatterns) {
    const match = baseName.match(regex);
    if (match) {
      if (regex === regexPatterns[2]) {
        wStr = match[1];
        hStr = match[2];
        rawMaterial = match[3];
      } else {
        rawMaterial = match[1];
        wStr = match[2];
        hStr = match[3];
      }
      break;
    }
  }

  if (!wStr || !hStr) return null;

  const w = parseFloat(wStr.replace(',', '.'));
  const h = parseFloat(hStr.replace(',', '.'));
  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null;

  const cleanMat = (rawMaterial || '').trim().toUpperCase();
  let material = 'VINILO';

  if (cleanMat.includes('MICRO') || cleanMat.includes('PERFORADO')) {
    material = 'MICROPERFORADO';
  } else if (cleanMat.includes('LONA') || cleanMat.includes('FRONT') || cleanMat.includes('BANNER')) {
    material = 'LONA FRONT';
  } else if (cleanMat.includes('BACKLIGHT') || cleanMat.includes('BACK')) {
    material = 'BACKLIGHT';
  } else if (cleanMat.includes('ESMERILADO')) {
    material = 'ESMERILADO';
  } else if (cleanMat.includes('REFLECTIVO')) {
    material = 'REFLECTIVO';
  } else if (cleanMat.includes('TRANSPARENTE') || cleanMat.includes('CLEAR')) {
    material = 'VINILO TRANSPARENTE';
  } else if (cleanMat.includes('VIILO') || cleanMat.includes('VINIL')) {
    material = 'VINILO';
  } else if (cleanMat.length > 0) {
    material = cleanMat;
  }

  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);
  const areaM2 = (w * h) / 10000;

  return {
    filename,
    fullPath,
    material,
    widthCm: w,
    heightCm: h,
    minDimCm: minDim,
    maxDimCm: maxDim,
    areaM2: Number(areaM2.toFixed(3))
  };
}

const fsSync = require('fs');

function scanDirectoryFiles(dirPath, fileList = []) {
  if (!fsSync.existsSync(dirPath)) return fileList;
  const entries = fsSync.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const resPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDirectoryFiles(resPath, fileList);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.pdf', '.ai', '.eps', '.cdr'].includes(ext)) {
        fileList.push({ name: entry.name, fullPath: resPath });
      }
    }
  }
  return fileList;
}

app.post('/api/calcular-rollos/scan-path', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { directoryPath, stockRollos } = req.body;
    if (!directoryPath || typeof directoryPath !== 'string') {
      return res.status(400).json({ error: 'Debes proporcionar una ruta de directorio válida.' });
    }

    if (!fsSync.existsSync(directoryPath)) {
      return res.status(404).json({ error: `La ruta "${directoryPath}" no existe o no es accesible.` });
    }

    const rawFiles = scanDirectoryFiles(directoryPath);
    if (!rawFiles || rawFiles.length === 0) {
      return res.status(200).json({
        totalFiles: 0,
        parsedPieces: [],
        summary: {},
        message: 'No se encontraron archivos de imagen o diseño en la carpeta.'
      });
    }

    const defaultStock = {
      'LONA FRONT': [107, 127, 140, 155, 210, 220, 240],
      'VINILO': [104, 134, 148],
      'MICROPERFORADO': [104, 134, 148]
    };

    const stock = { ...defaultStock, ...(stockRollos || {}) };
    const parsedPieces = [];
    const unparseableFiles = [];

    for (const f of rawFiles) {
      const piece = parsePieceFilename(f.name, f.fullPath);
      if (piece) {
        parsedPieces.push(piece);
      } else {
        unparseableFiles.push(f);
      }
    }

    // Agrupar por material y asignar al rollo en stock más eficiente
    const summary = {};
    let grandTotalM2 = 0;
    let grandTotalBillableM2 = 0;
    let grandTotalLinearM = 0;

    for (const p of parsedPieces) {
      grandTotalM2 += p.areaM2;
      if (!summary[p.material]) {
        summary[p.material] = {
          totalPieces: 0,
          totalM2: 0,
          totalBillableM2: 0,
          totalLinearM: 0,
          rollsUsed: {},
          unfitPieces: []
        };
      }

      const matGroup = summary[p.material];
      matGroup.totalPieces++;
      matGroup.totalM2 += p.areaM2;

      // Obtener anchos disponibles en stock ordenados
      const availableRolls = (stock[p.material] || stock['VINILO'] || [105, 137, 152]).slice().sort((a, b) => a - b);
      let chosenRoll = null;

      for (const rollWidth of availableRolls) {
        if (p.minDimCm <= rollWidth) {
          chosenRoll = rollWidth;
          break;
        }
      }

      if (chosenRoll) {
        if (!matGroup.rollsUsed[chosenRoll]) {
          matGroup.rollsUsed[chosenRoll] = {
            rollWidthCm: chosenRoll,
            linearMeters: 0,
            totalM2: 0,
            billableM2: 0,
            piecesCount: 0,
            pieces: []
          };
        }
        const linearM = p.maxDimCm / 100;
        const pieceBillableM2 = (chosenRoll * p.maxDimCm) / 10000;
        matGroup.rollsUsed[chosenRoll].linearMeters += linearM;
        matGroup.rollsUsed[chosenRoll].totalM2 += p.areaM2;
        matGroup.rollsUsed[chosenRoll].billableM2 += pieceBillableM2;
        matGroup.rollsUsed[chosenRoll].piecesCount++;
        matGroup.rollsUsed[chosenRoll].pieces.push({
          filename: p.filename,
          widthCm: p.widthCm,
          heightCm: p.heightCm,
          minDimCm: p.minDimCm,
          maxDimCm: p.maxDimCm,
          areaM2: p.areaM2,
          billableM2: Number(pieceBillableM2.toFixed(3)),
          rollWidthCm: chosenRoll,
          linearM: Number(linearM.toFixed(2))
        });
        matGroup.totalLinearM += linearM;
        matGroup.totalBillableM2 += pieceBillableM2;
        grandTotalLinearM += linearM;
        grandTotalBillableM2 += pieceBillableM2;
      } else {
        matGroup.unfitPieces.push(p);
      }
    }

    // Redondear totales
    for (const mat in summary) {
      summary[mat].totalM2 = Number(summary[mat].totalM2.toFixed(2));
      summary[mat].totalBillableM2 = Number(summary[mat].totalBillableM2.toFixed(2));
      summary[mat].totalLinearM = Number(summary[mat].totalLinearM.toFixed(2));
      for (const roll in summary[mat].rollsUsed) {
        summary[mat].rollsUsed[roll].linearMeters = Number(summary[mat].rollsUsed[roll].linearMeters.toFixed(2));
        summary[mat].rollsUsed[roll].totalM2 = Number(summary[mat].rollsUsed[roll].totalM2.toFixed(2));
        summary[mat].rollsUsed[roll].billableM2 = Number(summary[mat].rollsUsed[roll].billableM2.toFixed(2));
      }
    }

    res.json({
      success: true,
      directoryPath,
      totalScannedFiles: rawFiles.length,
      totalPieces: parsedPieces.length,
      unparseableCount: unparseableFiles.length,
      unparseableFiles: unparseableFiles.slice(0, 50),
      grandTotalM2: Number(grandTotalM2.toFixed(2)),
      grandTotalBillableM2: Number(grandTotalBillableM2.toFixed(2)),
      grandTotalLinearM: Number(grandTotalLinearM.toFixed(2)),
      summary,
      pieces: parsedPieces
    });
  } catch (error) {
    logger.error('Error al escanear directorio para cálculo de rollos', { error: error.stack });
    res.status(500).json({ error: 'Error interno al procesar el directorio: ' + error.message });
  }
});

// ==================== ENDPOINTS DE TRABAJOS ====================

// ==================== GESTIÓN DE TRABAJOS (SQLite) ====================

app.get('/api/trabajos', verifyToken, async (req, res) => {
  try {
    const works = await db.all('SELECT * FROM trabajos ORDER BY created_at DESC');
    const timelines = await db.all('SELECT * FROM trabajo_timeline ORDER BY id ASC');
    const mergers = await db.all('SELECT * FROM trabajo_merger ORDER BY id ASC');

    const timelinesMap = new Map();
    for (const t of timelines) {
      if (!timelinesMap.has(t.trabajo_id)) timelinesMap.set(t.trabajo_id, []);
      timelinesMap.get(t.trabajo_id).push({
        type: t.type || '',
        description: t.description || '',
        timestamp: t.timestamp || null
      });
    }

    const mergersMap = new Map();
    for (const m of mergers) {
      if (!mergersMap.has(m.trabajo_principal_id)) mergersMap.set(m.trabajo_principal_id, []);
      mergersMap.get(m.trabajo_principal_id).push({
        id: m.trabajo_secundario_id,
        quoteId: m.quote_id || null,
        clientName: m.client_name || '',
        total: m.total || 0,
        descripcion: m.descripcion || '',
        notes: (() => { try { return JSON.parse(m.notes_json || '[]'); } catch { return []; } })()
      });
    }

    const parsed = works.map(w => {
      const timeline = timelinesMap.get(w.id) || [];
      const mergedWorks = (() => {
        try {
          if (w.merged_works_json && w.merged_works_json !== '[]') {
            return JSON.parse(w.merged_works_json);
          }
        } catch (e) { }
        return mergersMap.get(w.id) || [];
      })();

      return {
        id: w.id,
        quoteId: w.quote_id,
        clientId: w.cliente_id,
        clientName: w.cliente_nombre,
        clientPhone: w.cliente_telefono,
        clientEmail: w.cliente_email,
        clientAddress: w.cliente_address,
        tipo_cliente: w.tipo_cliente,
        descripcion: w.descripcion,
        total: w.total,
        totalCost: w.total_cost,
        profit: w.profit,
        paidAmount: w.paid_amount,
        balance: w.balance,
        senia: w.senia,
        status: w.status,
        paymentStatus: w.payment_status,
        priority: w.priority,
        deliveryDate: w.delivery_date,
        deliveryStatus: w.delivery_status,
        actualDeliveryDate: w.actual_delivery_date,
        paidAt: w.paid_at,
        createdAt: w.created_at,
        is_merged: w.is_merged,
        printed: w.printed === 1,
        printedItems: (() => { try { return JSON.parse(w.printed_items_json || '{}'); } catch { return {}; } })(),
        completedItems: (() => { try { return JSON.parse(w.completed_items_json || '{}'); } catch { return {}; } })(),
        billedItems: (() => { try { return JSON.parse(w.billed_items_json || '{}'); } catch { return {}; } })(),
        timeline,
        mergedWorks: mergedWorks.filter(m => m && m.id),
        productos: (() => { try { return JSON.parse(w.productos_json || '[]'); } catch { return []; } })(),
        costos: (() => { try { return JSON.parse(w.costos_json || '{"materiales":{},"terceros":{}}'); } catch { return { materiales: {}, terceros: {} }; } })(),
        notes: (() => { try { return JSON.parse(w.notes_json || '[]'); } catch { return []; } })()
      };
    });

    res.json({ works: parsed, notifications: [] });
  } catch (error) {
    logger.error('Error leyendo trabajos desde SQLite', { error: error.stack });
    res.status(500).json({ error: 'Error leyendo trabajos' });
  }
});

app.post('/api/trabajos', verifyToken, async (req, res) => {
  // Sync bulk desde frontend: reemplaza todo el store
  try {
    const data = req.body;
    const works = data?.works || (Array.isArray(data) ? data : []);

    await db.withTransaction(async () => {
      // Eliminar de SQLite los trabajos que no vienen en el payload (bulk sync)
      const incomingIds = works.map(w => w.id).filter(Boolean);
      if (incomingIds.length > 0) {
        const placeholders = incomingIds.map(() => '?').join(',');
        await db.run(`DELETE FROM trabajo_timeline WHERE trabajo_id NOT IN (${placeholders})`, incomingIds);
        await db.run(`DELETE FROM trabajo_merger WHERE trabajo_principal_id NOT IN (${placeholders})`, incomingIds);
        await db.run(`DELETE FROM trabajo_pagos WHERE trabajo_id NOT IN (${placeholders})`, incomingIds);
        await db.run(`DELETE FROM trabajos WHERE id NOT IN (${placeholders})`, incomingIds);
      } else {
        await db.run('DELETE FROM trabajo_timeline');
        await db.run('DELETE FROM trabajo_merger');
        await db.run('DELETE FROM trabajo_pagos');
        await db.run('DELETE FROM trabajos');
      }

      // Obtener todos los trabajos y timelines actuales de SQLite para comparación rápida (Diff)
      const existingWorks = await db.all('SELECT * FROM trabajos');
      const existingTimeline = await db.all('SELECT * FROM trabajo_timeline ORDER BY id ASC');

      const existingMap = new Map(existingWorks.map(x => [x.id, x]));
      const timelineMap = new Map();
      for (const t of existingTimeline) {
        if (!timelineMap.has(t.trabajo_id)) timelineMap.set(t.trabajo_id, []);
        timelineMap.get(t.trabajo_id).push({
          type: t.type || '',
          description: t.description || '',
          timestamp: t.timestamp || null
        });
      }

      for (const w of works) {
        // Buscar cliente_id si no viene
        let clienteId = w.clientId || w.cliente_id || null;
        if (!clienteId && w.clientName) {
          const row = await db.get({ sql: 'SELECT id FROM clientes WHERE nombre = ? LIMIT 1', params: [w.clientName] });
          clienteId = row?.id || null;
        }

        const dbWork = existingMap.get(w.id);
        const clientProductos = JSON.stringify(w.productos || w.products || w.items || []);
        const clientIsMerged = (w.mergedWorks && w.mergedWorks.length > 0) ? 1 : 0;
        const clientCostos = JSON.stringify(w.costos || { materiales: {}, terceros: {} });
        const clientNotes = JSON.stringify(w.notes || []);
        const clientMergedWorks = JSON.stringify(w.mergedWorks || []);
        const clientPrinted = w.printed ? 1 : 0;
        const clientPrintedItems = JSON.stringify(w.printedItems || {});
        const clientCompletedItems = JSON.stringify(w.completedItems || {});
        const clientBilledItems = JSON.stringify(w.billedItems || {});

        let hasChanged = !dbWork;
        if (dbWork) {
          if (
            w.clientName !== dbWork.cliente_nombre ||
            w.clientPhone !== dbWork.cliente_telefono ||
            w.clientEmail !== dbWork.cliente_email ||
            w.clientAddress !== dbWork.cliente_address ||
            (w.tipo_cliente || 'gremio') !== dbWork.tipo_cliente ||
            (w.descripcion || '') !== (dbWork.descripcion || '') ||
            (w.total || 0) !== (dbWork.total || 0) ||
            (w.totalCost || 0) !== (dbWork.total_cost || 0) ||
            (w.profit || 0) !== (dbWork.profit || 0) ||
            (w.paidAmount || 0) !== (dbWork.paid_amount || 0) ||
            (w.balance || 0) !== (dbWork.balance || 0) ||
            (w.senia || 0) !== (dbWork.senia || 0) ||
            (w.status || 'pending') !== dbWork.status ||
            (w.paymentStatus || 'unpaid') !== dbWork.payment_status ||
            (w.priority || 'normal') !== dbWork.priority ||
            w.deliveryDate !== dbWork.delivery_date ||
            w.deliveryStatus !== dbWork.delivery_status ||
            w.actualDeliveryDate !== dbWork.actual_delivery_date ||
            w.paidAt !== dbWork.paid_at ||
            w.createdAt !== dbWork.created_at ||
            clientIsMerged !== dbWork.is_merged ||
            clientPrinted !== dbWork.printed ||
            clientPrintedItems !== dbWork.printed_items_json ||
            clientCompletedItems !== (dbWork.completed_items_json || '{}') ||
            clientBilledItems !== (dbWork.billed_items_json || '{}') ||
            clientProductos !== dbWork.productos_json ||
            clientCostos !== dbWork.costos_json ||
            clientNotes !== dbWork.notes_json ||
            clientMergedWorks !== dbWork.merged_works_json
          ) {
            hasChanged = true;
          } else {
            // Comparar timelines
            const dbTimelineEvents = timelineMap.get(w.id) || [];
            const clientTimelineEvents = (w.timeline || []).map(t => ({
              type: t.type || '',
              description: t.description || '',
              timestamp: t.timestamp || null
            }));
            if (JSON.stringify(dbTimelineEvents) !== JSON.stringify(clientTimelineEvents)) {
              hasChanged = true;
            }
          }
        }

        // Si no ha cambiado nada, saltamos la actualización en la BD para optimizar rendimiento
        if (!hasChanged) continue;

        // Borrar hijos ANTES del INSERT OR REPLACE: el REPLACE hace un DELETE interno
        // de la fila antigua y, con PRAGMA foreign_keys=ON, falla si aún hay filas
        // en trabajo_timeline / trabajo_merger / trabajo_pagos que la referencian.
        await db.run('DELETE FROM trabajo_timeline WHERE trabajo_id = ?', [w.id]);
        await db.run('DELETE FROM trabajo_merger WHERE trabajo_principal_id = ?', [w.id]);
        await db.run('DELETE FROM trabajo_pagos WHERE trabajo_id = ?', [w.id]);

        await db.run(
          `INSERT OR REPLACE INTO trabajos
           (id, quote_id, cliente_id, cliente_nombre, cliente_telefono, cliente_email, cliente_address,
            tipo_cliente, descripcion, total, total_cost, profit, paid_amount, balance, senia,
            status, payment_status, priority, delivery_date, delivery_status, actual_delivery_date,
            paid_at, created_at, productos_json, is_merged, costos_json, notes_json, merged_works_json,
            printed, printed_items_json, completed_items_json, billed_items_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [w.id, w.quoteId || null, clienteId, w.clientName || '', w.clientPhone || '',
          w.clientEmail || '', w.clientAddress || '', w.tipo_cliente || 'gremio',
          w.descripcion || '', w.total || 0, w.totalCost || 0, w.profit || 0,
          w.paidAmount || 0, w.balance || 0, w.senia || 0,
          w.status || 'pending', w.paymentStatus || 'unpaid', w.priority || 'normal',
          w.deliveryDate || null, w.deliveryStatus || 'pending',
          w.actualDeliveryDate || null, w.paidAt || null, w.createdAt || null,
            clientProductos, clientIsMerged, clientCostos, clientNotes, clientMergedWorks,
            clientPrinted, clientPrintedItems, clientCompletedItems, clientBilledItems]
        );

        // Regenerar timeline
        if (Array.isArray(w.timeline)) {
          for (const t of w.timeline) {
            await db.run(
              'INSERT INTO trabajo_timeline (trabajo_id, type, description, timestamp) VALUES (?,?,?,?)',
              [w.id, t.type || '', t.description || '', t.timestamp || null]
            );
          }
        }

        // Regenerar mergedWorks
        if (Array.isArray(w.mergedWorks)) {
          for (const mw of w.mergedWorks) {
            await db.run(
              'INSERT INTO trabajo_merger (trabajo_principal_id, trabajo_secundario_id, quote_id, client_name, total, descripcion, notes_json, merged_at) VALUES (?,?,?,?,?,?,?,?)',
              [w.id, mw.id || '', mw.quoteId || null, mw.clientName || '', mw.total || 0, mw.descripcion || '', JSON.stringify(mw.notes || []), mw.mergedAt || new Date().toISOString()]
            );
          }
        }

        // Regenerar pagos
        if (Array.isArray(w.pagos) && w.pagos.length > 0) {
          for (const p of w.pagos) {
            await db.run(
              'INSERT INTO trabajo_pagos (trabajo_id, monto, fecha, nota) VALUES (?,?,?,?)',
              [w.id, Number(p.monto || p.amount || 0), p.fecha || p.date || w.paidAt || w.createdAt || null, p.nota || p.note || 'Pago']
            );
          }
        } else if (Number(w.paidAmount || w.senia || 0) > 0) {
          await db.run(
            'INSERT INTO trabajo_pagos (trabajo_id, monto, fecha, nota) VALUES (?,?,?,?)',
            [w.id, Number(w.paidAmount || w.senia || 0), w.paidAt || w.createdAt || new Date().toISOString(), w.senia ? 'Seña / Anticipo' : 'Pago abonado']
          );
        }
      }
    });

    // Backup JSON
    await writeJSON(FILES.trabajos, { works, notifications: data?.notifications || [] });

    const io = req.app.get('socketio');
    if (io) io.emit('works_updated', { source: 'post_api' });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error guardando trabajos en SQLite', { error: error.stack });
    res.status(500).json({ error: 'Error guardando trabajos' });
  }
});

// NUEVO: Proxy para obtener imágenes de la carpeta de Drive
app.get('/api/google/folder-images', verifyToken, async (req, res) => {
  const { folderId } = req.query;
  if (!folderId) {
    return res.status(400).json({ error: 'Falta folderId' });
  }

  let scriptImages = null;
  try {
    const googleScriptUrl = "https://script.google.com/macros/s/AKfycbxCWY_Sre0t9V-4ilK-TWIXKAttWdUWqNBa2fTnneVJHbHxGQcWVKq9Ug6UYCf_ewCJ/exec";
    const response = await axios.get(`${googleScriptUrl}?action=getFolderImages&folderId=${folderId}`, { timeout: 8000 });

    // Si la respuesta es un array o JSON válido (y no la página de login/redirect de Google que es HTML)
    if (response.data && Array.isArray(response.data)) {
      scriptImages = response.data;
    } else if (typeof response.data === 'string' && response.data.trim().startsWith('[')) {
      try {
        scriptImages = JSON.parse(response.data);
      } catch (e) { }
    }
  } catch (error) {
    logger.warn('Apps Script getFolderImages falló o dio timeout, usando fallback de scraping', { error: error.message, folderId });
  }

  // Si el Apps Script funcionó bien, devolvemos las imágenes directamente
  if (scriptImages && scriptImages.length > 0 && scriptImages[0].thumbData) {
    return res.json(scriptImages);
  }

  // PLAN B: Scraping directo de la carpeta pública de Google Drive si el Apps Script no está actualizado
  logger.info(`🔍 [Drive Scraper] Ejecutando fallback de scraping para carpeta: ${folderId}`);
  try {
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
    const response = await axios.get(folderUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9'
      },
      timeout: 10000
    });

    const html = response.data;
    const fileEntries = [];
    // Buscar data-id y data-tooltip (contiene nombre y tipo)
    const regex = /data-id="([a-zA-Z0-9_-]{28,40})"[^>]*data-tooltip="([^"]+)"/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const [_, fileId, tooltip] = match;
      const name = tooltip.replace(/\s+(Image|PDF|Archive|Word|Video|Folder|Text|Document)$/i, '');
      const isImg = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name) || tooltip.toLowerCase().includes('image');

      fileEntries.push({
        id: fileId,
        name: name,
        isImage: isImg,
        fullUrl: `https://drive.google.com/file/d/${fileId}/view`
      });
    }

    const MAX_SCRAPE_IMAGES = 6;
    const images = [];

    for (const file of fileEntries) {
      if (images.length >= MAX_SCRAPE_IMAGES) break;

      if (file.isImage) {
        let thumbData = null;
        try {
          // Obtener el thumbnail oficial de Drive y pasarlo a base64
          const thumbUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w220`;
          const thumbRes = await axios.get(thumbUrl, {
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 5000
          });
          const base64 = Buffer.from(thumbRes.data).toString('base64');
          const mime = thumbRes.headers['content-type'] || 'image/jpeg';
          thumbData = `data:${mime};base64,${base64}`;
        } catch (thumbErr) {
          logger.warn(`No se pudo generar thumbnail para archivo ${file.id}: ${thumbErr.message}`);
        }

        images.push({
          id: file.id,
          name: file.name,
          thumbData: thumbData,
          fullUrl: file.fullUrl,
          isImage: true
        });
      } else {
        images.push({
          id: file.id,
          name: file.name,
          thumbData: null,
          fullUrl: file.fullUrl,
          isImage: false
        });
      }
    }

    logger.info(`✨ [Drive Scraper] Éxito: Encontrados ${images.length} archivos para la carpeta ${folderId}`);
    return res.json(images);

  } catch (error) {
    if (error.response && error.response.status === 404) {
      logger.warn(`[Drive Scraper] Carpeta no encontrada o sin acceso en Drive: ${folderId}`);
      return res.json([]);
    }
    logger.error('Error al realizar scraping de la carpeta de Drive', { error: error.message, folderId });
    res.status(500).json({ error: 'Error al consultar imágenes de Drive' });
  }
});

// NUEVO: Endpoint público para recibir trabajos del cotizador externo
// FIX: rate-limit + validación básica + dedupe por id (antes aceptaba cualquier payload y permitía spam/DoS)
app.post('/api/public/trabajo', publicLimiter, async (req, res) => {
  logger.info('🔔 Procesando endpoint /api/public/trabajo');
  try {
    const nuevoTrabajo = req.body;
    if (!nuevoTrabajo || typeof nuevoTrabajo !== 'object') {
      return res.status(400).json({ error: 'Payload inválido' });
    }
    const clientName = String(nuevoTrabajo.clientName || nuevoTrabajo.cliente_nombre || '').trim();
    if (!clientName || clientName.length < 2) {
      return res.status(400).json({ error: 'clientName requerido' });
    }
    const totalNum = Number(nuevoTrabajo.total || nuevoTrabajo.totalCliente || 0);
    if (isNaN(totalNum) || totalNum < 0) {
      return res.status(400).json({ error: 'total inválido' });
    }
    const workId = String(nuevoTrabajo.id || `web_${Date.now()}_${Math.random().toString(36).slice(-6)}`);
    const filePath = FILES.trabajos;

    logger.info(`📝 Intentando registrar trabajo de: ${nuevoTrabajo?.clientName || 'Cliente desconocido'}`);

    // Leer datos actuales
    let data = { works: [], notifications: [] };
    try {
      logger.info(`📂 Leyendo archivo: ${filePath}`);
      const existingData = await readJSON(filePath);
      if (Array.isArray(existingData)) {
        data.works = existingData;
        logger.info('🔄 Migrando datos de array a objeto');
      } else if (existingData && typeof existingData === 'object') {
        data = existingData;
        logger.info(`✅ Datos leídos. Trabajos: ${data.works?.length || 0}, Notif: ${data.notifications?.length || 0}`);
      }
    } catch (e) {
      logger.warn('Archivo de trabajos no existe o está corrupto, iniciando nuevo.', { error: e.message });
    }

    // Asegurar estructura
    if (!data.works) data.works = [];
    if (!data.notifications) data.notifications = [];

    // FIX: dedupe por id (evita duplicados si el cotizador reenvía el mismo pedido)
    const yaExiste = data.works.some(w => String(w.id) === String(workId));
    if (yaExiste) {
      return res.json({ success: true, duplicate: true, message: 'Pedido ya registrado.' });
    }
    nuevoTrabajo.id = workId;
    nuevoTrabajo.clientName = clientName;
    nuevoTrabajo.total = totalNum;
    if (!nuevoTrabajo.createdAt) nuevoTrabajo.createdAt = new Date().toISOString();

    // Agregar el trabajo
    data.works.push(nuevoTrabajo);

    // Agregar notificación para el sistema
    const newNotif = {
      id: 'notif_ext_' + Date.now(),
      title: '📦 Nuevo Pedido Online',
      message: `${nuevoTrabajo.clientName || 'Un cliente'} envió una cotización.`,
      type: 'success',
      read: false,
      createdAt: new Date().toISOString(),
      workId: nuevoTrabajo.id
    };
    data.notifications.unshift(newNotif);
    logger.info('🔔 Notificación encolada');

    // Limitar notificaciones
    if (data.notifications.length > 50) data.notifications = data.notifications.slice(0, 50);

    const success = await writeJSON(filePath, data);
    if (success) {
      logger.info('📩 Trabajo guardado exitosamente en JSON:', nuevoTrabajo.clientName);

      // Persistir también en SQLite para sincronización con GET /api/trabajos
      try {
        const clienteRow = await db.get({ sql: 'SELECT id FROM clientes WHERE nombre = ? LIMIT 1', params: [nuevoTrabajo.clientName || ''] });
        const clienteId = clienteRow?.id || null;

        await db.run(
          `INSERT OR REPLACE INTO trabajos
           (id, quote_id, cliente_id, cliente_nombre, cliente_telefono, cliente_email, cliente_address,
            tipo_cliente, descripcion, total, total_cost, profit, paid_amount, balance, senia,
            status, payment_status, priority, delivery_date, delivery_status, actual_delivery_date,
            paid_at, created_at, productos_json, is_merged, costos_json, notes_json, merged_works_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            nuevoTrabajo.id || ('work_web_' + Date.now()),
            nuevoTrabajo.quoteId || null,
            clienteId,
            nuevoTrabajo.clientName || 'Cliente Web',
            nuevoTrabajo.clientPhone || '',
            nuevoTrabajo.clientEmail || '',
            nuevoTrabajo.clientAddress || '',
            nuevoTrabajo.tipo_cliente || 'gremio',
            nuevoTrabajo.descripcion || 'Pedido recibido desde Portal Web',
            nuevoTrabajo.total || 0,
            nuevoTrabajo.totalCost || 0,
            (nuevoTrabajo.total || 0) - (nuevoTrabajo.totalCost || 0),
            nuevoTrabajo.paidAmount || 0,
            nuevoTrabajo.balance ?? (nuevoTrabajo.total || 0),
            nuevoTrabajo.senia || 0,
            nuevoTrabajo.status || 'pending',
            nuevoTrabajo.paymentStatus || 'unpaid',
            nuevoTrabajo.priority || 'high',
            nuevoTrabajo.deliveryDate || null,
            nuevoTrabajo.deliveryStatus || 'pending',
            nuevoTrabajo.actualDeliveryDate || null,
            nuevoTrabajo.paidAt || null,
            nuevoTrabajo.createdAt || new Date().toISOString(),
            JSON.stringify(nuevoTrabajo.productos || []),
            nuevoTrabajo.is_merged ? 1 : 0,
            JSON.stringify(nuevoTrabajo.costos || {}),
            JSON.stringify(nuevoTrabajo.notes || []),
            JSON.stringify(nuevoTrabajo.mergedWorks || [])
          ]
        );

        await db.run(
          'INSERT INTO trabajo_timeline (trabajo_id, type, description, timestamp) VALUES (?,?,?,?)',
          [nuevoTrabajo.id || ('work_web_' + Date.now()), 'created', 'Pedido recibido desde Portal Web', new Date().toISOString()]
        );
        logger.info(`✅ Trabajo guardado en SQLite para ${nuevoTrabajo.clientName}`);
      } catch (sqErr) {
        logger.error('⚠️ Error al guardar trabajo web en SQLite:', { error: sqErr.message });
      }

      // 🔔 Emitir evento de tiempo real a todas las PCs
      const io = req.app.get('socketio');
      if (io) {
        io.emit('new_order', {
          title: '📦 Nuevo Pedido Online',
          message: `${nuevoTrabajo.clientName || 'Un cliente'} envió un pedido.`,
          workId: nuevoTrabajo.id
        });
        io.emit('works_updated', { id: nuevoTrabajo.id, source: 'public_api' });
      }

      res.json({ success: true });
    } else {
      logger.error('❌ Error: writeJSON devolvió false');
      throw new Error('No se pudo escribir el archivo');
    }
  } catch (error) {
    logger.error('🔥 Error crítico en /api/public/trabajo', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ error: 'Error al procesar pedido externo' });
  }
});

// NUEVO: Registrar Gremio (Registro Público)
app.post('/api/public/gremio/registrar', publicLimiter, async (req, res) => {
  try {
    const { nombre, telefono } = req.body;
    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'Nombre y Teléfono son requeridos' });
    }

    const cleanNombre = nombre.trim();
    const cleanTelefono = telefono.trim().replace(/\D/g, ''); // Solo números

    if (cleanNombre.length < 3) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres' });
    }
    if (cleanTelefono.length < 6) {
      return res.status(400).json({ error: 'El teléfono ingresado es muy corto' });
    }

    // Verificar duplicado en clientes
    const existingClient = await db.get({
      sql: 'SELECT id FROM clientes WHERE LOWER(nombre) = ?',
      params: [cleanNombre.toLowerCase()]
    });
    if (existingClient) {
      return res.status(409).json({ error: 'Ya existe un gremio con ese nombre' });
    }

    // Verificar duplicado en usuarios
    const existingUser = await db.get({
      sql: 'SELECT id FROM usuarios WHERE LOWER(usuario) = ?',
      params: [cleanNombre.toLowerCase()]
    });
    if (existingUser) {
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
    }

    const clientId = `gremio_${Date.now()}`;
    const userId = `usr_gremio_${Date.now()}`;
    const fecha = new Date().toISOString();

    // 1. Insertar Cliente Gremio
    await db.run(
      'INSERT INTO clientes (id, nombre, telefono, tipo, estado, fecha_creacion, fecha_registro) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [clientId, cleanNombre, cleanTelefono, 'gremio', 'activo', fecha, fecha]
    );

    // 2. Insertar Usuario Gremio (password es el teléfono)
    const hashedPassword = await bcrypt.hash(cleanTelefono, 10);
    try {
      await db.run(
        'INSERT INTO usuarios (id, nombre, usuario, password, rol, activo, fecha_creacion, cliente_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, cleanNombre, cleanNombre, hashedPassword, 'gremio', 1, fecha, clientId]
      );
    } catch (userErr) {
      await db.run('DELETE FROM clientes WHERE id = ?', [clientId]);
      throw userErr;
    }

    // 3. Escribir Backups JSON
    const allClients = await db.all('SELECT * FROM clientes');
    await writeJSON(FILES.clientes, allClients);

    const allUsers = await db.all('SELECT * FROM usuarios');
    await writeJSON(FILES.usuarios, allUsers.map(u => ({ ...u, activo: u.activo === 1 })));

    logger.info(`✨ Gremio registrado con éxito: "${cleanNombre}" (Tel: ${cleanTelefono})`);
    res.status(201).json({ success: true, message: 'Gremio registrado correctamente. Iniciá sesión con tu nombre y número de teléfono.' });
  } catch (error) {
    logger.error('Error al registrar gremio publicamente', { error: error.stack });
    res.status(500).json({ error: 'Error interno del servidor al procesar el registro' });
  }
});

// NUEVO: Obtener historial de pedidos del Gremio autenticado
app.get('/api/gremio/pedidos', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    let query = 'SELECT * FROM trabajos';
    let params = [];

    if (user.rol === 'gremio') {
      query += ' WHERE cliente_nombre = ?';
      params.push(user.nombre);
    }

    query += ' ORDER BY created_at DESC';
    const orders = await db.all(query, params);
    
    // Formatear JSONs
    const formatted = orders.map(o => ({
      ...o,
      productos: JSON.parse(o.productos_json || '[]'),
      timeline: JSON.parse(o.timeline_json || '[]'),
      notes: JSON.parse(o.notes_json || '[]')
    }));

    res.json(formatted);
  } catch (error) {
    logger.error('Error al obtener pedidos del gremio', { error: error.message });
    res.status(500).json({ error: 'Error al consultar pedidos' });
  }
});

// NUEVO: Cancelar pedido del Gremio (solo si está 'pending')
app.delete('/api/gremio/pedidos/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const user = req.user;

    const order = await db.get({ sql: 'SELECT * FROM trabajos WHERE id = ?', params: [orderId] });
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (user.rol === 'gremio' && order.cliente_nombre !== user.nombre) {
      return res.status(403).json({ error: 'No tienes autorización sobre este pedido' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'El pedido ya no está pendiente (entró en producción o entrega) y no se puede cancelar.' });
    }

    if (orderId.startsWith('goog_')) {
      try {
        let driveUrl = '';
        if (order.notes_json) {
          try {
            const notes = JSON.parse(order.notes_json);
            const syncNote = notes.find(n => n.author === 'Google Sync');
            if (syncNote) {
              const match = syncNote.text.match(/Link a Drive:\s*(https:\/\/drive\.google\.com\/\S*)/i);
              if (match) {
                driveUrl = match[1];
              }
            }
          } catch (e) {
            logger.error('Error al extraer driveUrl de las notas', e);
          }
        }

        const googleScriptUrl = "https://script.google.com/macros/s/AKfycbxCWY_Sre0t9V-4ilK-TWIXKAttWdUWqNBa2fTnneVJHbHxGQcWVKq9Ug6UYCf_ewCJ/exec";
        await axios.post(googleScriptUrl, { action: 'cancelOrder', orderId, driveUrl }, { timeout: 8000 });
      } catch (gasErr) {
        logger.warn(`No se pudo sincronizar cancelación en Google Sheets para el pedido ${orderId}: ${gasErr.message}`);
      }
    }

    await db.run('UPDATE trabajos SET status = ? WHERE id = ?', ['cancelled', orderId]);
    
    const timestamp = new Date().toISOString();
    await db.run(
      'INSERT INTO trabajo_timeline (trabajo_id, type, description, timestamp) VALUES (?,?,?,?)',
      [orderId, 'cancelled', 'Pedido cancelado por el cliente gremio', timestamp]
    );

    const allWorks = await db.all('SELECT * FROM trabajos');
    const worksJson = {
      works: allWorks.map(w => ({
        ...w,
        notes: JSON.parse(w.notes_json || '[]'),
        timeline: JSON.parse(w.timeline_json || '[]')
      })),
      notifications: []
    };
    await writeJSON(FILES.trabajos, worksJson);

    if (io) {
      io.emit('works_updated', { source: 'gremio_cancel' });
    }

    logger.info(`🚫 Pedido cancelado por el cliente: ID=${orderId} (Gremio=${order.cliente_nombre})`);
    res.json({ success: true, message: 'Pedido cancelado correctamente.' });
  } catch (error) {
    logger.error('Error al cancelar pedido del gremio', { error: error.message });
    res.status(500).json({ error: 'Error al procesar la cancelación del pedido' });
  }
});

// NUEVO: Modificar pedido del Gremio (solo si está 'pending')
app.put('/api/gremio/pedidos/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { detalles } = req.body;
    const user = req.user;

    const order = await db.get({ sql: 'SELECT * FROM trabajos WHERE id = ?', params: [orderId] });
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (user.rol === 'gremio' && order.cliente_nombre !== user.nombre) {
      return res.status(403).json({ error: 'No tienes autorización sobre este pedido' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'El pedido ya no está pendiente y no se puede modificar.' });
    }

    // Actualizar en SQLite
    await db.run('UPDATE trabajos SET descripcion = ? WHERE id = ?', [detalles, orderId]);
    
    // Insertar timeline
    const timestamp = new Date().toISOString();
    await db.run(
      'INSERT INTO trabajo_timeline (trabajo_id, type, description, timestamp) VALUES (?,?,?,?)',
      [orderId, 'edit', 'Pedido modificado por el cliente gremio', timestamp]
    );

    // Escribir JSON de backup
    const allWorks = await db.all('SELECT * FROM trabajos');
    const worksJson = {
      works: allWorks.map(w => ({
        ...w,
        notes: JSON.parse(w.notes_json || '[]'),
        timeline: JSON.parse(w.timeline_json || '[]')
      })),
      notifications: []
    };
    await writeJSON(FILES.trabajos, worksJson);

    if (io) {
      io.emit('works_updated', { source: 'gremio_edit' });
    }

    logger.info(`✏️ Pedido modificado por el cliente: ID=${orderId} (Gremio=${order.cliente_nombre})`);
    res.json({ success: true, message: 'Pedido modificado correctamente.' });
  } catch (error) {
    logger.error('Error al modificar pedido del gremio', { error: error.message });
    res.status(500).json({ error: 'Error al procesar la modificación' });
  }
});

// ==================== ENDPOINTS DE COTIZACIONES ====================

// GET cotizaciones pendientes de aprobación (cliente)
app.get('/api/cotizaciones/pendientes/cliente', verifyToken, async (req, res) => {
  try {
    const cotizaciones = await readJSON(FILES.clientes_data);
    const pendientes = Array.isArray(cotizaciones)
      ? cotizaciones.filter(c => !c.approved)
      : [];
    res.json({
      total: pendientes.length,
      cotizaciones: pendientes
    });
  } catch (error) {
    logger.error('Error leyendo cotizaciones cliente pendientes', { error: error.message });
    res.status(500).json({ error: 'Error leyendo cotizaciones' });
  }
});

// GET cotizaciones pendientes de aprobación (gremio)
app.get('/api/cotizaciones/pendientes/gremio', verifyToken, async (req, res) => {
  try {
    const cotizaciones = await readJSON(FILES.gremio_data);
    const pendientes = Array.isArray(cotizaciones)
      ? cotizaciones.filter(c => !c.approved)
      : [];
    res.json({
      total: pendientes.length,
      cotizaciones: pendientes
    });
  } catch (error) {
    logger.error('Error leyendo cotizaciones gremio pendientes', { error: error.message });
    res.status(500).json({ error: 'Error leyendo cotizaciones' });
  }
});

// GET cotizaciones aprobadas (cliente)
app.get('/api/cotizaciones/aprobadas/cliente', verifyToken, async (req, res) => {
  try {
    const cotizaciones = await readJSON(FILES.clientes_data);
    const aprobadas = Array.isArray(cotizaciones)
      ? cotizaciones.filter(c => c.approved)
      : [];
    res.json({
      total: aprobadas.length,
      cotizaciones: aprobadas
    });
  } catch (error) {
    logger.error('Error leyendo cotizaciones cliente aprobadas', { error: error.message });
    res.status(500).json({ error: 'Error leyendo cotizaciones' });
  }
});

// GET cotizaciones aprobadas (gremio)
app.get('/api/cotizaciones/aprobadas/gremio', verifyToken, async (req, res) => {
  try {
    const cotizaciones = await readJSON(FILES.gremio_data);
    const aprobadas = Array.isArray(cotizaciones)
      ? cotizaciones.filter(c => c.approved)
      : [];
    res.json({
      total: aprobadas.length,
      cotizaciones: aprobadas
    });
  } catch (error) {
    logger.error('Error leyendo cotizaciones gremio aprobadas', { error: error.message });
    res.status(500).json({ error: 'Error leyendo cotizaciones' });
  }
});

// GET todas las cotizaciones (pendientes + aprobadas)
app.get('/api/cotizaciones/todas', verifyToken, async (req, res) => {
  try {
    const [clientData, gremioData] = await Promise.all([
      readJSON(FILES.clientes_data),
      readJSON(FILES.gremio_data)
    ]);

    const clientCots = Array.isArray(clientData) ? clientData : [];
    const gremioCots = Array.isArray(gremioData) ? gremioData : [];

    const todasCotizaciones = {
      cliente: {
        pendientes: clientCots.filter(c => !c.approved),
        aprobadas: clientCots.filter(c => c.approved)
      },
      gremio: {
        pendientes: gremioCots.filter(c => !c.approved),
        aprobadas: gremioCots.filter(c => c.approved)
      },
      totalPendiente: clientCots.filter(c => !c.approved).length + gremioCots.filter(c => !c.approved).length,
      totalAprobado: clientCots.filter(c => c.approved).length + gremioCots.filter(c => c.approved).length
    };

    res.json(todasCotizaciones);
  } catch (error) {
    logger.error('Error leyendo todas las cotizaciones', { error: error.message });
    res.status(500).json({ error: 'Error leyendo cotizaciones' });
  }
});

// GET cotización específica por ID
app.get('/api/cotizaciones/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [clientData, gremioData] = await Promise.all([
      readJSON(FILES.clientes_data),
      readJSON(FILES.gremio_data)
    ]);

    const clientCots = Array.isArray(clientData) ? clientData : [];
    const gremioCots = Array.isArray(gremioData) ? gremioData : [];

    const cotizacion = clientCots.find(c => c.id === id) || gremioCots.find(c => c.id === id);

    if (!cotizacion) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    res.json(cotizacion);
  } catch (error) {
    logger.error('Error leyendo cotización específica', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Error leyendo cotización' });
  }
});

// PUT para actualizar un trabajo específico (por ejemplo, su estado)
app.put('/api/trabajos/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const existing = await db.get({ sql: 'SELECT * FROM trabajos WHERE id = ?', params: [id] });
    if (!existing) return res.status(404).json({ error: 'Trabajo no encontrado' });

    const oldStatus = existing.status;

    // Mapear campos del frontend a columnas SQL
    const fieldMap = {
      status: 'status', paymentStatus: 'payment_status', priority: 'priority',
      deliveryDate: 'delivery_date', deliveryStatus: 'delivery_status',
      actualDeliveryDate: 'actual_delivery_date', paidAt: 'paid_at',
      paidAmount: 'paid_amount', balance: 'balance', senia: 'senia',
      total: 'total', totalCost: 'total_cost', profit: 'profit',
      descripcion: 'descripcion', clientName: 'cliente_nombre',
      clientPhone: 'cliente_telefono', clientEmail: 'cliente_email',
      costos: 'costos_json', notes: 'notes_json',
      mergedWorks: 'merged_works_json',
      printed: 'printed', printedItems: 'printed_items_json',
      completedItems: 'completed_items_json', billedItems: 'billed_items_json'
    };
    const fields = [], values = [];
    for (const [k, col] of Object.entries(fieldMap)) {
      if (updates[k] !== undefined) {
        fields.push(`${col} = ?`);
        let val = updates[k];
        if ((k === 'costos' || k === 'notes' || k === 'mergedWorks' || k === 'printedItems' || k === 'completedItems' || k === 'billedItems') && typeof val === 'object') {
          val = JSON.stringify(val);
        } else if (k === 'printed') {
          val = val ? 1 : 0;
        }
        values.push(val);
      }
    }
    // Actualizar timeline si viene
    if (Array.isArray(updates.timeline)) {
      await db.run('DELETE FROM trabajo_timeline WHERE trabajo_id = ?', [id]);
      for (const t of updates.timeline) {
        await db.run(
          'INSERT INTO trabajo_timeline (trabajo_id, type, description, timestamp) VALUES (?,?,?,?)',
          [id, t.type || '', t.description || '', t.timestamp || null]
        );
      }
    }
    // Actualizar mergedWorks si viene
    if (Array.isArray(updates.mergedWorks)) {
      await db.run('DELETE FROM trabajo_merger WHERE trabajo_principal_id = ?', [id]);
      for (const mw of updates.mergedWorks) {
        await db.run(
          'INSERT INTO trabajo_merger (trabajo_principal_id, trabajo_secundario_id, quote_id, client_name, total, descripcion, notes_json, merged_at) VALUES (?,?,?,?,?,?,?,?)',
          [id, mw.id || '', mw.quoteId || null, mw.clientName || '', mw.total || 0, mw.descripcion || '', JSON.stringify(mw.notes || []), mw.mergedAt || new Date().toISOString()]
        );
      }
      fields.push('is_merged = ?');
      values.push(updates.mergedWorks.length > 0 ? 1 : 0);
    }

    if (fields.length) {
      values.push(id);
      await db.run(`UPDATE trabajos SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    // Backup JSON (leer todo y sincronizar)
    const allWorks = await db.all('SELECT * FROM trabajos ORDER BY created_at DESC');
    // FIX: serializar el backup siempre en camelCase (igual que GET) para que el dedupe
    // de google_sync y la migración lean el mismo formato (evita duplicados masivos).
    await writeJSON(FILES.trabajos, { works: allWorks.map(normalizarTrabajo), notifications: [] });

    const trabajo = { ...existing, ...updates };
    logger.info(`✅ Trabajo actualizado en SQLite: ${id}`);

    const io = req.app.get('socketio');
    if (io) io.emit('works_updated', { id, updates, source: 'put_api' });

    const shouldNotify = updates.notifyWhatsApp !== false && updates.skipNotification !== true;

    if (shouldNotify && updates.status && oldStatus !== updates.status &&
      ['completed', 'ready', 'para_retirar'].includes(updates.status)) {
      await enviarNotificacionTrabajoListo(trabajo);
    }

    if (updates.status === 'cancelled') {
      const normalizedWork = normalizarTrabajo(existing);
      googleSync.deleteOrderFromGoogle(normalizedWork).catch(err => {
        logger.warn(`[CANCEL WORK] Error notificando cancelación a Google: ${err.message}`);
      });
      // Notificar al cliente por WhatsApp
      enviarNotificacionCancelacion(normalizedWork).catch(err => {
        logger.warn(`[CANCEL WORK] Error enviando WhatsApp de cancelación: ${err.message}`);
      });
    }

    res.json({ success: true, data: trabajo });
  } catch (error) {
    logger.error('Error actualizando trabajo en SQLite', { id, error: error.stack });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE para eliminar un trabajo individual (y sus hijos en SQLite)
app.delete('/api/trabajos/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await db.get({ sql: 'SELECT * FROM trabajos WHERE id = ?', params: [id] });
    if (!existing) return res.status(404).json({ error: 'Trabajo no encontrado' });

    // Normalizar datos del trabajo antes de borrarlo para extraer carpetas y URLs de Drive
    const normalizedWork = normalizarTrabajo(existing);

    await db.withTransaction(async () => {
      await db.run('DELETE FROM trabajo_timeline WHERE trabajo_id = ?', [id]);
      await db.run('DELETE FROM trabajo_merger WHERE trabajo_principal_id = ?', [id]);
      await db.run('DELETE FROM trabajo_pagos WHERE trabajo_id = ?', [id]);
      await db.run('DELETE FROM trabajos WHERE id = ?', [id]);
    });

    // Responder de inmediato (latencia < 20ms)
    res.json({ success: true, message: 'Trabajo eliminado correctamente.' });

    // Tareas secundarias en segundo plano (no bloquean la respuesta al navegador)
    setImmediate(async () => {
      try {
        const allWorks = await db.all('SELECT * FROM trabajos ORDER BY created_at DESC');
        await writeJSON(FILES.trabajos, { works: allWorks.map(normalizarTrabajo), notifications: [] });

        const io = req.app.get('socketio');
        if (io) io.emit('works_updated', { id, source: 'delete_api' });

        logger.info(`🗑️ Trabajo eliminado en SQLite: ${id}`);

        googleSync.deleteOrderFromGoogle(normalizedWork).catch(err => {
          logger.warn(`[DELETE WORK] Error notificando eliminación a Google: ${err.message}`);
        });

        enviarNotificacionCancelacion(normalizedWork).catch(err => {
          logger.warn(`[DELETE WORK] Error enviando WhatsApp de cancelación: ${err.message}`);
        });
      } catch (bgErr) {
        logger.warn(`[DELETE WORK] Error en tareas de fondo: ${bgErr.message}`);
      }
    });
  } catch (error) {
    logger.error('Error eliminando trabajo en SQLite', { id, error: error.stack });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// BATCH DELETE: Eliminación en lote ultra rápida (< 50ms total para cualquier cantidad)
app.post('/api/trabajos/batch-delete', verifyToken, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Se requiere un arreglo de IDs' });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const existingWorks = await db.all(`SELECT * FROM trabajos WHERE id IN (${placeholders})`, ids);
    const normalizedList = existingWorks.map(normalizarTrabajo);

    await db.withTransaction(async () => {
      await db.run(`DELETE FROM trabajo_timeline WHERE trabajo_id IN (${placeholders})`, ids);
      await db.run(`DELETE FROM trabajo_merger WHERE trabajo_principal_id IN (${placeholders}) OR trabajo_secundario_id IN (${placeholders})`, [...ids, ...ids]);
      await db.run(`DELETE FROM trabajo_pagos WHERE trabajo_id IN (${placeholders})`, ids);
      await db.run(`DELETE FROM trabajos WHERE id IN (${placeholders})`, ids);
    });

    // Responder de inmediato a la UI
    res.json({ success: true, count: existingWorks.length, message: `${existingWorks.length} trabajos eliminados.` });

    // Tareas asíncronas de fondo (sin demorar la interfaz)
    setImmediate(async () => {
      try {
        const allWorks = await db.all('SELECT * FROM trabajos ORDER BY created_at DESC');
        await writeJSON(FILES.trabajos, { works: allWorks.map(normalizarTrabajo), notifications: [] });

        const io = req.app.get('socketio');
        if (io) io.emit('works_updated', { ids, source: 'batch_delete_api' });

        for (const w of normalizedList) {
          googleSync.deleteOrderFromGoogle(w).catch(() => {});
        }
      } catch (bgErr) {
        logger.warn('[BATCH DELETE] Error en tareas de fondo:', bgErr.message);
      }
    });
  } catch (error) {
    logger.error('Error en batch delete:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para reenviar el mensaje de listo (y alias notify-ready)
const handleReenviarListo = async (req, res) => {
  const { id } = req.params;

  try {
    let trabajo = await db.get({ sql: 'SELECT * FROM trabajos WHERE id = ?', params: [id] });

    if (!trabajo) {
      const data = await readJSON(FILES.trabajos).catch(() => ({ works: [] }));
      if (data && data.works) {
        trabajo = data.works.find(w => w.id === id);
      }
    }

    if (!trabajo) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }

    const notificationResult = await enviarNotificacionTrabajoListo(trabajo);
    if (notificationResult && notificationResult.success) {
      return res.json({ success: true, message: 'Mensaje reenviado con éxito.' });
    } else {
      const errorMsg = notificationResult?.error || 'No se pudo enviar el mensaje.';
      const isQueued = notificationResult?.queued;
      return res.status(isQueued ? 202 : 500).json({
        success: false,
        error: errorMsg,
        queued: isQueued,
        message: isQueued ? 'Bot desconectado. Mensaje guardado en cola pendiente.' : errorMsg
      });
    }
  } catch (error) {
    logger.error('Error al reenviar mensaje de listo', { id, error: error.stack });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
app.post('/api/trabajos/:id/reenviar-listo', verifyToken, handleReenviarListo);
app.post('/api/trabajos/:id/notify-ready', verifyToken, handleReenviarListo);

// Endpoint para reenviar el mensaje de confirmación (y alias notify-confirm)
const handleReenviarConfirmacion = async (req, res) => {
  const { id } = req.params;

  try {
    let trabajo = await db.get({ sql: 'SELECT * FROM trabajos WHERE id = ?', params: [id] });

    if (!trabajo) {
      const data = await readJSON(FILES.trabajos).catch(() => ({ works: [] }));
      if (data && data.works) {
        trabajo = data.works.find(w => w.id === id);
      }
    }

    if (!trabajo) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }

    const notificationResult = await enviarNotificacionConfirmacion(trabajo);
    if (notificationResult && notificationResult.success) {
      return res.json({ success: true, message: 'Mensaje de confirmación reenviado con éxito.' });
    } else {
      const errorMsg = notificationResult?.error || 'No se pudo enviar el mensaje.';
      const isQueued = notificationResult?.queued;
      return res.status(isQueued ? 202 : 500).json({
        success: false,
        error: errorMsg,
        queued: isQueued,
        message: isQueued ? 'Bot desconectado. Mensaje guardado en cola pendiente.' : errorMsg
      });
    }
  } catch (error) {
    logger.error('Error al reenviar mensaje de confirmación', { id, error: error.stack });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
app.post('/api/trabajos/:id/reenviar-confirmacion', verifyToken, handleReenviarConfirmacion);
app.post('/api/trabajos/:id/notify-confirm', verifyToken, handleReenviarConfirmacion);

// NUEVO: Endpoint para notificar ítem individual terminado por WhatsApp
app.post('/api/trabajos/:id/notify-item-ready', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { prodName } = req.body;

  try {
    let trabajo = await db.get({ sql: 'SELECT * FROM trabajos WHERE id = ?', params: [id] });
    if (!trabajo) {
      const data = await readJSON(FILES.trabajos).catch(() => ({ works: [] }));
      if (data && data.works) {
        trabajo = data.works.find(w => w.id === id);
      }
    }
    if (!trabajo) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }

    const job = normalizarTrabajo(trabajo);
    let phone = job.clientPhone || job.whatsapp || '';
    if (!phone) {
      return res.status(400).json({ error: 'El cliente no tiene teléfono registrado' });
    }

    let cleanPhone = phone.toString().replace(/\D/g, '');
    let has54 = false;
    if (cleanPhone.startsWith('54')) { cleanPhone = cleanPhone.substring(2); has54 = true; }
    if (has54 && cleanPhone.startsWith('9')) { cleanPhone = cleanPhone.substring(1); }
    if (cleanPhone.startsWith('0')) { cleanPhone = cleanPhone.substring(1); }
    if (cleanPhone.length >= 11 && cleanPhone.substring(2, 4) === '15') {
      cleanPhone = cleanPhone.substring(0, 2) + cleanPhone.substring(4);
    }
    phone = '549' + cleanPhone;

    const clientName = job.clientName || job.gremio || 'Cliente';
    const itemName = prodName || 'uno de tus productos';
    const mensaje = `*MR Letreros - ¡Ítem Listo!* ✅\n\n` +
      `Hola *${clientName}*, te informamos que *${itemName}* ya está *terminado y listo*.\n\n` +
      `📍 *Retiro:* En nuestro taller, en horario de atención.\n\n` +
      `¡Gracias por confiar en nosotros! 🙌`;

    try {
      // FIX: usar el helper (msgId + timeout 30s + cola pendiente real).
      // Antes decía "encolado" pero no guardaba nada → el mensaje se perdía.
      const resultado = await enviarWhatsAppViaBot(phone, mensaje, 'notificación de ítem listo');
      if (resultado.success) {
        return res.json({ success: true, message: 'Notificación de ítem enviada exitosamente.' });
      }
      return res.json({ success: false, queued: !!resultado.queued, message: resultado.error || 'No se pudo enviar.' });
    } catch (botErr) {
      return res.json({ success: false, queued: true, message: 'Mensaje procesado.' });
    }
  } catch (error) {
    logger.error('Error enviando notificación de ítem', { id, error: error.stack });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// NUEVO: Endpoint para enviar recordatorio de pago por WhatsApp
app.post('/api/trabajos/:id/reenviar-recordatorio-pago', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    let trabajo = await db.get({ sql: 'SELECT * FROM trabajos WHERE id = ?', params: [id] });

    if (!trabajo) {
      const data = await readJSON(FILES.trabajos).catch(() => ({ works: [] }));
      if (data && data.works) {
        trabajo = data.works.find(w => w.id === id);
      }
    }

    if (!trabajo) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }

    const notificationResult = await enviarNotificacionRecordatorioPago(trabajo);
    if (notificationResult && notificationResult.success) {
      return res.json({ success: true, message: 'Recordatorio de pago enviado con éxito.' });
    } else {
      const errorMsg = notificationResult?.error || 'No se pudo enviar el recordatorio.';
      const isQueued = notificationResult?.queued;
      return res.status(isQueued ? 202 : 500).json({
        success: false,
        error: errorMsg,
        queued: isQueued,
        message: isQueued ? 'Bot desconectado. Recordatorio guardado en cola pendiente.' : errorMsg
      });
    }
  } catch (error) {
    logger.error('Error al enviar recordatorio de pago', { id, error: error.stack });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==================== GESTIÓN DE CLIENTES (SQLite) ====================


app.get('/api/clientes', verifyToken, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM clientes ORDER BY nombre ASC');
    // Normalizar para compatibilidad con el frontend (espera nombre/name ambos)
    res.json(rows.map(c => ({ ...c, name: c.nombre, activo: c.estado === 'activo' })));
  } catch (error) {
    logger.error('❌ Error leyendo clientes desde SQLite', { error: error.stack });
    res.status(500).json({ error: 'Error leyendo clientes' });
  }
});

app.post('/api/clientes', verifyToken, async (req, res) => {
  try {
    const incomingData = req.body;

    // Si el body es un array => reemplazar lista completa (sync desde frontend)
    if (Array.isArray(incomingData)) {
      await db.withTransaction(async () => {
        for (const c of incomingData) {
          const nombre = c.nombre || c.name || 'Sin nombre';
          await db.run(
            `INSERT OR REPLACE INTO clientes
             (id, nombre, telefono, email, direccion, tipo, estado, descuento, notas,
              cuit, condicion_iva, total_facturado, cantidad_trabajos, ultimo_trabajo, fecha_creacion, fecha_registro)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [c.id || `cli_${Date.now()}_${Math.random().toString(36).slice(-4)}`,
              nombre, c.telefono || '', c.email || '', c.direccion || '',
            c.tipo || 'gremio', c.estado || 'activo', c.descuento || 0, c.notas || '',
            c.cuit || '', c.condicionIVA || '', c.totalFacturado || 0,
            c.cantidadTrabajos || 0, c.ultimoTrabajo || null,
            c.fechaCreacion || c.fechaRegistro || new Date().toISOString(),
            c.fechaRegistro || c.fechaCreacion || null]
          );
        }
      });
      const all = await db.all('SELECT * FROM clientes ORDER BY nombre ASC');
      await writeJSON(FILES.clientes, all.map(c => ({ ...c, name: c.nombre })));
      return res.json({ success: true });
    }

    // Nuevo cliente individual
    const nombre = incomingData.nombre || incomingData.name || 'Sin nombre';
    const tel = (incomingData.telefono || '').replace(/\D/g, '');
    const existe = await db.get({
      sql: 'SELECT id FROM clientes WHERE LOWER(nombre) = LOWER(?) AND REPLACE(telefono, " ", "") = ? LIMIT 1',
      params: [nombre, tel]
    });
    if (existe) return res.status(409).json({ error: 'El cliente ya existe.' });

    const newId = incomingData.id || `cli_${Date.now()}`;
    await db.run(
      `INSERT INTO clientes
       (id, nombre, telefono, email, direccion, tipo, estado, descuento, notas,
        cuit, condicion_iva, total_facturado, cantidad_trabajos, ultimo_trabajo, fecha_creacion)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [newId, nombre, incomingData.telefono || '', incomingData.email || '',
        incomingData.direccion || '', incomingData.tipo || 'gremio', 'activo',
        incomingData.descuento || 0, incomingData.notas || '',
        incomingData.cuit || '', incomingData.condicionIVA || '', 0, 0, null,
        incomingData.fechaCreacion || new Date().toISOString()]
    );
    const all = await db.all('SELECT * FROM clientes ORDER BY nombre ASC');
    await writeJSON(FILES.clientes, all.map(c => ({ ...c, name: c.nombre })));
    res.json({ success: true, data: { ...incomingData, id: newId } });
  } catch (error) {
    logger.error('❌ Error guardando clientes', { error: error.stack });
    res.status(500).json({ error: 'Error guardando clientes' });
  }
});

app.put('/api/clientes/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const c = req.body;
    const existing = await db.get({ sql: 'SELECT id FROM clientes WHERE id = ?', params: [id] });
    if (!existing) return res.status(404).json({ success: false, error: 'Cliente no encontrado' });

    const nombre = c.nombre || c.name;
    const fields = [], values = [];
    if (nombre) { fields.push('nombre = ?'); values.push(nombre); }
    if (c.telefono !== undefined) { fields.push('telefono = ?'); values.push(c.telefono); }
    if (c.email !== undefined) { fields.push('email = ?'); values.push(c.email); }
    if (c.direccion !== undefined) { fields.push('direccion = ?'); values.push(c.direccion); }
    if (c.tipo !== undefined) { fields.push('tipo = ?'); values.push(c.tipo); }
    if (c.estado !== undefined) { fields.push('estado = ?'); values.push(c.estado); }
    if (c.descuento !== undefined) { fields.push('descuento = ?'); values.push(c.descuento); }
    if (c.notas !== undefined) { fields.push('notas = ?'); values.push(c.notas); }
    if (c.cuit !== undefined) { fields.push('cuit = ?'); values.push(c.cuit); }
    if (c.totalFacturado !== undefined) { fields.push('total_facturado = ?'); values.push(c.totalFacturado); }
    if (c.cantidadTrabajos !== undefined) { fields.push('cantidad_trabajos = ?'); values.push(c.cantidadTrabajos); }
    if (c.ultimoTrabajo !== undefined) { fields.push('ultimo_trabajo = ?'); values.push(c.ultimoTrabajo); }
    if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });
    values.push(id);

    await db.run(`UPDATE clientes SET ${fields.join(', ')} WHERE id = ?`, values);
    const all = await db.all('SELECT * FROM clientes ORDER BY nombre ASC');
    await writeJSON(FILES.clientes, all.map(c => ({ ...c, name: c.nombre })));
    const updated = await db.get({ sql: 'SELECT * FROM clientes WHERE id = ?', params: [id] });
    res.json({ success: true, data: { ...updated, name: updated.nombre } });
  } catch (error) {
    logger.error('❌ Error actualizando cliente', { error: error.stack });
    res.status(500).json({ error: 'Error actualizando cliente' });
  }
});

app.delete('/api/clientes/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const existing = await db.get({ sql: 'SELECT id FROM clientes WHERE id = ?', params: [req.params.id] });
    if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
    await db.run('DELETE FROM clientes WHERE id = ?', [req.params.id]);
    const all = await db.all('SELECT * FROM clientes ORDER BY nombre ASC');
    await writeJSON(FILES.clientes, all.map(c => ({ ...c, name: c.nombre })));
    res.json({ success: true });
  } catch (error) {
    logger.error('❌ Error eliminando cliente', { error: error.stack });
    res.status(500).json({ error: 'Error eliminando cliente' });
  }
});

// Endpoint para registrar leads desde WhatsApp
app.post('/api/leads/whatsapp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Número de teléfono requerido' });
  }

  const filePath = FILES.clientes;
  try {
    const clientes = await readJSON(filePath);

    // Normalizar el número de teléfono (quitar @c.us)
    const normalizedPhone = phone.split('@')[0];

    // Verificar si el cliente ya existe (buscando en telefono, contact, o phone)
    const existingClient = clientes.find(c =>
      (c.telefono && c.telefono.includes(normalizedPhone)) ||
      (c.contact && c.contact.includes(normalizedPhone)) ||
      (c.phone && c.phone.includes(normalizedPhone))
    );

    if (existingClient) {
      return res.json({ success: true, message: 'Lead ya existente', client: existingClient.id });
    }

    // Si no existe, crearlo
    const newLead = {
      id: `cli_${Date.now()}`,
      nombre: `Lead WhatsApp ${normalizedPhone}`,
      telefono: normalizedPhone,
      tipo: 'Prospecto',
      origen: 'WhatsApp Bot',
      fechaCreacion: new Date().toISOString(),
      notas: 'Lead generado automáticamente por el Bot de WhatsApp.'
    };

    clientes.push(newLead);
    await writeJSON(filePath, clientes);

    logger.info('✅ Nuevo lead de WhatsApp registrado', { phone: normalizedPhone });
    res.status(201).json({ success: true, message: 'Nuevo lead creado', data: newLead });

  } catch (error) {
    logger.error('❌ Error registrando lead de WhatsApp', { error: error.stack });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==================== LEAD MANAGEMENT ENDPOINTS ====================

app.get('/api/leads', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const tiers = ['hot', 'warm', 'cold'];
    const leadsData = {};

    for (const tier of tiers) {
      const filePath = path.join(DATA_DIR, 'bot_whatsapp', `leads_${tier}.json`);
      try {
        await fs.access(filePath);
        const data = await fs.readFile(filePath, 'utf-8');
        const leads = JSON.parse(data);
        // Convertir el objeto de leads en un array y ordenar por fecha
        leadsData[tier] = Object.values(leads).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      } catch {
        leadsData[tier] = []; // Si el archivo no existe, devolver un array vacío
      }
    }

    res.json(leadsData);

  } catch (error) {
    logger.error('❌ Error leyendo los leads del bot', { error: error.stack });
    res.status(500).json({ error: 'Error al leer los leads' });
  }
});

// ==================== ENDPOINT RESETEO TOTAL Y PARCIAL ====================

app.post('/api/system/reset/:section?', verifyToken, requireRole(['superadmin']), async (req, res) => {
  const section = req.params.section;

  try {
    // Si no hay sección o es 'all', reseteo total
    if (!section || section === 'all') {
      logger.warn('⚠️ [API] Solicitud de reseteo TOTAL recibida', { user: req.user.usuario });
      for (const [name, filepath] of Object.entries(FILES)) {
        let initialData = [];
        if (name === 'trabajos') {
          initialData = { works: [], notifications: [] };
        } else if (name === 'business_rules') {
          initialData = { idealMargin: 35, deliveryStandardDays: 4, vipThreshold: 500000, priceStagnationDays: 30 };
        }
        await writeJSON(filepath, initialData);
      }
      logger.warn('✅ [API] Sistema reseteado completamente por el usuario', { user: req.user.usuario });
      return res.json({ success: true, message: 'Sistema reseteado completamente' });
    }

    // Reseteo parcial de una sección específica
    if (FILES[section]) {
      logger.warn(`⚠️ [API] Solicitud de reseteo PARCIAL: ${section}`, { user: req.user.usuario });
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
    logger.error('❌ [API] Error reseteando el sistema', { section, user: req.user.usuario, error: error.stack });
    res.status(500).json({ error: error.message });
  }
});

// ==================== ENDPOINT GOOGLE SYNC ====================

app.post('/api/sync/google', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    logger.info('🔄 Iniciando sincronización con Google Sheets...', { user: req.user.usuario });
    const result = await googleSync.syncData();
    res.json({ success: true, details: result });
  } catch (error) {
    logger.error('❌ Error en sincronización con Google', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ==================== ENDPOINT RESTAURAR AUDITORIA ====================

app.post('/api/system/restore-audit', verifyToken, requireRole(['superadmin']), async (req, res) => {
  const sourceDir = path.join(BASE_PATH, 'auditorias', 'datos_mr_letreros');

  // Mapeo de archivos a restaurar
  const filesToRestore = [
    { src: 'clientes.json', dest: FILES.clientes, name: 'Contactos (Clientes)' },
    { src: 'gremio_precios_db.json', dest: FILES.precios, name: 'Precios' },
    { src: 'gremio_materiales.json', dest: FILES.materiales, name: 'Materiales' },
    { src: 'gremio_costos_db.json', dest: FILES.costos, name: 'Costos' }
  ];

  try {
    // Verificar existencia del directorio de origen
    try {
      await fs.access(sourceDir);
    } catch {
      return res.status(404).json({ error: `No se encontró la carpeta de origen: ${sourceDir}` });
    }

    let restoredLog = [];
    let errorLog = [];

    for (const file of filesToRestore) {
      const srcPath = path.join(sourceDir, file.src);
      try {
        await fs.access(srcPath); // Verificar que el archivo existe
        await fs.copyFile(srcPath, file.dest); // Copiar (sobrescribir)
        restoredLog.push(file.name);
        logger.info(`✅ Restaurado desde auditoría: ${file.name}`);
      } catch (e) {
        errorLog.push(`${file.name} (No encontrado en origen)`);
        logger.warn(`⚠️ Salteado en restauración: ${file.name} - ${e.message}`);
      }
    }

    res.json({
      success: true,
      message: `Proceso finalizado.\n✅ Restaurados: ${restoredLog.length > 0 ? restoredLog.join(', ') : 'Ninguno'}.\n${errorLog.length > 0 ? '⚠️ No encontrados: ' + errorLog.join(', ') : ''}`
    });

  } catch (error) {
    logger.error('❌ Error en restauración de auditoría', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ==================== PUENTE CON BOT DE WHATSAPP ====================

app.post('/api/bot/send', verifyToken, requireRole(['admin', 'vendedor', 'superadmin']), async (req, res) => {
  try {
    // Reenviar la petición al proceso del bot (puerto 3001)
    // Usamos fetch nativo de Node 18+
    const response = await fetch('http://127.0.0.1:3001/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Error del bot: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    logger.error('Error comunicando con el bot de WhatsApp', { error: error.message });
    // Si el bot está apagado, avisar
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'El bot de WhatsApp parece estar apagado o desconectado.' });
    }
    res.status(500).json({ error: 'Error al enviar mensaje de WhatsApp' });
  }
});

// ==================== ENDPOINTS INSTAGRAM (MARKETING) ====================
// (Los duplicados de /api/calculadora/* fueron eliminados: Express usa el primero registrado)

app.get('/api/instagram/settings', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const data = await readJSON(FILES.instagram_settings);
    // Mascaramos el token
    if (data.accessToken) {
      data.accessToken = data.accessToken.substring(0, 10) + '...';
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error leyendo configuraciones de Instagram' });
  }
});

app.post('/api/instagram/settings', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const data = await readJSON(FILES.instagram_settings);
    if (req.body.pageId) data.pageId = req.body.pageId;
    if (req.body.accessToken && !req.body.accessToken.includes('...')) {
      data.accessToken = req.body.accessToken;
    }
    await writeJSON(FILES.instagram_settings, data);
    res.json({ success: true, message: 'Ajustes guardados.' });
  } catch (err) {
    res.status(500).json({ error: 'Error guardando configuraciones.' });
  }
});

const igUpload = multer({ dest: UPLOADS_TEMP_DIR });

app.post('/api/instagram/generate-copy', verifyToken, igUpload.single('image'), async (req, res) => {
  try {
    const provider = req.body.provider || 'gemini';
    let caption = "";

    if (provider === 'ollama') {
      // --- Lógica OLLAMA (Local) ---
      const botSettings = await readJSON(path.join(DATA_DIR, 'bot_whatsapp', 'bot_config.json'));
      const model = botSettings.ollamaVisionModel || botSettings.ollamaModel || 'gemma4:latest';

      const ollamaClient = new OpenAI({
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'ollama'
      });

      let promptText = "Eres el Community Manager de MR Letreros, la mejor fábrica de letras armadas, corpóreos, carteles de neón y marquesinas. Escribe un copy original y muy persuasivo y publicitario para Instagram destacando este trabajo. Usa lenguaje coloquial, amigable, que incite a enviar DM o WhatsApp para cotizaciones, e incluye 5 o 6 hashtags relevantes.";
      if (req.body.prompt && req.body.prompt.trim()) {
        promptText += " Además, ten en cuenta este contexto extra dado por el dueño: " + req.body.prompt;
      }

      const messages = [{
        role: 'user',
        content: [
          { type: 'text', text: promptText }
        ]
      }];

      if (req.file) {
        const imageBuffer = await fs.readFile(req.file.path);
        const imageBase64 = imageBuffer.toString("base64");
        messages[0].content.push({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
        });
        fs.unlink(req.file.path).catch(() => { });
      }

      const response = await ollamaClient.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: 800
      });
      caption = response.choices[0].message.content;

    } else {
      // --- Lógica GROQ (Cloud) ---
      let apiKey = process.env.GROQ_API_KEY || '';
      try {
        let botSettings = await readJSON(path.join(DATA_DIR, 'bot_whatsapp', 'bot_config.json'));
        if (botSettings.groqApiKey) apiKey = botSettings.groqApiKey;
      } catch (e) { }

      if (!apiKey) throw new Error("API Key de Groq no configurada.");

      const groqClient = new OpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: apiKey
      });

      // Usamos Llama 4 Scout (como en el bot)
      const model = 'meta-llama/llama-4-scout-17b-16e-instruct';

      let promptText = "Eres el Community Manager de MR Letreros, la mejor fábrica de letras armadas, corpóreos, carteles de neón y marquesinas. Escribe un copy original y muy persuasivo y publicitario para Instagram destacando este trabajo. Usa lenguaje coloquial, amigable, que incite a enviar DM o WhatsApp para cotizaciones, e incluye 5 o 6 hashtags relevantes.";
      if (req.body.prompt && req.body.prompt.trim()) {
        promptText += " Además, ten en cuenta este contexto extra dado por el dueño: " + req.body.prompt;
      }

      const messages = [{
        role: 'user',
        content: [
          { type: 'text', text: promptText }
        ]
      }];

      if (req.file) {
        const imageBuffer = await fs.readFile(req.file.path);
        const imageBase64 = imageBuffer.toString("base64");
        messages[0].content.push({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
        });
        fs.unlink(req.file.path).catch(() => { });
      }

      const response = await groqClient.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: 800
      });
      caption = response.choices[0].message.content;
    }

    res.json({ copy: caption });
  } catch (error) {
    logger.error('Error generando copy', { error: error.message });
    res.status(500).json({ error: 'Error generando texto con IA: ' + error.message });
    if (req.file) fs.unlink(req.file.path).catch(() => { });
  }
});

app.post('/api/instagram/publish', verifyToken, requireRole(['admin', 'superadmin']), igUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Imagen requerida.' });
    if (!req.body.caption) return res.status(400).json({ error: 'Falta la descripción.' });

    const settings = await readJSON(FILES.instagram_settings);
    if (!settings.pageId || !settings.accessToken) {
      fs.unlink(req.file.path).catch(() => { });
      return res.status(400).json({ error: 'Falta configurar credenciales desde Marketing.' });
    }

    const ig = new InstagramAPI(settings.pageId, settings.accessToken);

    // Optimizar para Instagram (1080x1080 máximo, formato jpg)
    const optimizedPath = path.join(UPLOADS_TEMP_DIR, `opt_${req.file.filename}.jpg`);
    await sharp(req.file.path).resize(1080, 1080, { fit: 'inside' }).jpeg({ quality: 90 }).toFile(optimizedPath);

    const postId = await ig.processAndPublish(optimizedPath, req.body.caption);

    fs.unlink(req.file.path).catch(() => { });
    fs.unlink(optimizedPath).catch(() => { });

    res.json({ success: true, postId });
  } catch (error) {
    logger.error('Error publicando en IG', { error: error.message });
    if (req.file) fs.unlink(req.file.path).catch(() => { });
    res.status(500).json({ error: error.message });
  }
});

// ==================== ENDPOINTS TAREAS INTERNAS ====================

app.get('/api/tareas', verifyToken, async (req, res) => {
  try {
    const tareas = await readJSON(FILES.tareas_internas).catch(() => []);
    res.json(tareas);
  } catch (error) {
    logger.error('Error GET /api/tareas', { error: error.message });
    res.status(500).json({ error: 'Error leyendo tareas' });
  }
});

app.post('/api/tareas', verifyToken, async (req, res) => {
  try {
    const tareas = await readJSON(FILES.tareas_internas).catch(() => []);
    const nuevaTarea = {
      id: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      titulo: req.body.titulo || 'Nueva Tarea',
      descripcion: req.body.descripcion || '',
      estado: req.body.estado || 'pendiente', // pendiente, en_proceso, completado
      archivos: req.body.archivos || [],
      fechaCreacion: new Date().toISOString(),
      creadoPor: req.user.nombre || req.user.usuario
    };
    tareas.push(nuevaTarea);
    await writeJSON(FILES.tareas_internas, tareas);
    res.json({ success: true, tarea: nuevaTarea });
  } catch (error) {
    logger.error('Error POST /api/tareas', { error: error.message });
    res.status(500).json({ error: 'Error creando tarea' });
  }
});

app.put('/api/tareas/:id', verifyToken, async (req, res) => {
  try {
    const tareas = await readJSON(FILES.tareas_internas).catch(() => []);
    const idx = tareas.findIndex(t => t.id === req.params.id);
    if (idx !== -1) {
      tareas[idx] = { ...tareas[idx], ...req.body };
      await writeJSON(FILES.tareas_internas, tareas);
      res.json({ success: true, tarea: tareas[idx] });
    } else {
      res.status(404).json({ error: 'Tarea no encontrada' });
    }
  } catch (error) {
    logger.error('Error PUT /api/tareas/:id', { error: error.message });
    res.status(500).json({ error: 'Error actualizando tarea' });
  }
});

app.delete('/api/tareas/:id', verifyToken, async (req, res) => {
  try {
    const tareas = await readJSON(FILES.tareas_internas).catch(() => []);
    const filtradas = tareas.filter(t => t.id !== req.params.id);
    await writeJSON(FILES.tareas_internas, filtradas);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error DELETE /api/tareas/:id', { error: error.message });
    res.status(500).json({ error: 'Error eliminando tarea' });
  }
});

// Multer specifically for Tareas
const uploadTareas = multer({
  dest: UPLOADS_TAREAS_DIR,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

app.post('/api/tareas/upload', verifyToken, uploadTareas.single('archivo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

    // Original extension handling
    const ext = path.extname(req.file.originalname);
    const newPath = req.file.path + ext;
    fs.rename(req.file.path, newPath).catch(err => console.error(err));

    res.json({
      success: true,
      filename: req.file.originalname,
      url: `/uploads/tareas/${req.file.filename}${ext}`
    });
  } catch (error) {
    logger.error('Error subiendo archivo de tarea', { error: error.message });
    res.status(500).json({ error: 'Error subiendo archivo' });
  }
});

// Proxy para procesar Nesting Polifan (FastAPI) evitando bloqueos de puerto 8000 y resolución mDNS en red local
const FormData = require('form-data');
const uploadMemory = multer({ storage: multer.memoryStorage() });

app.post('/api/nesting/nest-svg', verifyToken, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    form.append('sheet_width_mm', req.body.sheet_width_mm || 1350);
    form.append('spacing_mm', req.body.spacing_mm || 3);
    form.append('population_size', req.body.population_size || 20);
    form.append('generations', req.body.generations || 30);

    const pythonRes = await axios.post('http://localhost:8000/api/nesting/nest-svg', form, {
      headers: {
        ...form.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    res.json(pythonRes.data);
  } catch (error) {
    logger.error('Error proxying Nesting request to Python backend:', { error: error.message });
    res.status(500).json({
      error: 'Error al procesar el optimizador de plancha.',
      details: error.response ? error.response.data : error.message
    });
  }
});

// ==================== LOGS Y MANEJO DE ERRORES ====================

// Endpoint para ver los errores del servidor (lectura del archivo error.log)
app.get('/api/admin/logs', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const logPath = path.join(__dirname, 'error.log');

    try {
      await fs.access(logPath);
    } catch {
      return res.json({ logs: [], message: 'No hay errores registrados aún.' });
    }

    const data = await fs.readFile(logPath, 'utf-8');
    // Parsear líneas JSON de Winston y ordenarlas
    const logs = data
      .trim()
      .split('\n')
      .filter(line => line)
      .map(line => {
        try { return JSON.parse(line); } catch { return { message: line }; }
      })
      .reverse() // Más recientes primero
      .slice(0, 50); // Mostrar solo los últimos 50 errores

    res.json({ logs });
  } catch (error) {
    logger.error('Error leyendo logs', { error: error.message });
    res.status(500).json({ error: 'Error al leer logs' });
  }
});

// ==================== ENDPOINTS ADMINISTRACIÓN SQLITE ====================

// Lista todas las tablas relacionales SQLite con recuento de filas y esquema
app.get('/api/admin/relational-tables', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const dbModule = require('./db');
    const masterTables = await dbModule.all(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
    );
    const tables = [];
    for (const t of masterTables) {
      const countRow = await dbModule.get({ sql: `SELECT COUNT(*) as c FROM "${t.name}"` });
      const cols = await dbModule.all(`PRAGMA table_info("${t.name}")`);
      tables.push({
        name: t.name,
        rows: countRow ? countRow.c : 0,
        columns: cols.map(c => ({ name: c.name, type: c.type, pk: c.pk === 1 }))
      });
    }
    res.json({ total: tables.length, tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Devuelve los datos paginados/filtrados de una tabla relacional SQLite específica
app.get('/api/admin/relational-table/:tableName', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const dbModule = require('./db');
    const tableName = req.params.tableName;

    const masterCheck = await dbModule.get({
      sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? AND name NOT LIKE 'sqlite_%'",
      params: [tableName]
    });
    if (!masterCheck) {
      return res.status(404).json({ error: `La tabla '${tableName}' no existe en SQLite.` });
    }

    const cols = await dbModule.all(`PRAGMA table_info("${tableName}")`);
    const countRow = await dbModule.get({ sql: `SELECT COUNT(*) as c FROM "${tableName}"` });
    const limit = parseInt(req.query.limit) || 300;
    const offset = parseInt(req.query.offset) || 0;
    const search = (req.query.search || '').trim();

    let sql = `SELECT * FROM "${tableName}"`;
    let params = [];

    if (search) {
      const searchCols = cols.map(c => `"${c.name}" LIKE ?`).join(' OR ');
      sql += ` WHERE ${searchCols}`;
      params = cols.map(() => `%${search}%`);
    }

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await dbModule.all(sql, params);
    res.json({
      table: tableName,
      columns: cols,
      totalRows: countRow ? countRow.c : 0,
      count: rows.length,
      limit,
      offset,
      rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista todos los archivos almacenados en SQLite con metadata (JSON Store)
app.get('/api/admin/sqlite', verifyToken, requireRole(['admin', 'superadmin']), (req, res) => {
  const sqlite3 = require('sqlite3');
  const sqliteDb = new sqlite3.Database(
    path.join(DATA_DIR, 'mr_letreros.db'),
    sqlite3.OPEN_READONLY,
    (err) => { if (err) return res.status(500).json({ error: 'No se pudo abrir la base de datos SQLite.' }); }
  );
  sqliteDb.all(
    `SELECT key, length(value) AS bytes,
            datetime(CAST(updated_at AS INTEGER) / 1000, 'unixepoch', 'localtime') AS ultima_actualizacion
     FROM json_store ORDER BY updated_at DESC`,
    [],
    (err, rows) => {
      sqliteDb.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json({ total: rows.length, registros: rows });
    }
  );
});

// Devuelve el contenido JSON de una clave específica
app.get('/api/admin/sqlite/:key(*)', verifyToken, requireRole(['admin', 'superadmin']), (req, res) => {
  const sqlite3 = require('sqlite3');
  const key = req.params.key;
  const sqliteDb = new sqlite3.Database(
    path.join(DATA_DIR, 'mr_letreros.db'),
    sqlite3.OPEN_READONLY,
    (err) => { if (err) return res.status(500).json({ error: 'No se pudo abrir la base de datos SQLite.' }); }
  );
  sqliteDb.get('SELECT value, updated_at FROM json_store WHERE key = ?', [key], (err, row) => {
    sqliteDb.close();
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: `Clave '${key}' no encontrada en SQLite.` });
    try {
      const data = JSON.parse(row.value);
      const count = Array.isArray(data) ? data.length : (typeof data === 'object' ? Object.keys(data).length : 1);
      res.json({ key, ultima_actualizacion: new Date(row.updated_at).toLocaleString('es-AR'), registros: count, data });
    } catch (e) {
      res.json({ key, raw: row.value });
    }
  });
});

// Endpoint para generar un error de prueba (para verificar que el log funciona)
app.post('/api/admin/test-error', verifyToken, requireRole(['admin', 'superadmin']), (req, res) => {
  logger.error('🚨 Error de prueba generado manualmente por el administrador', {
    user: req.user.usuario,
    timestamp: new Date().toISOString()
  });
  res.json({ success: true, message: 'Error de prueba registrado en logs.' });
});

// Middleware global para capturar y loguear errores no manejados
app.use((err, req, res, next) => {
  logger.error('🔥 Error no capturado en Express:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    contentLength: req.headers['content-length']
  });

  if (!res.headersSent) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});



// ==================== INICIAR SERVIDOR ====================

initializeDataStructure().then(() => {
  // Verificar Python antes de iniciar el servidor web
  checkPython().then(pythonOk => {
    if (!pythonOk) {
      logger.warn('*********************************************************************');
      logger.warn('ADVERTENCIA: La función de nesting (Python) NO funcionará. Instala Python.');
      logger.warn('*********************************************************************');
    }
    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ El puerto ${PORT} ya está en uso por otro proceso. Cierra la otra instancia e intenta de nuevo.`);
        console.error(`\n❌ ERROR: El puerto ${PORT} ya está en uso por otro proceso.\n`);
      } else {
        logger.error('❌ Error en httpServer:', err);
      }
    });

    const serverInstance = httpServer.listen(PORT, '0.0.0.0', () => {
      // Publicar servicio en la red local via mDNS
      try {
        const bonjour = new Bonjour();
        bonjour.publish({ name: 'MR Letreros', type: 'http', port: PORT, host: 'mrletreros.local' });
        logger.info('🌐 mDNS activo: accedé desde otras PCs con http://mrletreros.local:' + PORT);
      } catch (mdnsErr) {
        logger.warn('⚠️ mDNS no disponible:', mdnsErr.message);
      }

      // Endpoint para sincronización manual con Google Sheets
      app.post('/api/sync-google', verifyToken, requireRole(['admin', 'superadmin', 'vendedor']), async (req, res) => {
        try {
          await googleSync.syncData(io);
          res.json({ success: true, message: 'Planilla de Google Sheets sincronizada correctamente.' });
        } catch (error) {
          logger.error('Error sincronizando con Google Sheets', { error: error.message });
          res.status(500).json({ success: false, error: error.message });
        }
      });

      // --- INICIAR SINCRONIZACIÓN AUTOMÁTICA CON GOOGLE ---
      logger.info('📡 Sincronización con Google activa (bucle no bloqueante cada 10 seg)');
      const runGoogleSyncLoop = async () => {
        try {
          await googleSync.syncData(io);
        } catch (err) {
          // Error controlado
        }
        setTimeout(runGoogleSyncLoop, 10000);
      };
      setTimeout(runGoogleSyncLoop, 2000);
    });

    // Manejo de cierre elegante (Graceful Shutdown)
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} recibido. Cerrando servidor limpiamente...`);
      if (serverInstance) {
        serverInstance.close(() => {
          logger.info('Servidor HTTP cerrado.');
          process.exit(0);
        });
        setTimeout(() => process.exit(1), 5000);
      } else {
        process.exit(0);
      }
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  });
});