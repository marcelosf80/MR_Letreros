// Simulación 2D y 3D

// Estado de Simulación
let simulationState = {
    active: false,
    paused: false,
    resumeFn: null,
    cleanupFn: null
};

// Referencias DOM para Simulación
const simControls = document.getElementById('simControls');
const btnPauseSim = document.getElementById('btnPauseSim');
const btnResumeSim = document.getElementById('btnResumeSim');
const btnStopSim = document.getElementById('btnStopSim');
const simSpeedInput = document.getElementById('simSpeed');

// Event Listeners para Simulación
if (btnPauseSim) {
    btnPauseSim.addEventListener('click', () => {
        simulationState.paused = true;
        btnPauseSim.style.display = 'none';
        btnResumeSim.style.display = 'inline-block';
    });
}
if (btnResumeSim) {
    btnResumeSim.addEventListener('click', () => {
        simulationState.paused = false;
        btnPauseSim.style.display = 'inline-block';
        btnResumeSim.style.display = 'none';
        if (simulationState.resumeFn) simulationState.resumeFn();
    });
}
if (btnStopSim) {
    btnStopSim.addEventListener('click', () => {
        simulationState.active = false;
        if (simulationState.cleanupFn) simulationState.cleanupFn();
        simControls.style.display = 'none';
    });
}

