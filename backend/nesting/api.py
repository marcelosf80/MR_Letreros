"""FastAPI integration for the Polifan nesting engine.
"""
from __future__ import annotations

import io
import os
import logging
import xml.etree.ElementTree as ET
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
from shapely.geometry import Polygon
from svgpathtools import parse_path

from .geometry import Piece
from .genetic import optimize

logger = logging.getLogger("Nesting_API")
nesting_router = APIRouter()


class PieceIn(BaseModel):
    id: str
    contour: list[tuple[float, float]] = Field(..., min_length=3)
    quantity: int = Field(1, ge=1)
    allowed_rotations: list[float] = Field(default_factory=lambda: [0.0])


class NestRequest(BaseModel):
    pieces: list[PieceIn]
    sheet_width_mm: float = Field(..., gt=0)
    spacing_mm: float = Field(2.0, ge=0)
    population_size: int = Field(20, ge=4, le=200)
    generations: int = Field(30, ge=1, le=500)


class PlacementOut(BaseModel):
    piece_id: str
    rotation: float
    x: float
    y: float
    contour: list[tuple[float, float]]


class NestResponse(BaseModel):
    placements: list[PlacementOut]
    unplaced_piece_ids: list[str]
    used_length_mm: float
    sheet_width_mm: float
    utilization_pct: float


class NestSvgResponse(BaseModel):
    nested_svg: str
    used_length_mm: float
    sheet_width_mm: float
    utilization_pct: float
    unplaced_count: int
    unplaced_piece_ids: list[str]


def _parse_svg_string_in_memory(svg_str: str):
    """Parsea completamente un SVG en memoria sin escribir en disco.
    Convierte trazados path, rect, circle, ellipse, polygon y polyline a objetos Path de svgpathtools.
    """
    paths = []
    try:
        root = ET.fromstring(svg_str)
    except Exception as e:
        logger.error(f"Error parseando XML del SVG: {e}")
        return []

    for elem in root.iter():
        tag = elem.tag.split('}')[-1].lower() if '}' in elem.tag else elem.tag.lower()
        d_str = None

        if tag == 'path' and 'd' in elem.attrib:
            d_str = elem.attrib['d']
        elif tag == 'rect':
            try:
                x = float(elem.attrib.get('x', 0))
                y = float(elem.attrib.get('y', 0))
                w = float(elem.attrib.get('width', 0))
                h = float(elem.attrib.get('height', 0))
                if w > 0 and h > 0:
                    d_str = f"M {x} {y} L {x+w} {y} L {x+w} {y+h} L {x} {y+h} Z"
            except Exception:
                pass
        elif tag == 'circle':
            try:
                cx = float(elem.attrib.get('cx', 0))
                cy = float(elem.attrib.get('cy', 0))
                r = float(elem.attrib.get('r', 0))
                if r > 0:
                    d_str = f"M {cx-r} {cy} A {r} {r} 0 1 0 {cx+r} {cy} A {r} {r} 0 1 0 {cx-r} {cy} Z"
            except Exception:
                pass
        elif tag == 'ellipse':
            try:
                cx = float(elem.attrib.get('cx', 0))
                cy = float(elem.attrib.get('cy', 0))
                rx = float(elem.attrib.get('rx', 0))
                ry = float(elem.attrib.get('ry', 0))
                if rx > 0 and ry > 0:
                    d_str = f"M {cx-rx} {cy} A {rx} {ry} 0 1 0 {cx+rx} {cy} A {rx} {ry} 0 1 0 {cx-rx} {cy} Z"
            except Exception:
                pass
        elif tag in ('polygon', 'polyline'):
            pts_str = elem.attrib.get('points', '').strip()
            if pts_str:
                raw_coords = [c for c in pts_str.replace(',', ' ').split() if c]
                if len(raw_coords) >= 4 and len(raw_coords) % 2 == 0:
                    d_pairs = [f"{raw_coords[i]} {raw_coords[i+1]}" for i in range(0, len(raw_coords), 2)]
                    d_str = f"M {d_pairs[0]} " + " ".join([f"L {pair}" for pair in d_pairs[1:]])
                    if tag == 'polygon':
                        d_str += " Z"

        if d_str:
            try:
                p = parse_path(d_str)
                if p and p.length() > 0.5:
                    paths.append(p)
            except Exception as pe:
                logger.warning(f"Error al parsear el elemento SVG '{tag}': {pe}")
                continue

    return paths


@nesting_router.post("/nest", response_model=NestResponse)
def run_nest(request: NestRequest) -> NestResponse:
    pieces = [
        Piece(
            id=p.id,
            contour=p.contour,
            quantity=p.quantity,
            allowed_rotations=p.allowed_rotations or [0.0],
        )
        for p in request.pieces
    ]

    result = optimize(
        pieces,
        sheet_width=request.sheet_width_mm,
        spacing=request.spacing_mm,
        population_size=request.population_size,
        generations=request.generations,
    )

    area_sheet = request.sheet_width_mm * result.used_length_mm
    area_used = sum(_polygon_area(pl.contour) for pl in result.placements)
    utilization = (area_used / area_sheet * 100) if area_sheet > 0 else 0.0

    return NestResponse(
        placements=[
            PlacementOut(
                piece_id=pl.piece_id, rotation=pl.rotation, x=pl.x, y=pl.y, contour=pl.contour
            )
            for pl in result.placements
        ],
        unplaced_piece_ids=result.unplaced_piece_ids,
        used_length_mm=result.used_length_mm,
        sheet_width_mm=request.sheet_width_mm,
        utilization_pct=round(utilization, 1),
    )


