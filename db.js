// c:\MR_Letreros\db.js
// Base de Datos SQLite - MR Letreros
// Almacén de documentos JSON + Tablas relacionales para entidades críticas

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const DB_PATH = path.join('C:\\MR_Letreros', 'datos_mr_letreros', 'mr_letreros.db');

let db = null;

// ==================== HELPERS ASYNC ====================

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('DB no inicializada'));
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(key) {
  // Overload: si recibe un objeto {sql, params} usa SQL directo
  if (typeof key === 'object' && key.sql) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB no inicializada'));
      db.get(key.sql, key.params || [], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }
  // Modo documento: busca en json_store
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('DB no inicializada'));
    db.get('SELECT value, updated_at FROM json_store WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sqlOrKey, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('DB no inicializada'));
    db.all(sqlOrKey, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function set(key, value, updatedAt) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('DB no inicializada'));
    db.run(
      'REPLACE INTO json_store (key, value, updated_at) VALUES (?, ?, ?)',
      [key, value, updatedAt],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

function transaction(fn) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('DB no inicializada'));
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      Promise.resolve(fn()).then(result => {
        db.run('COMMIT', () => resolve(result));
      }).catch(err => {
        db.run('ROLLBACK', () => reject(err));
      });
    });
  });
}

// ==================== SCHEMA ====================

const SCHEMA = `
  -- Almacén de documentos JSON (compatibilidad)
  CREATE TABLE IF NOT EXISTS json_store (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER
  );

  -- Usuarios del sistema
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    usuario TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'vendedor',
    activo INTEGER NOT NULL DEFAULT 1,
    fecha_creacion TEXT
  );

  -- Clientes (gremio y final unificados)
  CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    telefono TEXT DEFAULT '',
    email TEXT DEFAULT '',
    direccion TEXT DEFAULT '',
    tipo TEXT NOT NULL DEFAULT 'gremio',
    estado TEXT DEFAULT 'activo',
    descuento REAL DEFAULT 0,
    notas TEXT DEFAULT '',
    cuit TEXT DEFAULT '',
    condicion_iva TEXT DEFAULT '',
    total_facturado REAL DEFAULT 0,
    cantidad_trabajos INTEGER DEFAULT 0,
    ultimo_trabajo TEXT,
    fecha_creacion TEXT,
    fecha_registro TEXT
  );

  -- Trabajos aprobados
  CREATE TABLE IF NOT EXISTS trabajos (
    id TEXT PRIMARY KEY,
    quote_id TEXT,
    cliente_id TEXT,
    cliente_nombre TEXT,
    cliente_telefono TEXT DEFAULT '',
    cliente_email TEXT DEFAULT '',
    cliente_address TEXT DEFAULT '',
    tipo_cliente TEXT DEFAULT 'gremio',
    descripcion TEXT DEFAULT '',
    total REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    profit REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    senia REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    priority TEXT DEFAULT 'normal',
    delivery_date TEXT,
    delivery_status TEXT DEFAULT 'pending',
    actual_delivery_date TEXT,
    paid_at TEXT,
    created_at TEXT,
    productos_json TEXT DEFAULT '[]',
    is_merged INTEGER DEFAULT 0,
    costos_json TEXT DEFAULT '{}',
    notes_json TEXT DEFAULT '[]',
    merged_works_json TEXT DEFAULT '[]',
    printed INTEGER DEFAULT 0,
    printed_items_json TEXT DEFAULT '{}',
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  );

  -- Timeline de eventos de cada trabajo
  CREATE TABLE IF NOT EXISTS trabajo_timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trabajo_id TEXT NOT NULL,
    type TEXT,
    description TEXT,
    timestamp TEXT,
    FOREIGN KEY (trabajo_id) REFERENCES trabajos(id)
  );

  -- Pagos parciales de cada trabajo
  CREATE TABLE IF NOT EXISTS trabajo_pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trabajo_id TEXT NOT NULL,
    monto REAL NOT NULL,
    fecha TEXT,
    nota TEXT DEFAULT '',
    FOREIGN KEY (trabajo_id) REFERENCES trabajos(id)
  );

  -- Relación de unificaciones entre trabajos
  CREATE TABLE IF NOT EXISTS trabajo_merger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trabajo_principal_id TEXT NOT NULL,
    trabajo_secundario_id TEXT NOT NULL,
    quote_id TEXT,
    client_name TEXT,
    total REAL DEFAULT 0,
    descripcion TEXT DEFAULT '',
    merged_at TEXT,
    FOREIGN KEY (trabajo_principal_id) REFERENCES trabajos(id)
  );

  -- Tabla de precios unificada (gremio + cliente)
  CREATE TABLE IF NOT EXISTS precios (
    id TEXT PRIMARY KEY,
    producto_id TEXT,
    categoria TEXT DEFAULT '',
    producto TEXT NOT NULL,
    costo REAL DEFAULT 0,
    area REAL DEFAULT 0,
    precio_gremio REAL DEFAULT 0,
    precio_cliente REAL DEFAULT 0,
    unidad TEXT DEFAULT 'm2',
    created_at TEXT
  );

  -- Materiales / inventario de rollos
  CREATE TABLE IF NOT EXISTS materiales (
    id TEXT PRIMARY KEY,
    categoria TEXT DEFAULT '',
    producto_nombre TEXT NOT NULL,
    producto TEXT DEFAULT '',
    unidad TEXT DEFAULT 'm2',
    ancho REAL DEFAULT 1,
    largo REAL DEFAULT 1,
    m2 REAL DEFAULT 0,
    precio_rollo REAL DEFAULT 0,
    costo_por_m2 REAL DEFAULT 0,
    ultima_actualizacion TEXT,
    fecha TEXT
  );

  -- Terceros/proveedores
  CREATE TABLE IF NOT EXISTS terceros (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    telefono TEXT DEFAULT '',
    categoria TEXT DEFAULT '',
    precio_base REAL DEFAULT 0,
    notas TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    created_at TEXT
  );

  -- Tareas internas
  CREATE TABLE IF NOT EXISTS tareas (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    estado TEXT DEFAULT 'pendiente',
    archivos_json TEXT DEFAULT '[]',
    fecha_creacion TEXT,
    creado_por TEXT DEFAULT 'admin'
  );

  -- Gastos
  CREATE TABLE IF NOT EXISTS gastos (
    id TEXT PRIMARY KEY,
    descripcion TEXT NOT NULL,
    monto REAL DEFAULT 0,
    categoria TEXT DEFAULT '',
    fecha TEXT,
    created_by TEXT DEFAULT '',
    notas TEXT DEFAULT ''
  );
`;

