import sys
import os
sys.path.append(r'c:\MR_Letreros\backend')

import numpy as np
from shapely.geometry import Polygon
from main import _centerline_leds, LedRequest, _prune_skeleton

def _break_triangles(coords: set) -> set:
    coords = set(coords)
    for _ in range(3):  # Maximo 3 pasadas
        to_remove = set()
        for p in coords:
            px, py = p
            nbrs = [(px+dx, py+dy) for dx in (-1,0,1) for dy in (-1,0,1)
                    if (dx,dy) != (0,0) and (px+dx, py+dy) in coords]
            nbrs = [n for n in nbrs if n not in to_remove]
            found = False
            n_len = len(nbrs)
            for i in range(n_len):
                for j in range(i + 1, n_len):
                    n1 = nbrs[i]
                    n2 = nbrs[j]
                    if abs(n1[0]-n2[0]) <= 1 and abs(n1[1]-n2[1]) <= 1:
                        to_remove.add(p)
                        found = True
                        break
                if found:
                    break
        if not to_remove:
            break
        coords -= to_remove
    return coords

# Create a true "C" outline
outer_pts = [(20 * np.cos(a), 10 * np.sin(a)) for a in np.linspace(0.2, 2*np.pi - 0.2, 50)]
inner_pts = [(14 * np.cos(a), 7 * np.sin(a)) for a in np.linspace(2*np.pi - 0.2, 0.2, 50)]
c_shape = Polygon(outer_pts + inner_pts)

SCALE = 4.0
minx, miny, maxx, maxy = c_shape.bounds
W = max(4, int((maxx - minx) * SCALE) + 4)
H = max(4, int((maxy - miny) * SCALE) + 4)

from PIL import Image, ImageDraw
img = Image.new('L', (W, H), 0)
draw = ImageDraw.Draw(img)

def _draw_poly(poly, draw):
    ext = [(int((x - minx)*SCALE + 2), int((y - miny)*SCALE + 2)) for x, y in poly.exterior.coords]
    draw.polygon(ext, fill=255)
    for ring in poly.interiors:
        hole = [(int((x - minx)*SCALE + 2), int((y - miny)*SCALE + 2)) for x, y in ring.coords]
        draw.polygon(hole, fill=0)

_draw_poly(c_shape, draw)

from skimage.morphology import skeletonize
binary = np.array(img) > 127
skel = skeletonize(binary)

ys, xs = np.where(skel)
px_set = set(zip(xs.tolist(), ys.tolist()))

def get_degree_stats(coords):
    def get_nbrs(p):
        px, py = p
        return {(px+dx, py+dy) for dx in (-1,0,1) for dy in (-1,0,1)
                if (dx,dy) != (0,0) and (px+dx, py+dy) in coords}
    degrees = {p: len(get_nbrs(p)) for p in coords}
    endpoints = [p for p, d in degrees.items() if d == 1]
    junctions = [p for p, d in degrees.items() if d > 2]
    return len(endpoints), len(junctions)

eps, juncs = get_degree_stats(px_set)
print(f"Before Pruning: Endpoints={eps}, Junctions={juncs}")

# Apply Triangle Breaking
no_triangles = _break_triangles(px_set)
eps_t, juncs_t = get_degree_stats(no_triangles)
print(f"After Triangle Breaking: Endpoints={eps_t}, Junctions={juncs_t}")

# Run pruning
spacing = 8.5
pruned = _prune_skeleton(no_triangles.copy(), spacing * SCALE)
eps_p, juncs_p = get_degree_stats(pruned)
print(f"After Pruning: Endpoints={eps_p}, Junctions={juncs_p}, Remaining pixels={len(pruned)}")
