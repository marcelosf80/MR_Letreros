import sys
import json
import math
from xml.etree import ElementTree as ET
from io import StringIO
# Asegúrate de haber instalado esta librería con: pip install svg.path
from svg.path import parse_path, Path, Line, Arc, CubicBezier, QuadraticBezier, Close

# Registra namespaces para manejar correctamente los archivos SVG
ET.register_namespace("", "http://www.w3.org/2000/svg")
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

# --- Funciones de Ayuda ---

def point_in_polygon(p, polygon_points):
    # Algoritmo de Ray Casting para saber si un punto está en un polígono
    x, y = p['x'], p['y']
    inside = False
    if not polygon_points: return False
    p1x, p1y = polygon_points[0]['x'], polygon_points[0]['y']
    for i in range(len(polygon_points) + 1):
        p2x, p2y = polygon_points[i % len(polygon_points)]['x'], polygon_points[i % len(polygon_points)]['y']
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def is_contained(inner, outer):
    # 1. Revisión rápida con Bounding Box
    if (inner['bbox']['x'] < outer['bbox']['x'] or
            inner['bbox']['y'] < outer['bbox']['y'] or
            inner['bbox']['x'] + inner['bbox']['w'] > outer['bbox']['x'] + outer['bbox']['w'] or
            inner['bbox']['y'] + inner['bbox']['h'] > outer['bbox']['y'] + outer['bbox']['h']):
        return False
    
    # 2. Revisión precisa con el punto central
    center_point = {'x': inner['bbox']['x'] + inner['bbox']['w'] / 2, 'y': inner['bbox']['y'] + inner['bbox']['h'] / 2}
    if point_in_polygon(center_point, outer['points']):
        return True
    
    return False

def get_bbox_and_points(path_obj, samples=200):
    # Obtiene la caja contenedora (bounding box) y una lista de puntos del trazado
    points = []
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')

    for i in range(samples + 1):
        pos = i / samples
        p = path_obj.point(pos)
        x, y = p.real, p.imag
        points.append({'x': x, 'y': y})
        min_x, max_x = min(min_x, x), max(max_x, x)
        min_y, max_y = min(min_y, y), max(max_y, y)
    
    return {
        'x': min_x, 'y': min_y,
        'w': max_x - min_x, 'h': max_y - min_y
    }, points

def shape_to_path_d(shape):
    # Convierte un elemento de forma SVG (rect, circle, etc.) a un string de trazado 'd'
    tag = shape.tag.split('}')[-1] if '}' in shape.tag else shape.tag
    attrs = shape.attrib
    d = ''
    k = 0.5522847498  # Constante para aproximación de arcos con curvas Bezier

    if tag == 'rect':
        x = float(attrs.get('x', 0))
        y = float(attrs.get('y', 0))
        w = float(attrs.get('width', 0))
        h = float(attrs.get('height', 0))
        rx = float(attrs.get('rx', 0))
        ry = float(attrs.get('ry', 0))
        
        if not rx and not ry:
            d = f"M{x},{y}h{w}v{h}h{-w}Z"
        else:
            r_x = rx or ry
            r_y = ry or rx
            kx = r_x * k
            ky = r_y * k
            d = (f"M{x + r_x},{y}"
                 f"L{x + w - r_x},{y}"
                 f"C{x + w - r_x + kx},{y},{x + w},{y + r_y - ky},{x + w},{y + r_y}"
                 f"L{x + w},{y + h - r_y}"
                 f"C{x + w},{y + h - r_y + ky},{x + w - r_x + kx},{y + h},{x + w - r_x},{y + h}"
                 f"L{x + r_x},{y + h}"
                 f"C{x + r_x - kx},{y + h},{x},{y + h - r_y + ky},{x},{y + h - r_y}"
                 f"L{x},{y + r_y}"
                 f"C{x},{y + r_y - ky},{x + r_x - kx},{y},{x + r_x},{y}Z")
    
    elif tag == 'circle':
        cx = float(attrs.get('cx', 0))
        cy = float(attrs.get('cy', 0))
        r = float(attrs.get('r', 0))
        kr = r * k
        d = (f"M{cx - r},{cy}"
             f"C{cx - r},{cy - kr},{cx - kr},{cy - r},{cx},{cy - r}"
             f"C{cx + kr},{cy - r},{cx + r},{cy - kr},{cx + r},{cy}"
             f"C{cx + r},{cy + kr},{cx + kr},{cy + r},{cx},{cy + r}"
             f"C{cx - kr},{cy + r},{cx - r},{cy + kr},{cx - r},{cy}Z")

    elif tag == 'ellipse':
        cx = float(attrs.get('cx', 0))
        cy = float(attrs.get('cy', 0))
        rx = float(attrs.get('rx', 0))
        ry = float(attrs.get('ry', 0))
        kx = rx * k
        ky = ry * k
        d = (f"M{cx - rx},{cy}"
             f"C{cx - rx},{cy - ky},{cx - kx},{cy - ry},{cx},{cy - ry}"
             f"C{cx + kx},{cy - ry},{cx + rx},{cy - ky},{cx + rx},{cy}"
             f"C{cx + rx},{cy + ky},{cx + kx},{cy + ry},{cx},{cy + ry}"
             f"C{cx - kx},{cy + ry},{cx - rx},{cy + ky},{cx - rx},{cy}Z")

    elif tag == 'line':
        x1, y1, x2, y2 = map(lambda k: float(attrs.get(k, 0)), ['x1', 'y1', 'x2', 'y2'])
        d = f"M{x1},{y1}L{x2},{y2}"

    elif tag in ['polyline', 'polygon']:
        points_str = attrs.get('points', '').strip().replace(',', ' ')
        points = points_str.split()
        if len(points) >= 2:
            d = f"M{points[0]},{points[1]}"
            for i in range(2, len(points), 2):
                d += f"L{points[i]},{points[i+1]}"
            if tag == 'polygon':
                d += "Z"
    
    elif tag == 'path':
        d = attrs.get('d', '')

    return d

