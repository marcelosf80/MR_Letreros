// Editor de piezas individuales con Fabric.js

let fabricCanvas = null;
let currentEditingPart = null;

function openFabricEditor(part) {
    const fabricModal = document.getElementById('fabricModal');
    currentEditingPart = part;
    fabricModal.style.display = 'flex';
    
    const container = document.getElementById('fabricContainer');

    // Seguridad: Si el contenedor no tiene tamaño aún (renderizado pendiente), esperar un poco
    if (container.clientWidth === 0 || container.clientHeight === 0) {
        setTimeout(() => openFabricEditor(part), 50);
        return;
    }
    
    if (!fabricCanvas) {
        const c = document.getElementById('fabricCanvas');
        c.width = container.clientWidth;
        c.height = container.clientHeight;
        fabricCanvas = new fabric.Canvas('fabricCanvas');
    } else {
        fabricCanvas.setWidth(container.clientWidth);
        fabricCanvas.setHeight(container.clientHeight);
        fabricCanvas.calcOffset(); // CRÍTICO: Recalcular offsets al mostrar el modal
    }
    fabricCanvas.clear();
    fabricCanvas.setBackgroundColor('#fff');
    fabricCanvas.setZoom(1);

    // Agregar cuadrícula de referencia
    drawGrid(fabricCanvas);

    const serializer = new XMLSerializer();
    const pathString = serializer.serializeToString(part.element);

    // Envolvemos en un SVG simple sin viewBox restrictivo para que Fabric lo interprete libremente
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg">${pathString}</svg>`;
    
    fabric.loadSVGFromString(svgString, (objects, options) => {
        if (!objects || objects.length === 0) return;

        const obj = fabric.util.groupSVGElements(objects, options);
        
        // Configuración base del objeto
        obj.set({
            originX: 'center',
            originY: 'center',
            borderColor: '#51CF66',
            cornerColor: 'white',
            cornerSize: 10,
            transparentCorners: false,
            hasControls: true,
            padding: 10
        });
        
        // Asegurar visibilidad (Manejar Grupos y Paths individuales)
        const ensureVisible = (o) => {
            const hasFill = o.fill && o.fill !== 'none' && o.fill !== 'transparent';
            const hasStroke = o.stroke && o.stroke !== 'none' && o.stroke !== 'transparent';
            
            if (!hasFill && !hasStroke) {
                o.set('fill', '#555'); // Si no tiene nada, poner relleno gris
            }
            // Si tiene stroke pero es muy fino o nulo, asegurar que se vea si no hay fill
            if (!hasFill && (!o.strokeWidth || o.strokeWidth === 0)) {
                 o.set({ stroke: '#333', strokeWidth: 1 });
            }
        };

        if (obj.type === 'group') {
            obj.forEachObject(ensureVisible);
        } else {
            ensureVisible(obj);
        }

        fabricCanvas.add(obj);
        
        // Centrar y Escalar
        const canvasW = fabricCanvas.width;
        const canvasH = fabricCanvas.height;
        
        // Resetear escala para medir dimensiones reales
        obj.scale(1);
        
        // Calcular escala para ajustar al 80% del canvas
        if (obj.width > 0 && obj.height > 0) {
            const scale = Math.min(
                (canvasW * 0.8) / obj.width,
                (canvasH * 0.8) / obj.height
            );
            obj.scale(scale);
        }

        // Posicionar en el centro absoluto del canvas
        obj.setPositionByOrigin(new fabric.Point(canvasW / 2, canvasH / 2), 'center', 'center');

        obj.setCoords(); // Actualizar caja de control
        fabricCanvas.setActiveObject(obj);
        fabricCanvas.renderAll();
    });
}

function drawGrid(canvas) {
    const gridSize = 20; // Cuadrícula de 20px
    const width = canvas.width;
    const height = canvas.height;
    const gridOpts = { stroke: '#f0f0f0', selectable: false, evented: false, excludeFromExport: true };

    for (let i = 0; i < Math.ceil(width / gridSize); i++) canvas.add(new fabric.Line([ i * gridSize, 0, i * gridSize, height], gridOpts));
    for (let i = 0; i < Math.ceil(height / gridSize); i++) canvas.add(new fabric.Line([ 0, i * gridSize, width, i * gridSize], gridOpts));
}

