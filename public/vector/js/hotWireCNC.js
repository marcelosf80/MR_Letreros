/**
 * hotWireCNC.js - Generador de G-Code para Cortadora de Hilo Caliente (Ackon Eco3)
 * Integra presets de materiales y optimización de trayectoria.
 */

class HotWireCNCGenerator {
    constructor() {
        this.config = {
            speed: 300,       // mm/min
            temperature: 0,   // 0-1000 (S value)
            zHeight: 0,       // Usually 0 for 2D hot wire
            travelSpeed: 1500 // Rapid movement speed
        };
        
        this.presets = {
            'eps_20': { name: 'Telgopor (EPS) 20mm', speed: 300, temp: 350 },
            'eps_50': { name: 'Telgopor (EPS) 50mm', speed: 300, temp: 400 },
            'xps_20': { name: 'Polyfan (XPS) 20mm', speed: 300, temp: 600 },
            'xps_50': { name: 'Polyfan (XPS) 50mm', speed: 300, temp: 800 },
            'custom': { name: 'Personalizado', speed: 300, temp: 0 }
        };
    }

    /**
     * Parsea el SVG string actual y extrae las coordenadas
     * @param {string} svgString 
     */
    extractPathsFromSVG(svgString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, "image/svg+xml");
        const svg = doc.querySelector('svg');
        
        if (!svg) throw new Error("SVG no válido");

        const paths = [];
        // Seleccionamos elementos básicos. 
        const elements = svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');

        elements.forEach(el => {
            const points = this.elementToPath(el);
            if (points && points.length > 0) {
                paths.push(points);
            }
        });

