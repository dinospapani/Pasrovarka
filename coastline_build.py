#!/usr/bin/env python3
"""BiteCast - coastline from OpenStreetMap.

Source: OSM land polygons, split, WGS84 (osmdata.openstreetmap.de, land-polygons-split-4326).
Data (c) OpenStreetMap contributors, ODbL 1.0 - attribution is shown in the app (exposure card).

Usage: python3 coastline_build.py <path to land_polygons.shp> <output dir>
Writes (flat files, repo root):
  coastgrid.js      land/sea raster used by exposure.js (same format as before: lon0, lat1, step, w, h, rle)
  coastexp.js       pre-computed effective fetch around Cyprus for the sea-state map layer (seastate.js)
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
    return mask


# ---------- pre-computed exposure for the sea-state map layer (seastate.js) ----------
# Same method as exposure.js: SPM/CERC effective fetch, radials every 6 deg within +-42 deg,
# cos weighting, 200 km cap, ray step 0.25 km, on the raster above. Cells of 0.01 deg (~1 km)
# whose centre is sea and within BAND_KM of land.
EXPO = dict(lon0=32.15, lat1=35.80, lon1=34.70, lat0=34.45, step=0.01, band_km=10.0)
MAXKM, RAD_STEP, HALF, STEP_KM = 200.0, 6, 42, 0.25
RE = 6371.0088


def quant(km):
    """byte: 0..200 -> 0..50 km in 0.25 km; 201..250 -> 53..200 km in 3 km."""
    km = np.clip(km, 0, MAXKM)
    return np.where(km <= 50, np.round(km / 0.25), 200 + np.round((km - 50) / 3)).astype(np.uint8)


def build_exposure(mask, out_dir):
    from scipy.ndimage import distance_transform_edt

    g, e = GRID, EXPO
    gs = g["step"]
    H, W = mask.shape

    def is_land(lat, lon):
        c = np.floor((lon - g["lon0"]) / gs).astype(np.int64)
        r = np.floor((g["lat1"] - lat) / gs).astype(np.int64)
        out = (c < 0) | (r < 0) | (c >= W) | (r >= H)
        v = np.full(lat.shape, -1, dtype=np.int8)
        ok = ~out
        v[ok] = mask[r[ok], c[ok]]
        return v

    ew = int(round((e["lon1"] - e["lon0"]) / e["step"]))
    eh = int(round((e["lat1"] - e["lat0"]) / e["step"]))
    rr, cc = np.mgrid[0:eh, 0:ew]
    clat = e["lat1"] - (rr + 0.5) * e["step"]
    clon = e["lon0"] + (cc + 0.5) * e["step"]

    # distance to nearest land (km) on the fine raster, window around the area + 20 km
    pad = 0.25
    r0 = int((g["lat1"] - (e["lat1"] + pad)) / gs); r1 = int((g["lat1"] - (e["lat0"] - pad)) / gs)
    c0 = int((e["lon0"] - pad - g["lon0"]) / gs); c1 = int((e["lon1"] + pad - g["lon0"]) / gs)
    sub = mask[r0:r1, c0:c1]
    kmy = gs * 111.2
    kmx = gs * 111.2 * np.cos(np.radians((e["lat0"] + e["lat1"]) / 2))
    dist = distance_transform_edt(sub == 0, sampling=(kmy, kmx))
    sr = np.floor((g["lat1"] - clat) / gs).astype(int) - r0
    sc = np.floor((clon - g["lon0"]) / gs).astype(int) - c0
    d = dist[sr, sc]
    keep = (is_land(clat, clon) == 0) & (d <= e["band_km"])
    plat = clat[keep].astype(np.float64)
    plon = clon[keep].astype(np.float64)
    n = plat.size

    la1 = np.radians(plat); lo1 = np.radians(plon)
    sin_la, cos_la = np.sin(la1), np.cos(la1)

    def ray(brg):
        b = np.radians(brg)
        res = np.full(n, MAXKM)
        act = np.arange(n)
        for k in range(1, int(round(MAXKM / STEP_KM)) + 1):
            if act.size == 0:
                break
            dd = k * STEP_KM / RE
            la2 = np.arcsin(sin_la[act] * np.cos(dd) + cos_la[act] * np.sin(dd) * np.cos(b))
            lo2 = lo1[act] + np.arctan2(np.sin(b) * np.sin(dd) * cos_la[act], np.cos(dd) - sin_la[act] * np.sin(la2))
            v = is_land(np.degrees(la2), np.degrees(lo2))
            hit = v == 1
            res[act[hit]] = (k - 1) * STEP_KM
            gone = hit | (v == -1)  # -1: left the raster -> keep MAXKM (as exposure.js)
            act = act[~gone]
        return res

    F = np.zeros((n, 16))
    radials = list(range(-HALF // RAD_STEP, HALF // RAD_STEP + 1))
    w = np.array([np.cos(np.radians(k * RAD_STEP)) for k in radials])
    for i in range(16):
        frm = i * 22.5
        acc = np.zeros(n)
        for wk, k in zip(w, radials):
            acc += wk * ray((frm + k * RAD_STEP) % 360)
        F[:, i] = acc / w.sum()

    stamp = datetime.date.today().isoformat()
    cells = encode_rle(keep.astype(np.uint8))
    fb = base64.b64encode(quant(F).tobytes()).decode("ascii")
    js = (
        "/* Προϋπολογισμένο ενεργό fetch (km) ανά κελί 0,01° (~1 km), 16 κατευθύνσεις ανέμου, έως "
        f"{e['band_km']:g} km από την ακτή της Κύπρου.\n"
        "   Ίδια μέθοδος με το exposure.js (SPM/CERC, ±42°, ανά 6°, ζύγισμα cos, όριο 200 km) πάνω στο coastgrid.js.\n"
        "   Πηγή ακτογραμμής: (c) OpenStreetMap contributors, ODbL 1.0. Φτιάχνεται από το coastline-sync.yml "
        f"({stamp}).\n"
        "   cells: run-length (θάλασσα/κελί με δεδομένα), f: 16 byte ανά κελί με δεδομένα, με τη σειρά των γραμμών.\n"
        "   byte q -> km: q<=200 ? q*0.25 : 50+(q-200)*3 */\n"
        f"window.PSARO_COASTEXP={{src:'osm',built:'{stamp}',lon0:{e['lon0']:g},lat1:{e['lat1']:g},step:{e['step']:g},"
        f"w:{ew},h:{eh},n:{n},cells:'{cells}',f:'{fb}'}};\n"
    )
    with open(f"{out_dir}/coastexp.js", "w") as fh:
        fh.write(js)
    print(f"coastexp.js: {n} cells, {len(js)/1024:.0f} KB")


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
    m = build_grid(sys.argv[1], sys.argv[2])
    build_exposure(m, sys.argv[2])
    build_polygons(sys.argv[1], sys.argv[2])
