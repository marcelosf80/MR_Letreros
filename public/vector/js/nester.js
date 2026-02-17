// Lógica de Nesting y Dibujo 2D

async function runNesting() {
    const statusMsg = document.getElementById('statusMsg');
    statusMsg.innerText = "⏳ Optimizando con el servidor...";
    document.getElementById('sheetsContainer').innerHTML = '';

    const sheetW = parseFloat(document.getElementById('sheetWidth').value);
    const sheetH = parseFloat(document.getElementById('sheetHeight').value);
    const gap = parseFloat(document.getElementById('gap').value);
    const allowRotation = document.getElementById('allowRotation').checked;
    
    // --- FIX: Separar Nesting de la visualización de Trayectoria ---
    document.getElementById('showToolpath').checked = false;
    const cncActions = document.querySelectorAll('.cnc-actions');
    if (cncActions) cncActions.forEach(el => el.style.display = 'none');

    globalParts.forEach(p => { p.placed = false; p.binId = -1; p.nestedInHole = false; });
    
    // Mostrar barra de progreso (indicando que se está procesando en el servidor)
    const progressContainer = document.getElementById('nestingProgressContainer');
    const progressBar = document.getElementById('nestingProgressBar');
    const progressText = document.getElementById('nestingProgressText');
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = '50%';
    if (progressText) progressText.innerText = 'Optimizando en servidor... (0%)';

    // 1. Preparar datos para enviar al backend
    const partsForBackend = globalParts.map(p => ({ id: p.id, w: p.w, h: p.h }));
    const payload = {
        parts: partsForBackend,
        sheetW: sheetW,
        sheetH: sheetH,
        gap: gap,
        allowRotation: allowRotation
    };

    try {
        // 2. Llamar a la API del backend
        const response = await fetch('/api/nesting/solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (progressText) progressText.innerText = 'Optimizando en servidor... (50%)';
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || 'El servidor devolvió un error.');
        }

        const nestingResult = await response.json();

        if (progressText) progressText.innerText = 'Optimizando en servidor... (100%)';
        // 3. Procesar el resultado de Python para que `drawResults` lo entienda
        const packerResult = {
            bins: [],
            sheetW: sheetW,
            sheetH: sheetH
        };
        
        nestingResult.forEach(binData => {
            const newBin = { id: binData.bin_id, parts: [] };
            binData.parts.forEach(placedPartData => {
                const originalPart = globalParts.find(p => p.id === placedPartData.id);
                if (originalPart) {
                    originalPart.placed = true;
                    originalPart.rotated = placedPartData.rotated;
                    originalPart.binId = placedPartData.bin;
                    originalPart.fit = { x: placedPartData.x, y: placedPartData.y };
                    newBin.parts.push(originalPart);
                }
            });
            packerResult.bins.push(newBin);
        });
        
        lastPacker = packerResult; // Guardar para usarlo en G-Code, etc.

        if (progressContainer) progressContainer.style.display = 'none';
        drawResults(packerResult);

    } catch (error) {
        console.error('Error llamando al backend de nesting:', error);
        statusMsg.innerText = `❌ Error: ${error.message}`;
        statusMsg.style.color = 'red';
        if (progressContainer) progressContainer.style.display = 'none';
    }
}

