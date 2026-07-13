import numpy as np
import shapely
import logging
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Literal

from shapely.geometry import Polygon, box, LineString
from svgpathtools import parse_path

# Configurar logging para ver qué pasa en la consola
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LED_API")

# --- Modelos de Datos ---

class LedRequest(BaseModel):
    svg_path: str = Field(..., description="El atributo 'd' de un path SVG.")
    module_width: float
    module_height: float
    spacing_x: float
    spacing_y: float
    margin: float
    mode: Literal['fill', 'contour']
    contour_spacing: float = 10.0

class LedPosition(BaseModel):
    x: float
    y: float
    angle: float

# --- App ---

app = FastAPI(title="LED Wizard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permitir todo para desarrollo local
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Lógica Geométrica ---

def parse_svg_to_polygon(svg_d: str, segments: int = 100) -> Polygon:
    """
    Convierte un path SVG (incluyendo curvas y agujeros) en un polígono de Shapely.
    Esta versión maneja correctamente los polígonos con agujeros (ej. 'O', 'A', 'B').
    """
    try:
        logger.info(f"   > Parseando SVG (longitud: {len(svg_d)} caracteres)...")
        path = parse_path(svg_d)
        if not path:
            return Polygon()
    except Exception:
        # svgpathtools puede fallar con paths malformados
        return Polygon()

    # svgpathtools a veces genera subpaths vacíos, los filtramos.
    subpaths = [sp for sp in path.continuous_subpaths() if sp.length() > 0]
    if not subpaths:
        return Polygon()

    polygons = []
    for subpath in subpaths:
        # Discretizar la curva en puntos. Más puntos para curvas más largas.
        num_points = max(segments, int(subpath.length() / 2))
        points = [
            (p.real, p.imag)
            for p in (subpath.point(i / num_points) for i in range(num_points + 1))
        ]
        if len(points) < 4: # Un polígono necesita al menos 3 puntos distintos para ser válido.
            continue
        
        poly = Polygon(points)
        if not poly.is_valid:
            poly = poly.buffer(0) # Intentar reparar geometrías inválidas (auto-intersecciones)
        
        if not poly.is_empty:
            polygons.append(poly)

    if not polygons:
        return Polygon()

    # Heurística para construir el polígono con agujeros:
    # 1. El polígono más grande es el contorno exterior (shell).
    # 2. Todos los demás polígonos que estén DENTRO del shell son agujeros.
    polygons.sort(key=lambda p: p.area, reverse=True)
    shell = polygons[0]
    holes = [p.exterior.coords for p in polygons[1:] if shell.contains(p)]
    final_polygon = Polygon(shell.exterior.coords, holes)
    return final_polygon if final_polygon.is_valid else final_polygon.buffer(0)

def calculate_fill_mode(polygon: Polygon, config: LedRequest) -> List[LedPosition]:
    leds = []
    minx, miny, maxx, maxy = polygon.bounds
    
    # Protección contra bucles infinitos por escala incorrecta
    if config.spacing_x <= 0.1 or config.spacing_y <= 0.1:
        logger.warning(f"⚠️ Espaciado muy pequeño (x:{config.spacing_x:.4f}, y:{config.spacing_y:.4f}). Ajustando a mínimo 1.0 para evitar colapso.")
        config.spacing_x = max(config.spacing_x, 1.0)
        config.spacing_y = max(config.spacing_y, 1.0)
    
    # Generar grid
    x_coords = np.arange(minx + config.module_width/2, maxx, config.spacing_x)
    y_coords = np.arange(miny + config.module_height/2, maxy, config.spacing_y)
    
    total_points = len(x_coords) * len(y_coords)
    logger.info(f"   > Generando grid de {len(x_coords)} x {len(y_coords)} = {total_points} puntos de prueba.")

    # --- OPTIMIZACIÓN VECTORIAL (Shapely 2.0+) ---
    # 1. Crear malla de coordenadas
    xv, yv = np.meshgrid(x_coords, y_coords)
    x_flat = xv.flatten()
    y_flat = yv.flatten()

    # 2. Crear puntos vectorizados y filtrar masivamente (100x más rápido que el bucle for)
    # Primero verificamos solo el CENTRO del módulo para descartar rápidamente
    points = shapely.points(x_flat, y_flat)
    mask = shapely.contains(polygon, points)
    
    # 3. Filtrar coordenadas válidas
    valid_x = x_flat[mask]
    valid_y = y_flat[mask]

    logger.info(f"   > Puntos candidatos (centros dentro): {len(valid_x)} de {total_points}")

    # 4. Verificación fina (Caja completa) solo en los supervivientes
    mw, mh = config.module_width, config.module_height
    
    for x, y in zip(valid_x, valid_y):
        module_box = box(x - mw/2, y - mh/2, x + mw/2, y + mh/2)
        if polygon.contains(module_box):
            leds.append(LedPosition(x=x, y=y, angle=0))
            
    return leds

def calculate_contour_mode(polygon: Polygon, config: LedRequest) -> List[LedPosition]:
    leds = []
    
    def place_on_line(line):
        length = line.length
        if length == 0: return
        count = int(length / config.contour_spacing)
        for i in range(count):
            dist = i * config.contour_spacing
            point = line.interpolate(dist)
            
            # Ángulo tangente
            p_next = line.interpolate(dist + 0.1)
            angle = np.degrees(np.arctan2(p_next.y - point.y, p_next.x - point.x))
            
            leds.append(LedPosition(x=point.x, y=point.y, angle=angle))

    if hasattr(polygon, 'exterior'):
        place_on_line(polygon.exterior)
        for interior in polygon.interiors:
            place_on_line(interior)
    elif hasattr(polygon, 'geoms'): # MultiPolygon
        for geom in polygon.geoms:
            place_on_line(geom.exterior)
            for interior in geom.interiors:
                place_on_line(interior)
                
    return leds

@app.post("/api/calculate-leds", response_model=List[LedPosition])
async def calculate_leds(request: LedRequest):
    try:
        start_time = time.time()
        logger.info(f"📥 Recibida petición: Modo={request.mode} | Módulo={request.module_width}x{request.module_height}")
        
        poly = parse_svg_to_polygon(request.svg_path)
        working_area = poly.buffer(-request.margin)
        
        if working_area.is_empty: return []
        
        if request.mode == 'fill':
            result = calculate_fill_mode(working_area, request)
        else:
            result = calculate_contour_mode(working_area, request)
            
        logger.info(f"✅ Cálculo completado en {time.time() - start_time:.3f}s. LEDs generados: {len(result)}")
        return result
    except Exception as e:
        logger.error(f"❌ Error en cálculo: {e}")
        raise HTTPException(status_code=500, detail=str(e))