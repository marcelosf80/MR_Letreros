let materials = [];
let customProducts = [];
let quoteMode = 'linear'; // default to linear
let canvas;
let scaleFactor = 1; // px to cm
let currentGroup = null;
let cachedCostsConfig = {};
let cachedPricesConfig = {};
let materialFrame = null;
let originalSVG = null;
let is3DMode = false;
let isOutlineMode = false;
let scene, camera, renderer, controls, modelGroup;
let ambientLight, directLight;

document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    init3D();
    initFileUpload();
    
    // Configurar el event listener del switch de modo
    const selectQuoteMode = document.getElementById('selectQuoteMode');
    if (selectQuoteMode) {
        selectQuoteMode.addEventListener('change', (e) => {
            updateDropdownAndUI();
        });
    }

    // Configurar inputs de cm lineal en modo Producto para que calculen el precio de venta dinámicamente
    ['inputCutCost', 'inputProfitPct'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                if (quoteMode === 'linear') {
                    updateCalculatedPrice();
                }
            });
        }
    });

    // Cargar configuraciones del backend
    loadMaterials().then(() => {
        loadCalculatorConfig().then(() => {
            loadCustomProducts();
            updateDropdownAndUI();
            if (currentGroup) calculateCosts();
        });
    });
});

function initCanvas() {
    canvas = new fabric.Canvas('mainCanvas', {
        backgroundColor: 'transparent',
        width: 800,
        height: 600
    });

    // --- ZOOM with mouse wheel ---
    canvas.on('mouse:wheel', function(opt) {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.05) zoom = 0.05;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
        document.getElementById('zoomLevel').innerText = `Zoom: ${Math.round(zoom * 100)}%`;
    });

    // --- PAN with ALT + drag ---
    canvas.on('mouse:down', function(opt) {
        if (opt.e.altKey) {
            this.isDragging = true;
            this.selection = false;
            this.lastPosX = opt.e.clientX;
            this.lastPosY = opt.e.clientY;
        }
    });
    canvas.on('mouse:move', function(opt) {
        if (this.isDragging) {
            const vpt = this.viewportTransform;
            vpt[4] += opt.e.clientX - this.lastPosX;
            vpt[5] += opt.e.clientY - this.lastPosY;
            this.requestRenderAll();
            this.lastPosX = opt.e.clientX;
            this.lastPosY = opt.e.clientY;
        }
    });
    canvas.on('mouse:up', function() {
        this.setViewportTransform(this.viewportTransform);
        this.isDragging = false;
        this.selection = true;
    });



    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
}

function resetZoom() {
    if (canvas) {
        canvas.setZoom(1);
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        if (currentGroup) {
            canvas.centerObject(currentGroup);
            currentGroup.setCoords();
        }
        canvas.renderAll();
        document.getElementById('zoomLevel').innerText = `Zoom: 100%`;
    }
}

function toggleCanvasMode() {
    const area = document.getElementById('dropZoneLayer');
    if (area) area.classList.toggle('dark-mode');
}

function resizeCanvas() {
    const container = document.querySelector('.canvas-area');
    if (!container || !canvas) return;
    
    const w = container.clientWidth;
    const h = container.clientHeight;
    
    if (w > 0 && h > 0) {
        canvas.setWidth(w);
        canvas.setHeight(h);
        canvas.renderAll();
        
        // Resize 3D also
        if (renderer && camera) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
    }
}

function toggleAutoRotate3D() {
    if (controls) {
        controls.autoRotate = document.getElementById('checkAutoRotate').checked;
        controls.autoRotateSpeed = 4.0;
    }
}

