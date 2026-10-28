#!/usr/bin/env python3
"""BiteCast - coastline from OpenStreetMap.

Source: OSM land polygons, split, WGS84 (osmdata.openstreetmap.de, land-polygons-split-4326).
Data (c) OpenStreetMap contributors, ODbL 1.0 - attribution is shown in the app (exposure card).

Usage: python3 coastline_build.py <path to land_polygons.shp> <output dir>
Writes (flat files, repo root):
  coastgrid.js      land/sea raster used by exposure.js (same format as before: lon0, lat1, step, w, h, rle)
  coast_cy.geojson  land polygons, Cyprus
  coast_gr.geojson  land polygons, Greece
"""
import base64
import datetime
import json
import sys

import numpy as np
import shapefile  # pyshp
from PIL import Image, ImageDraw
from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

# ---------- raster for exposure.js (fetch rays) ----------
# Same area as the previous Natural Earth grid: Cyprus, Greece, Aegean, Ionian,
# plus the coasts that bound fetch (Turkey, Levant, Albania, Libya/Egypt edge is outside).
GRID = dict(lon0=19.0, lat1=42.0, lon1=36.0, lat0=33.0, step=0.0025)  # ~250 m cells

# ---------- polygons ----------
REGIONS = [
    ("cy", "Cyprus", (32.00, 34.40, 34.80, 35.80), 0.00005),   # ~5 m
    ("gr", "Greece", (19.20, 34.70, 29.80, 41.90), 0.00020),   # ~20 m
]
DECIMALS = 5  # ~1 m


def encode_rle(mask):
    """mask: flat uint8 array, 1 = land. Runs alternate sea, land, sea... starting with sea.
    Each run length is a little-endian base-128 varint (high bit = more bytes). Base64."""
    flat = np.asarray(mask, dtype=np.uint8).ravel()
    n = flat.size
    change = np.flatnonzero(np.diff(flat)) + 1
    edges = np.concatenate(([0], change, [n]))
    runs = np.diff(edges).tolist()
    if flat[0] == 1:  # first run must be sea
        runs.insert(0, 0)
    out = bytearray()
    for v in runs:
        while True:
            b = v & 127
            v >>= 7
            if v:
                out.append(b | 128)
            else:
                out.append(b)
                break
    return base64.b64encode(bytes(out)).decode("ascii")


def rings_of(geom):
    polys = [geom] if geom.geom_type == "Polygon" else [g for g in getattr(geom, "geoms", []) if g.geom_type == "Polygon"]
    for p in polys:
        yield p


def build_grid(shp_path, out_dir):
    g = GRID
    step = g["step"]
    w = int(round((g["lon1"] - g["lon0"]) / step))
    h = int(round((g["lat1"] - g["lat0"]) / step))
    mask = np.zeros((h, w), dtype=np.uint8)

    def px(lon, lat):
        return ((lon - g["lon0"]) / step - 0.5, (g["lat1"] - lat) / step - 0.5)

    sf = shapefile.Reader(shp_path)
    n = 0
    for shp in sf.iterShapes(bbox=[g["lon0"], g["lat0"], g["lon1"], g["lat1"]]):
        geom = shape(shp.__geo_interface__)
        for p in rings_of(geom):
            minx, miny, maxx, maxy = p.bounds
            c0 = max(0, int(np.floor((minx - g["lon0"]) / step)) - 1)
            c1 = min(w, int(np.ceil((maxx - g["lon0"]) / step)) + 1)
            r0 = max(0, int(np.floor((g["lat1"] - maxy) / step)) - 1)
            r1 = min(h, int(np.ceil((g["lat1"] - miny) / step)) + 1)
            if c1 <= c0 or r1 <= r0:
                continue
            # rasterize this polygon (exterior minus its own holes) in its own window, then OR it in
            img = Image.new("L", (c1 - c0, r1 - r0), 0)
            d = ImageDraw.Draw(img)
            ext = [(x - c0, y - r0) for x, y in (px(lo, la) for lo, la in p.exterior.coords)]
            d.polygon(ext, fill=1, outline=1)
            for ring in p.interiors:
                hole = [(x - c0, y - r0) for x, y in (px(lo, la) for lo, la in ring.coords)]
                d.polygon(hole, fill=0, outline=0)
            mask[r0:r1, c0:c1] |= np.asarray(img, dtype=np.uint8)
            n += 1

    rle = encode_rle(mask)
    stamp = datetime.date.today().isoformat()
    js = (
        "/* Raster ξηράς/θάλασσας (Κύπρος, Ελλάδα, Αιγαίο, Ιόνιο, Τουρκία, Λεβάντε) για το exposure.js.\n"
        "   Πηγή: OpenStreetMap land polygons (osmdata.openstreetmap.de), (c) OpenStreetMap contributors, ODbL 1.0.\n"
        f"   Κελί {step}° (~250 m), run-length. Φτιάχνεται αυτόματα από το coastline-sync.yml ({stamp}). */\n"
        f"window.PSARO_COASTGRID={{src:'osm',built:'{stamp}',lon0:{g['lon0']:g},lat1:{g['lat1']:g},step:{step:g},w:{w},h:{h},rle:'{rle}'}};\n"
    )
    with open(f"{out_dir}/coastgrid.js", "w") as f:
        f.write(js)
    print(f"coastgrid.js: {w}x{h} cells, {n} polygons, land {mask.mean():.3f}, {len(js)/1024:.0f} KB")


def rnd(coords):
    if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (int, float)):
        return [round(coords[0], DECIMALS), round(coords[1], DECIMALS)]
    return [rnd(c) for c in coords]


def build_polygons(shp_path, out_dir):
    sf = shapefile.Reader(shp_path)
    stamp = datetime.date.today().isoformat()
    for code, name, bb, tol in REGIONS:
        clip = box(*bb)
        parts = []
        for shp in sf.iterShapes(bbox=list(bb)):
            g = shape(shp.__geo_interface__)
            if not g.is_valid:
                g = g.buffer(0)
            g = g.intersection(clip)
            if not g.is_empty:
                parts.append(g)
        land = unary_union(parts).simplify(tol, preserve_topology=True)
        feats = []
        for p in rings_of(land):
            if p.area < 1e-9:  # drop rocks under ~10 m2 after simplify
                continue
            feats.append({"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": rnd(mapping(p)["coordinates"])}})
        fc = {
            "type": "FeatureCollection",
            "name": f"coast_{code}",
            "metadata": {
                "region": name,
                "bbox": list(bb),
                "kind": "land polygons (sea = outside)",
                "source": "OpenStreetMap land polygons (osmdata.openstreetmap.de)",
                "attribution": "© OpenStreetMap contributors, ODbL 1.0",
                "simplify_deg": tol,
                "built": stamp,
            },
            "features": feats,
        }
        out = f"{out_dir}/coast_{code}.geojson"
        with open(out, "w") as f:
            json.dump(fc, f, separators=(",", ":"))
        print(f"{out}: {len(feats)} polygons")


if __name__ == "__main__":
    build_grid(sys.argv[1], sys.argv[2])
    build_polygons(sys.argv[1], sys.argv[2])
