const fs = require('fs');
const path = require('path');

// Rutas base
const DATA_DIR = path.join(__dirname, 'datos_mr_letreros');
const UNIFIED_FILE = path.join(DATA_DIR, 'clientes.json');

// Intentar localizar el archivo antiguo
// Prioridad 1: Carpeta 'auditorias' dentro del proyecto
let OLD_FILE = path.join(__dirname, 'auditorias', 'gremio', 'clientes.json');

// Prioridad 2: Carpeta 'auditoria' (singular) dentro del proyecto
if (!fs.existsSync(OLD_FILE)) {
    OLD_FILE = path.join(__dirname, 'auditoria', 'gremio', 'clientes.json');
}

// Prioridad 3: Ruta estándar antigua del sistema gremio en datos_mr_letreros
if (!fs.existsSync(OLD_FILE)) {
    OLD_FILE = path.join(DATA_DIR, 'gremio', 'clientes.json');
}

async function migrate() {
    console.log('🚀 Iniciando migración de clientes...');
    console.log(`📂 Buscando archivo antiguo en: ${OLD_FILE}`);

    if (!fs.existsSync(OLD_FILE)) {
        console.error(`❌ No se encontró el archivo de clientes antiguos.`);
        console.log('   Asegúrate de que el archivo "clientes.json" esté en "auditorias/gremio/" o "datos_mr_letreros/gremio/".');
        return;
    }

    // 1. Leer archivo unificado (destino)
    let unifiedClients = [];
    if (fs.existsSync(UNIFIED_FILE)) {
        try {
            unifiedClients = JSON.parse(fs.readFileSync(UNIFIED_FILE, 'utf8'));
        } catch (e) {
            console.error('❌ Error leyendo archivo unificado (destino):', e.message);
            return;
        }
    } else {
        console.log('ℹ️ El archivo unificado no existe, se creará uno nuevo.');
    }

    // 2. Leer archivo antiguo (origen)
    let oldClients = [];
    try {
        oldClients = JSON.parse(fs.readFileSync(OLD_FILE, 'utf8'));
    } catch (e) {
        console.error('❌ Error leyendo archivo antiguo (origen):', e.message);
        return;
    }

    console.log(`📊 Estado inicial:`);
    console.log(`   - Clientes en sistema actual: ${unifiedClients.length}`);
    console.log(`   - Clientes antiguos encontrados: ${oldClients.length}`);

    let added = 0;
    let skipped = 0;

    // 3. Procesar y fusionar
    oldClients.forEach(oldClient => {
        // Normalizar nombre para comparación (algunos usan 'name', otros 'nombre')
        const oldName = (oldClient.name || oldClient.nombre || '').trim();
        
        if (!oldName) return; // Saltar si no tiene nombre válido

        // Buscar duplicados por ID o por Nombre (case insensitive)
        const exists = unifiedClients.find(uc => {
            const ucName = (uc.name || uc.nombre || '').trim();
            return (uc.id && uc.id === oldClient.id) || 
                   (ucName.toLowerCase() === oldName.toLowerCase());
        });

        if (!exists) {
            // Preparar cliente para migración (Normalización de datos)
            const newClient = {
                id: oldClient.id || `migrated_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                tipo: oldClient.tipo || 'gremio', // Asignar tipo gremio por defecto si viene de ahí
                
                // Campos unificados (mantener compatibilidad con ambos sistemas)
                name: oldName,
                nombre: oldName, 
                
                // Contacto
                contact: oldClient.contact || oldClient.contacto || '',
                telefono: oldClient.telefono || oldClient.phone || '',
                email: oldClient.email || '',
                direccion: oldClient.direccion || oldClient.address || '',
                
                // Notas
                notes: oldClient.notes || oldClient.notas || '',
                
                // Metadatos
                fechaRegistro: oldClient.fechaRegistro || new Date().toISOString(),
                origen: 'migracion_gremio'
            };
            
            unifiedClients.push(newClient);
            added++;
        } else {
            skipped++;
        }
    });

    // 4. Guardar cambios
    if (added > 0) {
        try {
            fs.writeFileSync(UNIFIED_FILE, JSON.stringify(unifiedClients, null, 2));
            console.log(`\n✅ MIGRACIÓN EXITOSA`);
            console.log(`   - Clientes agregados: ${added}`);
            console.log(`   - Clientes omitidos (ya existían): ${skipped}`);
            console.log(`   - Total actual en base de datos: ${unifiedClients.length}`);
        } catch (e) {
            console.error('❌ Error guardando el archivo unificado:', e.message);
        }
    } else {
        console.log('\n⚠️ No se requirieron cambios. Todos los clientes antiguos ya existían en el sistema unificado.');
    }
}

migrate();