function reset3DCamera() {
    if (controls && camera) {
        camera.position.set(0, 0, 400);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

function update3DLightScale(val) {
    if (ambientLight) ambientLight.intensity = parseFloat(val);
    if (directLight) directLight.intensity = parseFloat(val) + 0.2;
}

function toggle3DView() {
    is3DMode = !is3DMode;
    const canvas2D = document.getElementById('mainCanvas').parentElement; 
    const container3D = document.getElementById('container3D');
    const btn = document.getElementById('btnToggle3D');
    
    if (is3DMode) {
        canvas2D.style.display = 'none';
        container3D.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-th"></i> VISTA 2D';
        btn.classList.replace('btn-primary', 'btn-secondary');
        document.getElementById('btnDownloadSTL').style.display = 'block';
        document.getElementById('extra3DOptions').style.display = 'flex';
        resizeCanvas(); // Ensure renderer size is correct
        update3DView();
    } else {
        canvas2D.style.display = 'block';
        container3D.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-cube"></i> VISTA 3D';
        btn.classList.replace('btn-secondary', 'btn-primary');
        document.getElementById('btnDownloadSTL').style.display = 'none';
        document.getElementById('extra3DOptions').style.display = 'none';
    }
}

function toggleOutlineMode() {
    isOutlineMode = !isOutlineMode;
    const btn = document.getElementById('btnToggleOutline');
    if (isOutlineMode) {
        btn.classList.replace('btn-light', 'btn-warning');
        btn.innerHTML = '<i class="fas fa-paint-brush"></i> Lleno';
    } else {
        btn.classList.replace('btn-warning', 'btn-light');
        btn.innerHTML = '<i class="fas fa-vector-square"></i> Contorno';
    }
    calculateCosts(); // Re-render logic with new style
}

function init3D() {
    const container = document.getElementById('container3D');
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    camera.position.set(0, -100, 400);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = false; // default
    controls.autoRotateSpeed = 4.0;

    ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    directLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directLight.position.set(100, 100, 200);
    directLight.castShadow = true;
    scene.add(directLight);

    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

function downloadSTL() {
    if (!modelGroup || modelGroup.children.length === 0) {
        alert("Primero debes cargar un diseño y entrar en la Vista 3D.");
        return;
    }

    const exporter = new THREE.STLExporter();
    const originalScale = modelGroup.scale.clone();
    const originalPos = modelGroup.position.clone();
    const originalRot = modelGroup.rotation.clone();

    const targetH_cm = parseFloat(document.getElementById('inputHeight').value) || 10;
    const targetH_mm = targetH_cm * 10;
    
    const manualDepth_cm = parseFloat(document.getElementById('inputManualDepth').value) || 2;
    const manualDepth_mm = manualDepth_cm * 10;
    
    const box = new THREE.Box3().setFromObject(modelGroup);
    const currentH_3dUnits = box.getSize(new THREE.Vector3()).y / modelGroup.scale.y;
    
    const worldScale = targetH_mm / currentH_3dUnits;
    
    modelGroup.scale.set(worldScale, worldScale, worldScale);
    modelGroup.rotation.set(Math.PI, 0, 0); // Exportar derecho
    modelGroup.position.set(0, 0, 0);

    const result = exporter.parse(modelGroup, { binary: true });
    
    // Restaurar vista
    modelGroup.scale.copy(originalScale);
    modelGroup.position.copy(originalPos);
    modelGroup.rotation.copy(originalRot);

    const blob = new Blob([result], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.href = URL.createObjectURL(blob);
    link.download = `letrero_3d_${targetH_cm}cm.stl`;
    link.click();
    document.body.removeChild(link);
}

function update3DView() {
    if (!originalSVG || !is3DMode) return;

    const isHollowNow = document.getElementById('checkHollow').checked;
    document.getElementById('hollowSubOptions').style.display = isHollowNow ? 'flex' : 'none';

    // Clear previous model
    for (let i = scene.children.length - 1; i >= 0; i--) {
        const obj = scene.children[i];
        if (obj.type === 'Group' || obj.type === 'Mesh') {
            scene.remove(obj);
        }
    }
    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const loader = new THREE.SVGLoader();
    const svgData = loader.parse(originalSVG);
    
    // Get material properties
    let matName = "";
    if (quoteMode === 'material') {
        const selectedMatId = document.getElementById('selectMaterial').value;
        const material = materials.find(m => String(m.id) === String(selectedMatId));
        matName = material ? (material.productoNombre || material.producto).toLowerCase() : "";
    } else {
        const selectedProdId = document.getElementById('selectMaterial').value;
        const product = customProducts.find(p => String(p.id) === String(selectedProdId));
        matName = product ? product.name.toLowerCase() : "";
    }
    
    // Simple material logic
    let threeMat;
    if (matName.includes('polifan')) {
        threeMat = new THREE.MeshPhongMaterial({ color: 0xeeeeee, flatShading: true, side: THREE.DoubleSide });
    } else if (matName.includes('chapa') || matName.includes('acero') || matName.includes('galv')) {
        threeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide });
    } else if (matName.includes('acrilico')) {
        threeMat = new THREE.MeshPhongMaterial({ color: 0x4361ee, transparent: true, opacity: 0.8, shininess: 100, side: THREE.DoubleSide });
    } else {
        threeMat = new THREE.MeshPhongMaterial({ color: 0x4361ee, side: THREE.DoubleSide });
    }
    
    let currentDepth = parseFloat(document.getElementById('inputManualDepth').value) || 2;
    
    const targetH_cm = parseFloat(document.getElementById('inputHeight').value) || 10;
    const wallThickness_mm = parseFloat(document.getElementById('inputWallThickness').value) || 2;
    const isHollow = document.getElementById('checkHollow').checked;

    // 1. Obtenemos los Shapes y calculamos las medidas nativas reales de los vectores 3D
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const allShapes = [];
    
    svgData.paths.forEach((path) => {
        const shapes = THREE.SVGLoader.createShapes(path);
        shapes.forEach(shape => {
            allShapes.push(shape);
            const pts = shape.getPoints();
            pts.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            });
        });
    });

    const nativeSVGHeight = (maxY - minY) > 0 ? (maxY - minY) : 100;
    
    // 2. Cálculo matemático exacto para la extrusión
    const unitsPerCm = nativeSVGHeight / targetH_cm;
    
    const depthInUnits = currentDepth * unitsPerCm;
    const wall_3dUnits = (wallThickness_mm / 10) * unitsPerCm;
    const backPanel_units = 0.15 * unitsPerCm; // 1.5mm back panel
    
    const customColorHex = document.getElementById('input3DColorOverride').value;
    const customColor = new THREE.Color(customColorHex);

    allShapes.forEach((shape) => {
        const designMat = threeMat.clone();
        designMat.color.copy(customColor);
        
        if (isHollow) {
            const hasFront = document.getElementById('checkFront').checked;
            const hasBack = document.getElementById('checkBack').checked;

            if (hasFront) {
                const frontGeom = new THREE.ExtrudeGeometry(shape, {
                    depth: backPanel_units,
                    bevelEnabled: false
                });
                const frontMesh = new THREE.Mesh(frontGeom, designMat);
                frontMesh.position.z = depthInUnits - backPanel_units;
                modelGroup.add(frontMesh);
            }

            if (hasBack) {
                const backGeom = new THREE.ExtrudeGeometry(shape, {
                    depth: backPanel_units,
                    bevelEnabled: false
                });
                const backMesh = new THREE.Mesh(backGeom, designMat);
                modelGroup.add(backMesh);
            }
            
            if (typeof ClipperLib !== 'undefined') {
                const scale = 10000;
                const subj = new ClipperLib.Paths();
                
                subj.push(shape.getPoints().map(p => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) })));
                shape.holes.forEach(hole => {
                    subj.push(hole.getPoints().map(p => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) })));
                });
                
                const co = new ClipperLib.ClipperOffset();
                co.AddPaths(subj, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
                const corePaths = new ClipperLib.Paths();
                co.Execute(corePaths, -wall_3dUnits * scale); 
                
                const c = new ClipperLib.Clipper();
                c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
                c.AddPaths(corePaths, ClipperLib.PolyType.ptClip, true);
                const solutionTree = new ClipperLib.PolyTree();
                c.Execute(ClipperLib.ClipType.ctDifference, solutionTree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

                const finalShapes = [];
                const extractPolyTree = (node) => {
                    const childs = typeof node.Childs === 'function' ? node.Childs() : (node.Childs || node.m_childs || []);
                    for (let i = 0; i < childs.length; i++) {
                        const outerNode = childs[i];
                        const contour = typeof outerNode.Contour === 'function' ? outerNode.Contour() : (outerNode.Contour || outerNode.m_polygon || []);
                        
                        if (contour.length > 0) {
                            const pts = contour.map(p => new THREE.Vector2(p.X / scale, p.Y / scale));
                            const threeShape = new THREE.Shape(pts);
                            
                            const holes = typeof outerNode.Childs === 'function' ? outerNode.Childs() : (outerNode.Childs || outerNode.m_childs || []);
                            for (let j = 0; j < holes.length; j++) {
                                const holeNode = holes[j];
                                const hContour = typeof holeNode.Contour === 'function' ? holeNode.Contour() : (holeNode.Contour || holeNode.m_polygon || []);
                                if (hContour.length > 0) {
                                    const hPts = hContour.map(p => new THREE.Vector2(p.X / scale, p.Y / scale));
                                    threeShape.holes.push(new THREE.Path(hPts));
                                }
                                extractPolyTree(holeNode);
                            }
                            finalShapes.push(threeShape);
                        }
                    }
                };
                extractPolyTree(solutionTree);

                finalShapes.forEach(s => {
                    const wallGeom = new THREE.ExtrudeGeometry(s, { depth: depthInUnits, bevelEnabled: false });
                    const wallMesh = new THREE.Mesh(wallGeom, designMat);
                    modelGroup.add(wallMesh);
                });

            } else {
                const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
                    depth: depthInUnits,
                    bevelEnabled: false
                }), designMat);
                modelGroup.add(mesh);
            }

        } else {
            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: depthInUnits,
                bevelEnabled: false
            });

            let meshMaterial = designMat;
            if (isOutlineMode) {
                meshMaterial = new THREE.MeshPhongMaterial({ 
                    color: customColorHex, 
                    wireframe: true,
                    transparent: true,
                    opacity: 0.5,
                    side: THREE.DoubleSide
                });
            }

            const mesh = new THREE.Mesh(geometry, meshMaterial);
            modelGroup.add(mesh);
            
            if (isOutlineMode) {
                const edges = new THREE.EdgesGeometry(geometry);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
                modelGroup.add(line);
            }
        }
    });

    const box = new THREE.Box3().setFromObject(modelGroup);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    modelGroup.position.set(-center.x, -center.y, -center.z);
    modelGroup.scale.set(1, -1, 1);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * 1.5;

    camera.position.set(0, 0, cameraDistance);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
}

async function loadMaterials() {
    try {
        const token = localStorage.getItem('mr_token');
        const response = await fetch('/api/materiales', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const rawData = await response.json();
        const rawMaterials = Array.isArray(rawData) ? rawData : [];
        const excludedCategories = ["lonas", "vinilo", "laqueado", "tintas", "banners", "otros"];
        materials = rawMaterials.filter(m => {
            const cat = (m.categoria || "").toLowerCase().trim();
            return !excludedCategories.includes(cat);
        });
    } catch (err) {
        console.error("Error cargando materiales:", err);
    }
}

function initFileUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    console.log("initFileUpload: Input y DropZone configurados.");

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
}