document.getElementById('btnZoomIn').addEventListener('click', () => {
    if (!fabricCanvas) return;
    let zoom = fabricCanvas.getZoom();
    zoom *= 1.1;
    if (zoom > 20) zoom = 20;
    fabricCanvas.zoomToPoint(new fabric.Point(fabricCanvas.width / 2, fabricCanvas.height / 2), zoom);
});

document.getElementById('btnZoomOut').addEventListener('click', () => {
    if (!fabricCanvas) return;
    let zoom = fabricCanvas.getZoom();
    zoom *= 0.9;
    if (zoom < 0.1) zoom = 0.1;
    fabricCanvas.zoomToPoint(new fabric.Point(fabricCanvas.width / 2, fabricCanvas.height / 2), zoom);
});

// --- NUEVAS FUNCIONES DE EDICIÓN ---

document.getElementById('btnRotateCCW').addEventListener('click', () => {
    if (!fabricCanvas) return;
    const obj = fabricCanvas.getObjects().find(o => !o.excludeFromExport);
    if (obj) {
        obj.rotate((obj.angle || 0) - 90);
        fabricCanvas.renderAll();
    }
});

document.getElementById('btnRotateCW').addEventListener('click', () => {
    if (!fabricCanvas) return;
    const obj = fabricCanvas.getObjects().find(o => !o.excludeFromExport);
    if (obj) {
        obj.rotate((obj.angle || 0) + 90);
        fabricCanvas.renderAll();
    }
});

document.getElementById('btnFlipX').addEventListener('click', () => {
    if (!fabricCanvas) return;
    const obj = fabricCanvas.getObjects().find(o => !o.excludeFromExport);
    if (obj) {
        obj.set('flipX', !obj.flipX);
        fabricCanvas.renderAll();
    }
});

document.getElementById('btnFlipY').addEventListener('click', () => {
    if (!fabricCanvas) return;
    const obj = fabricCanvas.getObjects().find(o => !o.excludeFromExport);
    if (obj) {
        obj.set('flipY', !obj.flipY);
        fabricCanvas.renderAll();
    }
});

document.getElementById('btnDeletePart').addEventListener('click', () => {
    if (!currentEditingPart) return;
    
    if (confirm("¿Estás seguro de eliminar esta pieza del trabajo?")) {
        // 1. Eliminar de la lista global de piezas
        const gIdx = globalParts.indexOf(currentEditingPart);
        if (gIdx > -1) globalParts.splice(gIdx, 1);

        // 2. Eliminar de la placa actual (visualización)
        if (lastPacker && lastPacker.bins) {
            lastPacker.bins.forEach(bin => {
                const pIdx = bin.parts.indexOf(currentEditingPart);
                if (pIdx > -1) bin.parts.splice(pIdx, 1);
            });
            drawResults(lastPacker); // Redibujar nesting
        }
        
        document.getElementById('fabricModal').style.display = 'none';
    }
});

document.getElementById('btnSaveFabric').addEventListener('click', () => {
    if (!currentEditingPart || !fabricCanvas) return;
    
    // Obtener el objeto editado (filtrando la cuadrícula)
    const objects = fabricCanvas.getObjects().filter(o => !o.excludeFromExport);
    const obj = objects[0];
    
    if (!obj) return;

    const newSvg = obj.toSVG();
    const parser = new DOMParser();
    const doc = parser.parseFromString(newSvg, 'image/svg+xml');
    const newPath = doc.querySelector('path');
    
    // Lógica de guardado (simplificada para el ejemplo)
    if (newPath) {
        currentEditingPart.element.setAttribute('d', newPath.getAttribute('d'));
        currentEditingPart.element.setAttribute('transform', newPath.getAttribute('transform') || '');
        
        // --- FIX: Actualizar dimensiones y geometría de la pieza para el Packer ---
        try {
            const bbox = currentEditingPart.element.getBBox();
            currentEditingPart.x = bbox.x;
            currentEditingPart.y = bbox.y;
            currentEditingPart.w = bbox.width;
            currentEditingPart.h = bbox.height;
            
            // Recalcular geometría para G-Code (aproximada)
            const totalLen = currentEditingPart.element.getTotalLength();
            const samples = Math.max(100, Math.ceil(totalLen / 2));
            const points = [];
            for (let i = 0; i < samples; i++) {
                const pt = currentEditingPart.element.getPointAtLength((i / samples) * totalLen);
                // Normalizar respecto al nuevo bbox
                points.push({ x: pt.x - bbox.x, y: pt.y - bbox.y });
            }
            // Actualizar outer geometry (huecos se pierden en edición simple, o se asume sólido)
            if (!currentEditingPart.geometry) currentEditingPart.geometry = { holes: [] };
            currentEditingPart.geometry.outer = points;
        } catch(e) { console.error("Error actualizando geometría", e); }
        // -----------------------------------------------------------

        alert("✅ Pieza actualizada.");
        if (typeof drawResults === 'function' && typeof lastPacker !== 'undefined') drawResults(lastPacker);
    }
    document.getElementById('fabricModal').style.display = 'none';
});

