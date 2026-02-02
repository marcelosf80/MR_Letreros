/*
   app.js - Controlador Principal (Limpio)
*/

// Referencias DOM
const fileInput = document.getElementById('fileInput');
const sheetsContainer = document.getElementById('sheetsContainer');
const hiddenContainer = document.getElementById('hiddenSvgContainer');
const statusMsg = document.getElementById('statusMsg');
const statsBar = document.getElementById('statsBar');
const miniPreview = document.getElementById('miniPreview');
const sourcePreviewImg = document.getElementById('sourcePreviewImg');

// Controles de Vectorización
const vectorOptions = document.getElementById('vectorOptions');
const smoothingInput = document.getElementById('smoothing');
const noiseInput = document.getElementById('noise');
const colorsInput = document.getElementById('colors');
const realWidthInput = document.getElementById('realWidthCm');

// Botones de Flujo
const workflowActions = document.getElementById('workflowActions');
const imageOps = document.getElementById('imageOps');
const btnRemoveBg = document.getElementById('btnRemoveBg');
const btnDownloadPng = document.getElementById('btnDownloadPng');
const btnVectorize = document.getElementById('btnVectorize');
const btnDownloadSvg = document.getElementById('btnDownloadSvg');
const btnNest = document.getElementById('btnNest');
const btnCalcToolpath = document.getElementById('btnCalcToolpath');
const showToolpath = document.getElementById('showToolpath');

// --- EVENTOS ---

// 1. Cargar Archivo (Auto-ejecutar)
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // UI Reset
    sheetsContainer.innerHTML = '';
    statusMsg.innerText = "📂 Archivo cargado. Seleccione una acción.";
    statusMsg.style.color = "yellow";
    workflowActions.style.display = 'block';
    
    btnDownloadPng.style.display = 'none';
    btnDownloadSvg.style.display = 'none';
    btnCalcToolpath.disabled = true; 
    btnNest.disabled = false;
    
    // Preview IMG
    const url = URL.createObjectURL(file);
    sourcePreviewImg.src = url;
    currentImgUrl = url; // Variable global de globals.js
    miniPreview.style.display = 'block';
    currentSvgString = null; // Variable global de globals.js

    // DETECTAR TIPO DE ARCHIVO
    if (file.type.startsWith('image/') && !file.type.includes('svg')) {
        // === ES UNA IMAGEN (JPG, PNG) ===
        vectorOptions.style.display = 'block';
        imageOps.style.display = 'block';
        btnNest.disabled = true;
        statusMsg.innerText = "🖼️ Imagen cargada. Quite el fondo o vectorice.";
        
        const img = document.createElement('img');
        img.src = url;
        img.style.maxWidth = '100%';
        sheetsContainer.appendChild(img);
    } else {
        // === ES UN SVG NORMAL ===
        vectorOptions.style.display = 'none';
        imageOps.style.display = 'none';
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            currentSvgString = ev.target.result;
            
            // Cargar imagen para recortes
            const blob = new Blob([currentSvgString], {type: 'image/svg+xml'});
            const urlObj = URL.createObjectURL(blob);
            
            globalSvgImage = new Image(); // Variable global de globals.js
            globalSvgImage.src = urlObj;
            
            statusMsg.innerText = "✅ SVG listo para acomodar.";
            statusMsg.style.color = "#51CF66";
            
            // Mostrar en visor principal
            sheetsContainer.innerHTML = '';
            const div = document.createElement('div');
            div.innerHTML = currentSvgString;
            const svg = div.querySelector('svg');
            if(svg) {
                svg.style.maxWidth = '100%';
                svg.style.height = 'auto';
                sheetsContainer.appendChild(svg);
            }
        };
        reader.readAsText(file);
    }
});

// --- ACCIONES DE BOTONES ---

btnRemoveBg.addEventListener('click', removeBackground); // Función de vectorizer.js

btnDownloadPng.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = currentImgUrl;
    a.download = 'imagen_sin_fondo.png';
    a.click();
});

btnVectorize.addEventListener('click', runVectorization); // Función de vectorizer.js

btnDownloadSvg.addEventListener('click', () => {
    if (!currentSvgString) return;
    const blob = new Blob([currentSvgString], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vectorizado.svg';
    a.click();
});

btnNest.addEventListener('click', () => {
    if (!currentSvgString) {
        alert("⚠️ No hay vectores para acomodar. Vectoriza la imagen primero.");
        return;
    }
    parseSvgParts(currentSvgString); // Función de vectorizer.js
    runNesting(); // Función de nester.js
    btnCalcToolpath.disabled = false;
});

btnCalcToolpath.addEventListener('click', () => {
    const cncActions = document.querySelectorAll('.cnc-actions');
    cncActions.forEach(el => el.style.display = 'block');
    
    document.getElementById('showToolpath').checked = true;
    if (lastPacker) drawResults(lastPacker); // Función de nester.js
    statusMsg.innerText = "🚜 Trayectorias calculadas. Listo para descargar G-Code.";
});

// EVENTOS DE LOS SLIDERS (Actualización en tiempo real)
smoothingInput.addEventListener('input', (e) => document.getElementById('smoothingVal').innerText = e.target.value);
smoothingInput.addEventListener('change', runVectorization); // Recalcular al soltar

noiseInput.addEventListener('input', (e) => document.getElementById('noiseVal').innerText = e.target.value);
noiseInput.addEventListener('change', runVectorization); // Recalcular al soltar

colorsInput.addEventListener('input', (e) => document.getElementById('colorsVal').innerText = e.target.value);
colorsInput.addEventListener('change', runVectorization);

showToolpath.addEventListener('change', () => {
    if (lastPacker) {
        drawResults(lastPacker);
    }
});

// Inicializar persistencia
if (typeof initSettings === 'function') {
    initSettings(); // Función de settings.js
}