function handleFile(file) {
    const fileName = file.name.toLowerCase();
    const status = document.getElementById('uploadStatus');
    if (status) {
        status.innerText = "Leyendo archivo...";
        status.style.display = "block";
    }
    
    if (fileName.endsWith('.cdr') || fileName.endsWith('.ai') || fileName.endsWith('.eps')) {
        const modal = new bootstrap.Modal(document.getElementById('modalCorelHelp'));
        modal.show();
        if (status) status.style.display = "none";
        return;
    }

    if (fileName.endsWith('.dxf')) {
        const reader = new FileReader();
        reader.onload = (e) => loadDXF(e.target.result);
        reader.readAsText(file);
        return;
    }

    if (!fileName.endsWith('.svg')) {
        alert("Por favor sube un archivo válido (.SVG o .DXF).");
        if (status) status.style.display = "none";
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const svgText = e.target.result;
        originalSVG = svgText;
        loadSVG(svgText);
    };
    reader.readAsText(file);
}

function loadSVG(svgText) {
    const status = document.getElementById('uploadStatus');
    if (status) status.innerText = "Cargando vectores...";

    try {
        if (!svgText) throw new Error("SVG vacío o inválido.");

        fabric.loadSVGFromString(svgText, (objects, options) => {
            if (!objects || objects.length === 0) {
                alert("El archivo SVG parece estar vacío o no tiene vectores válidos.");
                if (status) status.style.display = "none";
                return;
            }

            document.getElementById('dropText').style.display = 'none';

            resizeCanvas();
            const cw = canvas.getWidth();
            const ch = canvas.getHeight();

            objects.forEach(obj => {
                const fill = obj.fill ? obj.fill.toString().toLowerCase() : "";
                if (!obj.fill || fill === 'white' || fill === '#ffffff' || fill === 'transparent') {
                    if (!obj.stroke || obj.stroke === 'transparent') {
                        obj.set({
                            stroke: '#6366f1',
                            strokeWidth: 1.5,
                            strokeUniform: true
                        });
                    }
                }
            });

            const group = fabric.util.groupSVGElements(objects, options);
            if (currentGroup) canvas.remove(currentGroup);
            
            group.set({
                originX: 'center',
                originY: 'center',
                selectable: true,
                strokeUniform: true
            });

            const physical = parsePhysicalUnits(svgText);
            if (physical && physical.height > 0) {
                scaleFactor = group.height / physical.height;
                document.getElementById('inputHeight').value = physical.height.toFixed(1);
            }

            const padding = 0.85;
            const scaleW = (cw > 0 ? (cw * padding) / group.width : 1);
            const scaleH = (ch > 0 ? (ch * padding) / group.height : 1);
            let scale = Math.min(scaleW, scaleH);
            
            if (!isFinite(scale) || scale <= 0) scale = 1;

            group.scale(scale);
            canvas.add(group);
            canvas.centerObject(group);
            canvas.setActiveObject(group);
            currentGroup = group;
            group.setCoords();
            
            if (canvas.wrapperEl) {
                canvas.wrapperEl.style.display = 'block';
                canvas.wrapperEl.style.visibility = 'visible';
                canvas.wrapperEl.style.opacity = '1';
            }

            canvas.renderAll();
            refreshPreviewImage();
            
            document.getElementById('autoDims').style.display = 'block';
            document.getElementById('btnToggle3D').style.display = 'block';
            document.getElementById('btnChangeFile').style.display = 'block';
            
            if (document.getElementById('btnSendRenderer')) {
                document.getElementById('btnSendRenderer').disabled = false;
            }
            
            calculateCosts();
            resetZoom();
            if (status) status.style.display = "none";
        });
    } catch (err) {
        console.error("LOAD_SVG ERROR:", err);
        alert("Error al cargar el visor: " + err.message);
        if (status) status.style.display = "none";
    }
}

function loadDXF(dxfText) {
    document.getElementById('dropText').style.display = 'none';
    const canvasWrapper = document.getElementById('mainCanvas').parentElement;
    if (canvasWrapper) canvasWrapper.style.display = 'block';

    if (!dxfText || (!dxfText.includes('SECTION') && !dxfText.includes('HEADER'))) {
        alert("⚠️ Error: El archivo DXF parece ser binario o estar corrupto. \n\nPor favor, desde tu CAD exporta como 'DXF ASCII' (versión R12 o R14) o usa el formato SVG para mayor compatibilidad.");
        document.getElementById('dropText').style.display = 'flex';
        return;
    }

    try {
        const parser = new DxfParser();
        const dxf = parser.parseSync(dxfText);
        const fabricObjects = [];
        
        let unitScale = 0.1;
        const insUnits = dxf.header ? dxf.header.$INSUNITS : 0;
        if (insUnits === 5) unitScale = 1;
        if (insUnits === 1) unitScale = 2.54;
        if (insUnits === 6) unitScale = 100;

        dxf.entities.forEach(entity => {
            let pathData = "";
            
            if (entity.type === 'LINE') {
                pathData = `M ${entity.vertices[0].x} ${-entity.vertices[0].y} L ${entity.vertices[1].x} ${-entity.vertices[1].y}`;
            } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
                entity.vertices.forEach((v, i) => {
                    pathData += (i === 0 ? "M " : "L ") + `${v.x} ${-v.y} `;
                });
                if (entity.shape) pathData += "Z";
            } else if (entity.type === 'CIRCLE') {
                const r = entity.radius;
                pathData = `M ${entity.center.x - r} ${-entity.center.y} A ${r} ${r} 0 1 0 ${entity.center.x + r} ${-entity.center.y} A ${r} ${r} 0 1 0 ${entity.center.x - r} ${-entity.center.y}`;
            } else if (entity.type === 'ARC') {
                const r = entity.radius;
                const startX = entity.center.x + r * Math.cos(entity.startAngle);
                const startY = entity.center.y + r * Math.sin(entity.startAngle);
                const endX = entity.center.x + r * Math.cos(entity.endAngle);
                const endY = entity.center.y + r * Math.sin(entity.endAngle);
                const largeArc = (entity.endAngle - entity.startAngle + 2 * Math.PI) % (2 * Math.PI) > Math.PI ? 1 : 0;
                pathData = `M ${startX} ${-startY} A ${r} ${r} 0 ${largeArc} 0 ${endX} ${-endY}`;
            }

            if (pathData) {
                fabricObjects.push(new fabric.Path(pathData, {
                    fill: 'transparent',
                    stroke: '#fbbf24',
                    strokeWidth: 1,
                    strokeUniform: true
                }));
            }
        });

        if (fabricObjects.length === 0) throw new Error("No se encontraron entidades válidas en el DXF");

        if (currentGroup) canvas.remove(currentGroup);
        const group = new fabric.Group(fabricObjects);
        
        group.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            selectable: true,
            strokeUniform: true
        });

        scaleFactor = 1 / unitScale; 
        const physicalH = group.height / scaleFactor;
        document.getElementById('inputHeight').value = physicalH.toFixed(1);

        const visScale = Math.min((canvas.width * 0.8) / group.width, (canvas.height * 0.8) / group.height);
        group.scale(visScale);

        canvas.add(group);
        canvas.setActiveObject(group);
        currentGroup = group;
        canvas.renderAll();
        
        document.getElementById('autoDims').style.display = 'block';
        document.getElementById('btnChangeFile').style.display = 'block';
        refreshPreviewImage();
        calculateCosts();

    } catch (err) {
        console.error("Error cargando DXF:", err);
        alert("Error al procesar el archivo DXF. Asegúrate de que sea un archivo R12/R14 o versión moderna compatible.");
        document.getElementById('dropText').style.display = 'flex';
    }
}