function drawResults(packer) {
    // Detectar si globalSvgImage no está cargada correctamente
    if (!globalSvgImage || !globalSvgImage.complete || globalSvgImage.width === 0) {
        console.log('[DEBUG] Regenerando globalSvgImage desde currentSvgString');
        if (currentSvgString) {
            const blob = new Blob([currentSvgString], {type: 'image/svg+xml'});
            globalSvgImage = new Image();
            globalSvgImage.onload = () => drawResults(packer); // Re-dibujar
            globalSvgImage.src = URL.createObjectURL(blob);
            return;
        }
    }

    const bins = packer.bins;
    let totalPlaced = 0;
    const containerW = document.querySelector('.preview').clientWidth - 40;
    const displayW = Math.min(containerW, 800);
    const scale = displayW / packer.sheetW;
    const sheetsContainer = document.getElementById('sheetsContainer');
    const statsBar = document.getElementById('statsBar');
    const statusMsg = document.getElementById('statusMsg');
    
    // --- FIX: Calcular la escala de la imagen correctamente ---
    // El `svgViewBox` global está en mm (escalado), pero `globalSvgImage` se renderizó
    // desde el SVG original. Necesitamos el viewBox ORIGINAL.
    let originalVbW = 1000, originalVbH = 1000;
    if (currentSvgString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(currentSvgString, "image/svg+xml");
        const svg = doc.querySelector('svg');
        if (svg) {
            const vb = svg.getAttribute('viewBox');
            if (vb) {
                const parts = vb.split(' ');
                originalVbW = parseFloat(parts[2]);
                originalVbH = parseFloat(parts[3]);
            } else {
                originalVbW = parseFloat(svg.getAttribute('width')) || globalSvgImage.width;
                originalVbH = parseFloat(svg.getAttribute('height')) || globalSvgImage.height;
            }
        }
    }
    const imgScaleX = globalSvgImage.width / originalVbW;
    const imgScaleY = globalSvgImage.height / originalVbH;

    bins.forEach(bin => {
        const wrapper = document.createElement('div');
        wrapper.className = 'sheet-wrapper';
        wrapper.style.marginBottom = "30px";

        const title = document.createElement('h4');
        title.style.margin = "0 0 5px 0";
        title.style.color = "#51CF66";
        title.innerText = `📦 Placa #${bin.id} (${bin.parts.length} piezas)`;
        
        const canvas = document.createElement('canvas');
        canvas.width = displayW;
        canvas.height = packer.sheetH * scale;
        canvas.style.background = "#ddd";
        canvas.style.borderRadius = "4px";
        canvas.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";
        canvas.style.cursor = "pointer";

        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            const found = bin.parts.find(p => {
                const x = p.fit.x * scale;
                const y = p.fit.y * scale;
                const w = (p.rotated ? p.h : p.w) * scale;
                const h = (p.rotated ? p.w : p.h) * scale;
                return clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h;
            });

            if (found) openFabricEditor(found);
        });

        // Botón Descargar PDF
        const btnPdf = document.createElement('button');
        btnPdf.innerText = "📄 Descargar PDF";
        btnPdf.style.marginTop = "10px";
        btnPdf.style.background = "#FFC107";
        btnPdf.style.color = "#000";
        btnPdf.style.border = "none";
        btnPdf.style.padding = "8px 15px";
        btnPdf.style.borderRadius = "4px";
        btnPdf.style.cursor = "pointer";
        btnPdf.style.fontWeight = "bold";
        btnPdf.style.width = "auto";
        btnPdf.style.marginRight = "10px";

        btnPdf.onclick = () => {
             if (!window.jspdf) { alert("Error: Librería PDF no cargada."); return; }
             const { jsPDF } = window.jspdf;
             
             const pdfCanvas = document.createElement('canvas');
             const pdfScale = 3; 
             
             pdfCanvas.width = packer.sheetW * pdfScale;
             pdfCanvas.height = packer.sheetH * pdfScale;
             const pdfCtx = pdfCanvas.getContext('2d');
             
             pdfCtx.fillStyle = "#ffffff";
             pdfCtx.fillRect(0, 0, pdfCanvas.width, pdfCanvas.height);
             
             bin.parts.forEach(part => {
                const destX = part.fit.x * pdfScale;
                const destY = part.fit.y * pdfScale;
                const destW = part.w * pdfScale;
                const destH = part.h * pdfScale;

                pdfCtx.save();
                const cx = destX + (part.rotated ? destH : destW) / 2;
                const cy = destY + (part.rotated ? destW : destH) / 2;
                pdfCtx.translate(cx, cy);
                if (part.rotated) pdfCtx.rotate(-90 * Math.PI / 180);
                
                // FIX: Usar dimensiones originales para el recorte
                const srcX = part.originalX * imgScaleX;
                const srcY = part.originalY * imgScaleY;
                const srcW = part.originalW * imgScaleX;
                const srcH = part.originalH * imgScaleY;
                try {
                    pdfCtx.drawImage(globalSvgImage, srcX, srcY, srcW, srcH, -destW/2, -destH/2, destW, destH);
                } catch(err) {}
                
                // Borde en PDF también
                pdfCtx.strokeStyle = part.nestedInHole ? '#e03131' : '#000000';
                pdfCtx.lineWidth = 2;
                pdfCtx.strokeRect(-destW/2, -destH/2, destW, destH);

                pdfCtx.restore();
             });

             const pdf = new jsPDF({
                orientation: packer.sheetW > packer.sheetH ? 'l' : 'p',
                unit: 'mm',
                format: [packer.sheetW, packer.sheetH]
             });

             const imgData = pdfCanvas.toDataURL('image/jpeg', 0.8);
             pdf.addImage(imgData, 'JPEG', 0, 0, packer.sheetW, packer.sheetH);
             pdf.save(`placa_${bin.id}.pdf`);
        };

        // Contenedor para acciones CNC
        const cncDiv = document.createElement('div');
        cncDiv.className = 'cnc-actions';
        cncDiv.style.display = 'none';
        
        // Recrear botones CNC (GCode, Python, Simulación)
        // Nota: Se asume que las funciones downloadGCode, downloadGCodePython y open3DSimulation existen globalmente
        cncDiv.innerHTML = `<button onclick="downloadGCode(lastPacker.bins[${bin.id-1}])" style="margin-top:10px; background:#339AF0; color:#fff; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold; margin-right:10px;">💾 G-Code (.nc)</button><button onclick="downloadGCodePython(lastPacker.bins[${bin.id-1}])" style="margin-top:10px; background:#20c997; color:#fff; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold; margin-right:10px;">🐍 G-Code (Python)</button><button onclick="open3DSimulation(lastPacker.bins[${bin.id-1}])" style="margin-top:10px; background:#7950f2; color:#fff; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">🎮 Simular 3D</button>`;
        
        wrapper.appendChild(title);
        wrapper.appendChild(canvas);
        wrapper.appendChild(btnPdf);
        wrapper.appendChild(cncDiv);
        sheetsContainer.appendChild(wrapper);

        const ctx = canvas.getContext('2d');
        drawGrid(ctx, canvas.width, canvas.height, scale);

        bin.parts.forEach(part => {
            totalPlaced++;
            const destX = part.fit.x * scale;
            const destY = part.fit.y * scale;
            const destW = part.w * scale;
            const destH = part.h * scale;

            ctx.save();
            const cx = destX + (part.rotated ? destH : destW) / 2;
            const cy = destY + (part.rotated ? destW : destH) / 2;
            ctx.translate(cx, cy);
            if (part.rotated) ctx.rotate(-90 * Math.PI / 180);

            // FIX: Usar las dimensiones y coordenadas originales (sin escalar) para recortar la imagen
            const srcX = part.originalX * imgScaleX;
            const srcY = part.originalY * imgScaleY;
            const srcW = part.originalW * imgScaleX;
            const srcH = part.originalH * imgScaleY;
            try {
                ctx.drawImage(globalSvgImage, srcX, srcY, srcW, srcH, -destW/2, -destH/2, destW, destH);
            } catch(err) {}

            ctx.restore();
        });

        if (document.getElementById('showToolpath').checked) {
            drawToolpathOverlay(ctx, bin, scale);
        }
    });

    const percent = Math.round((totalPlaced / globalParts.length) * 100);
    statsBar.innerHTML = `<strong>Resultados:</strong> ${totalPlaced}/${globalParts.length} piezas.`;
    statusMsg.innerHTML = totalPlaced < globalParts.length ? "⚠️ Faltan piezas." : "✅ Optimización completa.";
}

