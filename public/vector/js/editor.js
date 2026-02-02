// Editor de piezas individuales con Fabric.js

let fabricCanvas = null;
let currentEditingPart = null;

function openFabricEditor(part) {
    const fabricModal = document.getElementById('fabricModal');
    currentEditingPart = part;
    fabricModal.style.display = 'flex';
    
    const container = document.querySelector('#fabricModal > div > div:nth-child(2)');

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
        
        // Resetear propiedades para evitar conflictos de posición/escala del SVG original
        obj.set({
            scaleX: 1,
            scaleY: 1,
            left: 0,
            top: 0,
            originX: 'center',
            originY: 'center',
            hasControls: true,
            padding: 10
        });
        
        obj.set({
            borderColor: '#51CF66',
            cornerColor: 'white',
            cornerSize: 10,
            transparentCorners: false,
            // Asegurar visibilidad: si no tiene relleno, ponerle gris oscuro
            fill: (obj.fill === 'none' || !obj.fill) ? '#555' : obj.fill,
            stroke: obj.stroke || '#333',
            strokeWidth: obj.strokeWidth || 1
        });

        fabricCanvas.add(obj);
        
        // 1. Centrar explícitamente
        obj.setPositionByOrigin(new fabric.Point(fabricCanvas.width / 2, fabricCanvas.height / 2), 'center', 'center');

        // 2. Calcular Zoom para que la pieza quepa perfecta (80% del canvas)
        const scaleX = (fabricCanvas.width * 0.8) / obj.width;
        const scaleY = (fabricCanvas.height * 0.8) / obj.height;
        const zoom = Math.min(scaleX, scaleY);
        
        if (isFinite(zoom) && zoom > 0) obj.scale(zoom);

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
        alert("✅ Pieza actualizada.");
        if (typeof drawResults === 'function' && typeof lastPacker !== 'undefined') drawResults(lastPacker);
    }
    document.getElementById('fabricModal').style.display = 'none';
});