        return this.joinPaths(paths);
    }

    elementToPath(element) {
        const tagName = element.tagName.toLowerCase();
        
        // Normalizamos usando getPointAtLength para máxima compatibilidad
        let d = '';
        
        if (tagName === 'path') {
            d = element.getAttribute('d');
        } else if (tagName === 'rect') {
            const x = element.getAttribute('x') || 0;
            const y = element.getAttribute('y') || 0;
            const w = element.getAttribute('width') || 0;
            const h = element.getAttribute('height') || 0;
            d = `M${x},${y} h${w} v${h} h-${w} Z`;
        } else if (tagName === 'circle') {
            const cx = element.getAttribute('cx') || 0;
            const cy = element.getAttribute('cy') || 0;
            const r = element.getAttribute('r') || 0;
            d = `M${cx-r},${cy} a${r},${r} 0 1,0 ${r*2},0 a${r},${r} 0 1,0 -${r*2},0`;
        } else if (tagName === 'ellipse') {
            const cx = element.getAttribute('cx') || 0;
            const cy = element.getAttribute('cy') || 0;
            const rx = element.getAttribute('rx') || 0;
            const ry = element.getAttribute('ry') || 0;
            d = `M${cx-rx},${cy} a${rx},${ry} 0 1,0 ${rx*2},0 a${rx},${ry} 0 1,0 -${rx*2},0`;
        } else if (tagName === 'polygon' || tagName === 'polyline') {
            const points = element.getAttribute('points');
            if (points) {
                const pts = points.trim().split(/\s+|,/);
                if (pts.length >= 2) {
                    d = `M${pts[0]},${pts[1]}`;
                    for (let i = 2; i < pts.length; i += 2) {
                        d += ` L${pts[i]},${pts[i+1]}`;
                    }
                    if (tagName === 'polygon') d += ' Z';
                }
            }
        }

        if (d) {
            return this.pathDToPoints(d);
        }
        return [];
    }

    pathDToPoints(d) {
        const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        tempPath.setAttribute("d", d);
        
        const len = tempPath.getTotalLength();
        const points = [];
        // Resolución: 1mm para mantener curvas suaves pero no excesivos puntos
        const step = 1.0; 

        for (let i = 0; i <= len; i += step) {
            const pt = tempPath.getPointAtLength(i);
            points.push({ x: pt.x, y: pt.y });
        }
        // Asegurar punto final exacto
        const end = tempPath.getPointAtLength(len);
        if (points.length > 0) {
            const last = points[points.length - 1];
            if (Math.abs(last.x - end.x) > 0.1 || Math.abs(last.y - end.y) > 0.1) {
                points.push({ x: end.x, y: end.y });
            }
        } else {
            points.push({ x: end.x, y: end.y });
        }

        return points;
    }

    /**
     * Une múltiples trayectorias optimizando el orden (TSP Nearest Neighbor)
     */
    joinPaths(paths) {
        if (paths.length === 0) return [];
        
        let remaining = [...paths];
        let ordered = [];
        let currentPos = { x: 0, y: 0 };

        while (remaining.length > 0) {
            let nearestIdx = -1;
            let minDist = Infinity;

            for (let i = 0; i < remaining.length; i++) {
                const startPt = remaining[i][0];
                const dist = (startPt.x - currentPos.x)**2 + (startPt.y - currentPos.y)**2;
                if (dist < minDist) {
                    minDist = dist;
                    nearestIdx = i;
                }
            }

            const nextPath = remaining.splice(nearestIdx, 1)[0];
            ordered.push(nextPath);
            currentPos = nextPath[nextPath.length - 1];
        }

        return ordered;
    }

    generateGCode(svgString, options = {}) {
        this.config = { ...this.config, ...options };
        
        let paths;
        try {
            paths = this.extractPathsFromSVG(svgString);
        } catch (e) {
            console.error("Error extrayendo paths:", e);
            return null;
        }
        
        if (paths.length === 0) return null;

        const date = new Date().toISOString();
        let gcode = [];
        
        // Header
        gcode.push(`; Hot Wire CNC G-Code generated by MR Letreros`);
        gcode.push(`; Date: ${date}`);
        gcode.push(`; Material: ${options.materialName || 'Custom'}`);
        gcode.push(`; Speed: ${this.config.speed} mm/min`);
        gcode.push(`; Temperature (S): ${this.config.temperature}`);
        gcode.push(``);
        
        // Setup
        gcode.push(`G21 ; Millimeters`);
        gcode.push(`G90 ; Absolute positioning`);
        gcode.push(`G0 Z0 ; Z Axis to 0`);
        gcode.push(`M3 S${this.config.temperature} ; Turn on wire heating`);
        gcode.push(`G4 P1 ; Wait 1s for heat up`);
        gcode.push(`G1 F${this.config.speed} ; Set feed rate`);
        gcode.push(``);

        let totalLength = 0;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        paths.forEach((path, idx) => {
            if (path.length === 0) return;

            gcode.push(`; Path ${idx + 1}`);
            
            // Rapid move to start
            const start = path[0];
            gcode.push(`G0 X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`);
            
            // Cut path
            for (let i = 1; i < path.length; i++) {
                const p = path[i];
                gcode.push(`G1 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}`);
                
                // Stats
                const prev = path[i-1];
                totalLength += Math.hypot(p.x - prev.x, p.y - prev.y);
                
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            }
            
            // Pausa estratégica al final de cada corte para evitar arrastre
            gcode.push(`G4 P0.5`); 
            gcode.push(``);
        });

        // Footer
        gcode.push(`M5 ; Turn off wire heating`);
        gcode.push(`G0 X0 Y0 ; Return to home`);
        gcode.push(`M30 ; End of program`);

        // Stats object
        const stats = {
            paths: paths.length,
            points: paths.reduce((acc, p) => acc + p.length, 0),
            lengthMM: totalLength.toFixed(2),
            timeMinutes: (totalLength / this.config.speed).toFixed(2),
            boundingBox: {
                width: (maxX - minX).toFixed(2),
                height: (maxY - minY).toFixed(2)
            }
        };

        return { code: gcode.join('\n'), stats };
    }

    downloadGCode(gcodeString, filename = 'corte_hilo.nc') {
        const blob = new Blob([gcodeString], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Exportar instancia global
window.hotWireCNC = new HotWireCNCGenerator();