function parsePhysicalUnits(svgText) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const svgTag = doc.querySelector('svg');
        if (!svgTag) return null;

        const rawW = svgTag.getAttribute('width') || "";
        const rawH = svgTag.getAttribute('height') || "";

        const toCm = (val) => {
            if (!val) return null;
            const num = parseFloat(val);
            if (val.includes('mm')) return num / 10;
            if (val.includes('cm')) return num;
            if (val.includes('in')) return num * 2.54;
            if (val.includes('pt')) return num * 0.03527;
            return null;
        };

        const h = toCm(rawH);
        const w = toCm(rawW);

        if (h && w) return { width: w, height: h };
        return null;
    } catch (e) {
        return null;
    }
}

function applyScale() {
    if (!currentGroup) return;
    
    const targetH = parseFloat(document.getElementById('inputHeight').value);
    if (!targetH) return;

    const pxHeight = currentGroup.height * currentGroup.scaleY;
    scaleFactor = pxHeight / targetH; // px por cada 1 cm

    const realH = (currentGroup.height * currentGroup.scaleY) / scaleFactor;
    const realW = (currentGroup.width * currentGroup.scaleX) / scaleFactor;
    
    document.getElementById('textWidth').innerText = realW.toFixed(1);
    document.getElementById('textHeight').innerText = realH.toFixed(1);
    
    refreshPreviewImage();
    calculateCosts();
}

function updateMaterialFrame(sheetW_cm, sheetH_cm) {
    if (!canvas || !currentGroup) return;
    
    const frameW = sheetW_cm * scaleFactor;
    const frameH = sheetH_cm * scaleFactor;

    if (!materialFrame) {
        materialFrame = new fabric.Rect({
            left: 0,
            top: 0,
            fill: 'rgba(148, 163, 184, 0.1)',
            stroke: '#ef4444', 
            strokeWidth: 2,
            strokeDashArray: [10, 5],
            selectable: false,
            evented: false,
            originX: 'center',
            originY: 'center'
        });
        canvas.add(materialFrame);
    }
    materialFrame.sendToBack();

    materialFrame.set({ width: frameW, height: frameH });
    canvas.centerObject(materialFrame);
    
    currentGroup.set({
        selectable: true,
        hasControls: false,
        hasBorders: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true
    });
}

function refreshPreviewImage() {
    if (!currentGroup) return;
    try {
        window.currentPreviewImage = currentGroup.toDataURL({
            format: 'png',
            quality: 0.8,
            multiplier: 0.5
        });
    } catch (e) {
        console.error("Error generando preview:", e);
    }
}

