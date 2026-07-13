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

_nfp_cache: dict[tuple, list[list[Point]]] = {}


def clear_nfp_cache():
    _nfp_cache.clear()


def _reflect(points: list[Point]) -> list[Point]:
    return [(-x, -y) for x, y in points]


def outer_nfp(stationary: list[Point], orbiting: list[Point]) -> list[list[Point]]:
    """NFP of `orbiting` moving around fixed `stationary`."""
    key = (tuple(stationary), tuple(orbiting))
    if key in _nfp_cache:
        return _nfp_cache[key]

    pattern = to_int_path(_reflect(orbiting))
    path = to_int_path(stationary)
    result = pyclipper.MinkowskiSum(pattern, path, True)
    if not result:
        _nfp_cache[key] = []
        return []
    dominant = max(result, key=lambda ring: abs(pyclipper.Area(ring)))
    res = [from_int_path(dominant)]
    _nfp_cache[key] = res
    return res


def inner_fit_region(container: list[Point], piece: list[Point]) -> list[list[Point]]:
    """Valid translation region for `piece` (already at its working rotation)
    to stay fully inside convex `container`."""
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
            regions = pc.Execute(pyclipper.CT_INTERSECTION, pyclipper.PFT_NONZERO)
            if not regions:
                return []

    return [from_int_path(r) for r in (regions or [])]


def subtract_regions(subject_list: list[list[Point]], clip_list: list[list[Point]]) -> list[list[Point]]:
    """`subject_list` minus `clip_list`."""
    if not subject_list:
        return []
    if not clip_list:
        return subject_list

    pc = pyclipper.Pyclipper()
    pc.AddPaths([to_int_path(s) for s in subject_list], pyclipper.PT_SUBJECT, True)
    pc.AddPaths([to_int_path(c) for c in clip_list], pyclipper.PT_CLIP, True)
    out = pc.Execute(pyclipper.CT_DIFFERENCE, pyclipper.PFT_NONZERO)
    return [from_int_path(r) for r in out]


def offset_polygon(points: list[Point], delta: float) -> list[Point]:
    """Grow (delta > 0) or shrink (delta < 0) polygon by `delta` mm."""
    if delta == 0.0:
        return points
    pco = pyclipper.PyclipperOffset()
    pco.AddPath(to_int_path(points), pyclipper.JT_MITER, pyclipper.ET_CLOSEDPOLYGON)
    out = pco.Execute(delta * SCALE)
    if not out:
        return points
    dominant = max(out, key=lambda ring: abs(pyclipper.Area(ring)))
    return from_int_path(dominant)