@nesting_router.post("/nest-svg", response_model=NestSvgResponse)
async def run_nest_svg(
    file: UploadFile = File(...),
    sheet_width_mm: float = Form(1350.0),
    spacing_mm: float = Form(3.0),
    population_size: int = Form(20),
    generations: int = Form(30)
) -> NestSvgResponse:
    content = await file.read()
    svg_string = content.decode("utf-8", errors="ignore")
    
    paths = _parse_svg_string_in_memory(svg_string)
    
    if not paths:
        raise HTTPException(status_code=400, detail="No se encontraron trazados vectoriales procesables en el archivo SVG.")
        
    pieces = []
    original_paths = {}
    
    for idx, path in enumerate(paths):
        if not path or path.length() < 1.0:
            continue
        try:
            xmin, xmax, ymin, ymax = path.bbox()
            if (xmax - xmin) < 1.0 or (ymax - ymin) < 1.0:
                continue
        except Exception:
            continue
            
        subpaths = path.continuous_subpaths()
        if not subpaths:
            continue
            
        for s_idx, sp in enumerate(subpaths):
            if sp.length() < 5.0:
                continue
                
            n = max(20, min(100, int(sp.length() / 3.0)))
            pts = []
            for i in range(n + 1):
                p = sp.point(i / n)
                pts.append((p.real, p.imag))
                
            if len(pts) < 4:
                continue
                
            try:
                poly = Polygon(pts)
                if not poly.is_valid:
                    poly = poly.buffer(0)
                if poly.is_empty or poly.area < 5.0:
                    continue
                poly_simple = poly.simplify(0.5, preserve_topology=True)
                if poly_simple.is_empty or poly_simple.area < 5.0:
                    poly_simple = poly
                    
                if poly_simple.geom_type == 'Polygon':
                    coords = list(poly_simple.exterior.coords)
                elif poly_simple.geom_type == 'MultiPolygon':
                    largest = max(poly_simple.geoms, key=lambda g: g.area)
                    coords = list(largest.exterior.coords)
                else:
                    continue
            except Exception as poly_err:
                logger.warning(f"Omitiendo camino no válido {idx}_{s_idx}: {poly_err}")
                continue
                
            xs = [c[0] for c in coords]
            ys = [c[1] for c in coords]
            min_x, min_y = min(xs), min(ys)
            normalized_contour = [(x - min_x, y - min_y) for x, y in coords]
            
            piece_id = f"piece_{idx}_{s_idx}"
            pieces.append(Piece(
                id=piece_id,
                contour=normalized_contour,
                quantity=1,
                allowed_rotations=[0.0, 90.0, 180.0, 270.0]
            ))
            
            original_paths[piece_id] = path.translated(complex(-min_x, -min_y))
        
    if not pieces:
        raise HTTPException(status_code=400, detail="No se encontraron piezas o curvas cerradas válidas en el SVG.")
        
    # Ejecutar algoritmo genético
    result = optimize(
        pieces,
        sheet_width=sheet_width_mm,
        spacing=spacing_mm,
        population_size=population_size,
        generations=generations,
    )
    
    # Calcular utilización
    area_sheet = sheet_width_mm * result.used_length_mm
    area_used = sum(_polygon_area(pl.contour) for pl in result.placements)
    utilization = (area_used / area_sheet * 100) if area_sheet > 0 else 0.0
    
    # Generar nuevo SVG empaquetado
    svg_w = sheet_width_mm
    svg_h = result.used_length_mm
    svg_h_display = max(150.0, svg_h + 30.0)
    
    # Cabecera del SVG con fondo oscuro para la visualización interactiva
    svg_header = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {svg_w} {svg_h_display}" '
        f'width="100%" height="100%" '
        f'style="background:#0f172a; border-radius:12px; padding:15px; box-sizing:border-box;">\n'
    )
    
    # Dibujar la plancha física
    svg_body = (
        f'  <!-- Plancha Física de Polifan -->\n'
        f'  <rect x="0" y="0" width="{svg_w}" height="{svg_h}" '
        f'fill="rgba(255, 255, 255, 0.03)" stroke="#fbbf24" stroke-width="2" '
        f'stroke-dasharray="6,4" rx="4" />\n'
        f'  <text x="15" y="{svg_h + 20}" fill="#fbbf24" font-family="sans-serif" font-size="12" font-weight="bold">'
        f'Área Útil: {round(svg_w)} x {round(svg_h)} mm ({round(utilization, 1)}% de uso)</text>\n'
    )
    
    # Colocar cada pieza colocada
    for pl in result.placements:
        orig_id = pl.piece_id
        if orig_id not in original_paths:
            continue
        orig_path = original_paths[orig_id]
        
        # Aplicar la rotación del optimizador
        rot_path = orig_path.rotated(pl.rotation, 0)
        
        # Re-centrar después de rotación
        rx_min, _, ry_min, _ = rot_path.bbox()
        local_shifted = rot_path.translated(complex(-rx_min, -ry_min))
        
        # Desplazar a su posición optimizada en la plancha
        placed_path = local_shifted.translated(complex(pl.x, pl.y))
        
        # Convertir a string de trazado d="" de SVG
        d_str = placed_path.d()
        svg_body += (
            f'  <path d="{d_str}" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" '
            f'fill-opacity="0.8" style="transition: all 0.3s;" />\n'
        )
        
    svg_footer = '</svg>'
    nested_svg = svg_header + svg_body + svg_footer
    
    return NestSvgResponse(
        nested_svg=nested_svg,
        used_length_mm=round(result.used_length_mm, 2),
        sheet_width_mm=sheet_width_mm,
        utilization_pct=round(utilization, 1),
        unplaced_count=len(result.unplaced_piece_ids),
        unplaced_piece_ids=result.unplaced_piece_ids
    )


def _polygon_area(points: list[tuple[float, float]]) -> float:
    area = 0.0
    n = len(points)
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0
