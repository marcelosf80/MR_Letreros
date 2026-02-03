// Lógica de procesamiento de imágenes y SVG

function removeBackground() {
    if (!currentImgUrl) return;
    const statusMsg = document.getElementById('statusMsg');
    statusMsg.innerText = "⏳ Procesando fondo...";
    
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const threshold = 240; // Umbral de blanco
        
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] > threshold && data[i+1] > threshold && data[i+2] > threshold) {
                data[i+3] = 0; // Transparente
            }
        }
        ctx.putImageData(imageData, 0, 0);
        
        canvas.toBlob(blob => {
            const newUrl = URL.createObjectURL(blob);
            currentImgUrl = newUrl;
            document.getElementById('sourcePreviewImg').src = newUrl;
            document.getElementById('btnDownloadPng').style.display = 'flex';
            statusMsg.innerText = "✅ Fondo eliminado.";
            
            const sheetsContainer = document.getElementById('sheetsContainer');
            sheetsContainer.innerHTML = '';
            const imgPreview = document.createElement('img');
            imgPreview.src = newUrl;
            imgPreview.style.maxWidth = '100%';
            sheetsContainer.appendChild(imgPreview);
        }, 'image/png');
    };
    img.src = currentImgUrl;
}

function runVectorization() {
    if (!currentImgUrl) return;
    
    const statusMsg = document.getElementById('statusMsg');
    statusMsg.innerText = "🔄 Vectorizando imagen...";
    statusMsg.style.color = "yellow";

    const smoothing = parseFloat(document.getElementById('smoothing').value);
    const noise = parseInt(document.getElementById('noise').value);
    const colors = parseInt(document.getElementById('colors').value);
    
    const isBlackAndWhite = (colors === 2);

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = currentImgUrl;
    
    img.onload = function() {
        if (typeof ImageTracer === 'undefined') {
            throw new Error('ImageTracer no cargado');
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);

        const options = {
            ltres: smoothing,
            qtres: smoothing,
            pathomit: noise || 10,
            colorsampling: 2,
            numberofcolors: colors,
            mincolorratio: 0.02,
            colorquantcycles: 3,
            scale: 1,
            viewbox: true
        };
        
        const svgString = ImageTracer.imagedataToSVG(imgData, options);
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const paths = doc.querySelectorAll('path');
        paths.forEach(p => {
            const fill = p.getAttribute('fill');
            const opacity = p.getAttribute('fill-opacity');
            if (fill === 'rgb(255,255,255)' || fill === '#FFFFFF' || fill === 'white' || (fill && fill.startsWith('rgba') && fill.endsWith(',0)')) || opacity === '0') {
                p.remove();
            }
        });
        const cleanSvgString = new XMLSerializer().serializeToString(doc);
        currentSvgString = cleanSvgString;

        globalSvgImage = new Image();
        globalSvgImage.onload = () => {
            statusMsg.innerText = "✅ Vectorización lista. Puede descargar o acomodar.";
            statusMsg.style.color = "#51CF66";
            document.getElementById('btnDownloadSvg').style.display = 'flex';
            document.getElementById('btnNest').disabled = false;
            
            const sheetsContainer = document.getElementById('sheetsContainer');
            sheetsContainer.innerHTML = '';
            
            const vectorDiv = document.createElement('div');
            vectorDiv.style.width = '100%';
            vectorDiv.style.textAlign = 'center';
            vectorDiv.innerHTML = '<h4 style="margin:0 0 10px 0; color:#51CF66;">Vectorizado (SVG)</h4>';

            // Controles de edición
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

            const svgWrapper = document.createElement('div');
            svgWrapper.innerHTML = currentSvgString;
            const svg = svgWrapper.querySelector('svg');
            
            setupVectorEditor(svg, editControls, statusMsg);

            if(svg) {
                svg.style.maxWidth = '100%';
                svg.style.height = 'auto';
                svg.style.border = '1px solid #555';
                svg.style.borderRadius = '4px';
                svg.style.background = '#fff';
                vectorDiv.appendChild(svg);
            }

            sheetsContainer.appendChild(vectorDiv);
        };
        const blob = new Blob([currentSvgString], {type: 'image/svg+xml'});
        globalSvgImage.src = URL.createObjectURL(blob);
    };
}

