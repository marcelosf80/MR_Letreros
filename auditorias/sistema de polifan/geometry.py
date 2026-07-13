"""Polygon primitives shared by the nesting engine.

pyclipper operates on 64-bit integer coordinates. All geometry entering the
NFP/IFP routines is scaled up by SCALE and rounded; results are scaled back
down when handed to callers. Keep SCALE high enough to preserve sub-mm
precision for typical sign dimensions (hundreds of mm).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

SCALE = 1000  # 1 unit = 1 mm -> 0.001mm resolution after int rounding

Point = tuple[float, float]


def to_int_path(points: list[Point]) -> list[tuple[int, int]]:
    return [(round(x * SCALE), round(y * SCALE)) for x, y in points]


def from_int_path(points) -> list[Point]:
    return [(x / SCALE, y / SCALE) for x, y in points]


def rotate_points(points: list[Point], degrees: float) -> list[Point]:
    theta = math.radians(degrees)
    cos_t, sin_t = math.cos(theta), math.sin(theta)
    return [(x * cos_t - y * sin_t, x * sin_t + y * cos_t) for x, y in points]


def translate_points(points: list[Point], dx: float, dy: float) -> list[Point]:
    return [(x + dx, y + dy) for x, y in points]


def bounding_box(points: list[Point]) -> tuple[float, float, float, float]:
    """Returns (min_x, min_y, max_x, max_y)."""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def polygon_area(points: list[Point]) -> float:
    """Shoelace formula; sign indicates winding direction."""
    area = 0.0
    n = len(points)
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return area / 2.0


@dataclass
class Piece:
    """A single nestable shape.

    `contour` is the outer boundary only (v1 ignores internal holes for
    collision purposes -- see README trade-offs). `quantity` lets the same
    shape be requested multiple times without duplicating geometry.
    """

    id: str
    contour: list[Point]
    quantity: int = 1
    allowed_rotations: list[float] = field(default_factory=lambda: [0.0])

    def oriented(self, degrees: float) -> list[Point]:
        pts = rotate_points(self.contour, degrees)
        min_x, min_y, _, _ = bounding_box(pts)
        return translate_points(pts, -min_x, -min_y)  # normalize to origin