function calculateCosts() {
    if (!currentGroup) return;

    try {
        // Recalcular scaleFactor dinámicamente según el alto ingresado en el input para evitar errores de escala
        const targetH = parseFloat(document.getElementById('inputHeight').value);
        if (targetH && targetH > 0) {
            const pxHeight = currentGroup.height * currentGroup.scaleY;
            scaleFactor = pxHeight / targetH;
        }

        // 1. Calcular Perímetro en CENTÍMETROS
        let totalPathLengthPx = 0;
        
        function calculateRecursivePerimeter(objs, accumScaleX = 1, accumScaleY = 1) {
            objs.forEach(obj => {
                const currentScaleX = accumScaleX * (obj === currentGroup ? 1 : (obj.scaleX || 1));
                const currentScaleY = accumScaleY * (obj === currentGroup ? 1 : (obj.scaleY || 1));
                if (obj.type === 'path' && obj.path) {
                    totalPathLengthPx += getPathLength(obj) * Math.min(currentScaleX, currentScaleY);
                } else if (obj.getObjects) {
                    calculateRecursivePerimeter(obj.getObjects(), currentScaleX, currentScaleY);
                } else if (obj._objects) {
                    calculateRecursivePerimeter(obj._objects, currentScaleX, currentScaleY);
                }
            });
        }

        const topObjects = currentGroup._objects || [currentGroup];
        calculateRecursivePerimeter(topObjects);

        if (totalPathLengthPx === 0) totalPathLengthPx = (currentGroup.width + currentGroup.height) * 2;
        
        totalPathLengthPx *= currentGroup.scaleX; 
        
        let totalCL = Math.round(totalPathLengthPx / scaleFactor) || 0;
        
        // Override manual
        const manualPerimeter = parseFloat(document.getElementById('inputManualPerimeter').value);
        if (manualPerimeter && manualPerimeter > 0) {
            totalCL = Math.round(manualPerimeter);
        }
        
        // 2. Dimensiones Netas (cm)
        const netH = (currentGroup.height * currentGroup.scaleY) / scaleFactor || 0;
        const netW = (currentGroup.width * currentGroup.scaleX) / scaleFactor || 0;
        const areaNetM2 = (netH / 100) * (netW / 100) || 0;

        const elWidth = document.getElementById('textWidth');
        const elHeight = document.getElementById('textHeight');
        if (elWidth) elWidth.innerText = netW.toFixed(1);
        if (elHeight) elHeight.innerText = netH.toFixed(1);

        // UI Updates Básicas
        document.getElementById('resAreaNet').innerText = areaNetM2.toFixed(3) + ' m²';
        document.getElementById('resPerimeter').innerText = (isFinite(totalCL) ? totalCL.toFixed(0) : "0") + ' cm';

        const quantity = parseInt(document.getElementById('inputQuantity').value) || 1;
        const cutCost = parseFloat(document.getElementById('inputCutCost').value) || 0;
        const laborCost = parseFloat(document.getElementById('inputLaborCost').value) || 0;
        const cutPrice = parseFloat(document.getElementById('inputCutPrice').value) || 0;
        const laborPrice = parseFloat(document.getElementById('inputLaborPrice').value) || 0;

        let prodCostTotal = 0;
        let salePrice = 0;
        let areaToChargeM2 = 0;

        if (quoteMode === 'material') {
            // --- MODO 1: MATERIALES (Original) ---
            const margin = parseFloat(document.getElementById('inputMargin').value) || 0;
            const grossH = netH + margin;
            const grossW = netW + margin;
            
            const selectedMatId = document.getElementById('selectMaterial').value;
            const material = materials.find(m => String(m.id) === String(selectedMatId));
            const sheetType = document.getElementById('selectSheet').value;
            const billingMode = document.getElementById('selectBillingMode').value;
            const markup = parseFloat(document.getElementById('inputMarkup').value) || 1;

            // Plancha dimensions
            let sheetW = 244, sheetH = 122;
            if (material && material.ancho > 1 && material.largo > 1) {
                sheetW = material.ancho;
                sheetH = material.largo;
                if (sheetW > 10) sheetW = sheetW / 1; 
                else sheetW = sheetW * 100; 
                if (sheetH > 10) sheetH = sheetH / 1;
                else sheetH = sheetH * 100;
            } else {
                if (sheetType === 'polifan') { sheetW = 125; sheetH = 60; }
                else if (sheetType === 'acrilico') { sheetW = 244; sheetH = 122; }
            }
            if (sheetW < sheetH) [sheetW, sheetH] = [sheetH, sheetW];

            updateMaterialFrame(sheetW, sheetH);

            if (billingMode === 'efficient') {
                areaToChargeM2 = (grossH / 100) * (grossW / 100) * 1.15;
            } else {
                if (grossH <= sheetH) areaToChargeM2 = (grossW / 100) * (sheetH / 100);
                else if (grossW <= sheetW) areaToChargeM2 = (sheetW / 100) * (grossH / 100);
                else areaToChargeM2 = (grossH / 100) * (grossW / 100);
            }

            document.getElementById('resAreaGross').innerText = areaToChargeM2.toFixed(3) + ' m²';

            // Planchas
            const itemW = grossW || 1;
            const itemH = grossH || 1;
            const itemsPerSheetFixed = Math.floor((sheetW + 0.1) / itemW) * Math.floor((sheetH + 0.1) / itemH);
            const itemsPerSheetRotated = Math.floor((sheetW + 0.1) / itemH) * Math.floor((sheetH + 0.1) / itemW);
            const itemsPerSheet = Math.max(itemsPerSheetFixed, itemsPerSheetRotated);
            const canFit = itemsPerSheet > 0 && isFinite(itemsPerSheet);
            const totalSheets = canFit ? Math.ceil(quantity / itemsPerSheet) : "?";

            document.getElementById('resSheetCount').innerText = canFit ? totalSheets + " unid." : "⚠️ No cabe";
            document.getElementById('resSheetCount').style.color = canFit ? "#FFD43B" : "#FF6B6B";
            document.getElementById('btnDistribucion').disabled = !canFit;
            
            window.layoutData = { sheetW, sheetH, itemW, itemH, isRotated: itemsPerSheetRotated > itemsPerSheetFixed, quantity, itemsPerSheet, canFit };

            let matCost = 0;
            if (material) {
                if (material.precioLineal && material.precioLineal > 0) {
                    matCost = 0;
                } else {
                    let cpm2 = material.costoPorM2 || 0;
                    if (material.m2 > 1000) cpm2 *= 10000;
                    matCost = areaToChargeM2 * quantity * cpm2;
                }
            }

            const cutCostTotal = totalCL * cutCost * quantity;
            const laborCostTotal = laborCost * quantity;
            prodCostTotal = matCost + cutCostTotal + laborCostTotal;

            const cutPriceTotal = totalCL * cutPrice * quantity;
            const laborPriceTotal = laborPrice * quantity;
            salePrice = (matCost * markup) + cutPriceTotal + laborPriceTotal;

            const resBreakdown = document.getElementById('resBreakdown');
            if (resBreakdown) {
                const matVenta = Math.round(matCost * markup);
                resBreakdown.innerText = `Corte: ${isFinite(totalCL) ? totalCL.toFixed(0) : "0"}cm×$${cutPrice}×${quantity} | Mat: $${matVenta} | MO: $${laborPrice}×${quantity}`;
            }

        } else {
            // --- MODO 2: PRODUCTO CM LINEAL (Nuevo) ---
            document.getElementById('resAreaGross').innerText = '-';
            document.getElementById('resSheetCount').innerText = '-';
            document.getElementById('btnDistribucion').disabled = true;
            if (materialFrame) {
                canvas.remove(materialFrame);
                materialFrame = null;
            }

            const cutCostTotal = totalCL * cutCost * quantity;
            const laborCostTotal = laborCost * quantity;
            prodCostTotal = cutCostTotal + laborCostTotal;

            const cutPriceTotal = totalCL * cutPrice * quantity;
            const laborPriceTotal = laborPrice * quantity;
            salePrice = cutPriceTotal + laborPriceTotal;

            const resBreakdown = document.getElementById('resBreakdown');
            if (resBreakdown) {
                resBreakdown.innerText = `Precio/cm: $${cutPrice} | MO Venta: $${laborPrice} | Cant: ${quantity}`;
            }
        }



        const profit = salePrice - prodCostTotal;
        window.lastCalculatedSalePrice = salePrice;

        document.getElementById('resCostTotal').innerText = '$' + Math.round(prodCostTotal).toLocaleString();
        document.getElementById('resProfit').innerText = '$' + Math.round(profit).toLocaleString();
        
        const resTotal = document.getElementById('resTotal');
        if (resTotal) {
            resTotal.innerText = '$' + (isFinite(salePrice) ? Math.round(salePrice).toLocaleString() : "0");
        }
        
        document.getElementById('btnSendBudget').disabled = false;

        const elZoom = document.getElementById('zoomLevel');
        if (elZoom) elZoom.innerText = `Zoom: ${Math.round(canvas.getZoom() * 100)}%`;

        refreshPreviewImage();
        if (is3DMode) update3DView();

    } catch (err) {
        console.error("Error en calculateCosts:", err);
    }
}

function getPathLength(pathObj) {
    if (!pathObj.path) return 0;
    const pathData = pathObj.path.map(c => c.join(' ')).join(' ');
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', pathData);
    return tempPath.getTotalLength();
}

function openLayoutModal() {
    const modal = new bootstrap.Modal(document.getElementById('modalLayout'));
    modal.show();
    setTimeout(drawLayout, 300);
}

function drawLayout() {
    const d = window.layoutData;
    const previewImage = window.currentPreviewImage;
    if (!d || !previewImage) return;

    const canvasLayout = document.getElementById('canvasLayout');
    const ctx = canvasLayout.getContext('2d');
    
    const iw = d.isRotated ? d.itemH : d.itemW;
    const ih = d.isRotated ? d.itemW : d.itemH;

    const maxRealW = Math.max(d.sheetW, iw);
    const maxRealH = Math.max(d.sheetH, ih);
    const maxPx = 550;
    const scale = Math.min(maxPx / maxRealW, 350 / maxRealH);
    
    canvasLayout.width = maxRealW * scale + 20;
    canvasLayout.height = maxRealH * scale + 20;

    const img = new Image();
    img.onload = function() {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasLayout.width, canvasLayout.height);
        
        ctx.strokeStyle = "#adb5bd";
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(10, 10, d.sheetW * scale, d.sheetH * scale);
        ctx.setLineDash([]);
        
        ctx.fillStyle = "#adb5bd";
        ctx.font = "10px Inter";
        ctx.fillText(`PLANCHA ${d.sheetW}x${d.sheetH}cm`, 12, 22);

        if (!d.canFit) {
            ctx.fillStyle = "rgba(255, 107, 107, 0.1)";
            ctx.fillRect(10, 10, iw * scale, ih * scale);
            ctx.strokeStyle = "#FF6B6B";
            ctx.lineWidth = 1;
            ctx.strokeRect(10, 10, iw * scale, ih * scale);
            
            drawLogo(10, 10, iw, ih);

            const margin = parseFloat(document.getElementById('inputMargin').value) || 0;
            document.getElementById('layoutInfo').innerHTML = 
                `<b style="color:#FF6B6B">⚠️ EL DISEÑO ES MÁS GRANDE QUE LA PLANCHA</b><br>
                 Medida Neta: <b>${(d.itemW - margin).toFixed(1)} x ${(d.itemH - margin).toFixed(1)} cm</b> | Con Margen: ${iw.toFixed(1)} x ${ih.toFixed(1)} cm`;
            return;
        }

        const cols = Math.floor(d.sheetW / iw);
        const rows = Math.floor(d.sheetH / ih);
        let drawn = 0;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (drawn >= d.quantity) break;
                const x = c * iw * scale + 10;
                const y = r * ih * scale + 10;
                
                ctx.fillStyle = "rgba(226, 232, 240, 0.4)";
                ctx.fillRect(x, y, iw * scale, ih * scale);
                ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
                ctx.strokeRect(x, y, iw * scale, ih * scale);

                drawLogo(x, y, iw, ih);
                drawn++;
            }
        }

        document.getElementById('layoutInfo').innerHTML = 
            `Plancha: ${d.sheetW}x${d.sheetH}cm | Piezas: ${iw.toFixed(1)}x${ih.toFixed(1)}cm | <b>Entran: ${d.itemsPerSheet} por plancha.</b>`;
    };
    img.src = window.currentPreviewImage;

    function drawLogo(x, y, areaW, areaH) {
        ctx.save();
        ctx.translate(x + (areaW * scale) / 2, y + (areaH * scale) / 2);
        if (d.isRotated) ctx.rotate(Math.PI / 2);
        
        const margin = parseFloat(document.getElementById('inputMargin').value) || 0;
        const designW = d.itemW - margin;
        const designH = d.itemH - margin;
        
        ctx.drawImage(img, 
            -(designW * scale) / 2, 
            -(designH * scale) / 2, 
            designW * scale, 
            designH * scale
        );
        ctx.restore();
    }
}



