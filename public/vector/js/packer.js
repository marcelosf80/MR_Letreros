/* 
   packer.js - LÃ³gica Multi-Placa (Bin Packing)
*/

// Clase que representa una sola pieza
class Part {
    constructor(element, id) {
        this.id = id;
        this.element = element; // Guardamos referencia al vector original
        try {
            const bbox = element.getBBox();
            this.x = bbox.x; 
            this.y = bbox.y;
            this.w = bbox.width;
            this.h = bbox.height;
        } catch(e) {
            this.w = 0; this.h = 0;
        }

        // Estado del nesting
        this.placed = false;
        this.binId = -1; // En quÃ© placa quedÃ³ (-1 = ninguna)
        this.fit = null; // Coordenadas {x, y} en esa placa
        this.rotated = false;
        
        // Guardamos posiciÃ³n original para poder "recortar" la imagen luego
        this.originalX = this.x;
        this.originalY = this.y;

        // Cargar huecos si existen (Nesting dentro de huecos)
        this.holes = [];
        if (element.dataset && element.dataset.holes) {
            try { this.holes = JSON.parse(element.dataset.holes); } catch(e) {}
        }
    }
}

// Clase que representa UNA PLACA (Bin)
class Bin {
    constructor(id, width, height, gap, useVertical) {
        this.id = id;
        this.width = width;
        this.height = height;
        this.gap = gap;
        this.useVertical = useVertical;
        this.root = { x: 0, y: 0, w: width, h: height };
        this.spaces = [this.root]; // Espacios libres
        this.parts = []; // Piezas colocadas aquÃ­
    }

    // Intenta meter una pieza en esta placa
    tryFit(part, allowRotation) {
        let bestSpaceIndex = -1;
        let rotateThis = false;

        // Buscar espacio
        for (let i = 0; i < this.spaces.length; i++) {
            const space = this.spaces[i];
            
            // Cabe normal?
            const fitsNormal = (space.w >= part.w + this.gap) && (space.h >= part.h + this.gap);
            // Cabe rotada?
            let fitsRotated = false;
            if (allowRotation) {
                fitsRotated = (space.w >= part.h + this.gap) && (space.h >= part.w + this.gap);
            }

            if (fitsNormal) {
                bestSpaceIndex = i;
                rotateThis = false;
                break; 
            } else if (fitsRotated) {
                bestSpaceIndex = i;
                rotateThis = true;
                break; 
            }
        }

        if (bestSpaceIndex !== -1) {
            // Encontramos lugar
            const space = this.spaces[bestSpaceIndex];
            
            // Guardar datos en la pieza
            part.placed = true;
            part.rotated = rotateThis;
            
            // Lógica de Centrado para Huecos ("Soldar al centro")
            if (space.isHole) {
                part.nestedInHole = true;
                const placedW = (rotateThis ? part.h : part.w);
                const placedH = (rotateThis ? part.w : part.h);
                const centerX = space.x + (space.w - placedW) / 2;
                const centerY = space.y + (space.h - placedH) / 2;
                part.fit = { x: centerX, y: centerY };
            } else {
                part.fit = { x: space.x, y: space.y };
            }
            
            part.binId = this.id;
            
            // Agregar a la lista de esta placa
            this.parts.push(part);

            // Calcular espacio ocupado
            const placedW = (rotateThis ? part.h : part.w) + this.gap;
            const placedH = (rotateThis ? part.w : part.h) + this.gap;

            // Dividir el espacio restante
            const rightSpace = { x: space.x + placedW, y: space.y, w: space.w - placedW, h: placedH };
            const downSpace = { x: space.x, y: space.y + placedH, w: space.w, h: space.h - placedH };
            
            this.spaces.splice(bestSpaceIndex, 1);

            if (downSpace.w > 0 && downSpace.h > 0) this.spaces.push(downSpace);
            if (rightSpace.w > 0 && rightSpace.h > 0) this.spaces.push(rightSpace);

            // --- NESTING EN HUECOS ---
            // Si la pieza tiene huecos, los agregamos como espacios libres
            if (part.holes && part.holes.length > 0) {
                part.holes.forEach(hole => {
                    let hx, hy, hw, hh;
                    
                    // Calcular posición del hueco según la rotación de la pieza
                    if (rotateThis) {
                        // Rotación -90 grados (CCW): x' = y, y' = W - (x + w)
                        hx = hole.y;
                        hy = part.w - (hole.x + hole.w);
                        hw = hole.h;
                        hh = hole.w;
                    } else {
                        hx = hole.x;
                        hy = hole.y;
                        hw = hole.w;
                        hh = hole.h;
                    }

                    // Coordenadas absolutas en la placa
                    const absX = space.x + hx;
                    const absY = space.y + hy;
                    
                    // Aplicar gap de seguridad dentro del hueco
                    const safeX = absX + this.gap;
                    const safeY = absY + this.gap;
                    const safeW = hw - (this.gap * 2);
                    const safeH = hh - (this.gap * 2);

                    if (safeW > 5 && safeH > 5) { // Mínimo útil
                        this.spaces.push({ x: safeX, y: safeY, w: safeW, h: safeH, isHole: true });
                    }
                });
            }

            // RE-ORDENAR ESPACIOS (AquÃ­ estÃ¡ la magia Vertical vs Horizontal)
            this.spaces.sort((a, b) => {
                if (this.useVertical) {
                    // Vertical: Llenar columnas (X importa mÃ¡s)
                    if (a.x === b.x) return a.y - b.y;
                    return a.x - b.x;
                } else {
                    // Horizontal: Llenar filas (Y importa mÃ¡s)
                    if (a.y === b.y) return a.x - b.x;
                    return a.y - b.y;
                }
            });

            return true; // Ã‰xito
        }

        return false; // No cupo
    }
}

// Clase Principal que administra MÃšLTIPLES PLACAS
class Packer {
    constructor(sheetW, sheetH, gap, useVertical) {
        this.sheetW = sheetW;
        this.sheetH = sheetH;
        this.gap = gap;
        this.useVertical = useVertical;
        this.bins = []; // Array de placas (bins)
    }

    fit(parts, allowRotation) {
        // Ordenar piezas (Las grandes primero)
        parts.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

        // Iterar cada pieza
        for (let part of parts) {
            let placed = false;

            // 1. Intentar en placas existentes
            for (let bin of this.bins) {
                if (bin.tryFit(part, allowRotation)) {
                    placed = true;
                    break;
                }
            }

            // 2. Si no cupo, crear NUEVA PLACA
            if (!placed) {
                // Verificar si la pieza es fÃ­sicamente mÃ¡s grande que la placa vacÃ­a
                const minSide = Math.min(part.w, part.h);
                const maxSheetSide = Math.max(this.sheetW, this.sheetH);
                
                // Si ni rotada cabe (aprox), advertir pero intentar crear placa
                const newBinId = this.bins.length + 1;
                const newBin = new Bin(newBinId, this.sheetW, this.sheetH, this.gap, this.useVertical);
                
                if (newBin.tryFit(part, allowRotation)) {
                    this.bins.push(newBin);
                } else {
                    console.warn(`Pieza #${part.id} es demasiado grande para la placa.`);
                }
            }
        }
    }
}