function setupVectorEditor(svg, controls, statusMsg) {
    let selectedPaths = new Set();
    let deletedStack = [];
    let isEditing = false;

    const btnToggle = controls.querySelector('#btnToggleEdit');
    const btnWeld = controls.querySelector('#btnWeldSelected');
    const btnExplode = controls.querySelector('#btnExplodeSelected');
    const btnDel = controls.querySelector('#btnDeleteSelected');
    const btnUndo = controls.querySelector('#btnUndo');
    const btnSave = controls.querySelector('#btnSaveEdit');

    const updateButtons = () => {
        btnDel.innerText = `🗑️ Borrar (${selectedPaths.size})`;
        btnDel.style.display = selectedPaths.size > 0 ? 'inline-block' : 'none';
        btnWeld.innerText = `🔗 Soldar (${selectedPaths.size})`;
        btnWeld.style.display = selectedPaths.size > 1 ? 'inline-block' : 'none';
        
        // Lógica para mostrar botón Desagrupar
        let canExplode = false;
        selectedPaths.forEach(p => {
            const d = p.getAttribute('d') || '';
            // Si tiene más de un comando M (Move), es compuesto y se puede desagrupar
            if ((d.match(/[Mm]/g) || []).length > 1) canExplode = true;
        });
        if (btnExplode) {
            btnExplode.style.display = (selectedPaths.size > 0 && canExplode) ? 'inline-block' : 'none';
            btnExplode.innerText = `💥 Desagrupar (${selectedPaths.size})`;
        }

        btnUndo.style.display = deletedStack.length > 0 ? 'inline-block' : 'none';
    };

    btnToggle.onclick = () => {
        isEditing = !isEditing;
        if (isEditing) {
            btnToggle.style.background = '#339AF0';
            btnToggle.innerText = 'Terminar Edición';
            btnSave.style.display = 'inline-block';
            updateButtons();
            
            svg.querySelectorAll('path').forEach(p => {
                if (!p.dataset.originalFill) p.dataset.originalFill = p.getAttribute('fill') || '#000000';
                p.style.cursor = 'pointer';
                
                p.onmouseover = () => { if(!selectedPaths.has(p)) p.setAttribute('fill', '#ff0000'); };
                p.onmouseout = () => { if(!selectedPaths.has(p)) p.setAttribute('fill', p.dataset.originalFill); };
                
                p.onclick = (e) => {
                    e.preventDefault();
                    if (selectedPaths.has(p)) {
                        selectedPaths.delete(p);
                        p.setAttribute('fill', p.dataset.originalFill);
                    } else {
                        selectedPaths.add(p);
                        p.setAttribute('fill', '#ff0000');
                    }
                    updateButtons();
                };
            });
        } else {
            btnToggle.style.background = '#444';
            btnToggle.innerText = '✏️ Editar / Limpiar';
            btnSave.style.display = 'none';
                        btnWeld.style.display = 'none';
            if (btnExplode) btnExplode.style.display = 'none';
            btnDel.style.display = 'none';
            btnUndo.style.display = 'none';
            selectedPaths.forEach(p => { if(p.parentNode) p.setAttribute('fill', p.dataset.originalFill); });
            selectedPaths.clear();
            svg.querySelectorAll('path').forEach(p => { p.style.cursor = 'default'; p.onmouseover = null; p.onmouseout = null; p.onclick = null; });
        }
    };

                btnWeld.onclick = () => {
                    const pathsToWeld = Array.from(selectedPaths);
                    if (pathsToWeld.length < 2) return;
                    
                    let combinedD = "";
                    pathsToWeld.forEach(p => {
                        combinedD += p.getAttribute('d') + " ";
                        p.remove();
                    });
                    
                    const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    newPath.setAttribute('d', combinedD);
                    newPath.setAttribute('fill', pathsToWeld[0].dataset.originalFill || '#000');
                    newPath.dataset.originalFill = pathsToWeld[0].dataset.originalFill || '#000';
                    newPath.dataset.welded = "true";
                    
                    // Attach listeners to new path
                    newPath.style.cursor = 'pointer';
                    newPath.onmouseover = () => { if(!selectedPaths.has(newPath)) newPath.setAttribute('fill', '#ff0000'); };
                    newPath.onmouseout = () => { if(!selectedPaths.has(newPath)) newPath.setAttribute('fill', newPath.dataset.originalFill); };
                    newPath.onclick = (e) => {
                         e.preventDefault();
                         if (selectedPaths.has(newPath)) {
                             selectedPaths.delete(newPath);
                             newPath.setAttribute('fill', newPath.dataset.originalFill);
                         } else {
                             selectedPaths.add(newPath);
                             newPath.setAttribute('fill', '#ff0000');
                         }
                         updateButtons();
                    };

                    svg.appendChild(newPath);
                    selectedPaths.clear();
                    updateButtons();
                };

                if (btnExplode) {
                    btnExplode.onclick = () => {
                        const pathsToExplode = Array.from(selectedPaths);
                        if (pathsToExplode.length === 0) return;

                        pathsToExplode.forEach(p => {
                            const d = p.getAttribute('d') || '';
                            const subPaths = d.split(/(?=[Mm])/).filter(s => s.trim().length > 0);
                            
                            if (subPaths.length > 1) {
                                subPaths.forEach(sp => {
                                    const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                    newPath.setAttribute('d', sp);
                                    newPath.setAttribute('fill', p.dataset.originalFill || '#000');
                                    newPath.dataset.originalFill = p.dataset.originalFill || '#000';
                                    
                                    newPath.style.cursor = 'pointer';
                                    newPath.onmouseover = () => { if(!selectedPaths.has(newPath)) newPath.setAttribute('fill', '#ff0000'); };
                                    newPath.onmouseout = () => { if(!selectedPaths.has(newPath)) newPath.setAttribute('fill', newPath.dataset.originalFill); };
                                    newPath.onclick = (e) => {
                                         e.preventDefault();
                                         if (selectedPaths.has(newPath)) {
                                             selectedPaths.delete(newPath);
                                             newPath.setAttribute('fill', newPath.dataset.originalFill);
                                         } else {
                                             selectedPaths.add(newPath);
                                             newPath.setAttribute('fill', '#ff0000');
                                         }
                                         updateButtons();
                                    };
                                    svg.appendChild(newPath);
                                });
                                p.remove();
                                selectedPaths.delete(p);
                            }
                        });
                        updateButtons();
                    };
                }

    btnDel.onclick = () => {
        const pathsToRemove = Array.from(selectedPaths);
        if (pathsToRemove.length > 0) {
            deletedStack.push(pathsToRemove);
            pathsToRemove.forEach(p => p.remove());
            selectedPaths.clear();
            updateButtons();
        }
    };

    btnUndo.onclick = () => {
        const lastBatch = deletedStack.pop();
        if (lastBatch) {
            lastBatch.forEach(p => {
                p.setAttribute('fill', p.dataset.originalFill);
                svg.appendChild(p);
            });
            updateButtons();
        }
    };

    btnSave.onclick = () => {
        currentSvgString = new XMLSerializer().serializeToString(svg);
        statusMsg.innerText = "✅ Vector actualizado. Listo para acomodar.";
        btnToggle.click(); 
    };
}

