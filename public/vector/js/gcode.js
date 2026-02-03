// Generador de G-Code

function getGlobalPoints(part, points) {
    // Aplica rotación y traslación a un array de puntos normalizados (0,0)
    return points.map(p => {
        let x = p.x;
        let y = p.y;
        
        if (part.rotated) {
            // Rotación -90 grados: x' = y, y' = w - x
            const oldX = x;
            x = y;
            y = part.w - oldX;
        }
        
        // Traslación a posición final en placa
        return { x: x + part.fit.x, y: y + part.fit.y };
    });
}

function downloadGCode(bin) {
    if (document.getElementById('ecoCutMode') && document.getElementById('ecoCutMode').checked) {
        downloadGCodeEcoCut(bin);
        return;
    }

    let gcode = [];
    const FEED_RATE = parseFloat(document.getElementById('cncFeedRate').value) || 1200;
    const parkX = parseFloat(document.getElementById('parkX').value) || 0;
    const parkY = parseFloat(document.getElementById('parkY').value) || 0;

    gcode.push(`%`);
    gcode.push(`(Generado por MR Letreros CNC Pro)`);
    gcode.push(`G21`);
    gcode.push(`G90`);
    gcode.push(`G17`);
    gcode.push(`M5`);
    gcode.push(`G0 X0 Y0`);
    gcode.push(``);

    // Ordenar piezas por cercanía (TSP simple)
    let partsToCut = [...bin.parts];
    let currentPos = { x: 0, y: 0 };
    const sequence = [];

    while (partsToCut.length > 0) {
        let nearestIdx = -1;
        let minDist = Infinity;
        for (let i = 0; i < partsToCut.length; i++) {
            const p = partsToCut[i];
            const dist = (p.fit.x - currentPos.x) ** 2 + (p.fit.y - currentPos.y) ** 2;
            if (dist < minDist) { minDist = dist; nearestIdx = i; }
        }
        const nextPart = partsToCut.splice(nearestIdx, 1)[0];
        sequence.push(nextPart);
        currentPos = { x: nextPart.fit.x, y: nextPart.fit.y };
    }

    sequence.forEach(part => {
        if (!part.geometry) return;

        // 1. Cortar Huecos Primero
        part.geometry.holes.forEach((holePoints, idx) => {
            gcode.push(`(Pieza ${part.id} - Hueco ${idx+1})`);
            writePathToGcode(getGlobalPoints(part, holePoints), gcode, FEED_RATE);
        });

        // 2. Cortar Contorno Exterior
        gcode.push(`(Pieza ${part.id} - Contorno)`);
        writePathToGcode(getGlobalPoints(part, part.geometry.outer), gcode, FEED_RATE);
        gcode.push(``);
    });

    gcode.push(`M5`);
    gcode.push(`G0 X${parkX} Y${parkY}`);
    gcode.push(`M30`);
    gcode.push(`%`);

    const blob = new Blob([gcode.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corte_placa_${bin.id}.nc`;
    a.click();
}

function writePathToGcode(points, gcode, feedRate) {
    if (points.length === 0) return;
    
    // Optimizar inicio (buscar punto más cercano al actual no implementado aquí para brevedad, pero recomendado)
    // Asumimos points[0] es el inicio
    
    gcode.push(`M5`);
    gcode.push(`G0 X${points[0].x.toFixed(3)} Y${points[0].y.toFixed(3)}`);
    gcode.push(`M3`);
    gcode.push(`G1 F${feedRate}`); // Asegurar feedrate
    
    for (let i = 1; i < points.length; i++) {
        gcode.push(`G1 X${points[i].x.toFixed(3)} Y${points[i].y.toFixed(3)}`);
    }
}

function getEcoCutPath(bin) {
    // 1. Discretizar y obtener caminos cerrados
    let paths = [];
    
    bin.parts.forEach(part => {
        const d = part.element.getAttribute('d');
        // Separar sub-trayectos (huecos)
        const subPathStrings = d.split(/(?=[Mm])/).filter(s => s.trim().length > 0);
        
        subPathStrings.forEach(subD => {
            // Crear elemento temporal para medir
            const tempEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
            tempEl.setAttribute('d', subD);
            
            const totalLen = tempEl.getTotalLength();
        const step = 1.0; // mm
        let points = [];
        
        const transformPoint = (p) => {
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
            return { x: finalX, y: finalY };
        };

        for (let len = 0; len <= totalLen; len += step) {
                points.push(transformPoint(tempEl.getPointAtLength(len)));
        }
        // Asegurar cierre
        const start = points[0];
        const end = points[points.length-1];
        if ((start.x - end.x)**2 + (start.y - end.y)**2 > 0.1) {
            points.push(start);
        }
            paths.push(points);
        });
    });

    if (paths.length === 0) {
        return [];
    }

    // 2. Algoritmo EcoCut (PathsJoiner)
    let mainPath = paths[0];
    let remaining = paths.slice(1);

    while (remaining.length > 0) {
        let best = { dist: Infinity, idxMain: -1, idxOther: -1, pathIdx: -1 };

        for (let r = 0; r < remaining.length; r++) {
            const other = remaining[r];
            for (let i = 0; i < mainPath.length; i++) {
                for (let j = 0; j < other.length; j++) {
                    const d = (mainPath[i].x - other[j].x)**2 + (mainPath[i].y - other[j].y)**2;
                    if (d < best.dist) {
                        best.dist = d;
                        best.idxMain = i;
                        best.idxOther = j;
                        best.pathIdx = r;
                    }
                }
            }
        }

        if (best.pathIdx === -1) break;

        const pathToAdd = remaining[best.pathIdx];
        remaining.splice(best.pathIdx, 1);

        // Rotar pathToAdd para empezar en idxOther
        const uniquePoints = pathToAdd.slice(0, pathToAdd.length - 1);
        const k = best.idxOther % uniquePoints.length;
        const rotated = [
            ...uniquePoints.slice(k),
            ...uniquePoints.slice(0, k),
            uniquePoints[k] // Cerrar
        ];

        // Insertar en mainPath
        mainPath.splice(best.idxMain + 1, 0, ...rotated);
    }
    
    return mainPath;
}

function downloadGCodeEcoCut(bin) {
    const FEED_RATE = parseFloat(document.getElementById('cncFeedRate').value) || 1200;
    const parkX = parseFloat(document.getElementById('parkX').value) || 0;
    const parkY = parseFloat(document.getElementById('parkY').value) || 0;

    const mainPath = getEcoCutPath(bin);

    if (!mainPath || mainPath.length === 0) return;

    // 3. Generar G-Code
    let gcode = [];
    gcode.push(`%`);
    gcode.push(`(Generado por MR Letreros - EcoCut Mode)`);
    gcode.push(`G21 G90 G17`);
    gcode.push(`M5`);
    gcode.push(`G0 X0 Y0`);
    gcode.push(`M3`); // Encender herramienta
    gcode.push(`G1 F${FEED_RATE}`);

    // Ir al inicio y recorrer todo el camino continuo
    gcode.push(`G0 X${mainPath[0].x.toFixed(3)} Y${mainPath[0].y.toFixed(3)}`);
    for (let i = 1; i < mainPath.length; i++) {
        gcode.push(`G1 X${mainPath[i].x.toFixed(3)} Y${mainPath[i].y.toFixed(3)}`);
    }

    gcode.push(`M5`);
    gcode.push(`G0 X${parkX} Y${parkY}`);
    gcode.push(`M30`);
    gcode.push(`%`);

    const blob = new Blob([gcode.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecocut_placa_${bin.id}.nc`;
    a.click();
}

// NUEVO: Función para usar el motor Python
async function downloadGCodePython(bin) {
    const statusMsg = document.getElementById('statusMsg');
    statusMsg.innerText = "🐍 Procesando con Python Engine...";
    
    // 1. Preparar datos para Python
    const partsData = bin.parts.map(part => {
        // Obtener path data original
        const d = part.element.getAttribute('d');
        return {
            id: part.id,
            path_data: d,
            orig_x: part.x,
            orig_y: part.y,
            width: part.w, // Usado para rotación
            height: part.h,
            fit_x: part.fit.x,
            fit_y: part.fit.y,
            rotated: part.rotated
        };
    });

    const settings = {
        feed_rate: parseFloat(document.getElementById('cncFeedRate').value) || 1200,
        cut_depth: parseFloat(document.getElementById('cncCutDepth').value) || -1.0,
        safe_z: 5.0
    };

    try {
        const response = await fetch('http://localhost:5000/generate-gcode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parts: partsData, settings: settings })
        });

        if (!response.ok) throw new Error('Error en servidor Python');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `python_corte_placa_${bin.id}.nc`;
        a.click();
        statusMsg.innerText = "✅ G-Code generado con Python.";
    } catch (error) {
        console.error(error);
        alert("❌ Error: Asegúrate de ejecutar 'python python_service/server.py'");
        statusMsg.innerText = "❌ Error de conexión con Python.";
    }
}