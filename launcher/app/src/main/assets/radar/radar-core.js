/*
 * The plane radar's arithmetic, with nothing of the page in it (tested in webos/tests/radar.test.js): the map's
 * projection and tiles, which class a plane is, the two feeds merged, where a plane is now, and what the remote's
 * arrows pick. Loaded after radar-icons.js. ES5. MIT.
 */
(function (root) {
  "use strict";
  var I = root.RadarIcons || (typeof require !== "undefined" ? require("./radar-icons.js") : null);
  var RAD = Math.PI / 180, NM = 1852;

  // ------------------------------------------------------------------ classes
  var KIND = {};
  (function () {
    var order = ["light", "bizjet", "glider", "turboprop", "widebody", "quadjet", "helicopter", "uav", "fastjet"], i, k;
    for (i = 0; i < order.length; i++) {   // later lists win, as in classifyAircraft(): fastjet first there
      var codes = String(I.TYPES[order[i]] || "").split(" ");
      for (k = 0; k < codes.length; k++) if (codes[k]) KIND[codes[k]] = order[i];
    }
  })();
  // ADS-B emitter categories, for a plane whose type nobody knows
  var CATEGORY = { A1: "light", A2: "bizjet", A3: "airliner", A4: "airliner", A5: "widebody", A6: "fastjet", A7: "helicopter",
    B1: "glider", B2: "light", B4: "light", B6: "uav" };
  function classify(type, category) {
    var c = String(type || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (c) return KIND[c] || "airliner";
    return CATEGORY[String(category || "").toUpperCase()] || "airliner";
  }

  // ------------------------------------------------------------------ the map: Web Mercator, as the tiles are
  function mercX(lon) { return (lon + 180) / 360; }
  function mercY(lat) {
    var s = Math.sin(Math.max(-85, Math.min(85, lat)) * RAD);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  }
  /**
   * The view centred on lat0/lon0 that shows rangeNm from the centre to 46 % of the screen's height. It draws tiles
   * of zoom z at `tile` pixels each (181..362: between two zooms the tiles are scaled).
   */
  function view(lat0, lon0, rangeNm, W, H) {
    var mpp = rangeNm * NM / (H * 0.46);                                   // metres per pixel at the centre
    var zf = Math.log(156543.03392 * Math.cos(lat0 * RAD) / mpp) / Math.LN2;
    var z = Math.max(2, Math.min(12, Math.round(zf)));
    var tile = 256 * Math.pow(2, zf - z), world = tile * Math.pow(2, z);
    var cx = mercX(lon0) * world, cy = mercY(lat0) * world;
    var v = { lat: lat0, lon: lon0, range: rangeNm, W: W, H: H, z: z, tile: tile, world: world, cx: cx, cy: cy, pxPerNm: NM / mpp };
    v.project = function (lat, lon) {
      var x = mercX(lon) * world - cx;
      if (x > world / 2) x -= world; else if (x < -world / 2) x += world;   // the short way round the date line
      return [W / 2 + x, H / 2 + mercY(lat) * world - cy];
    };
    return v;
  }
  /** The tiles that cover the screen: {x, y, z, px, py, size}; x wraps, y outside the world is left out. */
  function tiles(v) {
    var n = Math.pow(2, v.z), out = [];
    var x0 = Math.floor((v.cx - v.W / 2) / v.tile), x1 = Math.floor((v.cx + v.W / 2) / v.tile);
    var y0 = Math.floor((v.cy - v.H / 2) / v.tile), y1 = Math.floor((v.cy + v.H / 2) / v.tile);
    for (var y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      for (var x = x0; x <= x1; x++) {
        out.push({ x: ((x % n) + n) % n, y: y, z: v.z, px: v.W / 2 + x * v.tile - v.cx, py: v.H / 2 + y * v.tile - v.cy, size: v.tile });
      }
    }
    return out;
  }
  /** The box of latitude/longitude the screen shows at this range: [latMin, latMax, lonMin, lonMax]. */
  function box(lat0, lon0, rangeNm, W, H) {
    var dLat = rangeNm / 0.92 / 60, dLon = dLat * (W / H) / Math.max(0.2, Math.cos(lat0 * RAD));
    return [lat0 - dLat, lat0 + dLat, lon0 - dLon, lon0 + dLon];
  }

  // ------------------------------------------------------------------ distances
  function distNm(a1, o1, a2, o2) {
    var d = Math.sin((a2 - a1) * RAD / 2), e = Math.sin((o2 - o1) * RAD / 2);
    return 12742 * Math.asin(Math.sqrt(d * d + Math.cos(a1 * RAD) * Math.cos(a2 * RAD) * e * e)) / 1.852;
  }
  function bearing(a1, o1, a2, o2) {
    var y = Math.sin((o2 - o1) * RAD) * Math.cos(a2 * RAD),
        x = Math.cos(a1 * RAD) * Math.sin(a2 * RAD) - Math.sin(a1 * RAD) * Math.cos(a2 * RAD) * Math.cos((o2 - o1) * RAD);
    return (Math.atan2(y, x) / RAD + 360) % 360;
  }
  var POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  function compass(deg) { return POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]; }

  // ------------------------------------------------------------------ the feeds
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function call(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8); }
  /** adsb.lol's aircraft as the radar's records; `t` is when the answer came (s). On the ground: alt 0, ground true. */
  function fromAdsb(list, t) {
    var out = [];
    (list || []).forEach(function (a) {
      if (!a || a.lat == null || a.lon == null || !a.hex) return;
      var g = a.alt_baro === "ground";
      out.push({ hex: String(a.hex).toLowerCase().replace(/[^0-9a-f]/g, ""), flight: call(a.flight), lat: Number(a.lat), lon: Number(a.lon),
        alt: g ? 0 : num(a.alt_baro != null ? a.alt_baro : a.alt_geom), ground: g, gs: num(a.gs), track: num(a.track),
        rate: num(a.baro_rate != null ? a.baro_rate : a.geom_rate), squawk: a.squawk ? String(a.squawk).slice(0, 4) : "",
        reg: a.r ? String(a.r).slice(0, 10) : "", type: a.t ? String(a.t).toUpperCase().slice(0, 4) : "", category: a.category || "",
        at: t - (num(a.seen_pos) || 0), src: "adsb.lol" });
    });
    return out;
  }
  /** OpenSky's state vectors as the radar's records (m -> ft, m/s -> kt and ft/min). */
  function fromOpenSky(states) {
    var out = [];
    (states || []).forEach(function (v) {
      if (!v || !v[0] || v[5] == null || v[6] == null) return;
      var m = v[7] != null ? v[7] : v[13];
      out.push({ hex: String(v[0]).toLowerCase(), flight: call(v[1]), lat: Number(v[6]), lon: Number(v[5]), alt: v[8] ? 0 : m != null ? m * 3.28084 : null,
        ground: !!v[8], gs: v[9] != null ? v[9] * 1.94384 : null, track: num(v[10]), rate: v[11] != null ? v[11] * 196.85 : null,
        squawk: v[14] ? String(v[14]).slice(0, 4) : "", reg: "", type: "", category: "", at: v[3] || v[4] || 0, src: "OpenSky" });
    });
    return out;
  }
  /**
   * One plane per ICAO address: adsb.lol's when it has seen the plane in the last minute (it knows the type and the
   * registration), else whichever feed saw it last. Positions older than maxAge seconds are dropped.
   */
  function merge(adsb, os, t, maxAge) {
    var by = {}, out = [], h;
    (os || []).forEach(function (p) { if (t - p.at <= maxAge) by[p.hex] = p; });
    (adsb || []).forEach(function (p) {
      if (t - p.at > maxAge) return;
      var o = by[p.hex];
      if (!o || t - p.at < 60 || p.at >= o.at) by[p.hex] = p;
    });
    for (h in by) if (by.hasOwnProperty(h)) out.push(by[h]);
    return out;
  }
  /** Where a plane is at time t: flown on from its last position along its track (at most 10 minutes of it). */
  function now(p, t) {
    var age = Math.max(0, Math.min(600, t - (p.at || t)));
    if (p.ground || !p.gs || p.track == null || !age) return [p.lat, p.lon];
    var d = p.gs * age / 3600 / 60;   // nautical miles flown, in degrees of latitude
    return [p.lat + d * Math.cos(p.track * RAD), p.lon + d * Math.sin(p.track * RAD) / Math.max(0.2, Math.cos(p.lat * RAD))];
  }

  // ------------------------------------------------------------------ the remote
  /**
   * The plane the arrows move to. Left and right go round the home like a radar's sweep (by bearing from the home,
   * the nearer first on the same bearing); with nothing picked, right takes the nearest plane and left the farthest.
   * list: [{hex, brg, nm}]. Returns a hex, or "" when there are no planes.
   */
  function pick(list, cur, dir) {
    if (!list || !list.length) return "";
    var i, at = -1;
    if (!cur) {
      var by = list.slice().sort(function (a, b) { return a.nm - b.nm; });
      return (dir > 0 ? by[0] : by[by.length - 1]).hex;
    }
    var ring = list.slice().sort(function (a, b) { return a.brg - b.brg || a.nm - b.nm; });
    for (i = 0; i < ring.length; i++) if (ring[i].hex === cur) at = i;
    if (at < 0) return ring[0].hex;
    return ring[(at + (dir > 0 ? 1 : -1) + ring.length) % ring.length].hex;
  }

  // ------------------------------------------------------------------ words and colours
  function thousands(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function altText(p) {
    if (p.ground) return "on the ground";
    if (p.alt == null) return "";
    return thousands(Math.round(p.alt / 25) * 25) + " ft";
  }
  /** A trail's colour by altitude, low to high: white, yellow, green, cyan, blue, violet, red. */
  var STOPS = [[0, 255, 255, 255], [2000, 255, 228, 77], [8000, 92, 214, 92], [16000, 64, 200, 224], [26000, 70, 120, 255],
    [34000, 168, 96, 240], [42000, 255, 72, 88]];
  function altColor(ft) {
    var a = Math.max(0, Math.min(42000, Number(ft) || 0)), i = 1;
    while (i < STOPS.length - 1 && a > STOPS[i][0]) i++;
    var lo = STOPS[i - 1], hi = STOPS[i], u = (a - lo[0]) / (hi[0] - lo[0] || 1);
    u = Math.max(0, Math.min(1, u));
    return "rgb(" + Math.round(lo[1] + (hi[1] - lo[1]) * u) + "," + Math.round(lo[2] + (hi[2] - lo[2]) * u) + "," + Math.round(lo[3] + (hi[3] - lo[3]) * u) + ")";
  }
  /** An SVG of one class in one colour, for an <img> (the radar turns it into a sprite). */
  function svg(kind, fill, edge) {
    var body = (I.BODIES[kind] || I.BODIES.airliner)
      .replace(/@S/g, 'stroke="' + edge + '" stroke-width="2.6" stroke-linejoin="round"')
      .replace(/@B/g, 'stroke="' + edge + '" stroke-width="3" stroke-linejoin="round"')
      .replace(/fill="white"/g, 'fill="' + fill + '"');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="-48 -48 96 96">' + body + "</svg>";
  }

  var RANGES = [25, 50, 100, 200, 300, 400, 500];
  var STYLES = ["terrain", "dark", "streets", "drawn"];
  /**
   * The pictures of a style: [base tile url, label tile url or "", credit], {z}/{y}/{x} the tile. All from Esri's
   * public tile services, which need no key (CARTO's basemaps now do).
   */
  var ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
  var MAPS = {
    terrain: [ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}", ESRI + "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      "Imagery: Esri, Maxar, Earthstar Geographics · places: Esri, HERE, Garmin, © OpenStreetMap contributors"],
    dark: [ESRI + "Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", ESRI + "Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      "Esri, HERE, Garmin, © OpenStreetMap contributors"],
    streets: [ESRI + "World_Street_Map/MapServer/tile/{z}/{y}/{x}", "", "Esri, HERE, Garmin, © OpenStreetMap contributors"],
    drawn: ["", "", "Land: Natural Earth"]
  };
  function tileUrl(tpl, t) {
    return tpl.replace("{z}", t.z).replace("{x}", t.x).replace("{y}", t.y);
  }

  root.RadarCore = { classify: classify, mercX: mercX, mercY: mercY, view: view, tiles: tiles, box: box, distNm: distNm, bearing: bearing,
    compass: compass, fromAdsb: fromAdsb, fromOpenSky: fromOpenSky, merge: merge, now: now, pick: pick, thousands: thousands,
    altText: altText, altColor: altColor, svg: svg, tileUrl: tileUrl, RANGES: RANGES, STYLES: STYLES, MAPS: MAPS, SCALE: I.SCALE };
  if (typeof module !== "undefined" && module.exports) module.exports = root.RadarCore;
})(typeof window !== "undefined" ? window : this);
