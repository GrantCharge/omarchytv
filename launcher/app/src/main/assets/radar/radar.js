/*
 * The plane radar's page: the map (tiles, or the drawn land), the airports, the planes where they are now, the one
 * you picked with its trail and its card. The arithmetic is radar-core.js; the feeds are the saver's (adsb.lol,
 * OpenSky when screensaver.opensky is on, adsbdb for the route, the type and the photo), read through the launcher.
 * Settings come from the host (OmarchyRadar.config()) or, on a desk, from #cfg=<json>. ES5. MIT.
 */
(function (root) {
  "use strict";
  var C = root.RadarCore, P = root.OmarchyPulseTV, host = root.OmarchyRadar || null, doc = root.document;
  function $(id) { return doc.getElementById(id); }
  function log(m) { try { if (host && host.log) host.log("radar: " + m); else if (root.console) root.console.log("radar: " + m); } catch (e) {} }
  function readCfg() {
    var c = {}, k;
    try { if (host && host.config) c = JSON.parse(host.config()) || {}; } catch (e) { log("cfg " + e); }
    try {
      var h = /[#&]cfg=([^&]+)/.exec(root.location.hash || "");
      if (h) { var j = JSON.parse(decodeURIComponent(h[1])); for (k in j) if (j.hasOwnProperty(k)) c[k] = j[k]; }
    } catch (e2) { log("hash " + e2); }
    return c;
  }
  var cfg = readCfg();
  var lat0 = Number(cfg.lat), lon0 = Number(cfg.lon), hasLoc = isFinite(lat0) && isFinite(lon0) && !(lat0 === 0 && lon0 === 0);
  function saved(k, d) { try { var v = root.localStorage.getItem("radar." + k); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { root.localStorage.setItem("radar." + k, String(v)); } catch (e) {} }

  // The box on Home (RadarWidget): no remote, no card; the range is the config's, the marks are drawn bigger.
  var widget = !!cfg.widget;
  if (widget) doc.documentElement.className = "widget";
  // The screensaver (TteSaver, screensaver.art "radar"): the full map and the remote (arrows and OK; Back closes it),
  // its map and range from the saver settings, a plane's card in turn (cfg.tour) and the hints unless cfg.hints is false.
  var saver = !widget && !!cfg.saver, saverHost = root.OmarchySaver || null;
  var tour = saver && cfg.tour !== false, tourHold = 0;
  if (saver) doc.documentElement.className = "saver" + (cfg.hints === false ? " nohints" : "");
  var rangeI = C.RANGES.indexOf(Number(widget || saver ? cfg.range || 200 : saved("range", cfg.range || 200)));
  if (rangeI < 0) rangeI = C.RANGES.length - 1;
  var style = saver ? cfg.map || "terrain" : saved("map", cfg.map || "terrain");
  if (C.STYLES.indexOf(style) < 0) style = "terrain";

  // what the styles look like under and over the pictures
  var LOOK = {
    terrain: { sea: "#2d5560", land: "#3c5a45", dim: "#2d5560", ring: "rgba(255,255,255,", halo: "rgba(0,0,0,0.8)" },
    dark: { sea: "#0e1418", land: "#262b2f", dim: "", ring: "rgba(255,255,255,", halo: "rgba(0,0,0,0.85)" },
    streets: { sea: "#aad3df", land: "#f3efe6", dim: "", ring: "rgba(40,50,60,", halo: "rgba(0,0,0,0.8)" },
    drawn: { sea: "#1d3640", land: "#3f6349", dim: "", ring: "rgba(255,255,255,", halo: "rgba(0,0,0,0.8)" }
  };
  var YELLOW = "#f8d21c", YELLOW_EDGE = "#2b2500", RED = "#ff4438", RED_EDGE = "#3a0600";

  var cv = $("map"), g = cv.getContext("2d"), mapC = doc.createElement("canvas"), mg = mapC.getContext("2d");
  var W = 0, H = 0, U = 0, dpr = 1, V = null, mapDirty = true;
  function resize() {
    W = root.innerWidth || 1280; H = root.innerHeight || 720;
    U = widget ? H * 1.45 : H;   // the unit sizes are drawn in: the box is small, its marks stay readable
    dpr = Math.max(1, Math.min(2, root.devicePixelRatio || 1));
    cv.width = mapC.width = Math.round(W * dpr); cv.height = mapC.height = Math.round(H * dpr);
    V = hasLoc ? C.view(lat0, lon0, C.RANGES[rangeI], W, H) : null;
    mapDirty = true;
  }

  // ------------------------------------------------------------------ the pictures of the map
  var imgs = {}, imgN = 0;
  function tileImg(url) {
    var e = imgs[url];
    if (e) return e;
    if (imgN > 400) { imgs = {}; imgN = 0; }   // a long evening of zooming: start the cache again
    e = imgs[url] = { img: new root.Image(), ok: false, bad: false };
    imgN++;
    e.img.onload = function () { e.ok = true; mapDirty = true; };
    e.img.onerror = function () { e.bad = true; };
    e.img.src = url;
    return e;
  }
  // the land, decoded once: [{b: [minLon, minLat, maxLon, maxLat], p: [lon, lat, ...]}] in degrees
  var land = (root.RadarLand || []).map(function (r) {
    var d = r[4], p = new Array(d.length), x = 0, y = 0, i;
    for (i = 0; i < d.length; i += 2) { x += d[i]; y += d[i + 1]; p[i] = x / 100; p[i + 1] = y / 100; }
    return { b: [r[0] / 100, r[1] / 100, r[2] / 100, r[3] / 100], p: p };
  });
  var airports = String(root.RadarAirports || "").split(";").map(function (s) {
    var a = s.split(",");
    return { iata: a[0], lat: Number(a[1]), lon: Number(a[2]), big: a[3] === "L" };
  }).filter(function (a) { return a.iata && hasLoc && Math.abs(a.lat - lat0) < 9 && Math.abs(a.lon - lon0) < 16; });

  function drawLand(c, look) {
    var b = C.box(lat0, lon0, V.range, W, H), i, k;
    c.fillStyle = look.land;
    for (i = 0; i < land.length; i++) {
      var r = land[i];
      if (r.b[2] < b[2] - 1 || r.b[0] > b[3] + 1 || r.b[3] < b[0] - 1 || r.b[1] > b[1] + 1) continue;
      c.beginPath();
      for (k = 0; k < r.p.length; k += 2) {
        var q = V.project(r.p[k + 1], r.p[k]);
        if (k) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]);
      }
      c.closePath(); c.fill();
    }
  }
  function drawTiles(c, tpl, ts) {
    var all = true;
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i], e = tileImg(C.tileUrl(tpl, t));
      if (!e.ok) { all = false; continue; }
      var x = Math.floor(t.px), y = Math.floor(t.py);
      c.drawImage(e.img, x, y, Math.ceil(t.px + t.size) - x, Math.ceil(t.py + t.size) - y);
    }
    return all;
  }
  function halo(c, text, x, y, fill, haloCol, w) {
    c.lineJoin = "round"; c.lineWidth = w || 3; c.strokeStyle = haloCol; c.strokeText(text, x, y);
    c.fillStyle = fill; c.fillText(text, x, y);
  }
  function drawPin(c, x, y, r) {   // an airport: a blue drop with a white rim and a white dot
    c.beginPath();
    c.arc(x, y - r * 1.9, r, Math.PI * 0.85, Math.PI * 0.15, false);
    c.lineTo(x, y); c.closePath();
    c.fillStyle = "#2f80d3"; c.fill();
    c.lineWidth = Math.max(1, r * 0.22); c.strokeStyle = "#fff"; c.stroke();
    c.beginPath(); c.arc(x, y - r * 1.9, r * 0.36, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill();
  }
  function drawMap() {
    var c = mg, look = LOOK[style], m = C.MAPS[style], ts = C.tiles(V), i;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    var whole = false;
    if (m[0]) whole = drawTiles(c, m[0], ts);
    if (!whole) {   // no pictures (yet): the drawn land under whatever has arrived
      c.globalCompositeOperation = "destination-over";
      drawLand(c, look);
      c.fillStyle = look.sea; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "source-over";
    }
    if (look.dim && m[0]) {   // the dark sea of the satellite pictures lifted to a blue-green; the land keeps its greens
      c.globalCompositeOperation = "lighten"; c.fillStyle = look.dim; c.fillRect(0, 0, W, H); c.globalCompositeOperation = "source-over";
    }
    if (m[1]) drawTiles(c, m[1], ts);
    // the rings: every quarter of the range, the outer one stronger
    var steps = 4, home = V.project(lat0, lon0);
    c.font = "500 " + Math.round(U * 0.0185) + "px Roboto, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    for (i = 1; i <= steps; i++) {
      var nm = V.range * i / steps, rad = nm * V.pxPerNm;
      c.beginPath(); c.arc(home[0], home[1], rad, 0, Math.PI * 2);
      c.strokeStyle = look.ring + (i === steps ? "0.5)" : "0.2)"); c.lineWidth = i === steps ? 1.6 : 1;
      c.setLineDash(i === steps ? [] : [5, 7]); c.stroke();
      halo(c, nm + " nm", home[0], home[1] - rad, look.ring + "0.9)", style === "streets" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.6)", 3);
    }
    c.setLineDash([]);
    // the airports, the big ones named first
    var boxes = [], pr = U * 0.0125;
    c.font = "700 " + Math.round(U * 0.019) + "px Roboto, sans-serif"; c.textBaseline = "top";
    airports.slice().sort(function (a, b) { return (b.big ? 1 : 0) - (a.big ? 1 : 0); }).forEach(function (a) {
      var q = V.project(a.lat, a.lon);
      if (q[0] < -20 || q[0] > W + 20 || q[1] < -20 || q[1] > H + 40) return;
      drawPin(c, q[0], q[1], a.big ? pr : pr * 0.8);
      var tw = c.measureText(a.iata).width, bx = [q[0] - tw / 2 - 2, q[1] + 2, tw + 4, U * 0.024];
      for (var k = 0; k < boxes.length; k++) if (over(bx, boxes[k])) return;
      boxes.push(bx);
      halo(c, a.iata, q[0], q[1] + 3, "#fff", "rgba(0,0,0,0.75)", 3);
    });
    // the home
    c.beginPath(); c.arc(home[0], home[1], U * 0.008, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill();
    c.lineWidth = 2; c.strokeStyle = "#2f80d3"; c.stroke();
    $("credit").textContent = m[2];
    mapDirty = false;
  }
  function over(a, b) { return a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3]; }

  // ------------------------------------------------------------------ the aircraft sprites
  var sprites = {};
  function sprite(kind, fill, edge) {
    var key = kind + fill, s = sprites[key];
    if (s) return s.ok ? s.c : null;
    s = sprites[key] = { ok: false, c: doc.createElement("canvas") };
    var img = new root.Image();
    img.onload = function () {
      s.c.width = s.c.height = 128;
      s.c.getContext("2d").drawImage(img, 0, 0, 128, 128);
      s.ok = true;
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(C.svg(kind, fill, edge));
    return null;
  }

  // ------------------------------------------------------------------ the planes
  var planes = {}, list = [], sel = "", trails = {}, info = {}, routes = {}, lookQ = [], adsb = [], adsbAt = 0, os = [], osAt = 0;
  var osEvery = cfg.openskyAuth ? (widget ? 120 : 60) : 480;   // the box is on screen for hours: half the reads
  var types = {};
  try { types = JSON.parse(saved("types", "{}")) || {}; } catch (e) { types = {}; }
  function nowS() { return Date.now() / 1000; }
  function net(url) {
    return new root.Promise(function (ok, no) {
      var x = new root.XMLHttpRequest();
      x.open("GET", cfg.proxy ? cfg.proxy + encodeURIComponent(url) : url, true);
      x.timeout = 25000;
      x.onload = function () {
        if (x.status < 200 || x.status >= 300) { no(new Error("HTTP " + x.status)); return; }
        try { ok(JSON.parse(x.responseText)); } catch (e) { no(e); }
      };
      x.onerror = x.ontimeout = function () { no(new Error("network")); };
      x.send();
    });
  }
  function quiet(p) { return p.then(null, function () { return null; }); }

  function rebuild() {
    var t = nowS();
    var fresh = C.merge(adsb.filter(function (p) { return t - p.at <= 90; }), os, t, osEvery + 120);
    var seen = {}, next = [];
    fresh.forEach(function (r) {
      var here = C.now(r, t), nm = C.distNm(lat0, lon0, here[0], here[1]);
      if (nm > 420) return;
      var p = planes[r.hex] || (planes[r.hex] = { hex: r.hex, la: here[0], lo: here[1] });
      for (var k in r) if (r.hasOwnProperty(k)) p[k] = r[k];
      if (!p.type && types[r.hex]) p.type = types[r.hex];
      p.kind = C.classify(p.type, p.category);
      p.name = p.flight || p.reg || r.hex.toUpperCase();
      seen[r.hex] = 1; next.push(p);
      var tr = trails[r.hex] || (trails[r.hex] = []), last = tr[tr.length - 1];
      if (!last || r.at - last[3] >= 5) { tr.push([r.lat, r.lon, r.alt || 0, r.at]); if (tr.length > 240) tr.shift(); }
      if (!p.type && !(r.hex in info) && lookQ.indexOf(r.hex) < 0) lookQ.push(r.hex);
    });
    for (var h in planes) if (!seen[h]) { delete planes[h]; delete trails[h]; }
    list = next;
    if (sel && !planes[sel]) select("");
  }
  function pollAdsb() {
    if (!hasLoc) return;
    quiet(net("https://api.adsb.lol/v2/lat/" + lat0.toFixed(4) + "/lon/" + lon0.toFixed(4) + "/dist/250")).then(function (j) {
      if (j) { adsb = C.fromAdsb(j.ac || j.aircraft || [], nowS()); adsbAt = nowS(); }
      rebuild();
    });
  }
  function pollOs() {
    if (!hasLoc || !cfg.opensky) return;
    var b = C.box(lat0, lon0, 200, Math.max(W, 1280), Math.max(H, 720));
    quiet(net("https://opensky-network.org/api/states/all?lamin=" + b[0].toFixed(2) + "&lamax=" + b[1].toFixed(2) +
      "&lomin=" + b[2].toFixed(2) + "&lomax=" + b[3].toFixed(2))).then(function (j) {
      if (j && j.states) { os = C.fromOpenSky(j.states); osAt = nowS(); rebuild(); }
    });
  }
  // adsbdb: the picked plane first (its route too), then the type of a plane no feed names
  function lookup() {
    var p = sel ? planes[sel] : null, hex = "", cs = "", h;
    if (p && !(sel in info)) { hex = sel; cs = p.flight && !(p.flight in routes) ? p.flight : ""; }
    else if (p && p.flight && !(p.flight in routes)) cs = p.flight;   // adsbdb did not know the aircraft: the route alone
    else { while (lookQ.length && !hex) { h = lookQ.shift(); if (planes[h] && !(h in info)) hex = h; } }
    if (!hex && !cs) return;
    var both = hex && cs;
    if (hex) info[hex] = null;
    if (cs && !hex) routes[cs] = null;
    var url = hex ? "https://api.adsbdb.com/v0/aircraft/" + encodeURIComponent(hex) + (cs ? "?callsign=" + encodeURIComponent(cs) : "")
      : "https://api.adsbdb.com/v0/callsign/" + encodeURIComponent(cs);
    quiet(net(url)).then(function (j) {
      var r = j && j.response, a = r && r.aircraft, f = r && r.flightroute;
      if (hex) {
        if (a) {
          info[hex] = { type: a.icao_type || "", full: ((a.manufacturer || "") + " " + (a.type || "")).replace(/\s+/g, " ").trim(), owner: a.registered_owner || "",
            reg: a.registration || "", photo: a.url_photo_thumbnail || "", country: a.registered_owner_country_name || "" };
          if (a.icao_type) {
            types[hex] = String(a.icao_type).toUpperCase().slice(0, 4);
            var keys = Object.keys(types);
            if (keys.length > 1500) keys.slice(0, 500).forEach(function (k) { delete types[k]; });
            save("types", JSON.stringify(types));
            if (planes[hex] && !planes[hex].type) { planes[hex].type = types[hex]; planes[hex].kind = C.classify(types[hex], ""); }
          }
        } else info[hex] = {};   // unknown to adsbdb (it answers 404), or no answer: not asked again
      }
      if (cs && (f || !both)) {   // asked with the aircraft and nothing came: the next turn asks for the route alone
        var o = (f && f.origin) || {}, d = (f && f.destination) || {};
        routes[cs] = f ? { from: o.iata_code || o.icao_code || "", to: d.iata_code || d.icao_code || "", fromCity: o.municipality || "", toCity: d.municipality || "",
          airline: (f.airline || {}).name || "", oLat: numOr(o.latitude), oLon: numOr(o.longitude), dLat: numOr(d.latitude), dLon: numOr(d.longitude) } : {};
      }
      if (hex === sel || (p && p.hex === sel)) card();
    });
  }
  function numOr(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  /** The picked plane's route, only when the plane is plausibly on it (adsbdb's routes go stale). */
  function routeOf(p) {
    var r = p.flight ? routes[p.flight] : null;
    if (!r || !r.from || !r.to) return null;
    return P.routeFits(r, p.la, p.lo, p.track) ? r : null;
  }

  // ------------------------------------------------------------------ drawing the planes, four times a second
  function draw() {
    if (!V) return;
    if (mapDirty) drawMap();
    var t = nowS(), i, look = LOOK[style];
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(mapC, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var base = U * 0.05, boxes = [], shown = [];
    for (i = 0; i < list.length; i++) {
      var p = list[i], here = C.now(p, t);
      p.la += (here[0] - p.la) * 0.4; p.lo += (here[1] - p.lo) * 0.4;   // a new position is eased in, not jumped to
      var q = V.project(p.la, p.lo);
      p.x = q[0]; p.y = q[1];
      p.nm = C.distNm(lat0, lon0, p.la, p.lo); p.brg = C.bearing(lat0, lon0, p.la, p.lo);
      if (q[0] > -30 && q[0] < W + 30 && q[1] > -30 && q[1] < H + 30) shown.push(p);
    }
    var picked = sel ? planes[sel] : null;
    if (picked) drawTrail(picked, t);
    shown.sort(function (a, b) { return (a.hex === sel ? 1 : 0) - (b.hex === sel ? 1 : 0) || (a.alt || 0) - (b.alt || 0); });
    for (i = 0; i < shown.length; i++) {
      var s = shown[i], isSel = s.hex === sel;
      var size = base * Math.max(0.74, C.SCALE[s.kind] || 1) * (s.ground ? 0.72 : 1) * (isSel ? 1.18 : 1);
      var sp = sprite(s.kind, isSel ? RED : YELLOW, isSel ? RED_EDGE : YELLOW_EDGE), sh = sprite(s.kind, "#000000", "#000000");
      var ang = (s.track || 0) * Math.PI / 180, old = t - s.at > (s.src === "OpenSky" ? osEvery + 30 : 45);
      if (sh && !s.ground) {
        g.save(); g.globalAlpha = 0.3; g.translate(s.x + size * 0.1, s.y + size * 0.16); g.rotate(ang);
        g.drawImage(sh, -size / 2, -size / 2, size, size); g.restore();
      }
      if (sp) {
        g.save(); g.globalAlpha = old ? 0.6 : 1; g.translate(s.x, s.y); g.rotate(ang);
        g.drawImage(sp, -size / 2, -size / 2, size, size); g.restore();
      }
      s.bi = boxes.length; s.size = size;
      boxes.push([s.x - size * 0.4, s.y - size * 0.4, size * 0.8, size * 0.8]);
    }
    // the names: the picked one first, then the others where there is room
    g.font = "600 " + Math.round(U * 0.0195) + "px Roboto, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
    var th = U * 0.025;
    shown.slice().reverse().forEach(function (s2) {
      var tw = g.measureText(s2.name).width, x = s2.x + s2.size * 0.52, y = s2.y + s2.size * 0.3, k;
      var cands = [[x, y], [s2.x - s2.size * 0.52 - tw, y], [x, s2.y - s2.size * 0.4], [s2.x - tw / 2, s2.y + s2.size * 0.72]], put = null;
      for (var c2 = 0; c2 < cands.length && !put; c2++) {
        var bx = [cands[c2][0] - 2, cands[c2][1] - th / 2, tw + 4, th], hit = false;
        for (k = 0; k < boxes.length && !hit; k++) if (k !== s2.bi && over(bx, boxes[k])) hit = true;
        if (!hit || s2.hex === sel) put = bx;
      }
      if (!put) return;
      boxes.push(put);
      halo(g, s2.name, put[0] + 2, put[1] + th / 2, s2.hex === sel ? "#ffd9d5" : "#fff", look.halo, 3.2);
    });
    if (picked) {
      g.beginPath(); g.arc(picked.x, picked.y, picked.size * 0.78, 0, Math.PI * 2);
      g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 1.6; g.setLineDash([4, 5]); g.stroke(); g.setLineDash([]);
    }
  }
  function drawTrail(p, t) {
    var tr = trails[p.hex] || [], i, r = routeOf(p);
    g.lineCap = "round"; g.lineJoin = "round";
    if (r && r.oLat != null && tr.length) {   // from where it took off to where we first saw it: a guess, drawn faint
      var o = V.project(r.oLat, r.oLon), f = V.project(tr[0][0], tr[0][1]);
      g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(f[0], f[1]);
      g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 2; g.setLineDash([2, 6]); g.stroke(); g.setLineDash([]);
    }
    g.lineWidth = Math.max(2.5, U * 0.0045);
    for (i = 1; i <= tr.length; i++) {
      var a = tr[i - 1], b = i < tr.length ? tr[i] : [p.la, p.lo, p.alt || 0], qa = V.project(a[0], a[1]), qb = V.project(b[0], b[1]);
      g.beginPath(); g.moveTo(qa[0], qa[1]); g.lineTo(qb[0], qb[1]);
      g.strokeStyle = C.altColor(b[2]); g.stroke();
    }
    if (r && r.dLat != null) {   // on to where it lands
      var d = V.project(r.dLat, r.dLon);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(d[0], d[1]);
      g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 2; g.setLineDash([9, 8]); g.stroke(); g.setLineDash([]);
    }
  }

  // ------------------------------------------------------------------ the card of the picked plane
  function row(k, v) { return v ? "<div><span>" + k + "</span><em>" + esc(v) + "</em></div>" : ""; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function card() {
    var p = sel ? planes[sel] : null, el = $("card");
    if (!p) { el.hidden = true; return; }
    var inf = info[p.hex] || {}, r = routeOf(p), any = p.flight ? routes[p.flight] : null;
    el.hidden = false;
    $("cs").textContent = p.name;
    $("airline").textContent = (any && any.airline) || inf.owner || "";
    $("route").hidden = !r;
    if (r) { $("from").textContent = r.from; $("to").textContent = r.to; $("fromCity").textContent = r.fromCity || ""; $("toCity").textContent = r.toCity || ""; }
    var ph = $("photo"), by = $("photoBy");
    if (inf.photo) { if (ph.getAttribute("src") !== inf.photo) ph.src = inf.photo; ph.hidden = false; by.hidden = false; by.textContent = "photo: airport-data.com"; }
    else { ph.hidden = true; by.hidden = true; ph.removeAttribute("src"); }
    var type = p.type || inf.type || "", nameT = type ? P.typeName(type) : "";
    var rate = p.rate != null && Math.abs(p.rate) >= 200 ? (p.rate > 0 ? "  ↑ " : "  ↓ ") + C.thousands(Math.abs(Math.round(p.rate / 50) * 50)) + " ft/min" : "";
    $("rows").innerHTML =
      row("Aircraft", inf.full || (nameT && nameT !== type ? nameT + " (" + type + ")" : type)) +
      row("Registration", p.reg || inf.reg) +
      row("Altitude", C.altText(p) + (p.ground ? "" : rate)) +
      row("Speed", p.gs != null ? Math.round(p.gs) + " kt" : "") +
      row("Heading", p.track != null ? Math.round(p.track) + "° " + C.compass(p.track) : "") +
      row("From here", p.nm != null ? Math.round(p.nm) + " nm " + C.compass(p.brg) : "") +
      row("Squawk", p.squawk) +
      row("Seen by", p.src + " · " + Math.max(0, Math.round(nowS() - p.at)) + " s ago");
  }
  ph0();
  function ph0() { $("photo").onerror = function () { this.hidden = true; $("photoBy").hidden = true; }; }

  function select(hex) {
    sel = hex || "";
    $("backs").textContent = sel && !saver ? "close" : "leave";
    card();
    if (sel) lookup();
  }
  function bar() {
    var t = nowS(), air = 0, i;
    for (i = 0; i < list.length; i++) if (!list[i].ground) air++;
    $("place").textContent = cfg.city || (lat0.toFixed(2) + ", " + lon0.toFixed(2));
    $("range").textContent = C.RANGES[rangeI] + " nm";
    $("count").textContent = air + (air === 1 ? " plane" : " planes") + (list.length > air ? " + " + (list.length - air) + " on the ground" : "");
    var f = [];
    f.push(adsbAt && t - adsbAt < 60 ? "adsb.lol" : "adsb.lol ?");
    if (cfg.opensky) f.push(osAt && t - osAt < osEvery + 60 ? "OpenSky" : "OpenSky ?");
    $("feeds").textContent = f.join(" + ");
    var d = new Date();
    $("clock").textContent = (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
    if (sel) card();
  }

  // ------------------------------------------------------------------ the remote
  function key(k) {
    if (!V || widget) return k === "back" ? "false" : "true";
    if (saver && k === "back") return "false";   // the saver closes on Back
    if (k === "left" || k === "right") {
      var on = list.filter(function (p) { return p.x > 0 && p.x < W && p.y > 0 && p.y < H; });
      select(C.pick(on, sel, k === "right" ? 1 : -1));
      tourHold = Date.now() + 60000;   // a plane picked by hand stays a minute before the tour moves on
    } else if (k === "up" || k === "down") {
      var n = Math.max(0, Math.min(C.RANGES.length - 1, rangeI + (k === "up" ? -1 : 1)));
      if (n !== rangeI) { rangeI = n; keep("range", C.RANGES[n]); resize(); }
    } else if (k === "ok") {
      style = C.STYLES[(C.STYLES.indexOf(style) + 1) % C.STYLES.length]; keep("map", style); mapDirty = true;
    } else if (k === "back") {
      if (!sel) return "false";   // nothing picked: the launcher closes the radar
      select("");
    }
    bar(); draw();
    return "true";
  }
  function keep(k, v) {   // the full screen keeps it in the page; the saver in the launcher's settings
    if (!saver) { save(k, v); return; }
    try { if (host && host.save) host.save(k, String(v)); } catch (e) { log("save " + e); }
  }
  root.OmarchyRadarHost = { key: key, pause: function () { paused = true; }, resume: function () { paused = false; pollAdsb(); } };
  doc.addEventListener("keydown", function (e) {   // a keyboard, on a desk
    var k = { 37: "left", 39: "right", 38: "up", 40: "down", 13: "ok", 27: "back", 8: "back" }[e.keyCode];
    if (k) { key(k); e.preventDefault(); }
  });

  // ------------------------------------------------------------------ go
  var paused = false;
  root.addEventListener("resize", resize);
  resize();
  if (!hasLoc) {
    $("msg").hidden = false;
    $("msg").textContent = "The radar needs to know where you are: set your place in Settings › Weather.";
    $("hint").hidden = true;
    if (saver && saverHost && saverHost.fail) { try { saverHost.fail("radar: no place set"); } catch (e) {} }
  } else {
    bar();
    pollAdsb(); pollOs();
    root.setInterval(function () { if (!paused) pollAdsb(); }, widget ? 20000 : 12000);
    root.setInterval(function () { if (!paused) pollOs(); }, osEvery * 1000);
    root.setInterval(function () { if (!paused) lookup(); }, widget ? 10000 : 2500);   // the box only needs the types, for the silhouettes
    root.setInterval(function () { if (!paused) bar(); }, 1000);
    root.setInterval(function () { if (!paused) draw(); }, widget ? 1000 : 250);
    if (tour) {
      // a tour: every 15 s the next plane in the air gets its card, so the saver keeps moving
      root.setInterval(function () {
        if (paused || Date.now() < tourHold) return;
        var on = list.filter(function (p) { return !p.ground && p.x > 0 && p.x < W && p.y > 0 && p.y < H; });
        select(on.length ? C.pick(on, sel, 1) : "");
        draw();
      }, 15000);
    }
    if (saver) {
      draw();
      if (saverHost && saverHost.drawn) { try { saverHost.drawn("radar", list.length, "radar"); } catch (e) {} }
    }
  }
  root.__radar = { planes: function () { return list; }, view: function () { return V; }, cfg: cfg };
})(window);
