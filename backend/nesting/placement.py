"""Bottom-left-fill placement for a single sheet, given a piece order.

This is the deterministic "inner loop": place pieces one at a time into the
first (lowest, then left-most) feasible slot. The genetic optimizer in
genetic.py searches over orderings/rotations that feed this function --
placement.py itself does no searching, which keeps it easy to unit test in
isolation.
"""
from __future__ import annotations

from dataclasses import dataclass

from .geometry import Piece, Point, bounding_box, translate_points
from .nfp import inner_fit_region, outer_nfp, subtract_regions, offset_polygon


@dataclass
class Placement:
    piece_id: str
    rotation: float
    x: float
    y: float
    contour: list[Point]  # final, rotated + translated outline


def _region_candidate_points(regions: list[list[Point]]) -> list[Point]:
    """Optimal touching placements always land on a vertex of the feasible
    region (standard NFP result), so vertices are the only candidates worth
    scoring -- no need to scan a grid."""
    pts = []
    for region in regions:
        pts.extend(region)
    return pts


def _bottom_left_score(p: Point) -> tuple[float, float]:
    return (p[1], p[0])  # minimize y first, then x


def place_on_sheet(
    pieces_in_order: list[tuple[Piece, float]],  # (piece, chosen rotation)
    sheet_width: float,
    spacing: float,
    sheet_height_cap: float | None = None,
) -> tuple[list[Placement], list[str]]:
    """Places pieces greedily. Returns (placements, unplaced_piece_ids).

    Sheet is treated as open-ended in Y (a roll/large panel); sheet_height_cap
    optionally bounds it for fixed-size plates.
    """
    height_cap = sheet_height_cap if sheet_height_cap is not None else 10 ** 7
    container = [(0, 0), (sheet_width, 0), (sheet_width, height_cap), (0, height_cap)]

    placed_contours: list[list[Point]] = []
    placements: list[Placement] = []
    unplaced: list[str] = []

    for piece, rotation in pieces_in_order:
        try:
            oriented = piece.oriented(rotation)
            oriented = offset_polygon(oriented, spacing / 2.0)

            ifp = inner_fit_region(container, oriented)
            if not ifp:
                unplaced.append(piece.id)
                continue

            blocking = []
            for existing in placed_contours:
                blocking.extend(outer_nfp(existing, oriented))

            feasible = subtract_regions(ifp, blocking)
            if not feasible:
                unplaced.append(piece.id)
                continue

            candidates = _region_candidate_points(feasible)
            if not candidates:
                unplaced.append(piece.id)
                continue
                
            best = min(candidates, key=_bottom_left_score)

            final_contour = translate_points(oriented, best[0], best[1])
            placed_contours.append(final_contour)
            placements.append(
                Placement(piece_id=piece.id, rotation=rotation, x=best[0], y=best[1], contour=final_contour)
            )
        except Exception as piece_err:
            unplaced.append(piece.id)
            continue

    return placements, unplaced


def used_length(placements: list[Placement]) -> float:
    """Length (Y extent) of material consumed -- the quantity the genetic
    optimizer tries to minimize for a fixed sheet width."""
    if not placements:
        return 0.0
    max_y = 0.0
    for pl in placements:
        _, _, _, y_max = bounding_box(pl.contour)
        max_y = max(max_y, y_max)
    return max_y
