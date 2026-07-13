/**
 * vectorizer.js - Lógica para la vectorización de imágenes y manipulación de mapas de bits.
 * Contiene las funciones para quitar fondo y vectorizar.
 */

/**
 * Elimina el fondo de una imagen usando IA en el navegador.
 * Es llamada por el event listener en app.js.
 */
async function handleRemoveBackground() {
    const removeBgBtn = document.getElementById('btnRemoveBg');
    const sourcePreviewImg = document.getElementById('sourcePreviewImg');
    const downloadPngBtn = document.getElementById('btnDownloadPng');
    const vectorizeBtn = document.getElementById('btnVectorize');

    if (!sourcePreviewImg.src || sourcePreviewImg.src.startsWith('data:image/svg')) {
        if (typeof showStatus === 'function') showStatus('Primero carga una imagen (JPG, PNG).', 'error');
        return;
    }

    // Deshabilitar botón y mostrar estado de carga
    removeBgBtn.disabled = true;
    removeBgBtn.innerHTML = '🪄 Procesando IA...';
    if (typeof showStatus === 'function') showStatus('Quitando fondo... (La primera vez puede tardar un poco)', 'loading');

    try {
        let blob;

        // --- ESTRATEGIA 3: API REMOVE.BG (Prioridad) ---
        const apiKey = 'qdtBJGk3DKk9oDTutZ4WujGC';
        if (apiKey) {
            try {
                if (typeof showStatus === 'function') showStatus('☁️ Procesando con Remove.bg...', 'loading');
                blob = await removeBackgroundAPI(sourcePreviewImg.src, apiKey);
            } catch (apiError) {
                console.warn("Fallo API Remove.bg, intentando alternativas...", apiError);
            }
        }

        if (!blob) {
            // --- ESTRATEGIA 1: INTELIGENCIA ARTIFICIAL (Librería @imgly) ---
            if (window.removeBackgroundAI) {
                try {
                    // Intentamos usar la IA
                    blob = await window.removeBackgroundAI(sourcePreviewImg.src);
                } catch (aiError) {
                    console.warn("Fallo la IA, cambiando a modo local...", aiError);
                    if (typeof showStatus === 'function') showStatus('⚠️ IA no disponible. Usando modo rápido local...', 'loading');
                    // Si falla la IA, pasamos a la estrategia 2
                    blob = await removeBackgroundLocal(sourcePreviewImg);
                }
            } 
            // --- ESTRATEGIA 2: PROCESAMIENTO LOCAL (Canvas / Color Keying) ---
            else {
                console.warn("Librería IA no detectada. Usando modo local.");
                blob = await removeBackgroundLocal(sourcePreviewImg);
            }
        }
        
        const url = URL.createObjectURL(blob);
        
        // Actualiza la vista previa para mostrar la imagen sin fondo.
        sourcePreviewImg.src = url;
        
        // Guardar en estado global (de globals.js)
        currentImgUrl = url;

        // --- NUEVO: Mostrar imagen sin fondo en el visor principal ---
        const sheetsContainer = document.getElementById('sheetsContainer');
        const statsBar = document.getElementById('statsBar');
        
        if (sheetsContainer) {
            sheetsContainer.innerHTML = '';
            const img = document.createElement('img');
            img.src = url;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '500px';
            // Fondo de ajedrez para resaltar la transparencia
            img.style.background = 'conic-gradient(#eee 0.25turn, transparent 0.25turn 0.5turn, #eee 0.5turn 0.75turn, transparent 0.75turn) top left / 20px 20px repeat';
            img.style.border = '1px solid #555';
            sheetsContainer.appendChild(img);
        }
        if (statsBar) statsBar.innerText = "✨ Fondo eliminado. Listo para vectorizar.";
        // -------------------------------------------------------------

        if (typeof showStatus === 'function') showStatus('Fondo eliminado. Ahora puedes vectorizar.', 'success');
        
        // Habilitar y configurar el botón para descargar el PNG sin fondo.
        downloadPngBtn.style.display = 'block';
        vectorizeBtn.disabled = false; // Habilitar vectorización

    } catch (error) {
        console.error('Error al quitar el fondo:', error);
        if (typeof showStatus === 'function') showStatus('Error: ' + error.message, 'error');
    } finally {
        // Reactivar el botón al finalizar
        removeBgBtn.disabled = false;
        removeBgBtn.innerHTML = '🪄 Quitar Fondo';
    }
}

/**
 * Llama a la API de Remove.bg
 */
async function removeBackgroundAPI(imageUrl, apiKey) {
    const formData = new FormData();
    formData.append('size', 'auto');
    
    if (imageUrl.startsWith('data:')) {
        formData.append('image_file_b64', imageUrl.split(',')[1]);
    } else {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        formData.append('image_file', blob, 'image.png');
    }

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.errors[0].title || 'Error API Remove.bg');
    }

    return await response.blob();
}

