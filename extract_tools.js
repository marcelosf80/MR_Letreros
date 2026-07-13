const fs = require('fs');
const path = require('path');

const srcDir = path.join('c:', 'MR_Letreros');
const destDir = path.join('c:', 'MR_Letreros_Herramientas');
const publicDest = path.join(destDir, 'public');

function copyDirSync(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 1. Create structure
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);
if (!fs.existsSync(publicDest)) fs.mkdirSync(publicDest);

// 2. Copy shared assets
const assetsToCopy = ['css', 'js', 'img', 'vector'];
for (const asset of assetsToCopy) {
    const srcAsset = path.join(srcDir, 'public', asset);
    const destAsset = path.join(publicDest, asset);
    if (fs.existsSync(srcAsset)) {
        copyDirSync(srcAsset, destAsset);
    }
}

// 3. Copy & modify HTML tools
const tools = [
    'calculador-vectores.html',
    'cotizador-acrilicos.html',
    'led-wizard.html',
    'nesting-polifan.html',
    'renderizador-3d.html',
    'vectores.html',
    'vectores_paperjs.html',
    'vectorizador.html'
];

tools.forEach(tool => {
    const srcPath = path.join(srcDir, 'public', tool);
    const destPath = path.join(publicDest, tool);
    
    if (fs.existsSync(srcPath)) {
        let content = fs.readFileSync(srcPath, 'utf8');
        content = content.replace(/<script\s+src=["']js\/auth\.js["']><\/script>/g, '');
        fs.writeFileSync(destPath, content, 'utf8');
    }
});

// 4. Create server.js
const serverJs = [
"const express = require('express');",
"const path = require('path');",
"const app = express();",
"app.use(express.static('public'));",
"app.get('/', (req, res) => {",
"    res.send('<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\"><title>Herramientas MR Letreros</title><link href=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css\" rel=\"stylesheet\"></head><body class=\"bg-light p-5\"><div class=\"container\"><h1>Herramientas MR Letreros</h1><div class=\"list-group\"><a href=\"/vectorizador.html\" class=\"list-group-item list-group-item-action\">Vectorizador de Imágenes</a><a href=\"/nesting-polifan.html\" class=\"list-group-item list-group-item-action\">Optimizador Nesting (Polifan)</a><a href=\"/led-wizard.html\" class=\"list-group-item list-group-item-action\">Cálculo de Módulos LED</a><a href=\"/renderizador-3d.html\" class=\"list-group-item list-group-item-action\">Renderizador 3D</a><a href=\"/calculador-vectores.html\" class=\"list-group-item list-group-item-action\">Calculador de Perímetros</a><a href=\"/cotizador-acrilicos.html\" class=\"list-group-item list-group-item-action\">Cotizador Acrílicos</a></div></div></body></html>');",
"});",
"const PORT = 3001;",
"app.listen(PORT, () => console.log('Servidor de herramientas corriendo en http://localhost:3001'));"
].join('\n');

fs.writeFileSync(path.join(destDir, 'server.js'), serverJs);

// 5. Create package.json
const packageJson = {
  "name": "mr_letreros_herramientas",
  "version": "1.0.0",
  "description": "Repositorio independiente para herramientas de MR Letreros",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.19.2"
  }
};
fs.writeFileSync(path.join(destDir, 'package.json'), JSON.stringify(packageJson, null, 2));

console.log('Extraction completed.');
