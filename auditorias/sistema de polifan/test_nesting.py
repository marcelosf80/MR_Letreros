import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest
from shapely.geometry import Polygon as ShapelyPolygon

from nesting_engine.geometry import Piece, rotate_points, bounding_box
from nesting_engine.nfp import inner_fit_region, outer_nfp
from nesting_engine.placement import place_on_sheet
from nesting_engine.genetic import optimize

SQUARE = [(0, 0), (10, 0), (10, 10), (0, 10)]
L_SHAPE = [(0, 0), (60, 0), (60, 20), (20, 20), (20, 80), (0, 80)]


def test_rotate_points_preserves_area():
    original_area = ShapelyPolygon(SQUARE).area
    rotated = rotate_points(SQUARE, 37)
    assert ShapelyPolygon(rotated).area == pytest.approx(original_area, rel=1e-6)


def test_inner_fit_region_rejects_piece_larger_than_container():
    container = [(0, 0), (5, 0), (5, 5), (0, 5)]
    ifp = inner_fit_region(container, SQUARE)
    assert ifp == []


def test_inner_fit_region_allows_expected_translation_range():
    container = [(0, 0), (100, 0), (100, 100), (0, 100)]
    ifp = inner_fit_region(container, SQUARE)
    assert len(ifp) == 1
    min_x, min_y, max_x, max_y = bounding_box(ifp[0])
    assert min_x == pytest.approx(0, abs=1e-6)
    assert max_x == pytest.approx(90, abs=1e-6)  # 100 - piece width(10)
    assert max_y == pytest.approx(90, abs=1e-6)


def test_outer_nfp_two_squares_no_overlap_at_zero_offset():
    """Squares placed with their reference points coincident (offset=(0,0))
    must be flagged as overlapping, i.e. (0,0) is inside/on the NFP."""
    nfp_regions = outer_nfp(SQUARE, SQUARE)
    poly = ShapelyPolygon(nfp_regions[0])
    from shapely.geometry import Point as ShapelyPoint

    assert poly.contains(ShapelyPoint(0, 0)) or poly.boundary.distance(ShapelyPoint(0, 0)) < 1e-6


def test_place_on_sheet_no_overlaps_for_simple_squares():
    pieces = [(Piece(id=f"sq{i}", contour=SQUARE), 0.0) for i in range(6)]
    placements, unplaced = place_on_sheet(pieces, sheet_width=25, spacing=1)
    assert unplaced == []
    assert len(placements) == 6

    polys = [ShapelyPolygon(p.contour).buffer(0) for p in placements]
    for i in range(len(polys)):
        for j in range(i + 1, len(polys)):
            assert polys[i].intersection(polys[j]).area < 1e-3


def test_place_on_sheet_reports_unplaceable_piece():
    huge = [(0, 0), (1000, 0), (1000, 1000), (0, 1000)]
    pieces = [(Piece(id="too_big", contour=huge), 0.0)]
    placements, unplaced = place_on_sheet(pieces, sheet_width=50, spacing=0)
    assert placements == []
    assert unplaced == ["too_big"]


def test_optimize_end_to_end_places_all_pieces_without_overlap():
    pieces = [
        Piece(id="L", contour=L_SHAPE, quantity=3, allowed_rotations=[0, 90, 180, 270]),
        Piece(id="SQ", contour=SQUARE, quantity=5, allowed_rotations=[0]),
    ]
    result = optimize(pieces, sheet_width=150, spacing=2, population_size=10, generations=8, seed=1)

    assert result.unplaced_piece_ids == []
    assert len(result.placements) == 8

    polys = [ShapelyPolygon(p.contour).buffer(0) for p in result.placements]
    for i in range(len(polys)):
        for j in range(i + 1, len(polys)):
            assert polys[i].intersection(polys[j]).area < 1e-3


def test_optimize_is_deterministic_given_seed():
    pieces = [Piece(id="SQ", contour=SQUARE, quantity=4, allowed_rotations=[0])]
    r1 = optimize(pieces, sheet_width=30, spacing=1, population_size=8, generations=5, seed=7)
    r2 = optimize(pieces, sheet_width=30, spacing=1, population_size=8, generations=5, seed=7)
    assert r1.used_length_mm == pytest.approx(r2.used_length_mm)