['inputHeight', 'inputMargin', 'inputManualPerimeter', 'inputQuantity', 'selectSheet', 'selectBillingMode', 'inputCutCost', 'inputLaborCost', 'inputCutPrice', 'inputLaborPrice', 'inputMarkup'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculateCosts);
});

function getMaterialConfigKey(materialName) {
    if (!materialName) return 'default';
    const nameLower = materialName.toLowerCase();
    const keys = Object.keys(cachedCostsConfig);
    const sortedKeys = keys.filter(k => k !== 'default').sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
        if (nameLower.includes(key)) {
            return key;
        }
    }
    return 'default';
}

function applyMaterialConfig() {
    if (quoteMode !== 'material') return; // En modo lineal, los valores provienen del producto

    const select = document.getElementById('selectMaterial');
    const selectedMatId = select.value;
    const material = materials.find(m => String(m.id) === String(selectedMatId));
    const materialName = material ? (material.productoNombre || material.producto) : '';
    
    const key = getMaterialConfigKey(materialName);
    console.log(`Aplicando configuración de calculadora para llave: "${key}" (Material: "${materialName}")`);
    
    const costConfig = cachedCostsConfig[key] || cachedCostsConfig['default'] || { cutCostPerCm: 10, laborCost: 0 };
    const priceConfig = cachedPricesConfig[key] || cachedPricesConfig['default'] || { cutPricePerCm: 25, laborPrice: 0, markup: 2.5 };
    
    document.getElementById('inputCutCost').value = costConfig.cutCostPerCm ?? 10;
    document.getElementById('inputLaborCost').value = costConfig.laborCost ?? 0;
    
    if (materialName.toLowerCase().includes('polifan')) {
        const platePrice = material.costoPorM2 || 0;
        const calculatedLinearPrice = Math.round(platePrice * (345 / 2090));
        console.log(`Cálculo dinámico de Polifan: Placa $${platePrice} -> cm lineal calculado: $${calculatedLinearPrice}`);
        document.getElementById('inputCutPrice').value = calculatedLinearPrice;
    } else {
        document.getElementById('inputCutPrice').value = priceConfig.cutPricePerCm ?? 25;
    }
    
    document.getElementById('inputLaborPrice').value = priceConfig.laborPrice ?? 0;
    document.getElementById('inputMarkup').value = priceConfig.markup ?? 2.5;
    
    if (material && material.precioLineal && material.precioLineal > 0) {
        console.log("Sobrepasando con precio lineal específico de base de datos de materiales:", material.precioLineal);
        document.getElementById('inputCutPrice').value = material.precioLineal;
    }
}

async function loadCalculatorConfig() {
    try {
        const resCosts = await fetch('/api/calculadora/costos');
        if (resCosts.ok) {
            cachedCostsConfig = await resCosts.json();
        }
        const resPrices = await fetch('/api/calculadora/precios');
        if (resPrices.ok) {
            cachedPricesConfig = await resPrices.json();
        }
        applyMaterialConfig();
    } catch (err) {
        console.error("Error cargando configuraciones de la calculadora:", err);
    }
}

async function saveAllConfig() {
    if (quoteMode === 'linear') {
        alert("En el modo de Producto Cm Lineal, los precios se administran desde la lista de productos personalizados.");
        return;
    }

    const select = document.getElementById('selectMaterial');
    const selectedMatId = select.value;
    const material = materials.find(m => String(m.id) === String(selectedMatId));
    const materialName = material ? (material.productoNombre || material.producto) : '';
    const key = getMaterialConfigKey(materialName);

    if (!cachedCostsConfig[key]) cachedCostsConfig[key] = {};
    cachedCostsConfig[key].cutCostPerCm = parseFloat(document.getElementById('inputCutCost').value) || 0;
    cachedCostsConfig[key].laborCost = parseFloat(document.getElementById('inputLaborCost').value) || 0;

    if (!cachedPricesConfig[key]) cachedPricesConfig[key] = {};
    cachedPricesConfig[key].cutPricePerCm = parseFloat(document.getElementById('inputCutPrice').value) || 0;
    cachedPricesConfig[key].laborPrice = parseFloat(document.getElementById('inputLaborPrice').value) || 0;
    cachedPricesConfig[key].markup = parseFloat(document.getElementById('inputMarkup').value) || 1;
    
    try {
        const token = localStorage.getItem('mr_token');
        const [resCosts, resPrices] = await Promise.all([
            fetch('/api/calculadora/costos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(cachedCostsConfig)
            }),
            fetch('/api/calculadora/precios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(cachedPricesConfig)
            })
        ]);
        if (resCosts.ok && resPrices.ok) {
            alert(`✅ Configuración guardada por defecto para "${key}".`);
            calculateCosts();
        } else {
            alert('❌ Error al guardar configuración.');
        }
    } catch (err) {
        console.error("Error guardando configuración:", err);
        alert('❌ Error de conexión al guardar.');
    }
}

const saveCostsConfig = saveAllConfig;
const savePricesConfig = saveAllConfig;

function sendToBudget() {
    if (!currentGroup || !window.lastCalculatedSalePrice) return;

    const qty = parseInt(document.getElementById('inputQuantity').value) || 1;
    const singlePrice = window.lastCalculatedSalePrice / qty;
    
    const matSelect = document.getElementById('selectMaterial');
    const materialName = matSelect.options[matSelect.selectedIndex]?.text || '';
    
    const netW = parseFloat(document.getElementById('textWidth').innerText);
    const netH = parseFloat(document.getElementById('textHeight').innerText);
    
    const cleanMaterial = materialName.replace(/\s*\([^)]*\)/g, '').trim();
    
    const desc = `Trabajo a medida en ${cleanMaterial}.\nDimensiones totales: ${netW} x ${netH} cm.`;

    const item = {
        id: Date.now(),
        description: desc,
        qty: qty,
        price: singlePrice,
        isAutoAssigned: true
    };

    const existingList = JSON.parse(localStorage.getItem('mr_pending_budget_items') || '[]');
    existingList.push(item);
    localStorage.setItem('mr_pending_budget_items', JSON.stringify(existingList));
    
    window.location.href = 'presupuesto-gen.html';
}

