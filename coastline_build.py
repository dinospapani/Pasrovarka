#!/usr/bin/env python3
"""BiteCast - build coastline (land polygons) for Cyprus and Greece from OpenStreetMap.

Source: OSM land polygons, split, WGS84 (osmdata.openstreetmap.de, land-polygons-split-4326).
Data (c) OpenStreetMap contributors, ODbL 1.0 - attribution must be shown in the app.

Usage: python3 coastline_build.py <path to land_polygons.shp> <output dir>
Writes coast_cy.geojson and coast_gr.geojson (flat files, repo root).
"""
import json
import sys
import datetime

import shapefile  # pyshp
from shapely.geometry import shape, box, mapping
from shapely.ops import unary_union

# name, bbox (min lon, min lat, max lon, max lat), simplify tolerance in degrees
REGIONS = [
    ("cy", "Cyprus", (32.00, 34.40, 34.80, 35.80), 0.00005),   # ~5 m
    ("gr", "Greece", (19.20, 34.70, 29.80, 41.90), 0.00020),   # ~20 m
]
DECIMALS = 5  # ~1 m


def rnd(coords):
    if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (int, float)):
        return [round(coords[0], DECIMALS), round(coords[1], DECIMALS)]
    return [rnd(c) for c in coords]


def build(shp_path, out_dir):
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
        polys = [land] if land.geom_type == "Polygon" else [p for p in getattr(land, "geoms", []) if p.geom_type == "Polygon"]
        feats = []
        for p in polys:
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
    build(sys.argv[1], sys.argv[2])