function runSimulation(bin, ctx, width, height, scale) {
    // Detener simulación anterior si existe
    if (simulationState.active) {
        simulationState.active = false;
        if (simulationState.cleanupFn) simulationState.cleanupFn();
    }

    // Mostrar controles
    if (simControls) {
        simControls.style.display = 'block';
        btnPauseSim.style.display = 'inline-block';
        btnResumeSim.style.display = 'none';
        simSpeedInput.value = 1;
    }

    // 1. Preparar Datos de Trayectoria
    const sequence = getOptimizedSequence(bin);
    let currentPos = { x: 0, y: 0 };
    const operations = []; 

    // 1b. Configuración de Tiempos
    const feedRate = parseFloat(document.getElementById('cncFeedRate').value) || 1200;
    const rapidRate = 3000; 
    let totalTimeMin = 0;
    const parkX = parseFloat(document.getElementById('parkX').value) || 0;
    const parkY = parseFloat(document.getElementById('parkY').value) || 0;

    const getScreenPos = (p, part) => {
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

    sequence.forEach(item => {
        const part = item.parentPart;
        const el = item.element;
        const totalLen = el.getTotalLength();
        
        let points = [];
        const step = 2.0; 
        for (let len = 0; len <= totalLen; len += step) {
            points.push(getScreenPos(el.getPointAtLength(len), part));
        }
        points.push(getScreenPos(el.getPointAtLength(totalLen), part));

        points = optimizePathStart(points, currentPos);

        if (points.length > 0) {
            const travelPath = getSafeTravelPath(currentPos, points[0], bin.width * scale, bin.height * scale);
            let lastP = currentPos;

            travelPath.forEach(p => {
                const rapidOp = { type: 'rapid', start: { ...lastP }, end: p };
                const rDx = (rapidOp.end.x - rapidOp.start.x) / scale;
                const rDy = (rapidOp.end.y - rapidOp.start.y) / scale;
                rapidOp.timeMin = Math.sqrt(rDx*rDx + rDy*rDy) / rapidRate;
                totalTimeMin += rapidOp.timeMin;
                operations.push(rapidOp);
                lastP = p;
            });

            for (let i = 0; i < points.length - 1; i++) {
                const cutOp = { 
                    type: 'cut', 
                    start: points[i], 
                    end: points[i+1],
                    cutType: item.type 
                };
                const cDx = (cutOp.end.x - cutOp.start.x) / scale;
                const cDy = (cutOp.end.y - cutOp.start.y) / scale;
                cutOp.timeMin = Math.sqrt(cDx*cDx + cDy*cDy) / feedRate;
                totalTimeMin += cutOp.timeMin;
                operations.push(cutOp);
            }
            currentPos = points[points.length - 1];
        }
    });

    const homeOp = { type: 'rapid', start: { ...currentPos }, end: { x: parkX * scale, y: parkY * scale } };
    const hDx = (homeOp.end.x - homeOp.start.x) / scale;
    const hDy = (homeOp.end.y - homeOp.start.y) / scale;
    homeOp.timeMin = Math.sqrt(hDx*hDx + hDy*hDy) / rapidRate;
    totalTimeMin += homeOp.timeMin;
    operations.push(homeOp);

    simulationState.active = true;
    simulationState.paused = false;

    let opIndex = 0;
    let progress = 0; 
    
    if (ctx.canvas.animationId) cancelAnimationFrame(ctx.canvas.animationId);

    const drawBase = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#ddd"; ctx.fillRect(0, 0, width, height);
        drawGrid(ctx, width, height, scale);

        const imgScaleX = globalSvgImage.width / svgViewBox.w;
        const imgScaleY = globalSvgImage.height / svgViewBox.h;
        bin.parts.forEach(part => {
             const destX = part.fit.x * scale; const destY = part.fit.y * scale;
             const destW = part.w * scale; const destH = part.h * scale;
             ctx.save();
             const cx = destX + (part.rotated ? destH : destW) / 2;
             const cy = destY + (part.rotated ? destW : destH) / 2;
             ctx.translate(cx, cy);
             if (part.rotated) ctx.rotate(-90 * Math.PI / 180);
             try {
                ctx.drawImage(globalSvgImage, part.originalX * imgScaleX, part.originalY * imgScaleY, part.w * imgScaleX, part.h * imgScaleY, -destW/2, -destH/2, destW, destH);
             } catch(e){}
             ctx.restore();
        });
    };

    const animate = () => {
        if (!simulationState.active) return;
        if (simulationState.paused) return;

        if (opIndex >= operations.length) {
            drawBase();
            drawToolpathOverlay(ctx, bin, scale);
            
            ctx.save();
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.fillRect(10, 10, 220, 65);
            ctx.fillStyle = "#51CF66";
            ctx.font = "bold 16px monospace";
            ctx.fillText(`✅ FINALIZADO`, 20, 35);
            ctx.fillStyle = "#fff";
            ctx.font = "14px monospace";
            ctx.fillText(`Tiempo: ${formatTime(totalTimeMin)}`, 20, 55);
            ctx.restore();
            simulationState.active = false;
            return;
        }

        drawBase();

        ctx.save();
        for(let i=0; i<=opIndex; i++) {
            const op = operations[i];
            const isCurrent = (i === opIndex);
            const pEnd = isCurrent ? progress : 1;
            
            const curX = op.start.x + (op.end.x - op.start.x) * pEnd;
            const curY = op.start.y + (op.end.y - op.start.y) * pEnd;

            ctx.beginPath();
            ctx.moveTo(op.start.x, op.start.y);
            ctx.lineTo(curX, curY);
            
            if (op.type === 'rapid') {
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
            } else {
                if (op.cutType === 'Hueco') {
                    ctx.strokeStyle = '#ff922b'; 
                } else {
                    ctx.strokeStyle = 'rgba(0, 100, 255, 1)'; 
                }
                ctx.setLineDash([]); ctx.lineWidth = 2;
            }
            ctx.stroke();

            if (isCurrent) {
                ctx.beginPath(); ctx.arc(curX, curY, 4, 0, Math.PI*2);
                ctx.fillStyle = op.type === 'rapid' ? 'red' : '#00f'; ctx.fill();
                ctx.strokeStyle = 'white'; ctx.stroke();
            }
        }
        ctx.restore();

        let elapsedMin = 0;
        for(let i=0; i<opIndex; i++) elapsedMin += operations[i].timeMin;
        elapsedMin += operations[opIndex].timeMin * progress;
        const remainingMin = Math.max(0, totalTimeMin - elapsedMin);

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(10, 10, 240, 90);
        ctx.fillStyle = "#fff";
        ctx.font = "14px monospace";
        ctx.fillText(`Total: ${formatTime(totalTimeMin)}`, 20, 30);
        ctx.fillStyle = "#FFC107";
        ctx.font = "bold 16px monospace";
        ctx.fillText(`Restante: ${formatTime(remainingMin)}`, 20, 55);
        
        const curOp = operations[opIndex];
        const statusText = curOp.type === 'rapid' ? '🚀 Moviendo...' : `🔪 Cortando (${curOp.cutType})`;
        ctx.fillStyle = curOp.type === 'rapid' ? '#ccc' : (curOp.cutType === 'Hueco' ? '#ff922b' : '#339AF0');
        ctx.fillText(statusText, 20, 80);
        ctx.restore();

        const baseSpeed = parseFloat(document.getElementById('cncFeedRate').value) / 1000 || 1;
        const sliderVal = parseFloat(simSpeedInput.value) || 1;
        const speedFactor = baseSpeed * sliderVal;
        
        const step = (operations[opIndex].type === 'rapid' ? 0.2 : 0.05) * speedFactor;
        progress += step;
        if (progress >= 1) { progress = 0; opIndex++; }

        ctx.canvas.animationId = requestAnimationFrame(animate);
    };
    
    simulationState.resumeFn = animate;
    simulationState.cleanupFn = () => {
        drawBase();
        drawToolpathOverlay(ctx, bin, scale);
    };

    animate();
}

// Variables globales para 3D
let scene, camera, renderer, controls, toolMesh;
let simAnimationId;
let simPathPoints = []; 
let simProgress = 0;
let isSimPlaying = false;

