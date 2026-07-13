"""FastAPI integration.

Mount with: app.include_router(nesting_router, prefix="/api/nesting")

This module intentionally has no knowledge of where piece contours come
from -- SignageMockup Pro already extracts vector contours during its
VTracer/Real-ESRGAN pipeline; wire that output into `PieceIn.contour` at
the call site rather than duplicating extraction logic here (SRP).
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from .geometry import Piece
from .genetic import optimize

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

    # population_size/generations are exposed directly rather than hidden
    # behind a "quality" enum (FAST/BEST) like the macro in the reel --
    # simpler API surface, caller can still map presets client-side.
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


def _polygon_area(points: list[tuple[float, float]]) -> float:
    area = 0.0
    n = len(points)
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0
