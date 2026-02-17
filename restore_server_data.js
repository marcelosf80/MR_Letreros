const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'datos_mr_letreros');
const FILES = {
    costos: path.join(DATA_DIR, 'gremio_costos_db.json'),
    materiales: path.join(DATA_DIR, 'gremio_materiales.json'),
    precios: path.join(DATA_DIR, 'gremio_precios_db.json')
};

function loadJSON(filePath) {
    if (!fs.existsSync(filePath)) return [];
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
        return [];
    }
}

function saveJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`✅ Saved ${data.length} items to ${filePath}`);
    } catch (e) {
        console.error(`Error writing ${filePath}:`, e);
    }
}

console.log('🚀 Starting Data Restoration...');

// 1. Load Materials (Source of Truth for Costs)
const materiales = loadJSON(FILES.materiales);
console.log(`📦 Loaded ${materiales.length} materials.`);

// 2. Load Existing Costs (probably empty)
let costos = loadJSON(FILES.costos);
// Handle wrapped structure if exists
if (costos.products && Array.isArray(costos.products)) costos = costos.products;
if (!Array.isArray(costos)) costos = [];

console.log(`💰 Loaded ${costos.length} existing costs.`);

// 3. Regenerate Costs from Materials
let addedCount = 0;
materiales.forEach(mat => {
    // Check if cost already exists for this material
    const exists = costos.find(c => c.name === mat.producto || c.name === mat.productoNombre);

    if (!exists) {
        const costValue = parseFloat(mat.costoPorM2) || 0;

        const newCost = {
            id: 'cost_' + mat.id,
            name: mat.producto || mat.productoNombre,
            category: mat.categoria,
            unit: mat.unidad || 'm²',
            costs: {
                material: costValue,
                labor: 0,
                indirect: 0,
                total: costValue
            },
            fromMaterialId: mat.id, // Link back to material
            updatedAt: new Date().toISOString()
        };

        costos.push(newCost);
        addedCount++;
    }
});

console.log(`➕ Generated ${addedCount} new cost entries from materials.`);

// 4. Save Costs (Ensure it's an array, or wrapped depending on what the app expects)
// Looking at costs-manager.js, it expects { products: [] } or just [] depending on version.
// Server.js reads file directly. Let's save as Array for now, but wrapper might be needed if using old logic.
// Checking `data-manager-network.js`: it returns what `request('/api/costos')` returns.
// Checking `server.js`: GET /api/costos returns `readJSON(FILES.costos)`.
// Let's save as Array to be safe, standard for new system.
saveJSON(FILES.costos, costos);


// 5. Verify Precios
const precios = loadJSON(FILES.precios);
console.log(`🏷️  Loaded ${precios.length} prices.`);
// No regeneration logic for prices as we don't have a source, but we ensure the file is valid.
if (!Array.isArray(precios)) {
    console.warn('⚠️ Precios file was not an array. Resetting to empty array.');
    saveJSON(FILES.precios, []);
}

console.log('✅ Restoration Complete.');
