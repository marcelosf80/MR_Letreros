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
    } else if (file.type === 'application/pdf') {
        // === ES UN PDF VECTORIAL ===
        statusMsg.innerText = "⏳ Procesando PDF...";
        statusMsg.style.color = "yellow";
        vectorOptions.style.display = 'none';
        imageOps.style.display = 'none';

        // Usar la función de pdf-importer.js
        processPdf(file).then(svgString => {
            currentSvgString = svgString;
            
            // El resto es similar a cargar un SVG
            const blob = new Blob([currentSvgString], {type: 'image/svg+xml'});
            const urlObj = URL.createObjectURL(blob);
            
            globalSvgImage = new Image(); // Variable global de globals.js
            globalSvgImage.src = urlObj;
            
            statusMsg.innerText = "✅ PDF convertido a SVG. Listo para acomodar.";
            statusMsg.style.color = "#51CF66";
            
            // Mostrar en visor principal (reutilizando código de SVG)
            sheetsContainer.innerHTML = '';
            
            const vectorDiv = document.createElement('div');
            vectorDiv.style.width = '100%';
            vectorDiv.style.textAlign = 'center';
            vectorDiv.innerHTML = '<h4 style="margin:0 0 10px 0; color:#51CF66;">Vista Previa (PDF importado como SVG)</h4>';

            const editControls = document.createElement('div');
            editControls.style.marginBottom = '10px';
            editControls.style.display = 'flex';
            editControls.style.gap = '5px';
            editControls.style.justifyContent = 'center';
            editControls.innerHTML = `
                <button id="btnToggleEdit" style="background:#444; color:white; border:1px solid #666; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em;">✏️ Editar / Limpiar</button>
                <button id="btnWeldSelected" style="background:#7950f2; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em; display:none;">🔗 Soldar (0)</button>
                <button id="btnExplodeSelected" style="background:#fd7e14; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em; display:none;">💥 Desagrupar</button>
                <button id="btnDeleteSelected" style="background:#e03131; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em; display:none;">🗑️ Borrar (0)</button>
                <button id="btnUndo" style="background:#f59f00; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em; display:none;">↩️ Deshacer</button>
                <button id="btnSaveEdit" style="background:#51CF66; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em; display:none;">💾 Guardar</button>
            `;
            vectorDiv.appendChild(editControls);

            const div = document.createElement('div');
            div.innerHTML = currentSvgString;
            const svg = div.querySelector('svg');
            if(svg) {
                svg.style.maxWidth = '100%';
                svg.style.height = 'auto';
                svg.style.border = '1px solid #555';
                svg.style.borderRadius = '4px';
                svg.style.background = '#fff';
                
                if (typeof setupVectorEditor === 'function') {
                    setupVectorEditor(svg, editControls, statusMsg);
                }
                vectorDiv.appendChild(svg);
            }
            sheetsContainer.appendChild(vectorDiv);

        }).catch(error => {
            console.error("Error procesando PDF:", error);
            statusMsg.innerText = "❌ Error al procesar el PDF.";
            statusMsg.style.color = "red";
        });
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
            
            const vectorDiv = document.createElement('div');
            vectorDiv.style.width = '100%';
            vectorDiv.style.textAlign = 'center';
            vectorDiv.innerHTML = '<h4 style="margin:0 0 10px 0; color:#51CF66;">Vista Previa (SVG)</h4>';

            const editControls = document.createElement('div');
            editControls.style.marginBottom = '10px';
            editControls.style.display = 'flex';
            editControls.style.gap = '5px';
            editControls.style.justifyContent = 'center';
            editControls.innerHTML = `
                <button id="btnToggleEdit" style="background:#444; color:white; border:1px solid #666; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em;">✏️ Editar / Limpiar</button>
                <button id="btnWeldSelected" style="background:#7950f2; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em; display:none;">🔗 Soldar (0)</button>
                <button id="btnExplodeSelected" style="background:#fd7e14; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em; display:none;">💥 Desagrupar</button>
                <button id="btnDeleteSelected" style="background:#e03131; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em; display:none;">🗑️ Borrar (0)</button>
                <button id="btnUndo" style="background:#f59f00; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em; display:none;">↩️ Deshacer</button>
                <button id="btnSaveEdit" style="background:#51CF66; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-size:0.8em; display:none;">💾 Guardar</button>
            `;
            vectorDiv.appendChild(editControls);

            const div = document.createElement('div');
            div.innerHTML = currentSvgString;
            const svg = div.querySelector('svg');
            if(svg) {
                svg.style.maxWidth = '100%';
                svg.style.height = 'auto';
                svg.style.border = '1px solid #555';
                svg.style.borderRadius = '4px';
                svg.style.background = '#fff';
                
                if (typeof setupVectorEditor === 'function') {
                    setupVectorEditor(svg, editControls, statusMsg);
                }
                vectorDiv.appendChild(svg);
            }
            sheetsContainer.appendChild(vectorDiv);
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