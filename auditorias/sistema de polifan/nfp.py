"""No-Fit Polygon / Inner-Fit Polygon computation.

Core idea (standard nesting theory):
  - NFP(stationary, orbiting) = stationary (+) reflect(orbiting), where (+) is
    Minkowski sum. If the orbiting piece's reference point sits strictly
    inside NFP(stationary, orbiting), the two pieces overlap. On the boundary
    they touch (which is what we want for tight packing).
  - IFP(container, piece), i.e. the set of valid reference-point translations
    that keep `piece` fully inside a *convex* `container`, equals the
    intersection over every vertex v of piece of (container translated by -v).
    This holds regardless of whether `piece` itself is convex, and is exact
    for our case since sheets are rectangles.
"""
from __future__ import annotations

import pyclipper

from .geometry import Point, SCALE, to_int_path, from_int_path, translate_points


def _reflect(points: list[Point]) -> list[Point]:
    return [(-x, -y) for x, y in points]


def outer_nfp(stationary: list[Point], orbiting: list[Point]) -> list[list[Point]]:
    """NFP of `orbiting` moving around fixed `stationary`.

    For concave `stationary` pieces, pyclipper's Minkowski sum can return
    secondary loops representing valid "pocket" placements inside a
    concavity (true NFP-with-holes behavior). Combined with the spacing
    offset (offset_polygon), these secondary loops are not reliably
    self-consistent for arbitrary concave inputs -- a mitered offset on a
    reflex vertex can self-intersect and corrupt the hole winding, which
    silently produces an under-sized blocking region and lets pieces overlap.

    Trade-off for v1: keep only the dominant (largest-area) loop as the
    blocking region. This forbids nesting a piece *into* another piece's
    concavity (a modest utilization loss on notched/letter shapes) in
    exchange for a collision guarantee, which matters more for a cutting
    job than a few extra percent of material usage. Revisit if profiling
    shows concave-in-concave nesting is worth the added robustness work.
    """
    pattern = to_int_path(_reflect(orbiting))
    path = to_int_path(stationary)
    result = pyclipper.MinkowskiSum(pattern, path, True)
    if not result:
        return []
    dominant = max(result, key=lambda ring: abs(pyclipper.Area(ring)))
    return [from_int_path(dominant)]


def inner_fit_region(container: list[Point], piece: list[Point]) -> list[list[Point]]:
    """Valid translation region for `piece` (already at its working rotation)
    to stay fully inside convex `container`. Container must be given as a
    simple convex polygon (a rectangle in our use case)."""
    container_int = to_int_path(container)
    regions = None
    pc = pyclipper.Pyclipper()
    for vx, vy in piece:
        shifted = to_int_path(translate_points(container, -vx, -vy))
        if regions is None:
            regions = [shifted]
        else:
            pc.Clear()
            pc.AddPaths(regions, pyclipper.PT_SUBJECT, True)
            pc.AddPath(shifted, pyclipper.PT_CLIP, True)
            regions = pc.Execute(
                pyclipper.CT_INTERSECTION,
                pyclipper.PFT_NONZERO,
                pyclipper.PFT_NONZERO,
            )
            if not regions:
                return []
    return [from_int_path(r) for r in regions]


def subtract_regions(
    minuend: list[list[Point]], subtrahends: list[list[Point]]
) -> list[list[Point]]:
    """minuend - union(subtrahends), all in float mm coordinates."""
    if not subtrahends:
        return minuend
    pc = pyclipper.Pyclipper()
    pc.AddPaths([to_int_path(p) for p in minuend], pyclipper.PT_SUBJECT, True)
    pc.AddPaths([to_int_path(p) for p in subtrahends], pyclipper.PT_CLIP, True)
    result = pc.Execute(pyclipper.CT_DIFFERENCE, pyclipper.PFT_NONZERO, pyclipper.PFT_NONZERO)
    return [from_int_path(r) for r in result]


def offset_polygon(points: list[Point], delta_mm: float) -> list[Point]:
    """Grow a polygon outward by delta_mm (used to add cut spacing between
    pieces without recomputing NFPs at multiple sizes)."""
    if delta_mm == 0:
        return points
    pco = pyclipper.PyclipperOffset()
    pco.AddPath(to_int_path(points), pyclipper.JT_MITER, pyclipper.ET_CLOSEDPOLYGON)
    result = pco.Execute(delta_mm * SCALE)
    return from_int_path(result[0]) if result else points