function parseSvgParts(svgString) {
    const hiddenContainer = document.getElementById('hiddenSvgContainer');
    const statusMsg = document.getElementById('statusMsg');
    const realWidthInput = document.getElementById('realWidthCm');
    
    // Inyectar SVG oculto
    hiddenContainer.innerHTML = svgString;
    const svgEl = hiddenContainer.querySelector('svg');

    if (!svgEl) {
        statusMsg.innerText = "❌ Error leyendo SVG.";
        return;
    }

    // Fix ViewBox
    if (!svgEl.getAttribute('viewBox')) {
        const w = parseFloat(svgEl.getAttribute('width')) || 1000;
        const h = parseFloat(svgEl.getAttribute('height')) || 1000;
        svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
    const vb = svgEl.viewBox.baseVal;
    svgViewBox = { w: vb.width, h: vb.height };
    if(svgViewBox.w === 0) svgViewBox.w = parseFloat(svgEl.getAttribute('width')) || 1000;
    if(svgViewBox.h === 0) svgViewBox.h = parseFloat(svgEl.getAttribute('height')) || 1000;

    // NUEVO: Convertir primitivas a Paths (Objeto a Trayecto)
    convertPrimitivesToPaths(svgEl);

    // --- ESCALA MÉTRICA (CM -> MM) ---
    const realWidthCm = parseFloat(realWidthInput.value);
    let scaleFactor = 1;

    if (realWidthCm && realWidthCm > 0) {
        const targetWidthMm = realWidthCm * 10;
        const currentWidthPx = svgViewBox.w;
        scaleFactor = targetWidthMm / currentWidthPx;
        
        // Aplicar escala al ViewBox
        svgViewBox.w *= scaleFactor;
        svgViewBox.h *= scaleFactor;
    }

    // --- GLOBAL HIERARCHY & GROUPING (Soporte para Huecos) ---
    // 1. Obtener todos los paths y descomponerlos
    const allPaths = Array.from(svgEl.querySelectorAll('path'));
    let simpleShapes = [];
    
    allPaths.forEach(el => {
        const d = el.getAttribute('d') || '';
        // Dividir por comando M (MoveTo) para encontrar sub-trayectos
        // Si está soldado (welded), no dividimos
        let subPaths = [];
        if (el.dataset.welded === "true") {
            subPaths = [d];
        } else {
            subPaths = d.split(/(?=[Mm])/).filter(s => s.trim().length > 0);
        }
        
        subPaths.forEach(sp => {
            // APLICAR ESCALA DIRECTAMENTE A LAS COORDENADAS DEL PATH
            let scaledSp = sp;
            if (scaleFactor !== 1) {
                scaledSp = sp.replace(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/g, (match) => {
                    return (parseFloat(match) * scaleFactor).toFixed(3);
                });
            }

            const tempEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
            tempEl.setAttribute('d', scaledSp);
            svgEl.appendChild(tempEl);

            // --- FIX: Crear elemento temporal con path original para obtener BBox sin escalar ---
            const tempOriginalEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
            tempOriginalEl.setAttribute('d', sp);
            svgEl.appendChild(tempOriginalEl);
            
            try {
                const bbox = tempEl.getBBox();
                // Extraer puntos para RayCasting (Aproximación poligonal)
                // CORRECCIÓN: Usar muestreo real del perímetro en lugar de Regex
                const points = [];
                const totalLen = tempEl.getTotalLength();
                const samples = Math.max(100, Math.ceil(totalLen / 2)); // Muestreo dinámico para mayor precisión
                for (let i = 0; i < samples; i++) {
                    const pt = tempEl.getPointAtLength((i / samples) * totalLen);
                    points.push({ x: pt.x, y: pt.y });
                }

                const originalBbox = tempOriginalEl.getBBox();
                simpleShapes.push({
                    d: scaledSp,
                    bbox: bbox,
                    originalBbox: originalBbox, // Guardar BBox original
                    area: bbox.width * bbox.height,
                    points: points,
                    children: [],
                    originalColor: el.getAttribute('fill') || '#000'
                });
            } catch(e) {}
            tempEl.remove();
            tempOriginalEl.remove();
        });
        el.remove(); // Eliminar original
    });

    // 2. Ordenar por Área Descendente
    simpleShapes.sort((a, b) => b.area - a.area);

    // 2b. FILTRO DE FONDO (Doble Logo)
    if (simpleShapes.length > 0) {
        const largest = simpleShapes[0];
        const vW = svgViewBox.w;
        const vH = svgViewBox.h;
        const isContainer = (largest.bbox.width > vW * 0.90) && 
                            (largest.bbox.height > vH * 0.90);
        if (isContainer) {
            simpleShapes.shift();
        }
    }

    // 3. Construir Jerarquía (Árbol) para manejar huecos
    const rootNodes = [];

    const isPointInPoly = (p, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > p.y) !== (yj > p.y)) &&
                (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    const isContained = (inner, outer) => {
        // BBox Check con Tolerancia (Epsilon) para evitar errores de punto flotante
        const epsilon = 0.5; 
        if (inner.bbox.x < outer.bbox.x - epsilon || 
            inner.bbox.y < outer.bbox.y - epsilon ||
            (inner.bbox.x + inner.bbox.width) > (outer.bbox.x + outer.bbox.width) + epsilon ||
            (inner.bbox.y + inner.bbox.height) > (outer.bbox.y + outer.bbox.height) + epsilon) {
            return false;
        }

        // RayCasting con el primer punto del inner
        if (inner.points.length === 0 || outer.points.length === 0) return true;
        
        // 1. Probar con el centro del BBox
        const center = {
            x: inner.bbox.x + inner.bbox.width / 2,
            y: inner.bbox.y + inner.bbox.height / 2
        };
        if (isPointInPoly(center, outer.points)) return true;

        // 2. Fallback: Probar múltiples puntos del perímetro para robustez
        // Probamos inicio, medio y final
        const indices = [0, Math.floor(inner.points.length / 2), inner.points.length - 1];
        for (let idx of indices) {
            if (isPointInPoly(inner.points[idx], outer.points)) return true;
        }
        
        return false;
    };

    const addToTree = (shape, nodes) => {
        for (let node of nodes) {
            if (isContained(shape, node)) {
                addToTree(shape, node.children);
                return;
            }
        }
        nodes.push(shape);
    };

    simpleShapes.forEach(shape => addToTree(shape, rootNodes));

    // 4. Reconstruir SVG con huecos combinados
    const getPointsFromPath = (d, step = 1.0) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute('d', d);
        const len = path.getTotalLength();
        const points = [];
        for (let l = 0; l <= len; l += step) {
            const p = path.getPointAtLength(l);
            points.push({x: p.x, y: p.y});
        }
        return points;
    };

    const processNode = (node, level) => {
        // Nivel par = Sólido, Nivel impar = Hueco (se ignora aquí, se procesa con el padre)
        if (level % 2 === 0) {
            let combinedD = node.d;
            // Propagar el BBox original de la pieza principal
            const originalBbox = node.originalBbox;
            
            // Recolectar huecos útiles para nesting
            const holesData = [];
            const holePolys = [];

            node.children.forEach(hole => {
                combinedD += " " + hole.d;
                // Los hijos del hueco son Islas -> Recursión
                hole.children.forEach(island => processNode(island, level + 2));

                // Calcular rectángulo seguro dentro del hueco (Safety Factor 0.7 para evitar bordes)
                const safetyFactor = 0.7;
                const hW = hole.bbox.width * safetyFactor;
                const hH = hole.bbox.height * safetyFactor;
                // Centrar el rectángulo seguro
                const hX = (hole.bbox.x - node.bbox.x) + (hole.bbox.width - hW) / 2;
                const hY = (hole.bbox.y - node.bbox.y) + (hole.bbox.height - hH) / 2;

                if (hW > 10 && hH > 10) { // Solo huecos mayores a 10mm
                    holesData.push({ x: hX, y: hY, w: hW, h: hH });
                }
                
                holePolys.push(getPointsFromPath(hole.d));
            });
            
            const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            newPath.setAttribute('d', combinedD);
            
            // Normalización de Geometría (Polígonos Relativos)
            const originX = node.bbox.x;
            const originY = node.bbox.y;
            const normalize = p => ({x: p.x - originX, y: p.y - originY});

            const geometry = {
                outer: getPointsFromPath(node.d).map(normalize),
                holes: holePolys.map(poly => poly.map(normalize))
            };
            newPath.geometry = geometry; // Adjuntar objeto directo al elemento DOM

            // Guardar datos de huecos en el elemento para el Packer
            if (holesData.length > 0) {
                newPath.dataset.holes = JSON.stringify(holesData);
            }

            // Adjuntar BBox original al elemento para usarlo al crear el objeto Part
            newPath.originalBbox = originalBbox;

            newPath.setAttribute('fill', node.originalColor);
            newPath.setAttribute('fill-rule', 'evenodd');
            svgEl.appendChild(newPath);
        }
    };

    rootNodes.forEach(node => processNode(node, 0));

    // Detectar Piezas Finales para el Packer
    const finalShapes = svgEl.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
    globalParts = []; // Reset
    let idCount = 1;

    finalShapes.forEach(el => {
        if (el.closest('defs') || el.closest('clipPath')) return;
        
        const p = new Part(el, idCount);
        if (p.w > 0.1 && p.h > 0.1) {
            // FIX: Asignar las coordenadas y dimensiones originales (sin escalar) para el recorte de la imagen
            if (el.originalBbox) {
                p.originalX = el.originalBbox.x;
                p.originalY = el.originalBbox.y;
                p.originalW = el.originalBbox.width;
                p.originalH = el.originalBbox.height;
            } else {
                // Fallback por si algo falla (aproximación)
                p.originalX = p.x / (scaleFactor || 1);
                p.originalY = p.y / (scaleFactor || 1);
                p.originalW = p.w / (scaleFactor || 1);
                p.originalH = p.h / (scaleFactor || 1);
            }
            globalParts.push(p);
            idCount++;
        }
    });

    if (globalParts.length === 0) {
        statusMsg.innerText = "❌ No se encontraron piezas vectoriales.";
    }
}

