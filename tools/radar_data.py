#!/usr/bin/env python3
"""
Build the two data files of the launcher's plane radar (launcher/app/src/main/assets/radar/):

  radar-airports.js  airports with scheduled service and an IATA code, from OurAirports (public domain):
                     window.RadarAirports = "HKT,8.113,98.317,L;KBV,8.099,98.986,M;..."  (L large, M medium)
  radar-land.js      the world's land outlines, from Natural Earth 1:50m (public domain), for the "drawn" map and
                     for when the map tiles can't be read: window.RadarLand = [[minLon,minLat,maxLon,maxLat,[x0,y0,dx,dy,...]],...]
                     in hundredths of a degree, each ring delta-encoded.

Re-run when either source changes:  python3 tools/radar_data.py   (or pass two local files: airports.csv land.geojson)
"""
import csv
import io
import json
import os
import sys
import urllib.request

AIRPORTS = "https://davidmegginson.github.io/ourairports-data/airports.csv"
LAND = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "launcher", "app", "src", "main", "assets", "radar")
STEP = 2   # hundredths of a degree between kept points (about 2 km): finer than a TV pixel at 100 nm


def read(src):
    if os.path.exists(src):
        with open(src, "rb") as fh:
            return fh.read().decode("utf-8")
    req = urllib.request.Request(src, headers={"User-Agent": "OmarchyTV-radar-data"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("utf-8")


def airports(text):
    out = []
    for row in csv.DictReader(io.StringIO(text)):
        kind = {"large_airport": "L", "medium_airport": "M"}.get(row["type"])
        iata = (row.get("iata_code") or "").strip().upper()
        if not kind or len(iata) != 3 or not iata.isalpha() or row.get("scheduled_service") != "yes":
            continue
        out.append((iata, float(row["latitude_deg"]), float(row["longitude_deg"]), kind))
    out.sort()
    return ";".join("%s,%.3f,%.3f,%s" % a for a in out), len(out)


def rings(geo):
    for f in geo["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            yield poly[0]   # the outer ring; lakes inside the land are not drawn


def land(text):
    out, points = [], 0
    for ring in rings(json.loads(text)):
        q, last = [], None
        for lon, lat in ring:
            p = (round(lon * 100), round(lat * 100))
            if last is None or abs(p[0] - last[0]) >= STEP or abs(p[1] - last[1]) >= STEP:
                q.append(p)
                last = p
        if len(q) < 4:
            continue   # an islet smaller than the step
        xs, ys = [p[0] for p in q], [p[1] for p in q]
        flat, prev = [], (0, 0)
        for p in q:
            flat += [p[0] - prev[0], p[1] - prev[1]]
            prev = p
        out.append([min(xs), min(ys), max(xs), max(ys), flat])
        points += len(q)
    return json.dumps(out, separators=(",", ":")), len(out), points


def main():
    a_src = sys.argv[1] if len(sys.argv) > 2 else AIRPORTS
    l_src = sys.argv[2] if len(sys.argv) > 2 else LAND
    os.makedirs(OUT, exist_ok=True)
    a, n = airports(read(a_src))
    with open(os.path.join(OUT, "radar-airports.js"), "w", encoding="utf-8") as fh:
        fh.write("// Airports with scheduled service, from OurAirports (public domain). Built by tools/radar_data.py.\n")
        fh.write('window.RadarAirports = "%s";\n' % a)
    l, rn, pn = land(read(l_src))
    with open(os.path.join(OUT, "radar-land.js"), "w", encoding="utf-8") as fh:
        fh.write("// Land outlines, from Natural Earth 1:50m (public domain). Built by tools/radar_data.py.\n")
        fh.write("window.RadarLand = %s;\n" % l)
    print("airports: %d; land: %d rings, %d points" % (n, rn, pn))


if __name__ == "__main__":
    main()