def scale_path(path, scale):
    if scale == 1.0:
        return path
    for segment in path:
        segment.start *= scale
        segment.end *= scale
        if hasattr(segment, 'control1'):
            segment.control1 *= scale
            segment.control2 *= scale
        elif hasattr(segment, 'control'):
            segment.control *= scale
        elif hasattr(segment, 'radius'):
            segment.radius *= scale
    return path

# --- Función Principal de Procesamiento ---

def process_svg(svg_string, options):
    real_width_cm = options.get('realWidthCm', 0)

    root = ET.fromstring(svg_string)
    
    viewbox_str = root.get('viewBox', f"0 0 {root.get('width', '1000')} {root.get('height', '1000')}")
    vb = [float(v) for v in viewbox_str.split()]
    
    scale_factor = 1.0
    if real_width_cm > 0:
        target_width_mm = real_width_cm * 10
        current_width_px = vb[2]
        if current_width_px > 0:
            scale_factor = target_width_mm / current_width_px

    # Buscar TODOS los elementos visuales y convertirlos a trazados si es necesario
    ns = 'http://www.w3.org/2000/svg'
    elements_to_process = root.findall(f".//{{{ns}}}path") + \
                          root.findall(f".//{{{ns}}}rect") + \
                          root.findall(f".//{{{ns}}}circle") + \
                          root.findall(f".//{{{ns}}}ellipse") + \
                          root.findall(f".//{{{ns}}}polygon") + \
                          root.findall(f".//{{{ns}}}polyline") + \
                          root.findall(f".//{{{ns}}}line")
    
    simple_shapes = []
    for el in elements_to_process:
        d = shape_to_path_d(el)
        if not d: continue
        
        path_obj = parse_path(d)
        scale_path(path_obj, scale_factor)
        bbox, points = get_bbox_and_points(path_obj)
        
        if bbox['w'] > 0.1 and bbox['h'] > 0.1:
            simple_shapes.append({
                'd': path_obj.d(), 'bbox': bbox, 'points': points,
                'area': bbox['w'] * bbox['h'], 'children': [], 'fill': el.get('fill', '#000')
            })

    simple_shapes.sort(key=lambda s: s['area'], reverse=True)
    
    # Construir jerarquía para detectar huecos
    root_nodes = []
    for shape in simple_shapes:
        placed = False
        nodes_to_check = root_nodes
        # Intenta colocar la forma dentro de una existente
        for node in nodes_to_check:
            if is_contained(shape, node):
                # Es un hueco o una isla dentro de un hueco
                node['children'].append(shape) # Simplificado: lo agregamos como hijo
                placed = True
                break
        if not placed:
            root_nodes.append(shape)

    # Reconstruir el SVG y preparar los datos de las piezas
    final_parts_for_nesting = []
    final_svg_paths = []
    part_id_counter = 1
    
    for node in root_nodes:
        # Combinar el trazado principal con sus huecos para el renderizado
        combined_d = node['d']
        for child in node['children']:
            combined_d += ' ' + child['d']
        
        final_svg_paths.append({
            'd': combined_d, 'fill': node['fill'], 'fill-rule': 'evenodd'
        })
        
        final_parts_for_nesting.append({
            'id': part_id_counter, 'w': node['bbox']['w'], 'h': node['bbox']['h']
        })
        part_id_counter += 1

    # Crear el string del nuevo SVG
    new_vb_w = vb[2] * scale_factor
    new_vb_h = vb[3] * scale_factor
    new_root = ET.Element('svg', {
        'xmlns': "http://www.w3.org/2000/svg",
        'width': str(new_vb_w), 'height': str(new_vb_h),
        'viewBox': f"0 0 {new_vb_w} {new_vb_h}"
    })
    for p_attrs in final_svg_paths:
        ET.SubElement(new_root, 'path', p_attrs)

    return {
        'svgString': ET.tostring(new_root, encoding='unicode'),
        'parts': final_parts_for_nesting,
        'viewBox': {'w': new_vb_w, 'h': new_vb_h}
    }

if __name__ == "__main__":
    try:
        input_json = json.load(sys.stdin)
        # Por ahora, solo procesamos SVG. La lógica para PDF e imágenes se puede agregar aquí.
        if 'svg' in input_json['fileType']:
            result = process_svg(input_json['fileContent'], input_json.get('options', {}))
            print(json.dumps(result))
        else:
            raise NotImplementedError(f"El tipo de archivo {input_json['fileType']} aún no es soportado por el procesador Python.")
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)