function open3DSimulation(bin) {
    const modal = document.getElementById('sim3dModal');
    const container = document.getElementById('sim3dContainer');
    modal.style.display = 'block';

    container.innerHTML = '';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202020);
    scene.fog = new THREE.Fog(0x202020, 500, 2000);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(bin.width / 2, -bin.height / 1.5, 600); 
    camera.up.set(0, 0, 1); 

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(bin.width / 2, bin.height / 2, 0);
    controls.update();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, -100, 200);
    scene.add(dirLight);

    const geometryPlane = new THREE.PlaneGeometry(bin.width, bin.height);
    const materialPlane = new THREE.MeshPhongMaterial({ color: 0x444444, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geometryPlane, materialPlane);
    plane.position.set(bin.width / 2, bin.height / 2, -0.5); 
    scene.add(plane);

    const gridHelper = new THREE.GridHelper(Math.max(bin.width, bin.height) * 2, 50);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.set(bin.width / 2, bin.height / 2, -1);
    scene.add(gridHelper);

    generate3DPath(bin);

    const toolGeo = new THREE.ConeGeometry(5, 20, 16);
    const toolMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    toolMesh = new THREE.Mesh(toolGeo, toolMat);
    toolMesh.rotation.x = Math.PI / 2; 
    scene.add(toolMesh);

    document.getElementById('closeSim3d').onclick = close3DSimulation;
    document.getElementById('sim3dPlay').onclick = () => { isSimPlaying = true; updateSimButtons(); };
    document.getElementById('sim3dPause').onclick = () => { isSimPlaying = false; updateSimButtons(); };
    document.getElementById('sim3dReset').onclick = () => { simProgress = 0; isSimPlaying = true; updateSimButtons(); };

    isSimPlaying = false;
    simProgress = 0;
    updateSimButtons();
    animate3D();
}

function close3DSimulation() {
    document.getElementById('sim3dModal').style.display = 'none';
    cancelAnimationFrame(simAnimationId);
    renderer.dispose();
}

function updateSimButtons() {
    document.getElementById('sim3dPlay').style.display = isSimPlaying ? 'none' : 'inline-block';
    document.getElementById('sim3dPause').style.display = isSimPlaying ? 'inline-block' : 'none';
}

function generate3DPath(bin) {
    const sequence = getOptimizedSequence(bin);
    let currentPos = { x: 0, y: 0, z: 10 }; 
    const parkX = parseFloat(document.getElementById('parkX').value) || 0;
    const parkY = parseFloat(document.getElementById('parkY').value) || 0;
    simPathPoints = [];

    const matRapid = new THREE.LineBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true }); 
    const matCut = new THREE.LineBasicMaterial({ color: 0x00ffff }); 

    const getPos = (p, part) => {
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
        return new THREE.Vector3(finalX, bin.height - finalY, 0); 
    };

    sequence.forEach(item => {
        const part = item.parentPart;
        const el = item.element;
        const totalLen = el.getTotalLength();
        const step = 2.0;
        
        let points = [];
        for (let len = 0; len <= totalLen; len += step) {
            points.push(getPos(el.getPointAtLength(len), part));
        }
        points.push(getPos(el.getPointAtLength(totalLen), part));
        
        const start = points[0];

        const travelPath2D = getSafeTravelPath(
            {x: currentPos.x, y: bin.height - currentPos.y}, 
            {x: start.x, y: bin.height - start.y}, 
            bin.width, bin.height
        );

        let last3D = new THREE.Vector3(currentPos.x, currentPos.y, 10);
        
        travelPath2D.forEach(p2d => {
            const next3D = new THREE.Vector3(p2d.x, bin.height - p2d.y, 10);
            const geoG0 = new THREE.BufferGeometry().setFromPoints([last3D, next3D]);
            scene.add(new THREE.Line(geoG0, matRapid));
            simPathPoints.push({ pos: last3D, type: 'G0' });
            simPathPoints.push({ pos: next3D, type: 'G0' });
            last3D = next3D;
        });

        const geoG1 = new THREE.BufferGeometry().setFromPoints(points);
        scene.add(new THREE.Line(geoG1, matCut));

        points.forEach(p => simPathPoints.push({ pos: p, type: 'G1' }));

        currentPos = points[points.length - 1];
    });

    const home = new THREE.Vector3(parkX, bin.height - parkY, 10);
    const geoHome = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(currentPos.x, currentPos.y, 10), home]);
    scene.add(new THREE.Line(geoHome, matRapid));
    simPathPoints.push({ pos: home, type: 'G0' });
}

function animate3D() {
    simAnimationId = requestAnimationFrame(animate3D);
    
    if (isSimPlaying && simPathPoints.length > 0) {
        const speed = parseInt(document.getElementById('sim3dSpeed').value);
        simProgress += speed;
        
        if (simProgress >= simPathPoints.length) {
            simProgress = simPathPoints.length - 1;
            isSimPlaying = false;
            updateSimButtons();
        }
        
        const idx = Math.floor(simProgress);
        const point = simPathPoints[idx];
        
        if (point) {
            toolMesh.position.copy(point.pos);
            toolMesh.position.z = point.type === 'G1' ? 0 : 10;
            toolMesh.material.color.setHex(point.type === 'G1' ? 0x00ffff : 0xff0000);
            
            document.getElementById('sim3dStatus').innerText = `${point.type} | ${(simProgress/simPathPoints.length*100).toFixed(0)}%`;
        }
    }

    renderer.render(scene, camera);
}