/**
 * SOLUCIÓN #1: Procesamiento Local (Sin IA, Sin Internet)
 * Elimina el fondo basándose en el color de las esquinas (usualmente blanco).
 */
function removeBackgroundLocal(imgElement) {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = imgElement.naturalWidth || imgElement.width;
            canvas.height = imgElement.naturalHeight || imgElement.height;
            const ctx = canvas.getContext('2d');
            
            // Dibujar imagen en canvas
            ctx.drawImage(imgElement, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Tomamos el color del píxel superior izquierdo como "color de fondo"
            const bgR = data[0];
            const bgG = data[1];
            const bgB = data[2];
            
            // Tolerancia para borrar colores similares (ej. blancos sucios, sombras suaves)
            const tolerance = 50; 
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                
                // Si el color es similar al fondo, lo hacemos transparente
                if (Math.abs(r - bgR) < tolerance && 
                    Math.abs(g - bgG) < tolerance && 
                    Math.abs(b - bgB) < tolerance) {
                    data[i+3] = 0; // Alpha = 0 (Transparente)
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            // Convertir a Blob
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("No se pudo generar la imagen sin fondo."));
            }, 'image/png');
            
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Ejecuta la vectorización de la imagen de vista previa usando ImageTracer.js.
 * Es llamada por el event listener en app.js.
 */
function runVectorization() {
    const sourceImg = document.getElementById('sourcePreviewImg');
    if (!sourceImg.src || sourceImg.src.startsWith('data:image/svg')) {
        if (typeof showStatus === 'function') showStatus('Carga una imagen o quita el fondo primero.', 'error');
        return;
    }

    if (typeof showStatus === 'function') showStatus('📐 Vectorizando imagen...', 'loading');
    const vectorizeBtn = document.getElementById('btnVectorize');
    const nestBtn = document.getElementById('btnNest');
    const downloadSvgBtn = document.getElementById('btnDownloadSvg');

    vectorizeBtn.disabled = true;
    nestBtn.disabled = true;
    downloadSvgBtn.style.display = 'none';

    // Crear barra de progreso
    let progressBar = document.getElementById('vectorProgressBar');
    const statusMsg = document.getElementById('statusMsg');
    if (!progressBar && statusMsg) {
        progressBar = document.createElement('div');
        progressBar.id = 'vectorProgressBar';
        progressBar.style.cssText = `
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
            overflow: hidden;
            margin: 10px 0;
        `;
        
        const progressFill = document.createElement('div');
        progressFill.id = 'vectorProgressFill';
        progressFill.style.cssText = `
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #51CF66, #37B24D);
            transition: width 0.3s ease;
        `;
        
        progressBar.appendChild(progressFill);
        statusMsg.parentNode.insertBefore(progressBar, statusMsg.nextSibling);
    }
    
    const progressFill = document.getElementById('vectorProgressFill');
    // Simular progreso durante el procesamiento
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        if (progressFill) progressFill.style.width = progress + '%';
    }, 500);

    // 1. Obtener opciones de los sliders
    const options = {
        ltres: parseFloat(document.getElementById('smoothing').value),
        qtres: parseFloat(document.getElementById('smoothing').value),
        pathomit: parseInt(document.getElementById('noise').value),
        numberofcolors: parseInt(document.getElementById('colors').value),
        strokewidth: 1,
        viewbox: true,
        colorsampling: 2,
        blurradius: 0.5,
        blurdelta: 10
    };

    // 2. Usar ImageTracer.js (API con callback)
    ImageTracer.imageToSVG(
        sourceImg.src,
        async function(svgString) {
            // Completar progreso
            clearInterval(progressInterval);
            if (progressFill) progressFill.style.width = '100%';

            // 3. Guardar y mostrar el SVG
            currentSvgString = svgString; // Variable global de globals.js
            displayFinalSvg(svgString);   // Función de app.js para mostrar el SVG principal
            
            // 4. Habilitar acciones siguientes
            downloadSvgBtn.style.display = 'block';
            nestBtn.disabled = false;
            vectorizeBtn.disabled = false;

            // 5. Analizar las piezas del nuevo SVG para el nesting (función de nester.js)
            await parseSvgParts(svgString, (current, total) => {
                 if (typeof showStatus === 'function') showStatus(`🧩 Analizando piezas: ${current}/${total}`, 'loading');
            });

            // Ocultar barra de progreso
            setTimeout(() => {
                if (progressBar) progressBar.style.display = 'none';
                if (progressFill) progressFill.style.width = '0%';
            }, 1000);

            if (typeof showStatus === 'function') showStatus('✅ Piezas listas para acomodar.', 'success');
        },
        options
    );
}