function drawGrid(ctx, w, h, scale) {
    ctx.save();
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;
    const step = 100 * scale; 
    for(let x=0; x<w; x+=step) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for(let y=0; y<h; y+=step) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    ctx.restore();
}

function drawToolpathOverlay(ctx, bin, scale) {
    // FIX: Asegurar que no se dibuje ni calcule si no está marcado
    if (!document.getElementById('showToolpath').checked) return;

    // 1. MODO ECOCUT (Trayectoria Continua)
    if (document.getElementById('ecoCutMode') && document.getElementById('ecoCutMode').checked) {
        if (typeof getEcoCutPath === 'function') {
            const path = getEcoCutPath(bin);
            if (path && path.length > 0) {
                // Animación progresiva
                let progress = 0;
                const speed = 4; // Puntos por frame (ajustar velocidad)
                
                const animate = () => {
                    if (!document.body.contains(ctx.canvas)) return; // Detener si el canvas ya no existe

                    ctx.save();
                    ctx.strokeStyle = '#d63384'; 
                    ctx.lineWidth = 2;
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    
                    const startIdx = Math.floor(progress);
                    const endIdx = Math.min(path.length - 1, Math.floor(progress + speed));
                    
                    if (startIdx < endIdx) {
                         ctx.moveTo(path[startIdx].x * scale, path[startIdx].y * scale);
                         for (let i = startIdx + 1; i <= endIdx; i++) {
                             ctx.lineTo(path[i].x * scale, path[i].y * scale);
                         }
                         ctx.stroke();
                    }
                    ctx.restore();

                    progress += speed;
                    if (progress < path.length - 1) {
                        requestAnimationFrame(animate);
                    }
                };
                animate();
                return;
            }
        }
    }

    // 2. MODO ESTÁNDAR (Corte pieza por pieza)
    ctx.save();
    
    let currentX = 0;
    let currentY = 0;

    // Estilos
    const styleRapid = { color: 'rgba(255, 0, 0, 0.6)', width: 1, dash: [3, 3] };
    const styleCut = { color: 'rgba(0, 100, 255, 0.9)', width: 2, dash: [] };

    // Ordenar piezas
    let partsToCut = [...bin.parts];
    // (Simple sort by position for drawing)
    partsToCut.sort((a, b) => (a.fit.x - b.fit.x) || (a.fit.y - b.fit.y));

    partsToCut.forEach(part => {
        if (!part.geometry) return;

        // Helper para transformar a pantalla
        const toScreen = (pts) => {
            // 1. Get Global Points (mm)
            const global = getGlobalPoints(part, pts);
            // 2. Scale to Screen (px)
            return global.map(p => ({ x: p.x * scale, y: p.y * scale }));
        };

        // Dibujar Huecos
        part.geometry.holes.forEach(holePts => {
            const points = toScreen(holePts);
            if (points.length === 0) return;

            ctx.beginPath();
            ctx.strokeStyle = '#ff922b'; // Naranja
            ctx.lineWidth = styleCut.width;
            ctx.setLineDash(styleCut.dash);
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
            ctx.stroke();
        });

        // Dibujar Contorno
        const outerPoints = toScreen(part.geometry.outer);
        if (outerPoints.length === 0) return;

        // Optimizar Inicio
        let points = optimizePathStart(outerPoints, {x: currentX, y: currentY});
        
        // Travel
        const start = points[0];
        const travelPath = getSafeTravelPath({x: currentX, y: currentY}, start, bin.width * scale, bin.height * scale);

        ctx.beginPath();
        ctx.strokeStyle = styleRapid.color;
        ctx.lineWidth = styleRapid.width;
        ctx.setLineDash(styleRapid.dash);
        ctx.moveTo(currentX, currentY);
        travelPath.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();

        // Cut
        ctx.beginPath();
        ctx.strokeStyle = styleCut.color;
        ctx.lineWidth = styleCut.width;
        ctx.setLineDash(styleCut.dash);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();

        currentX = points[points.length - 1].x;
        currentY = points[points.length - 1].y;
    });

    // Volver a Home (Parking)
    const parkX = (parseFloat(document.getElementById('parkX').value) || 0) * scale;
    const parkY = (parseFloat(document.getElementById('parkY').value) || 0) * scale;
    
    ctx.beginPath();
    ctx.strokeStyle = styleRapid.color;
    ctx.lineWidth = styleRapid.width;
    ctx.setLineDash(styleRapid.dash);
    ctx.moveTo(currentX, currentY);
    ctx.lineTo(parkX, parkY);
    ctx.stroke();
    
    // Marcar origen
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

/**
 * Analiza el SVG string, lo inyecta en el DOM oculto y genera los objetos Part.
 * Es crucial para que el Packer tenga dimensiones reales (getBBox).
 * @param {string} svgString - Código SVG
 * @param {function} onProgress - Callback de progreso (current, total)
 */
async function parseSvgParts(svgString, onProgress) {
    console.log('[parseSvgParts] Iniciando análisis de piezas...');
    
    // 1. Limpiar array global de piezas
    globalParts = []; 

    // 2. Parsear string a DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svg = doc.querySelector('svg');

    if (!svg) {
        console.error("No se encontró un elemento SVG válido.");
        return;
    }

    // 3. Inyectar en contenedor oculto (Necesario para getBBox)
    const hiddenContainer = document.getElementById('hiddenSvgContainer');
    if (hiddenContainer) {
        hiddenContainer.innerHTML = '';
        hiddenContainer.appendChild(svg);
    } else {
        console.warn("No se encontró #hiddenSvgContainer. getBBox podría fallar.");
    }

    // 4. Seleccionar elementos
    // Nota: file_processor.py devuelve principalmente 'path', pero soportamos otros por si acaso.
    const elements = Array.from(svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline'));
    const total = elements.length;

    // 5. Crear objetos Part
    for (let i = 0; i < total; i++) {
        const el = elements[i];
        
        // Crear instancia de Part (definida en packer.js)
        const part = new Part(el, i + 1);

        // Filtrar piezas inválidas o vacías
        if (part.w > 0.1 && part.h > 0.1) {
            globalParts.push(part);
        }

        // Callback de progreso (para no congelar UI en SVGs grandes)
        if (onProgress && i % 20 === 0) {
            onProgress(i + 1, total);
            await new Promise(r => setTimeout(r, 0));
        }
    }

    if (onProgress) onProgress(total, total);
    console.log(`[parseSvgParts] Análisis completado. ${globalParts.length} piezas válidas.`);
}