// ==================== MIGRACIÓN DESDE JSON ====================

async function migrateFromJson() {
  const DATA_DIR = path.join('C:\\MR_Letreros', 'datos_mr_letreros');

  function readJson(filename) {
    try {
      const content = fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }

  // --- Usuarios ---
  const usrCount = await get({ sql: 'SELECT COUNT(*) as c FROM usuarios' });
  if (usrCount.c === 0) {
    const usuarios = readJson('usuarios.json');
    if (Array.isArray(usuarios)) {
      for (const u of usuarios) {
        try {
          await run(
            `INSERT OR IGNORE INTO usuarios (id, nombre, usuario, password, rol, activo, fecha_creacion)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [u.id, u.nombre || u.usuario, u.usuario, u.password, u.rol || 'vendedor',
             u.activo !== false ? 1 : 0, u.fechaCreacion || new Date().toISOString()]
          );
        } catch (e) { /* skip duplicates */ }
      }
      logger.info(`   👤 Migrados ${usuarios.length} usuarios a SQLite`);
    }
  }

  // --- Clientes ---
  const cliCount = await get({ sql: 'SELECT COUNT(*) as c FROM clientes' });
  if (cliCount.c === 0) {
    const clientes = readJson('clientes.json');
    if (Array.isArray(clientes)) {
      for (const c of clientes) {
        try {
          const nombre = c.nombre || c.name || 'Sin nombre';
          await run(
            `INSERT OR IGNORE INTO clientes
             (id, nombre, telefono, email, direccion, tipo, estado, descuento, notas,
              cuit, condicion_iva, total_facturado, cantidad_trabajos, ultimo_trabajo,
              fecha_creacion, fecha_registro)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [c.id, nombre, c.telefono || '', c.email || '', c.direccion || '',
             c.tipo || 'gremio', c.estado || 'activo', c.descuento || 0, c.notas || '',
             c.cuit || '', c.condicionIVA || '', c.totalFacturado || 0,
             c.cantidadTrabajos || 0, c.ultimoTrabajo || null,
             c.fechaCreacion || c.fechaRegistro || null, c.fechaRegistro || c.fechaCreacion || null]
          );
        } catch (e) { /* skip duplicates */ }
      }
      logger.info(`   👥 Migrados ${clientes.length} clientes a SQLite`);
    }
  }

  // --- Precios ---
  const precCount = await get({ sql: 'SELECT COUNT(*) as c FROM precios' });
  if (precCount.c === 0) {
    const precios = readJson('gremio_precios_db.json');
    if (Array.isArray(precios)) {
      for (const p of precios) {
        try {
          await run(
            `INSERT OR IGNORE INTO precios
             (id, producto_id, categoria, producto, costo, area, precio_gremio, precio_cliente, unidad, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [p.id || p.productoId, p.productoId || p.id, p.categoria || '',
             p.producto || p.nombre || '', p.costo || 0, p.area || 0,
             p.precioGremio || 0, p.precioCliente || 0, p.unidad || 'm2',
             p.createdAt || new Date().toISOString()]
          );
        } catch (e) { /* skip duplicates */ }
      }
      logger.info(`   💰 Migrados ${precios.length} precios a SQLite`);
    }
  }

  // --- Materiales ---
  const matCount = await get({ sql: 'SELECT COUNT(*) as c FROM materiales' });
  if (matCount.c === 0) {
    const mats = readJson('gremio_materiales.json');
    if (Array.isArray(mats)) {
      for (const m of mats) {
        try {
          await run(
            `INSERT OR IGNORE INTO materiales
             (id, categoria, producto_nombre, producto, unidad, ancho, largo, m2, precio_rollo, costo_por_m2, fecha)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [m.id, m.categoria || '', m.productoNombre || m.producto || '',
             m.producto || m.productoNombre || '', m.unidad || 'm2',
             m.ancho || 1, m.largo || 1, m.m2 || 0,
             m.precioRollo || 0, m.costoPorM2 || 0, m.fecha || null]
          );
        } catch (e) { /* skip duplicates */ }
      }
      logger.info(`   📦 Migrados ${mats.length} materiales a SQLite`);
    }
  }

  // --- Terceros ---
  const tercCount = await get({ sql: 'SELECT COUNT(*) as c FROM terceros' });
  if (tercCount.c === 0) {
    const terceros = readJson('gremio_terceros.json');
    if (Array.isArray(terceros)) {
      for (const t of terceros) {
        try {
          await run(
            `INSERT OR IGNORE INTO terceros (id, nombre, telefono, categoria, precio_base, notas, activo, created_at)
             VALUES (?,?,?,?,?,?,?,?)`,
            [t.id, t.nombre || '', t.telefono || '', t.categoria || '',
             t.precioBase || t.precio || 0, t.notas || '',
             t.activo !== false ? 1 : 0, t.fechaCreacion || new Date().toISOString()]
          );
        } catch (e) { /* skip duplicates */ }
      }
      logger.info(`   🚚 Migrados ${terceros.length} terceros a SQLite`);
    }
  }

  // --- Tareas ---
  const tarCount = await get({ sql: 'SELECT COUNT(*) as c FROM tareas' });
  if (tarCount.c === 0) {
    const tareas = readJson('tareas_internas.json');
    if (Array.isArray(tareas)) {
      for (const t of tareas) {
        try {
          await run(
            `INSERT OR IGNORE INTO tareas (id, titulo, descripcion, estado, archivos_json, fecha_creacion, creado_por)
             VALUES (?,?,?,?,?,?,?)`,
            [t.id, t.titulo || '', t.descripcion || '', t.estado || 'pendiente',
             JSON.stringify(t.archivos || []), t.fechaCreacion || null, t.creadoPor || 'admin']
          );
        } catch (e) { /* skip duplicates */ }
      }
      logger.info(`   ✅ Migradas ${tareas.length} tareas a SQLite`);
    }
  }

  // --- Trabajos (la más compleja) ---
  const trabCount = await get({ sql: 'SELECT COUNT(*) as c FROM trabajos' });
  if (trabCount.c === 0) {
    const trabData = readJson('trabajos.json');
    const works = trabData?.works || (Array.isArray(trabData) ? trabData : []);
    let migrated = 0;

    for (const w of works) {
      try {
        // Buscar cliente_id por nombre
        const clienteRow = await get({ sql: 'SELECT id FROM clientes WHERE nombre = ? LIMIT 1', params: [w.clientName || ''] });
        const clienteId = clienteRow?.id || null;

        await run(
          `INSERT OR IGNORE INTO trabajos
           (id, quote_id, cliente_id, cliente_nombre, cliente_telefono, cliente_email, cliente_address,
            tipo_cliente, descripcion, total, total_cost, profit, paid_amount, balance, senia,
            status, payment_status, priority, delivery_date, delivery_status, actual_delivery_date,
            paid_at, created_at, productos_json, is_merged, costos_json, notes_json, merged_works_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [w.id, w.quoteId || null, clienteId, w.clientName || '', w.clientPhone || '',
           w.clientEmail || '', w.clientAddress || '', w.tipo_cliente || 'gremio',
           w.descripcion || '', w.total || 0, w.totalCost || 0, w.profit || 0,
           w.paidAmount || 0, w.balance || 0, w.senia || 0,
           w.status || 'pending', w.paymentStatus || 'unpaid', w.priority || 'normal',
           w.deliveryDate || null, w.deliveryStatus || 'pending',
           w.actualDeliveryDate || null, w.paidAt || null, w.createdAt || null,
           JSON.stringify(w.productos || w.items || []),
           (w.mergedWorks && w.mergedWorks.length > 0) ? 1 : 0,
           JSON.stringify(w.costos || { materiales: {}, terceros: {} }),
           JSON.stringify(w.notes || []),
           JSON.stringify(w.mergedWorks || [])]
        );

        // Timeline
        if (Array.isArray(w.timeline)) {
          for (const t of w.timeline) {
            await run(
              `INSERT INTO trabajo_timeline (trabajo_id, type, description, timestamp) VALUES (?,?,?,?)`,
              [w.id, t.type || '', t.description || '', t.timestamp || null]
            );
          }
        }

        // Unificaciones (mergedWorks → tabla relacional)
        if (Array.isArray(w.mergedWorks)) {
          for (const mw of w.mergedWorks) {
            await run(
              `INSERT OR IGNORE INTO trabajo_merger
               (trabajo_principal_id, trabajo_secundario_id, quote_id, client_name, total, descripcion, merged_at)
               VALUES (?,?,?,?,?,?,?)`,
              [w.id, mw.id || mw.workId || '', mw.quoteId || null,
               mw.clientName || '', mw.total || 0, mw.descripcion || '',
               mw.mergedAt || new Date().toISOString()]
            );
          }
        }

        migrated++;
      } catch (e) {
        logger.warn(`   ⚠️ No se pudo migrar trabajo ${w.id}: ${e.message}`);
      }
    }
    logger.info(`   🔨 Migrados ${migrated}/${works.length} trabajos a SQLite`);
  }

  // --- Gastos ---
  const gastCount = await get({ sql: 'SELECT COUNT(*) as c FROM gastos' });
  if (gastCount.c === 0) {
    const gastos = readJson('mr_letreros_gastos.json');
    if (Array.isArray(gastos)) {
      for (const g of gastos) {
        try {
          await run(
            `INSERT OR IGNORE INTO gastos (id, descripcion, monto, categoria, fecha, created_by, notas)
             VALUES (?,?,?,?,?,?,?)`,
            [g.id || `gasto_${Date.now()}_${Math.random().toString(36).slice(-4)}`,
             g.descripcion || g.concepto || '', g.monto || g.importe || 0,
             g.categoria || '', g.fecha || null, g.createdBy || g.usuario || '',
             g.notas || g.observaciones || '']
          );
        } catch (e) { /* skip duplicates */ }
      }
      logger.info(`   💳 Migrados ${gastos.length} gastos a SQLite`);
    }
  }
}

// ==================== INIT ====================

function init() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        logger.error('❌ Error al abrir SQLite:', err);
        return reject(err);
      }

      // Activar FK y WAL mode para mejor concurrencia
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;', (err) => {
        if (err) logger.warn('⚠️ No se pudo activar PRAGMA:', err.message);
      });

      db.exec(SCHEMA, async (err) => {
        if (err) {
          logger.error('❌ Error al crear schema SQLite:', err);
          return reject(err);
        }
        logger.info('✅ SQLite: Schema relacional inicializado.');
        
        // Agregar columna costos_json de forma incremental si no existe
        db.run('ALTER TABLE trabajos ADD COLUMN costos_json TEXT DEFAULT "{}"', () => {
          // Agregar columna notes_json de forma incremental si no existe
          db.run('ALTER TABLE trabajos ADD COLUMN notes_json TEXT DEFAULT "[]"', () => {
            // Agregar columna merged_works_json de forma incremental si no existe
            db.run('ALTER TABLE trabajos ADD COLUMN merged_works_json TEXT DEFAULT "[]"', () => {
              // Agregar columna printed de forma incremental si no existe
              db.run('ALTER TABLE trabajos ADD COLUMN printed INTEGER DEFAULT 0', () => {
                // Agregar columna printed_items_json de forma incremental si no existe
                db.run('ALTER TABLE trabajos ADD COLUMN printed_items_json TEXT DEFAULT "{}"', async (alterErr) => {
                  try {
                    await migrateFromJson();
                    resolve();
                  } catch (migErr) {
                    logger.error('❌ Error en migración JSON→SQLite:', migErr);
                    reject(migErr);
                  }
                });
              });
            });
          });
        });
      });
    });
  });
}

module.exports = { init, run, get, all, set, transaction };