function sendToRenderer() {
    if (typeof originalSVG === 'undefined' || !originalSVG) {
        alert('No hay un diseño cargado. Sube un archivo SVG primero.');
        return;
    }
    sessionStorage.setItem('mr_vcalc_svg', originalSVG);
    window.location.href = 'renderizador-3d.html';
}

function editMaterialPrice() {
    if (quoteMode === 'linear') {
        alert("En el modo de Producto Cm Lineal, edita los precios administrando los productos.");
        return;
    }

    const selectedMatId = document.getElementById('selectMaterial').value;
    const material = materials.find(m => String(m.id) === String(selectedMatId));
    
    if (!material) {
        alert("Por favor selecciona un material primero.");
        return;
    }

    const currentPrice = material.costoPorM2 || 0;
    const newPrice = prompt(`Editar precio para: ${material.productoNombre || material.producto}\nPrecio actual por m²: $${currentPrice}\n\nIngresa el nuevo precio por m²:`, currentPrice);

    if (newPrice !== null && !isNaN(newPrice)) {
        material.costoPorM2 = parseFloat(newPrice);
        
        if (material.precioLineal > 0) {
            material.precioLineal = parseFloat(newPrice) / 100;
        }

        fetch('/api/materiales', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('mr_token')}`
            },
            body: JSON.stringify(materials)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("✅ Precio actualizado y guardado correctamente.");
                applyMaterialConfig();
                calculateCosts();
            } else {
                alert("❌ Error al guardar en el servidor: " + (data.error || "Desconocido"));
            }
        })
        .catch(err => {
            console.error("Error guardando material:", err);
            alert("❌ Error de conexión al servidor.");
        });
    }
}

// ==================== LÓGICA DE PRODUCTOS DE CM LINEAL (NUEVO) ====================

function loadCustomProducts() {
    const serverCustomProducts = materials.filter(m => m.categoria === "Productos por Cm Lineal");
    
    if (serverCustomProducts.length > 0) {
        customProducts = serverCustomProducts.map(m => ({
            id: m.id,
            name: m.producto || m.productoNombre,
            cost: m.costo || m.costoPorM2 || 10,
            profit: m.profit || 150,
            depth: m.depth || 2,
            color: m.color || "#6366f1"
        }));
    } else {
        const raw = localStorage.getItem('mr_custom_linear_products');
        if (raw) {
            customProducts = JSON.parse(raw);
        } else {
            customProducts = [
                { id: "p1", name: "Neón Led Flex 6mm (Silicona)", cost: 15, profit: 150, depth: 1, color: "#6366f1" },
                { id: "p2", name: "Letrero Polifan 20mm Gremio", cost: 10, profit: 120, depth: 2, color: "#eeeeee" },
                { id: "p3", name: "Letrero Polifan 50mm Pintado", cost: 18, profit: 140, depth: 5, color: "#4f46e5" },
                { id: "p4", name: "Chapa Galvanizada Corpórea", cost: 25, profit: 180, depth: 6, color: "#888888" }
            ];
        }
        localStorage.setItem('mr_custom_linear_products', JSON.stringify(customProducts));
    }
}

async function saveCustomProducts() {
    localStorage.setItem('mr_custom_linear_products', JSON.stringify(customProducts));

    const standardMaterials = materials.filter(m => m.categoria !== "Productos por Cm Lineal");
    
    const updatedMaterials = [
        ...standardMaterials,
        ...customProducts.map(p => ({
            id: p.id,
            producto: p.name,
            productoNombre: p.name,
            categoria: "Productos por Cm Lineal",
            precioLineal: Math.round(p.cost * (1 + p.profit / 100) * 100) / 100,
            costo: p.cost,
            costoPorM2: 0,
            precioRollo: 0,
            m2: 0,
            profit: p.profit,
            depth: p.depth,
            color: p.color
        }))
    ];

    try {
        const token = localStorage.getItem('mr_token');
        const response = await fetch('/api/materiales', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedMaterials)
        });
        
        if (response.ok) {
            materials = updatedMaterials;
            console.log("Productos guardados exitosamente en el servidor.");
        } else {
            console.error("Error al guardar productos en el servidor. Status:", response.status);
        }
    } catch (err) {
        console.error("Error de red al guardar en el servidor:", err);
    }
}

function updateDropdownAndUI() {
    const selectQuoteMode = document.getElementById('selectQuoteMode');
    if (!selectQuoteMode) return;
    
    quoteMode = selectQuoteMode.value;
    
    const logisticGroup = document.getElementById('logisticMaterialGroup');
    const markupGroup = document.getElementById('markupGroup');
    const profitGroup = document.getElementById('profitGroup');
    const adminBtn = document.getElementById('adminProductsBtn');
    const labelMaterial = document.getElementById('labelMaterialSelect');
    const editPriceBtn = document.getElementById('btnEditMaterialPrice');

    if (quoteMode === 'material') {
        if (labelMaterial) labelMaterial.innerText = "Material Base";
        if (logisticGroup) logisticGroup.style.display = "block";
        if (markupGroup) markupGroup.style.display = "block";
        if (profitGroup) profitGroup.style.display = "none";
        if (adminBtn) adminBtn.style.display = "none";
        if (editPriceBtn) editPriceBtn.style.display = "inline-block";
        
        renderMaterialsDropdown();
    } else {
        if (labelMaterial) labelMaterial.innerText = "Producto (Cm Lineal)";
        if (logisticGroup) logisticGroup.style.display = "none";
        if (markupGroup) markupGroup.style.display = "none";
        if (profitGroup) profitGroup.style.display = "none";
        if (adminBtn) adminBtn.style.display = "inline-block";
        if (editPriceBtn) editPriceBtn.style.display = "none";
        
        renderProductsDropdown();
    }
}

function renderMaterialsDropdown() {
    const select = document.getElementById('selectMaterial');
    if (!select) return;
    
    if (materials.length === 0) {
        select.innerHTML = '<option value="">No hay materiales disponibles</option>';
        return;
    }

    const categories = [...new Set(materials.map(m => m.categoria))].sort();
    let html = '<option value="">Seleccione material...</option>';
    
    categories.forEach(cat => {
        html += `<optgroup label="${cat}">`;
        materials.filter(m => m.categoria === cat).forEach(m => {
            let priceLabel = "";
            const prodName = (m.productoNombre || m.producto || "").toLowerCase();
            if (prodName.includes("polifan")) {
                const platePrice = m.costoPorM2 || 0;
                const calculatedLinearPrice = Math.round(platePrice * (345 / 2090));
                priceLabel = `$${calculatedLinearPrice}/cm`;
            } else if (m.precioLineal && m.precioLineal > 0) {
                priceLabel = `$${m.precioLineal}/cm`;
            } else {
                const price = m.costoPorM2 || (m.m2 > 0 ? m.precioRollo / m.m2 : 0);
                priceLabel = `$${Math.round(price)}/m²`;
            }
            html += `<option value="${m.id}">${m.productoNombre || m.producto} (${priceLabel})</option>`;
        });
        html += `</optgroup>`;
    });

    select.innerHTML = html;
    
    // Configurar listener
    select.onchange = () => {
        const selectedMatId = select.value;
        const material = materials.find(m => String(m.id) === String(selectedMatId));
        if (material) {
            const matName = (material.productoNombre || material.producto).toLowerCase();
            let d = 0.5;
            if (matName.includes('20 mm') || matName.includes('20mm')) d = 2;
            else if (matName.includes('30 mm') || matName.includes('30mm')) d = 3;
            else if (matName.includes('40 mm') || matName.includes('40mm')) d = 4;
            else if (matName.includes('50 mm') || matName.includes('50mm')) d = 5;
            else if (matName.includes('10 mm') || matName.includes('10mm')) d = 1;
            
            const inputDepth = document.getElementById('inputManualDepth');
            if (inputDepth) inputDepth.value = d;
        }
        applyMaterialConfig();
        calculateCosts();
    };
}

function renderProductsDropdown() {
    const select = document.getElementById('selectMaterial');
    if (!select) return;
    
    if (customProducts.length === 0) {
        select.innerHTML = '<option value="">No hay productos creados</option>';
        return;
    }

    let html = '<option value="">Seleccione producto...</option>';
    customProducts.forEach(p => {
        html += `<option value="${p.id}">${p.name} ($${p.cost}/cm)</option>`;
    });
    
    select.innerHTML = html;
    
    select.onchange = () => {
        const selectedProdId = select.value;
        const product = customProducts.find(p => String(p.id) === String(selectedProdId));
        if (product) {
            document.getElementById('inputCutCost').value = product.cost;
            document.getElementById('inputProfitPct').value = product.profit;
            document.getElementById('inputManualDepth').value = product.depth || 2;
            if (product.color) {
                document.getElementById('input3DColorOverride').value = product.color;
            }
            updateCalculatedPrice();
        }
    };
}

function updateCalculatedPrice() {
    const cost = parseFloat(document.getElementById('inputCutCost').value) || 0;
    const calculatedPrice = cost;
    
    const cutPriceInput = document.getElementById('inputCutPrice');
    if (cutPriceInput) {
        cutPriceInput.value = Math.round(calculatedPrice * 100) / 100;
    }
    calculateCosts();
}

function openProductAdminModal() {
    const modal = new bootstrap.Modal(document.getElementById('modalAdminProducts'));
    modal.show();
    renderProductAdminList();
}

let editingProductId = null;

function renderProductAdminList() {
    const listBody = document.getElementById('adminProductsList');
    if (!listBody) return;
    
    if (customProducts.length === 0) {
        listBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay productos guardados. Crea uno usando el formulario inferior.</td></tr>`;
        return;
    }
    
    let html = "";
    customProducts.forEach((p, idx) => {
        html += `
            <tr style="vertical-align: middle;">
                <td class="fw-bold">${p.name}</td>
                <td>$${p.cost}</td>
                <td style="display: none;">${p.profit}%</td>
                <td>${p.depth || 2} cm</td>
                <td class="text-end">
                    <button class="btn btn-xs btn-outline-info me-1" onclick="editCustomProduct('${p.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-xs btn-outline-danger" onclick="deleteCustomProduct('${p.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    listBody.innerHTML = html;
}

function addCustomProduct() {
    const nameEl = document.getElementById('newProductName');
    const costEl = document.getElementById('newProductCost');
    const depthEl = document.getElementById('newProductDepth');
    const colorEl = document.getElementById('newProductColor');

    const name = nameEl.value.trim();
    const cost = parseFloat(costEl.value);
    const profit = 0; // El precio de venta ya es final
    const depth = parseFloat(depthEl.value) || 2;
    const color = colorEl.value || "#6366f1";

    if (!name || isNaN(cost)) {
        alert("Por favor rellena el nombre y precio del producto.");
        return;
    }

    const newProd = {
        id: "p_" + Date.now(),
        name,
        cost,
        profit,
        depth,
        color
    };

    customProducts.push(newProd);
    saveCustomProducts();
    
    // Limpiar formulario
    nameEl.value = "";
    costEl.value = "";
    depthEl.value = "2";
    
    renderProductAdminList();
    renderProductsDropdown();
    
    const select = document.getElementById('selectMaterial');
    if (select) {
        select.value = newProd.id;
        select.dispatchEvent(new Event('change'));
    }
}

function deleteCustomProduct(id) {
    if (editingProductId === id) {
        cancelProductEdit();
    }
    if (!confirm("¿Seguro que deseas eliminar este producto?")) return;
    customProducts = customProducts.filter(p => p.id !== id);
    saveCustomProducts();
    renderProductAdminList();
    renderProductsDropdown();
    calculateCosts();
}

function editCustomProduct(id) {
    const product = customProducts.find(p => p.id === id);
    if (!product) return;
    
    editingProductId = product.id;
    
    document.getElementById('newProductName').value = product.name;
    document.getElementById('newProductCost').value = product.cost;
    document.getElementById('newProductDepth').value = product.depth || 2;
    document.getElementById('newProductColor').value = product.color || "#6366f1";
    
    const header = document.getElementById('adminFormHeader');
    if (header) header.innerHTML = `<i class="fas fa-edit"></i> Editar Producto`;
    
    const buttonContainer = document.getElementById('adminFormButtons');
    if (buttonContainer) {
        buttonContainer.innerHTML = `
            <div class="row g-2 mt-3">
                <div class="col-6">
                    <button class="btn btn-sm btn-success w-100 fw-bold" onclick="saveCustomProductEdit()"><i class="fas fa-check"></i> GUARDAR</button>
                </div>
                <div class="col-6">
                    <button class="btn btn-sm btn-secondary w-100 fw-bold" onclick="cancelProductEdit()"><i class="fas fa-times"></i> CANCELAR</button>
                </div>
            </div>
        `;
    }
}

function cancelProductEdit() {
    editingProductId = null;
    
    document.getElementById('newProductName').value = "";
    document.getElementById('newProductCost').value = "";
    document.getElementById('newProductDepth').value = "2";
    document.getElementById('newProductColor').value = "#6366f1";
    
    const header = document.getElementById('adminFormHeader');
    if (header) header.innerHTML = `<i class="fas fa-plus"></i> Crear Nuevo Producto`;
    
    const buttonContainer = document.getElementById('adminFormButtons');
    if (buttonContainer) {
        buttonContainer.innerHTML = `
            <button id="btnSubmitProduct" class="btn btn-sm btn-primary w-100 mt-3 fw-bold" onclick="addCustomProduct()"><i class="fas fa-plus"></i> AGREGAR PRODUCTO</button>
        `;
    }
}

function saveCustomProductEdit() {
    if (!editingProductId) return;
    
    const nameEl = document.getElementById('newProductName');
    const costEl = document.getElementById('newProductCost');
    const depthEl = document.getElementById('newProductDepth');
    const colorEl = document.getElementById('newProductColor');

    const name = nameEl.value.trim();
    const cost = parseFloat(costEl.value);
    const profit = 0; // El precio de venta ya es final
    const depth = parseFloat(depthEl.value) || 2;
    const color = colorEl.value || "#6366f1";

    if (!name || isNaN(cost)) {
        alert("Por favor rellena el nombre y precio del producto.");
        return;
    }

    const productIndex = customProducts.findIndex(p => p.id === editingProductId);
    if (productIndex !== -1) {
        customProducts[productIndex].name = name;
        customProducts[productIndex].cost = cost;
        customProducts[productIndex].profit = profit;
        customProducts[productIndex].depth = depth;
        customProducts[productIndex].color = color;
        
        saveCustomProducts();
        renderProductAdminList();
        renderProductsDropdown();
        
        const select = document.getElementById('selectMaterial');
        if (select && select.value === editingProductId) {
            select.dispatchEvent(new Event('change'));
        }
    }
    
    cancelProductEdit();
}
