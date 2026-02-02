// Lógica de Nesting y Dibujo 2D

function runNesting() {
    const statusMsg = document.getElementById('statusMsg');
    statusMsg.innerText = "⏳ Optimizando...";
    document.getElementById('sheetsContainer').innerHTML = '';

    const sheetW = parseFloat(document.getElementById('sheetWidth').value);
    const sheetH = parseFloat(document.getElementById('sheetHeight').value);
    const gap = parseFloat(document.getElementById('gap').value);
    const allowRotation = document.getElementById('allowRotation').checked;
    const direction = document.getElementById('nestDirection').value;
    const useVertical = (direction === 'vertical');

    const packer = new Packer(sheetW, sheetH, gap, useVertical);
    lastPacker = packer;
    
    globalParts.forEach(p => { p.placed = false; p.binId = -1; });
    packer.fit(globalParts, allowRotation);
    drawResults(packer);
}

function drawResults(packer) {
    const bins = packer.bins;
    let totalPlaced = 0;
    const containerW = document.querySelector('.preview').clientWidth - 40;
    const displayW = Math.min(containerW, 800);
    const scale = displayW / packer.sheetW;
    const sheetsContainer = document.getElementById('sheetsContainer');
    const statsBar = document.getElementById('statsBar');
    const statusMsg = document.getElementById('statusMsg');

    const imgScaleX = globalSvgImage.width / svgViewBox.w;
    const imgScaleY = globalSvgImage.height / svgViewBox.h;

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

                const srcX = part.originalX * imgScaleX;
                const srcY = part.originalY * imgScaleY;
                const srcW = part.w * imgScaleX;
                const srcH = part.h * imgScaleY;
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

            const srcX = part.originalX * imgScaleX;
            const srcY = part.originalY * imgScaleY;
            const srcW = part.w * imgScaleX;
            const srcH = part.h * imgScaleY;

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

function getOptimizedSequence(bin) {
    let partsToCut = [...bin.parts];
    let currentPos = { x: 0, y: 0 };
    const sortedParts = [];

    while (partsToCut.length > 0) {
        let nearestIdx = -1;
        let minDist = Infinity;
        for (let i = 0; i < partsToCut.length; i++) {
            const p = partsToCut[i];
            const dist = (p.fit.x - currentPos.x) ** 2 + (p.fit.y - currentPos.y) ** 2;
            if (dist < minDist) { minDist = dist; nearestIdx = i; }
        }
        const nextPart = partsToCut.splice(nearestIdx, 1)[0];
        sortedParts.push(nextPart);
        currentPos = { x: nextPart.fit.x, y: nextPart.fit.y };
    }

    if (document.getElementById('reversePath') && document.getElementById('reversePath').checked) {
        sortedParts.reverse();
    }

    const finalSequence = [];
    const hiddenSvg = document.getElementById('hiddenSvgContainer').querySelector('svg');

    sortedParts.forEach(part => {
        const el = part.element;
        if (el.tagName.toLowerCase() === 'path') {
            const d = el.getAttribute('d');
            const subPathStrings = d.split(/(?=[Mm])/).filter(s => s.trim().length > 5); // Filtro de ruido
            if (subPathStrings.length > 1 && hiddenSvg) {
                const tempEls = subPathStrings.map(s => {
                    const tempEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    tempEl.setAttribute('d', s);
                    return tempEl;
                });
                const measured = tempEls.map(tempEl => {
                    hiddenSvg.appendChild(tempEl);
                    let area = 0;
                    try { const bbox = tempEl.getBBox(); area = bbox.width * bbox.height; } catch(e) {}
                    tempEl.remove();
                    return { el: tempEl, area };
                });
                // Ordenar: Menor área primero (Huecos) -> Mayor área al final (Contorno)
                measured.sort((a, b) => a.area - b.area); 
                measured.forEach((m, idx) => {
                    finalSequence.push({ element: m.el, parentPart: part, type: (idx < measured.length - 1) ? 'Hueco' : 'Contorno' });
                });
                return;
            }
        }
        finalSequence.push({ element: el, parentPart: part, type: 'Contorno' });
    });
    return finalSequence;
}

function drawToolpathOverlay(ctx, bin, scale) {
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

    const sequence = getOptimizedSequence(bin);

    sequence.forEach(item => {
        const part = item.parentPart;
        const el = item.element;
        const totalLen = el.getTotalLength();

        const getScreenPos = (p) => {
            const relX = p.x - part.x;
            const relY = p.y - part.y;
            let finalX, finalY;
            if (part.rotated) {
                finalX = part.fit.x + relY;
                finalY = part.fit.y + (part.w - relX); 
            } else {
                finalX = part.fit.x + relX;
                finalY = part.fit.y + relY;
            }
            return { x: finalX * scale, y: finalY * scale };
        };

        // Discretizar para visualización
        const step = 2.0; 
        let points = [];
        for (let len = 0; len <= totalLen; len += step) {
            points.push(getScreenPos(el.getPointAtLength(len)));
        }
        points.push(getScreenPos(el.getPointAtLength(totalLen)));

        // Optimizar Inicio
        points = optimizePathStart(points, {x: currentX, y: currentY});

        if (points.length > 0) {
            const start = points[0];

            // Movimiento Rápido (G0)
            const travelPath = getSafeTravelPath({x: currentX, y: currentY}, {x: start.x, y: start.y}, bin.width * scale, bin.height * scale);
            
            ctx.beginPath();
            ctx.strokeStyle = styleRapid.color;
            ctx.lineWidth = styleRapid.width;
            ctx.setLineDash(styleRapid.dash);
            ctx.moveTo(currentX, currentY);
            travelPath.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();

            // Movimiento de Corte (G1)
            ctx.beginPath();
            ctx.strokeStyle = styleCut.color;
            ctx.lineWidth = styleCut.width;
            ctx.setLineDash(styleCut.dash);
            ctx.moveTo(start.x, start.y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();

            currentX = points[points.length - 1].x;
            currentY = points[points.length - 1].y;
        }
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