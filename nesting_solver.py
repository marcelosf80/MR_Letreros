import json
import sys
import math

# ==========================================
# MOTOR DE NESTING EN PYTHON (Sin Navegador)
# ==========================================

class Part:
    def __init__(self, id, w, h):
        self.id = id
        self.w = float(w)
        self.h = float(h)
        self.x = 0
        self.y = 0
        self.rotated = False
        self.placed = False
        self.bin_id = -1

class Bin:
    def __init__(self, id, w, h, gap):
        self.id = id
        self.w = float(w)
        self.h = float(h)
        self.gap = float(gap)
        # Espacios libres (x, y, w, h)
        self.spaces = [{'x': 0, 'y': 0, 'w': self.w, 'h': self.h}]
        self.parts = []

    def try_fit(self, part, allow_rotation):
        best_space_idx = -1
        best_short_side_fit = float('inf')
        best_rotate = False

        for i, space in enumerate(self.spaces):
            gapped_w = part.w + self.gap
            gapped_h = part.h + self.gap

            # Cabe normal?
            fits_normal = (space['w'] >= gapped_w) and (space['h'] >= gapped_h)
            
            # Cabe rotada?
            fits_rotated = False
            if allow_rotation:
                fits_rotated = (space['w'] >= gapped_h) and (space['h'] >= gapped_w)

            if fits_normal:
                leftover_w = space['w'] - gapped_w
                leftover_h = space['h'] - gapped_h
                short_side = min(leftover_w, leftover_h)
                
                if short_side < best_short_side_fit:
                    best_short_side_fit = short_side
                    best_space_idx = i
                    best_rotate = False

            if fits_rotated:
                leftover_w = space['w'] - gapped_h
                leftover_h = space['h'] - gapped_w
                short_side = min(leftover_w, leftover_h)

                if short_side < best_short_side_fit:
                    best_short_side_fit = short_side
                    best_space_idx = i
                    best_rotate = True

        if best_space_idx != -1:
            space = self.spaces[best_space_idx]
            
            part.placed = True
            part.rotated = best_rotate
            part.x = space['x']
            part.y = space['y']
            part.bin_id = self.id
            
            self.parts.append(part)

            placed_w = (part.h if best_rotate else part.w) + self.gap
            placed_h = (part.w if best_rotate else part.h) + self.gap

            # Nuevos espacios
            right_space = {'x': space['x'] + placed_w, 'y': space['y'], 'w': space['w'] - placed_w, 'h': placed_h}
            down_space = {'x': space['x'], 'y': space['y'] + placed_h, 'w': space['w'], 'h': space['h'] - placed_h}

            del self.spaces[best_space_idx]

            if down_space['w'] > 0 and down_space['h'] > 0:
                self.spaces.append(down_space)
            if right_space['w'] > 0 and right_space['h'] > 0:
                self.spaces.append(right_space)
            
            # Ordenar espacios (Heurística simple)
            self.spaces.sort(key=lambda s: s['y'])
            
            return True
        return False

def solve_nesting(parts_data, sheet_w, sheet_h, gap, allow_rotation=True):
    parts = [Part(p['id'], p['w'], p['h']) for p in parts_data]
    # Ordenar por lado más largo (Heurística estándar)
    parts.sort(key=lambda p: max(p.w, p.h), reverse=True)

    bins = []

    for part in parts:
        placed = False
        for bin in bins:
            if bin.try_fit(part, allow_rotation):
                placed = True
                break
        
        if not placed:
            new_bin = Bin(len(bins) + 1, sheet_w, sheet_h, gap)
            if new_bin.try_fit(part, allow_rotation):
                bins.append(new_bin)
            else:
                print(f"Advertencia: Pieza {part.id} es demasiado grande para la placa.")

    # Generar resultado JSON
    results = []
    for bin in bins:
        bin_parts = []
        for p in bin.parts:
            bin_parts.append({
                'id': p.id,
                'x': p.x,
                'y': p.y,
                'rotated': p.rotated,
                'bin': bin.id
            })
        results.append({'bin_id': bin.id, 'parts': bin_parts})
    
    return json.dumps(results, indent=2)

if __name__ == "__main__":
    try:
        # 1. Leer todos los datos desde la entrada estándar (enviados por Node.js)
        input_data_str = sys.stdin.read()
        
        # 2. Parsear el JSON de entrada
        input_data = json.loads(input_data_str)
        
        # 3. Extraer los parámetros
        parts = input_data.get('parts', [])
        sheet_w = input_data.get('sheetW', 1200)
        sheet_h = input_data.get('sheetH', 600)
        gap = input_data.get('gap', 5)
        allow_rotation = input_data.get('allowRotation', True)
        
        # 4. Ejecutar el optimizador
        result_json = solve_nesting(parts, sheet_w, sheet_h, gap, allow_rotation)
        
        # 5. Imprimir el resultado a la salida estándar (para que Node.js lo capture)
        print(result_json)
        
    except Exception as e:
        # Si algo sale mal, imprimir el error a la salida de error estándar
        print(f"Error in Python script: {e}", file=sys.stderr)
        sys.exit(1)