// Funciones de ayuda matemáticas y generales

function distSq(p1, p2) {
    return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
}

function formatTime(minutes) {
    const totalSec = Math.round(minutes * 60);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
}

function optimizePathStart(points, targetPos) {
    if (points.length < 3) return points;
    
    const first = points[0];
    const last = points[points.length - 1];
    if (distSq(first, last) > 0.1) return points;

    let minD = Infinity;
    let idx = 0;
    
    for (let i = 0; i < points.length - 1; i++) {
        const d = distSq(points[i], targetPos);
        if (d < minD) {
            minD = d;
            idx = i;
        }
    }

    if (idx === 0) return points;

    const uniquePoints = points.slice(0, points.length - 1);
    const part1 = uniquePoints.slice(idx);
    const part2 = uniquePoints.slice(0, idx);
    const rotated = part1.concat(part2);
    rotated.push(rotated[0]);
    
    return rotated;
}

function getSafeTravelPath(start, end, sheetW, sheetH) {
    const safeTravelEl = document.getElementById('safeTravel');
    if (!safeTravelEl || !safeTravelEl.checked) {
        return [end];
    }

    const points = [];
    
    const distsStart = [
        { id: 0, val: start.y, p: { x: start.x, y: 0 } },
        { id: 1, val: sheetW - start.x, p: { x: sheetW, y: start.y } },
        { id: 2, val: sheetH - start.y, p: { x: start.x, y: sheetH } },
        { id: 3, val: start.x, p: { x: 0, y: start.y } }
    ];
    distsStart.sort((a, b) => a.val - b.val);
    const pStartBorder = distsStart[0].p;

    const distsEnd = [
        { id: 0, val: end.y, p: { x: end.x, y: 0 } },
        { id: 1, val: sheetW - end.x, p: { x: sheetW, y: end.y } },
        { id: 2, val: sheetH - end.y, p: { x: end.x, y: sheetH } },
        { id: 3, val: end.x, p: { x: 0, y: end.y } }
    ];
    distsEnd.sort((a, b) => a.val - b.val);
    const pEndBorder = distsEnd[0].p;

    points.push(pStartBorder);
    // Heurística simple: ir a esquinas si es necesario
    points.push(pEndBorder);
    points.push(end);
    return points;
}