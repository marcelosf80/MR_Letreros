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

// Usar variable de entorno o fallback seguro solo para desarrollo
const SECRET_KEY = process.env.JWT_SECRET || 'MR_LETREROS_SECURE_KEY_2024';

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
    logger.warn('Token inválido o expirado', { token: tokenString, error: err.message, ip: req.ip });
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

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { usuario, password } = req.body;

    // Leer usuario desde SQLite
    let user;
    try {
      user = await db.get({ sql: 'SELECT * FROM usuarios WHERE usuario = ? AND activo = 1', params: [usuario] });
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
      { id: user.id, usuario: user.usuario, rol: user.rol },
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
        rol: user.rol
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
    } catch (e) {}

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

    // Guardar en disco (backup y compatibilidad con C++/Google Sync)
    await fs.writeFile(filepath, jsonString);
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

async function getJobProductsAndPrices(job) {
  const items = [];
  
  // 1. Parsear notas de detalle si existen (para pedidos web o notas de unificación)
  const notesDetalle = (job.notes || []).filter(n => 
    n.author === 'Google Sync' || 
    n.author === 'Google' || 
    (n.text && (n.text.includes('PRODUCTO') || n.text.includes('ITEM') || n.text.includes('Detalle del pedido')))
  );
  
  if (notesDetalle.length > 0) {
    for (const note of notesDetalle) {
      const text = note.text || '';
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Regex para capturar "ITEM 1: Vinilo ... - $14.960" o similar
        const match = trimmed.match(/^(?:ITEM\s*\d+|P#\d+|PRODUCTO\s*\d+)\s*:\s*(.*?)\s*-\s*(\$?\s*[\d\.,]+)\s*$/i);
        if (match) {
          const name = match[1].trim();
          const price = match[2].trim();
          items.push({ name, price });
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
        items.push({ name, price });
      }
      
      for (const prod of productos) {
        const name = prod.name || prod.nombre || 'Producto';
        const price = (prod.total || prod.price) ? `$${Number(prod.total || prod.price).toLocaleString('es-AR')}` : '$0';
        items.push({ name, price });
      }
    }
  }
  
  // 3. Fallback: descripción del trabajo si no se obtuvo detalle de items
  if (items.length === 0 && job.descripcion) {
    const name = job.descripcion;
    const price = job.total ? `$${Number(job.total).toLocaleString('es-AR')}` : '$0';
    items.push({ name, price });
  }
  
  return items;
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
    is_merged: w.is_merged !== undefined ? w.is_merged : w.is_merged,
    mergedWorks: (() => {
      if (w.mergedWorks && Array.isArray(w.mergedWorks)) return w.mergedWorks;
      if (typeof w.merged_works_json === 'string') {
        try {
          return JSON.parse(w.merged_works_json);
        } catch (e) {}
      }
      if (Array.isArray(w.merged_works_json)) return w.merged_works_json;
      return [];
    })(),
    productos: (() => {
      if (w.productos && Array.isArray(w.productos)) return w.productos;
      if (typeof w.productos_json === 'string') {
        try {
          return JSON.parse(w.productos_json);
        } catch (e) {}
      }
      if (Array.isArray(w.productos_json)) return w.productos_json;
      return [];
    })(),
    costos: (() => {
      if (w.costos) return w.costos;
      if (typeof w.costos_json === 'string') {
        try {
          return JSON.parse(w.costos_json);
        } catch (e) {}
      }
      if (typeof w.costos_json === 'object') return w.costos_json;
      return { materiales: {}, terceros: {} };
    })(),
    notes: (() => {
      if (w.notes && Array.isArray(w.notes)) return w.notes;
      if (typeof w.notes_json === 'string') {
        try {
          return JSON.parse(w.notes_json);
        } catch (e) {}
      }
      if (Array.isArray(w.notes_json)) return w.notes_json;
      return [];
    })()
  };
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

  // Si nos quedan 10 dígitos (característica + número), agregamos el 549
  if (cleanPhone.length === 10) {
    phone = '549' + cleanPhone;
  } else {
    phone = '549' + cleanPhone;
  }

  let mensaje = '';
  try {
    const clientName = job.clientName || job.gremio || 'Cliente';
    
    // Obtener todos los productos y precios del trabajo principal y unificados
    let allItems = [];
    const mainItems = await getJobProductsAndPrices(job);
    allItems.push(...mainItems);
    
    if (job.mergedWorks && Array.isArray(job.mergedWorks)) {
      for (const mw of job.mergedWorks) {
        if (mw.quoteId) {
          const mwItems = await getJobProductsAndPrices(mw);
          allItems.push(...mwItems);
        }
      }
    }
    
    let itemsDetailText = '';
    if (allItems.length > 0) {
      itemsDetailText = `📦 *Detalle de productos:*\n`;
      allItems.forEach(item => {
        itemsDetailText += `• ${item.name}: *${item.price}*\n`;
      });
      itemsDetailText += `\n`;
    }
    
    const isUnified = job.mergedWorks && Array.isArray(job.mergedWorks) && job.mergedWorks.length > 0;
    const total = job.total ? `$${Number(job.total).toLocaleString('es-AR')}` : '';
    const totalLabel = isUnified ? '💰 *Total unificado:*' : '💰 *Total:*';
    
    mensaje = `*MR Letreros - ¡Tu pedido está listo!* ✅\n\n` +
              `Hola *${clientName}*, te informamos que tu trabajo ya está *terminado y listo para retirar*.\n\n` +
              `${itemsDetailText}` +
              `${total ? `${totalLabel} ${total}\n` : ''}` +
              `📍 *Retiro:* En nuestro taller, en horario de atención.\n\n` +
              `Si necesitás coordinar el envío o tenés alguna consulta, respondé este mensaje.\n\n` +
              `¡Gracias por confiar en nosotros! 🙌`;

    logger.info(`📲 Intentando enviar WhatsApp de retiro a ${phone}...`);
    const botRes = await fetch('http://localhost:3001/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, message: mensaje })
    });

    if (botRes.ok) {
      logger.info(`✅ WhatsApp de retiro enviado exitosamente a ${phone}`);
      return { success: true };
    } else {
      const errorText = await botRes.text();
      logger.error(`❌ El bot respondió con error al enviar notificación de retiro: ${errorText}`);
      return { success: false, error: errorText };
    }
  } catch (botErr) {
    logger.error(`❌ Error de conexión con el bot al enviar notificación de retiro: ${botErr.message}`);
    // GUARDAR EN COLA PENDIENTE
    try {
        const pendingFile = path.join(DATA_DIR, 'pending_messages.json');
        let pending = [];
        try {
            pending = JSON.parse(await fs.readFile(pendingFile, 'utf-8'));
        } catch (e) {}
        pending.push({ phone: phone, message: mensaje, date: new Date().toISOString() });
        await fs.writeFile(pendingFile, JSON.stringify(pending, null, 2));
        logger.info(`📥 Notificación guardada en cola pendiente para ${phone}`);
    } catch (queueErr) {
        logger.error(`❌ Error al guardar en cola pendiente: ${queueErr.message}`);
    }
    return { success: false, error: botErr.message, queued: true };
  }
}

