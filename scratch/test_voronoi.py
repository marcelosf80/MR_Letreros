import sys
import os
sys.path.append(r'c:\MR_Letreros\backend')

import numpy as np
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import linemerge
from scipy.spatial import Voronoi as _Vor
from main import LedPosition

scale = 22.0
w, h = 4.0 * scale, 20.0 * scale
stripe = Polygon([(-w/2, -h/2), (w/2, -h/2), (w/2, h/2), (-w/2, h/2)])

mh = 1.2 * scale
mw = 1.2 * scale  # Mini LED is 1.2cm x 1.2cm
spacing = 2.5 * scale  # 2.5cm
min_gap = spacing * 0.85

ext = stripe.exterior
n_ext  = max(80, int(ext.length / (mh * 0.33)))
ts     = np.linspace(0, 1, n_ext, endpoint=False)
pts    = np.array([ext.interpolate(t, normalized=True).coords[0] for t in ts])

vor = _Vor(pts)

lines = []
for ridge in vor.ridge_vertices:
    if -1 in ridge:
        continue
    v1, v2 = vor.vertices[ridge[0]], vor.vertices[ridge[1]]
    seg    = LineString([v1, v2])
    mid = Point((v1[0]+v2[0])*0.5, (v1[1]+v2[1])*0.5)
    
    if stripe.contains(mid) and seg.length >= 0.01:
        lines.append(seg)

merged = linemerge(lines)
lines_to_sample = []
if isinstance(merged, LineString):
    lines_to_sample = [merged]
elif hasattr(merged, 'geoms'):
    lines_to_sample = [g for g in merged.geoms if isinstance(g, LineString)]

filtered_lines = [ln for ln in lines_to_sample if ln.length >= spacing * 0.7]

all_candidates = []
def _sample_polyline(line: LineString) -> list:
    total = line.length
    if total < spacing * 0.5:
        return []
    distances = np.arange(spacing * 0.5, total, spacing)
    if len(distances) == 0:
        distances = np.array([total * 0.5])

    pts_out = []
    for d in distances:
        pt = line.interpolate(d)
        d0  = max(0.0, d - spacing * 0.05)
        d1  = min(total, d + spacing * 0.05)
        p0  = line.interpolate(d0)
        p1  = line.interpolate(d1)
        ang = np.degrees(np.arctan2(p1.y - p0.y, p1.x - p0.x))
        pts_out.append((pt.x, pt.y, ang))
    return pts_out

for ln in filtered_lines:
    all_candidates.extend(_sample_polyline(ln))

def _global_min_dist_filter(candidates: list, min_d: float) -> list:
    if not candidates:
        return []
    from scipy.spatial import cKDTree
    pts    = np.array([(x, y) for x, y, _ in candidates])
    kept   = []
    used   = np.zeros(len(pts), dtype=bool)
    tree = cKDTree(pts)
    for i in range(len(pts)):
        if used[i]:
            continue
        kept.append(candidates[i])
        idxs = tree.query_ball_point(pts[i], min_d)
        for j in idxs:
            used[j] = True
    return kept

import shapely
def _overlap_filter(candidates: list, poly: Polygon) -> list:
    if not candidates:
        return []
    result = []
    for (x, y, ang), _ in zip(candidates, candidates):
        from shapely.affinity import rotate
        box = shapely.box(x - mw*0.5, y - mh*0.5, x + mw*0.5, y + mh*0.5)
        oriented_box = rotate(box, ang, origin=(x, y))
        area = float(shapely.area(shapely.intersection(poly, oriented_box)))
        if area >= mw * mh * 0.35:
            result.append(LedPosition(x=float(x), y=float(y), angle=float(ang)))
    return result

filtered = _global_min_dist_filter(all_candidates, min_gap)
final_leds = _overlap_filter(filtered, stripe)
print(f"Final LEDs placed: {len(final_leds)}")
for i, led in enumerate(final_leds):
    print(f"  LED #{i+1}: x={led.x:.2f}, y={led.y:.2f}, angle={led.angle:.2f}")