/**
 * Configura el editor de vectores inline para SVG
 * Permite seleccionar, editar y eliminar paths directamente
 */
function setupVectorEditor(svg, controlsContainer, statusElement) {
    console.log('[EDITOR] Configurando editor de vectores');
    
    let selectedPaths = [];
    let isEditMode = false;
    let undoStack = [];
    
    // Referencias a botones
    const btnToggleEdit = controlsContainer.querySelector('#btnToggleEdit');
    const btnWeldSelected = controlsContainer.querySelector('#btnWeldSelected');
    const btnExplodeSelected = controlsContainer.querySelector('#btnExplodeSelected');
    const btnDeleteSelected = controlsContainer.querySelector('#btnDeleteSelected');
    const btnUndo = controlsContainer.querySelector('#btnUndo');
    const btnSaveEdit = controlsContainer.querySelector('#btnSaveEdit');
    
    // Función para entrar/salir del modo edición
    function toggleEditMode() {
        isEditMode = !isEditMode;
        
        if (isEditMode) {
            btnToggleEdit.textContent = '✅ Salir de Edición';
            btnToggleEdit.style.background = '#51CF66';
            enablePathSelection();
            showEditButtons();
            statusElement.textContent = '✏️ Modo edición: Click en paths para seleccionar';
            statusElement.style.color = '#51CF66';
        } else {
            btnToggleEdit.textContent = '✏️ Editar / Limpiar';
            btnToggleEdit.style.background = '#444';
            disablePathSelection();
            hideEditButtons();
            statusElement.textContent = '✅ Edición guardada';
            statusElement.style.color = '#51CF66';
        }
    }
    
    // Función para habilitar selección de paths
    function enablePathSelection() {
        const paths = svg.querySelectorAll('path, circle, rect, ellipse, polygon, polyline');
        
        paths.forEach(path => {
            path.style.cursor = 'pointer';
            path.style.transition = 'all 0.2s';
            
            path.addEventListener('click', handlePathClick);
            path.addEventListener('mouseenter', handlePathHover);
            path.addEventListener('mouseleave', handlePathLeave);
        });
    }
    
    // Función para deshabilitar selección
    function disablePathSelection() {
        const paths = svg.querySelectorAll('path, circle, rect, ellipse, polygon, polyline');
        
        paths.forEach(path => {
            path.style.cursor = 'default';
            path.removeEventListener('click', handlePathClick);
            path.removeEventListener('mouseenter', handlePathHover);
            path.removeEventListener('mouseleave', handlePathLeave);
            
            // Limpiar selecciones
            if (path.classList.contains('selected-path')) {
                path.classList.remove('selected-path');
                path.style.stroke = path.dataset.originalStroke || '';
                path.style.strokeWidth = path.dataset.originalStrokeWidth || '';
            }
        });
        
        selectedPaths = [];
        updateButtonCounts();
    }
    
    // Manejador de click en path
    function handlePathClick(e) {
        e.stopPropagation();
        const path = e.target;
        
        if (path.classList.contains('selected-path')) {
            // Deseleccionar
            path.classList.remove('selected-path');
            path.style.stroke = path.dataset.originalStroke || '';
            path.style.strokeWidth = path.dataset.originalStrokeWidth || '';
            selectedPaths = selectedPaths.filter(p => p !== path);
        } else {
            // Seleccionar
            path.classList.add('selected-path');
            path.dataset.originalStroke = path.style.stroke;
            path.dataset.originalStrokeWidth = path.style.strokeWidth;
            path.style.stroke = '#FFD43B';
            path.style.strokeWidth = '3';
            selectedPaths.push(path);
        }
        
        updateButtonCounts();
    }
    
    // Hover visual
    function handlePathHover(e) {
        if (!e.target.classList.contains('selected-path')) {
            e.target.style.opacity = '0.7';
        }
    }
    
    function handlePathLeave(e) {
        if (!e.target.classList.contains('selected-path')) {
            e.target.style.opacity = '1';
        }
    }
    
    // Actualizar contadores en botones
    function updateButtonCounts() {
        btnWeldSelected.textContent = `🔗 Soldar (${selectedPaths.length})`;
        btnDeleteSelected.textContent = `🗑️ Borrar (${selectedPaths.length})`;
        
        btnWeldSelected.disabled = selectedPaths.length < 2;
        btnExplodeSelected.disabled = selectedPaths.length === 0;
        btnDeleteSelected.disabled = selectedPaths.length === 0;
    }
    
    // Mostrar botones de edición
    function showEditButtons() {
        btnWeldSelected.style.display = 'inline-block';
        btnExplodeSelected.style.display = 'inline-block';
        btnDeleteSelected.style.display = 'inline-block';
        btnUndo.style.display = 'inline-block';
        btnSaveEdit.style.display = 'inline-block';
    }
    
    // Ocultar botones de edición
    function hideEditButtons() {
        btnWeldSelected.style.display = 'none';
        btnExplodeSelected.style.display = 'none';
        btnDeleteSelected.style.display = 'none';
        btnUndo.style.display = 'none';
        btnSaveEdit.style.display = 'none';
    }
    
    // Función para soldar paths seleccionados
    function weldSelected() {
        if (selectedPaths.length < 2) return;
        undoStack.push(svg.innerHTML);
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'welded-group');
        selectedPaths.forEach(path => {
            const clone = path.cloneNode(true);
            clone.style.stroke = path.dataset.originalStroke || '';
            clone.style.strokeWidth = path.dataset.originalStrokeWidth || '';
            clone.classList.remove('selected-path');
            group.appendChild(clone);
            path.remove();
        });
        svg.appendChild(group);
        selectedPaths = [];
        updateButtonCounts();
        statusElement.textContent = '🔗 Paths soldados en grupo';
        statusElement.style.color = '#51CF66';
    }
    
    // Función para desagrupar
    function explodeSelected() {
        if (selectedPaths.length === 0) return;
        undoStack.push(svg.innerHTML);
        selectedPaths.forEach(element => {
            if (element.tagName === 'g') {
                const children = Array.from(element.children);
                const parent = element.parentNode;
                children.forEach(child => {
                    parent.insertBefore(child, element);
                });
                element.remove();
            }
        });
        selectedPaths = [];
        updateButtonCounts();
        enablePathSelection();
        statusElement.textContent = '💥 Grupo desagrupado';
        statusElement.style.color = '#51CF66';
    }
    
    // Función para borrar seleccionados
    function deleteSelected() {
        if (selectedPaths.length === 0) return;
        if (!confirm(`¿Eliminar ${selectedPaths.length} elemento(s)?`)) return;
        undoStack.push(svg.innerHTML);
        selectedPaths.forEach(path => path.remove());
        selectedPaths = [];
        updateButtonCounts();
        statusElement.textContent = `🗑️ ${selectedPaths.length} elementos eliminados`;
        statusElement.style.color = '#51CF66';
    }
    
    // Función para deshacer
    function undo() {
        if (undoStack.length === 0) {
            alert('No hay acciones para deshacer');
            return;
        }
        const previousState = undoStack.pop();
        svg.innerHTML = previousState;
        selectedPaths = [];
        updateButtonCounts();
        if (isEditMode) enablePathSelection();
        statusElement.textContent = '↩️ Acción deshecha';
        statusElement.style.color = '#51CF66';
    }
    
    // Función para guardar cambios
    function saveEdit() {
        const serializer = new XMLSerializer();
        currentSvgString = serializer.serializeToString(svg);
        if (isEditMode) toggleEditMode();
        statusElement.textContent = '💾 Cambios guardados en el vector';
        statusElement.style.color = '#51CF66';
    }
    
    // Event Listeners
    btnToggleEdit.addEventListener('click', toggleEditMode);
    btnWeldSelected.addEventListener('click', weldSelected);
    btnExplodeSelected.addEventListener('click', explodeSelected);
    btnDeleteSelected.addEventListener('click', deleteSelected);
    btnUndo.addEventListener('click', undo);
    btnSaveEdit.addEventListener('click', saveEdit);
    
    // Inicialmente ocultar botones de edición
    hideEditButtons();
    updateButtonCounts();
    
    console.log('[EDITOR] ✅ Editor configurado correctamente');
}