// ==================== ENDPOINTS GREMIO CLIENTES ====================

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

// ==================== ENDPOINTS MATERIALES ====================

app.get('/api/materiales', async (req, res) => {
  try {
    const data = await readJSON(FILES.materiales);
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/materiales', { error: error.message });
    res.status(500).json({ error: 'Error al leer materiales' });
  }
});

app.post('/api/materiales', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const success = await writeJSON(FILES.materiales, req.body);
    logger.info('✅ Materiales actualizados por usuario', { user: req.user.usuario });
    res.json({ success });
  } catch (error) {
    logger.error('Error en POST /api/materiales', { error: error.message });
    res.status(500).json({ error: 'Error al salvar materiales' });
  }
});

// ==================== ENDPOINTS TERCEROS ====================


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
      logger.info('✅ Asistente actualizó trabajo:', trabajo.id);
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
app.get('/api/config/gemini-key', verifyToken, async (req, res) => {
  try {
    const key = await getGeminiApiKey();
    res.json({ key });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener la API Key de Groq (para visión en frontend)
app.get('/api/config/groq-key', verifyToken, async (req, res) => {
  try {
    const key = await getGroqApiKey();
    res.json({ key });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener la API Key de Fireworks (para visión en frontend)
app.get('/api/config/fireworks-key', verifyToken, async (req, res) => {
  try {
    const key = await getFireworksApiKey();
    res.json({ key });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SISTEMA DE VECTORIZACIÓN IA ====================

async function getGroqApiKey() {
  // 1. Variable de entorno (prioridad máxima)
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;

  // 2. bot_config.json
  try {
    const config = await readJSON(path.join(DATA_DIR, 'bot_whatsapp', 'bot_config.json'));
    if (config.groqApiKey && config.groqApiKey !== 'PEGAR_AQUÍ_TU_GROQ_KEY') {
      return config.groqApiKey;
    }
  } catch (e) { }

  // 3. whatsapp-bot-gemini.js (extracción por regex)
  try {
    const botFile = await fs.readFile(path.join(__dirname, 'whatsapp-bot-gemini.js'), 'utf-8');
    const match = botFile.match(/groqApiKey\s*:\s*(?:process\.env\.GROQ_API_KEY\s*\|\|\s*)?['"]([^'"]{20,})['"]/);
    if (match) return match[1];
    const match2 = botFile.match(/(gsk_[a-zA-Z0-9_]{20,})/);
    if (match2) return match2[1];
  } catch (e) { }

  return null;
}

async function getFireworksApiKey() {
  // Clave proporcionada por el usuario.
  return '58bc549eeade441588e0730a2c11ca0d.pnJjY0GysZN5aWcIX6CdUz7-';
}

async function getGeminiApiKey() {
  let key = process.env.GEMINI_API_KEY;
  if (!key) {
    try {
      const botConfigPath = path.join(__dirname, 'datos_mr_letreros', 'bot_whatsapp', 'bot_config.json');
      const botConfig = JSON.parse(await fs.readFile(botConfigPath, 'utf-8'));
      key = botConfig.geminiApiKey;
    } catch (e) { }
  }
  return key || 'AIzaSyCa0cYZYK3KE6tDsF0omv4Qo2fEyJvK3MI';
}

// 1. Análisis de imagen con Groq (Llama Vision)
async function analizarImagenConGroq(imagePath, prompt) {
  const apiKey = await getGroqApiKey();
  if (!apiKey) throw new Error("API Key de Groq no configurada");

  const groq = new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey });

  const imgBuffer = await fs.readFile(imagePath);
  const base64Image = imgBuffer.toString('base64');

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
    pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } }).threshold(240);
  }

  if (analisis.tiene_texto) {
    pipeline = pipeline.sharpen({ sigma: 1.5, m1: 0.5, m2: 3 });
  }

  await pipeline.png({ compressionLevel: 1 }).toFile(outputPath);
  return outputPath;
}

// 3. Vectorización con VTracer
async function vectorizarConVTracer(imagePngPath, params, outputSvgPath) {
  return new Promise((resolve, reject) => {
    const paramsJson = JSON.stringify(params);
    const scriptPath = path.join(BASE_PATH, 'vectorize.py');

    const proceso = spawn(pythonCmd, [
      scriptPath,
      '--input', imagePngPath,
      '--output', outputSvgPath,
      '--params', paramsJson
    ]);

    let stderr = '';
    proceso.stderr.on('data', d => stderr += d.toString());

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
async function vectorizarConStarVector(imagePngPath, outputSvgPath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(BASE_PATH, 'vectorize_starvector.py');

    const proceso = spawn(pythonCmd, [
      scriptPath,
      '--input', imagePngPath,
      '--output', outputSvgPath
    ]);

    let stderr = '';
    proceso.stderr.on('data', d => stderr += d.toString());

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
  const improveResolution = req.body.improve_resolution === 'true';
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

  try {
    logger.info(`[VECTORIZADOR] Iniciando trabajo ${jobId} usando método ${method}`, { file: req.file.originalname });

    // Usar Groq (Llama Vision) como primera opción
    let analisis;
    try {
      analisis = await analizarImagenConGroq(imagePath, vectorizerPrompt);
      logger.info(`[VECTORIZADOR] Análisis completado con Groq (Llama 4 Scout)`);
    } catch (groqError) {
      logger.warn(`[VECTORIZADOR] Falló Groq (${groqError.message}), intentando con Gemini...`);
      try {
        analisis = await analizarImagenConGemini(imagePath);
        logger.info(`[VECTORIZADOR] Análisis completado con Gemini`);
      } catch (geminiError) {
        logger.warn(`[VECTORIZADOR] Falló Gemini (${geminiError.message}), intentando con Fireworks.ai...`);
        analisis = await analizarImagenConFireworks(imagePath, vectorizerPrompt);
        logger.info(`[VECTORIZADOR] Análisis completado con Fireworks.ai`);
      }
    }

    const imgProcesada = await preprocesarImagen(imagePath, analisis, improveResolution, targetWidth);

    if (method === 'starvector') {
      logger.info(`[VECTORIZADOR] Procesando con StarVector...`);
      await vectorizarConStarVector(imgProcesada, svgPath);
    } else {
      logger.info(`[VECTORIZADOR] Procesando con VTracer...`);
      await vectorizarConVTracer(imgProcesada, analisis.params_vtracer, svgPath);
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

  try {
    const removebgKey = '668bsFxfi3i3iJemtV72ovYh'; // API Key proporcionada
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
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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

// Endpoint: Guardar en Cliente
app.post('/api/vectorizar/guardar', verifyToken, async (req, res) => {
  try {
    const { jobId, clientId, nombreArchivo } = req.body;
    if (!jobId || !clientId) return res.status(400).json({ error: 'Faltan datos (jobId, clientId)' });

    const sourceFile = path.join(UPLOADS_OUTPUT_DIR, `${jobId}.svg`);

    // Verificar existencia
    try {
      await fs.access(sourceFile);
    } catch {
      return res.status(404).json({ error: 'El archivo vectorial ha expirado o no existe.' });
    }

    // Crear carpeta del cliente si no existe
    const clientDir = path.join(UPLOADS_CLIENTS_DIR, clientId);
    await fs.mkdir(clientDir, { recursive: true });

    // Definir nombre final
    let finalName = nombreArchivo || `vectorizado_${jobId}`;
    finalName = finalName.replace(/[^a-z0-9\.\-_ ]/gi, '_').trim(); // Sanitizar
    if (!finalName.toLowerCase().endsWith('.svg')) finalName += '.svg';

    const destFile = path.join(clientDir, finalName);

    // Copiar archivo
    await fs.copyFile(sourceFile, destFile);

    logger.info(`[VECTORIZADOR] Archivo guardado en cliente ${clientId}: ${finalName}`);

    res.json({
      success: true,
      path: `/uploads/clientes/${clientId}/${finalName}`,
      message: 'Archivo guardado correctamente en la carpeta del cliente.'
    });

  } catch (e) {
    logger.error('Error guardando vectorización en cliente', e);
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

app.post('/api/process-file', (req, res) => {
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

app.post('/api/nesting/solve', (req, res) => {
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
        clientName: m.client_name || '',
        total: m.total || 0,
        descripcion: m.descripcion || ''
      });
    }

    const parsed = works.map(w => {
      const timeline = timelinesMap.get(w.id) || [];
      const mergedWorks = (() => {
        try {
          if (w.merged_works_json && w.merged_works_json !== '[]') {
            return JSON.parse(w.merged_works_json);
          }
        } catch (e) {}
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

    await db.run('BEGIN TRANSACTION');
    try {
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
        const clientProductos = JSON.stringify(w.productos || w.items || []);
        const clientIsMerged = (w.mergedWorks && w.mergedWorks.length > 0) ? 1 : 0;
        const clientCostos = JSON.stringify(w.costos || { materiales: {}, terceros: {} });
        const clientNotes = JSON.stringify(w.notes || []);
        const clientMergedWorks = JSON.stringify(w.mergedWorks || []);
        const clientPrinted = w.printed ? 1 : 0;
        const clientPrintedItems = JSON.stringify(w.printedItems || {});

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

        await db.run(
          `INSERT OR REPLACE INTO trabajos
           (id, quote_id, cliente_id, cliente_nombre, cliente_telefono, cliente_email, cliente_address,
            tipo_cliente, descripcion, total, total_cost, profit, paid_amount, balance, senia,
            status, payment_status, priority, delivery_date, delivery_status, actual_delivery_date,
            paid_at, created_at, productos_json, is_merged, costos_json, notes_json, merged_works_json,
            printed, printed_items_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [w.id, w.quoteId || null, clienteId, w.clientName || '', w.clientPhone || '',
           w.clientEmail || '', w.clientAddress || '', w.tipo_cliente || 'gremio',
           w.descripcion || '', w.total || 0, w.totalCost || 0, w.profit || 0,
           w.paidAmount || 0, w.balance || 0, w.senia || 0,
           w.status || 'pending', w.paymentStatus || 'unpaid', w.priority || 'normal',
           w.deliveryDate || null, w.deliveryStatus || 'pending',
           w.actualDeliveryDate || null, w.paidAt || null, w.createdAt || null,
           clientProductos, clientIsMerged, clientCostos, clientNotes, clientMergedWorks,
           clientPrinted, clientPrintedItems]
        );

        // Regenerar timeline
        await db.run('DELETE FROM trabajo_timeline WHERE trabajo_id = ?', [w.id]);
        if (Array.isArray(w.timeline)) {
          for (const t of w.timeline) {
            await db.run(
              'INSERT INTO trabajo_timeline (trabajo_id, type, description, timestamp) VALUES (?,?,?,?)',
              [w.id, t.type || '', t.description || '', t.timestamp || null]
            );
          }
        }

        // Regenerar mergedWorks
        await db.run('DELETE FROM trabajo_merger WHERE trabajo_principal_id = ?', [w.id]);
        if (Array.isArray(w.mergedWorks)) {
          for (const mw of w.mergedWorks) {
            await db.run(
              'INSERT INTO trabajo_merger (trabajo_principal_id, trabajo_secundario_id, quote_id, client_name, total, descripcion, merged_at) VALUES (?,?,?,?,?,?,?)',
              [w.id, mw.id || '', mw.quoteId || null, mw.clientName || '', mw.total || 0, mw.descripcion || '', mw.mergedAt || new Date().toISOString()]
            );
          }
        }
      }
      await db.run('COMMIT');
    } catch (e) {
      await db.run('ROLLBACK');
      throw e;
    }

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
      } catch(e) {}
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
          fullUrl: file.fullUrl
        });
      } else {
        images.push({
          id: file.id,
          name: file.name,
          thumbData: null,
          fullUrl: file.fullUrl
        });
      }
    }

    logger.info(`✨ [Drive Scraper] Éxito: Encontrados ${images.length} archivos para la carpeta ${folderId}`);
    return res.json(images);

  } catch (error) {
    logger.error('Error al realizar scraping de la carpeta de Drive', { error: error.message, folderId });
    res.status(500).json({ error: 'Error al consultar imágenes de Drive' });
  }
});

// NUEVO: Endpoint público para recibir trabajos del cotizador externo
app.post('/api/public/trabajo', async (req, res) => {
  logger.info('🔔 Procesando endpoint /api/public/trabajo');
  try {
    const nuevoTrabajo = req.body;
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
      logger.info('📩 Trabajo guardado exitosamente:', nuevoTrabajo.clientName);
      
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
      printed: 'printed', printedItems: 'printed_items_json'
    };
    const fields = [], values = [];
    for (const [k, col] of Object.entries(fieldMap)) {
      if (updates[k] !== undefined) {
        fields.push(`${col} = ?`);
        let val = updates[k];
        if ((k === 'costos' || k === 'notes' || k === 'mergedWorks' || k === 'printedItems') && typeof val === 'object') {
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
          'INSERT INTO trabajo_merger (trabajo_principal_id, trabajo_secundario_id, quote_id, client_name, total, descripcion, merged_at) VALUES (?,?,?,?,?,?,?)',
          [id, mw.id || '', mw.quoteId || null, mw.clientName || '', mw.total || 0, mw.descripcion || '', mw.mergedAt || new Date().toISOString()]
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
    await writeJSON(FILES.trabajos, { works: allWorks, notifications: [] });

    const trabajo = { ...existing, ...updates };
    logger.info(`✅ Trabajo actualizado en SQLite: ${id}`);

    const io = req.app.get('socketio');
    if (io) io.emit('works_updated', { id, updates, source: 'put_api' });

    if (updates.status && oldStatus !== updates.status &&
        ['completed', 'ready', 'para_retirar'].includes(updates.status)) {
      await enviarNotificacionTrabajoListo(trabajo);
    }

    res.json({ success: true, data: trabajo });
  } catch (error) {
    logger.error('Error actualizando trabajo en SQLite', { id, error: error.stack });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// NUEVO: Endpoint para reenviar el mensaje de listo
app.post('/api/trabajos/:id/reenviar-listo', verifyToken, async (req, res) => {
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
      await db.run('BEGIN TRANSACTION');
      try {
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
        await db.run('COMMIT');
      } catch (e) {
        await db.run('ROLLBACK');
        throw e;
      }
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
      const filePath = path.join(__dirname, 'data', `leads_${tier}.json`);
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

app.post('/api/bot/send', verifyToken, async (req, res) => {
  try {
    // Reenviar la petición al proceso del bot (puerto 3001)
    // Usamos fetch nativo de Node 18+
    const response = await fetch('http://localhost:3001/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
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

// ==================== ENDPOINTS CALCULADORA DE VECTORES ====================

app.get('/api/calculadora/costos', async (req, res) => {
  try {
    const data = await readJSON(FILES.calc_costos).catch(() => ({ cutCostPerCm: 10, laborCost: 0 }));
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/calculadora/costos', { error: error.message });
    res.status(500).json({ error: 'Error al leer la configuración de costos' });
  }
});

app.post('/api/calculadora/costos', verifyToken, async (req, res) => {
  try {
    const data = req.body;
    await writeJSON(FILES.calc_costos, data);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error en POST /api/calculadora/costos', { error: error.message });
    res.status(500).json({ error: 'Error al guardar la configuración de costos' });
  }
});

app.get('/api/calculadora/precios', async (req, res) => {
  try {
    const data = await readJSON(FILES.calc_precios).catch(() => ({ cutPricePerCm: 25, laborPrice: 0, markup: 2.5 }));
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /api/calculadora/precios', { error: error.message });
    res.status(500).json({ error: 'Error al leer la configuración de precios' });
  }
});

app.post('/api/calculadora/precios', verifyToken, async (req, res) => {
  try {
    const data = req.body;
    await writeJSON(FILES.calc_precios, data);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error en POST /api/calculadora/precios', { error: error.message });
    res.status(500).json({ error: 'Error al guardar la configuración de precios' });
  }
});

// ==================== ENDPOINTS INSTAGRAM (MARKETING) ====================

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
                fs.unlink(req.file.path).catch(()=>{});
            }

            const response = await ollamaClient.chat.completions.create({
                model: model,
                messages: messages,
                max_tokens: 800
            });
            caption = response.choices[0].message.content;

        } else {
            // --- Lógica GROQ (Cloud) ---
            let apiKey = process.env.GROQ_API_KEY || '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';
            try {
                let botSettings = await readJSON(path.join(DATA_DIR, 'bot_whatsapp', 'bot_config.json'));
                if (botSettings.groqApiKey) apiKey = botSettings.groqApiKey;
            } catch(e) {}
            
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
                fs.unlink(req.file.path).catch(()=>{});
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
        if (req.file) fs.unlink(req.file.path).catch(()=>{});
    }
});

app.post('/api/instagram/publish', verifyToken, requireRole(['admin', 'superadmin']), igUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Imagen requerida.' });
        if (!req.body.caption) return res.status(400).json({ error: 'Falta la descripción.' });

        const settings = await readJSON(FILES.instagram_settings);
        if (!settings.pageId || !settings.accessToken) {
            fs.unlink(req.file.path).catch(()=>{});
            return res.status(400).json({ error: 'Falta configurar credenciales desde Marketing.' });
        }

        const ig = new InstagramAPI(settings.pageId, settings.accessToken);
        
        // Optimizar para Instagram (1080x1080 máximo, formato jpg)
        const optimizedPath = path.join(UPLOADS_TEMP_DIR, `opt_${req.file.filename}.jpg`);
        await sharp(req.file.path).resize(1080, 1080, { fit: 'inside' }).jpeg({ quality: 90 }).toFile(optimizedPath);
        
        const postId = await ig.processAndPublish(optimizedPath, req.body.caption);
        
        fs.unlink(req.file.path).catch(()=>{});
        fs.unlink(optimizedPath).catch(()=>{});
        
        res.json({ success: true, postId });
    } catch (error) {
        logger.error('Error publicando en IG', { error: error.message });
        if (req.file) fs.unlink(req.file.path).catch(()=>{});
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
      id: `task_${Date.now()}_${Math.floor(Math.random()*1000)}`,
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

// Lista todos los archivos almacenados en SQLite con metadata
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

      // --- INICIAR SINCRONIZACIÓN AUTOMÁTICA CON GOOGLE ---
      logger.info('📡 Sincronización con Google activa (cada 30 seg)');
      // Primera sync al arrancar
      setTimeout(() => googleSync.syncData(io).catch(() => {}), 5000);
      setInterval(async () => {
        try {
          await googleSync.syncData(io);
        } catch (err) {
          // Error silencioso
        }
      }, 30000); // 30 segundos
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