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

function displayFinalSvg(svgString) {
    // Cargar imagen para recortes
    const blob = new Blob([svgString], {type: 'image/svg+xml'});
    const urlObj = URL.createObjectURL(blob);
    
    globalSvgImage = new Image(); // Variable global de globals.js
    globalSvgImage.src = urlObj;
    
    statusMsg.innerText = "✅ Archivo procesado. Listo para acomodar.";
    statusMsg.style.color = "#51CF66";
    
    // Mostrar en visor principal
    sheetsContainer.innerHTML = '';
    
    const vectorDiv = document.createElement('div');
    vectorDiv.style.width = '100%';
    vectorDiv.style.textAlign = 'center';
    vectorDiv.innerHTML = '<h4 style="margin:0 0 10px 0; color:#51CF66;">Vista Previa (Procesado por Servidor)</h4>';

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
    div.innerHTML = svgString;
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
}

// 1. Cargar Archivo (Auto-ejecutar)
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const fileContent = event.target.result;

        // --- NUEVO: Manejo de imágenes Raster (JPG, PNG) ---
        if (file.type.startsWith('image/') && !file.type.includes('svg')) {
            // Es una imagen: Mostrarla y esperar a que el usuario vectorice
            sourcePreviewImg.src = fileContent;
            miniPreview.style.display = 'block';
            
            statusMsg.innerText = "📷 Imagen cargada. Usa 'Quitar Fondo' o 'Vectorizar' para continuar.";
            statusMsg.style.color = "#339AF0";
            
            workflowActions.style.display = 'block';
            btnNest.disabled = true; // No se puede hacer nesting de una imagen raster
            
            // Limpiar contenedor de resultados anteriores
            sheetsContainer.innerHTML = '';

            // --- NUEVO: Mostrar imagen original en el visor principal ---
            const img = document.createElement('img');
            img.src = fileContent;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '500px';
            img.style.objectFit = 'contain';
            sheetsContainer.appendChild(img);
            if (statsBar) statsBar.innerText = "📷 Imagen cargada.";
            
            return; // IMPORTANTE: No enviar a Python todavía
        }

        // Reiniciar UI y mostrar progreso
        sheetsContainer.innerHTML = '';
        statusMsg.innerText = "⏳ Procesando archivo en el servidor...";
        statusMsg.style.color = "yellow";
        workflowActions.style.display = 'block';
        btnNest.disabled = true;
        
        const progressContainer = document.getElementById('nestingProgressContainer');
        if (progressContainer) progressContainer.style.display = 'block';

        const payload = {
            fileContent: fileContent,
            fileType: file.type,
            fileName: file.name,
            options: {
                realWidthCm: parseFloat(realWidthInput.value) || 0
            }
        };

        try {
            const response = await fetch('/api/process-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || 'El servidor devolvió un error al procesar el archivo.');
            }

            const result = await response.json();

            // Guardar resultados en variables globales
            currentSvgString = result.svgString;
            svgViewBox = result.viewBox;
            
            // Reconstruir los objetos Part en el frontend a partir de los datos del backend
            await parseSvgParts(currentSvgString, () => {});

            // Mostrar el SVG resultante
            displayFinalSvg(currentSvgString);
            btnNest.disabled = false;

        } catch (error) {
            console.error('Error procesando el archivo en el backend:', error);
            statusMsg.innerText = `❌ Error: ${error.message}`;
            statusMsg.style.color = 'red';
        } finally {
            if (progressContainer) progressContainer.style.display = 'none';
        }
    };

    // Lee el archivo según su tipo
    if (file.type.startsWith('image/') && !file.type.includes('svg')) {
        reader.readAsDataURL(file); // Para JPG/PNG (Vista previa)
    } else {
        reader.readAsText(file); // Para SVG (Texto para el backend)
    }
});

// --- ACCIONES DE BOTONES ---

btnRemoveBg.addEventListener('click', handleRemoveBackground); // Función de vectorizer.js

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

btnNest.addEventListener('click', async () => {
    if (globalParts.length === 0) {
        alert("⚠️ No hay piezas procesadas para acomodar. Carga un archivo primero.");
        return;
    }
    try {
        await runNesting(); // Función de nester.js (YA ERA ASÍNCRONA)
        btnCalcToolpath.disabled = false;
    } catch (error) {
        console.error("Error en el proceso de nesting:", error);
        statusMsg.innerText = `❌ Error: ${error.message}`;
    }
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

// --- NUEVO: Event Listener para Ampliar Imagen ---
const btnUpscale = document.getElementById('btnUpscale');
const upscaleScale = document.getElementById('upscaleScale');

if (btnUpscale) {
    btnUpscale.addEventListener('click', async () => {
        const sourceImg = document.getElementById('sourcePreviewImg');
        
        if (!sourceImg.src || sourceImg.src.startsWith('data:image/svg')) {
            alert('⚠️ Primero carga una imagen JPG o PNG');
            return;
        }
        
        const scale = parseInt(upscaleScale.value);
        const originalUrl = sourceImg.src;
        
        try {
            // upscaleImage está en upscaler.js
            const upscaledUrl = await upscaleImage(originalUrl, scale);
            showUpscalePreview(originalUrl, upscaledUrl);
        } catch (error) {
            console.error('Error:', error);
            alert('❌ Error al ampliar imagen: ' + error.message);
        }
    });
}

// Hot Wire CNC Logic
const hwMaterial = document.getElementById('hwMaterial');
const hwSpeed = document.getElementById('hwSpeed');
const hwTemp = document.getElementById('hwTemp');
const btnGenHotWire = document.getElementById('btnGenHotWire');
const hwStats = document.getElementById('hwStats');

if (hwMaterial) {
    hwMaterial.addEventListener('change', () => {
        const preset = window.hotWireCNC.presets[hwMaterial.value];
        if (preset && hwMaterial.value !== 'custom') {
            hwSpeed.value = preset.speed;
            hwTemp.value = preset.temp;
        }
    });
}

if (btnGenHotWire) {
    btnGenHotWire.addEventListener('click', () => {
        if (!currentSvgString) {
            alert("⚠️ Primero carga y vectoriza una imagen.");
            return;
        }
        
        const options = {
            speed: parseFloat(hwSpeed.value) || 300,
            temperature: parseFloat(hwTemp.value) || 0,
            materialName: hwMaterial.options[hwMaterial.selectedIndex].text
        };

        const result = window.hotWireCNC.generateGCode(currentSvgString, options);
        
        if (result) {
            // Show stats
            document.getElementById('hwLen').innerText = result.stats.lengthMM;
            document.getElementById('hwTime').innerText = result.stats.timeMinutes;
            hwStats.style.display = 'block';
            
            // Download
            window.hotWireCNC.downloadGCode(result.code, `hilo_caliente_${Date.now()}.nc`);
            
            if (typeof showStatus === 'function') showStatus('✅ G-Code Hilo Caliente generado y descargado.', 'success');
        } else {
            alert("❌ No se pudieron extraer trayectorias del SVG.");
        }
    });
}