function convertPrimitivesToPaths(svg) {
    const shapes = svg.querySelectorAll('rect, circle, ellipse, line, polyline, polygon');
    shapes.forEach(shape => {
        const tag = shape.tagName.toLowerCase();
        let d = '';
        
        // Constante Kappa para aproximación de círculos con Bezier
        const k = 0.5522847498;
        
        if (tag === 'rect') {
            const x = parseFloat(shape.getAttribute('x')) || 0;
            const y = parseFloat(shape.getAttribute('y')) || 0;
            const w = parseFloat(shape.getAttribute('width')) || 0;
            const h = parseFloat(shape.getAttribute('height')) || 0;
            const rx = parseFloat(shape.getAttribute('rx')) || 0;
            const ry = parseFloat(shape.getAttribute('ry')) || 0;
            
            if (rx || ry) {
                const r_x = rx || ry;
                const r_y = ry || rx;
                const kx = r_x * k;
                const ky = r_y * k;
                
                // Usar Curvas Bezier (C) en lugar de Arcos (A) para evitar errores de escalado
                d = `M ${x + r_x},${y} ` +
                    `L ${x + w - r_x},${y} ` +
                    `C ${x + w - r_x + kx},${y} ${x + w},${y + r_y - ky} ${x + w},${y + r_y} ` +
                    `L ${x + w},${y + h - r_y} ` +
                    `C ${x + w},${y + h - r_y + ky} ${x + w - r_x + kx},${y + h} ${x + w - r_x},${y + h} ` +
                    `L ${x + r_x},${y + h} ` +
                    `C ${x + r_x - kx},${y + h} ${x},${y + h - r_y + ky} ${x},${y + h - r_y} ` +
                    `L ${x},${y + r_y} ` +
                    `C ${x},${y + r_y - ky} ${x + r_x - kx},${y} ${x + r_x},${y} Z`;
            } else {
                d = `M ${x},${y} h ${w} v ${h} h ${-w} Z`;
            }
        } else if (tag === 'circle') {
            const cx = parseFloat(shape.getAttribute('cx')) || 0;
            const cy = parseFloat(shape.getAttribute('cy')) || 0;
            const r = parseFloat(shape.getAttribute('r')) || 0;
            const kr = r * k;
            d = `M ${cx - r},${cy} ` +
                `C ${cx - r},${cy - kr} ${cx - kr},${cy - r} ${cx},${cy - r} ` +
                `C ${cx + kr},${cy - r} ${cx + r},${cy - kr} ${cx + r},${cy} ` +
                `C ${cx + r},${cy + kr} ${cx + kr},${cy + r} ${cx},${cy + r} ` +
                `C ${cx - kr},${cy + r} ${cx - r},${cy + kr} ${cx - r},${cy} Z`;
        } else if (tag === 'ellipse') {
            const cx = parseFloat(shape.getAttribute('cx')) || 0;
            const cy = parseFloat(shape.getAttribute('cy')) || 0;
            const rx = parseFloat(shape.getAttribute('rx')) || 0;
            const ry = parseFloat(shape.getAttribute('ry')) || 0;
            const kx = rx * k;
            const ky = ry * k;
            d = `M ${cx - rx},${cy} ` +
                `C ${cx - rx},${cy - ky} ${cx - kx},${cy - ry} ${cx},${cy - ry} ` +
                `C ${cx + kx},${cy - ry} ${cx + rx},${cy - ky} ${cx + rx},${cy} ` +
                `C ${cx + rx},${cy + ky} ${cx + kx},${cy + ry} ${cx},${cy + ry} ` +
                `C ${cx - kx},${cy + ry} ${cx - rx},${cy + ky} ${cx - rx},${cy} Z`;
        } else if (tag === 'line') {
            const x1 = parseFloat(shape.getAttribute('x1')) || 0;
            const y1 = parseFloat(shape.getAttribute('y1')) || 0;
            const x2 = parseFloat(shape.getAttribute('x2')) || 0;
            const y2 = parseFloat(shape.getAttribute('y2')) || 0;
            d = `M ${x1},${y1} L ${x2},${y2}`;
        } else if (tag === 'polyline' || tag === 'polygon') {
            const points = shape.getAttribute('points');
            if (points) {
                const pts = points.trim().split(/[\s,]+/);
                if (pts.length >= 2) {
                    d = 'M ' + pts[0] + ',' + pts[1];
                    for (let i = 2; i < pts.length; i+=2) {
                        d += ' L ' + pts[i] + ',' + pts[i+1];
                    }
                    if (tag === 'polygon') d += ' Z';
                }
            }
        }

        if (d) {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute('d', d);
            for (let i = 0; i < shape.attributes.length; i++) {
                const attr = shape.attributes[i];
                if (!['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'points', 'd'].includes(attr.name)) {
                    path.setAttribute(attr.name, attr.value);
                }
            }
            shape.parentNode.replaceChild(path, shape);
        }
    });
}