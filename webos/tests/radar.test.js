// The plane radar on Android TV (launcher/app/src/main/assets/radar): the arithmetic in radar-core.js and the page's shape.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const R = path.join(__dirname, "../../launcher/app/src/main/assets/radar/");
global.window = global;
const I = require(R + "radar-icons.js");
const C = require(R + "radar-core.js");
const HERE = [7.78, 98.33];   // Rawai, Phuket

test("radar: the page loads its files in order, in plain ES5, and names its sources", () => {
  const html = fs.readFileSync(R + "index.html", "utf8");
  const order = ["../pulse/pulse-tv-data.js", "../pulse/pulse-tv-hub.js", "radar-icons.js", "radar-core.js", "radar-airports.js", "radar-land.js", "radar.js"]
    .map((s) => html.indexOf('src="' + s + '"'));
  order.forEach((at, i) => assert.ok(at > 0 && (i === 0 || at > order[i - 1]), "script " + i));
  for (const f of ["radar.js", "radar-core.js", "radar-icons.js"]) {   // Android TV 5-8 still runs old WebViews
    const src = fs.readFileSync(R + f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    assert.ok(!/=>|\blet\s|\bconst\s|`|\?\.|\?\?/.test(src), f + " is ES5");
  }
  assert.match(fs.readFileSync(R + "radar-icons.js", "utf8"), /God's Eye View \(MIT/);
  assert.match(fs.readFileSync(R + "radar-airports.js", "utf8"), /OurAirports/);
  assert.match(fs.readFileSync(R + "radar-land.js", "utf8"), /Natural Earth/);
  for (const k of C.STYLES) assert.ok(C.MAPS[k] && C.MAPS[k][2], k + " has a credit line");
});

test("radar: every class has a silhouette and a size, and types fall into their class", () => {
  for (const k of Object.keys(I.SCALE)) assert.ok(I.BODIES[k], k);
  assert.strictEqual(C.classify("B738"), "airliner");
  assert.strictEqual(C.classify("A388"), "quadjet");
  assert.strictEqual(C.classify("C172"), "light");
  assert.strictEqual(C.classify("", "A7"), "helicopter");
  assert.strictEqual(C.classify("ZZZZ"), "airliner");
  const svg = C.svg("airliner", "#f8d21c", "#000");
  assert.ok(svg.indexOf("<svg") === 0 && svg.indexOf("#f8d21c") > 0 && svg.indexOf('fill="white"') < 0);
  assert.ok(C.svg("no-such-class", "#fff", "#000").indexOf("<path") > 0, "unknown class draws an airliner");
});

test("radar: the map view puts the TV's place in the middle and the range inside the screen", () => {
  const v = C.view(HERE[0], HERE[1], 200, 1280, 720);
  assert.deepStrictEqual(v.project(HERE[0], HERE[1]), [640, 360]);
  const north = v.project(HERE[0] + 200 / 60, HERE[1]);
  assert.strictEqual(north[0], 640);
  assert.ok(north[1] > 0 && north[1] < 60, "200 nm north is near the top edge, on screen");
  const b = C.box(HERE[0], HERE[1], 200, 1280, 720);
  assert.ok(b[0] < HERE[0] - 200 / 60 && b[1] > HERE[0] + 200 / 60 && b[2] < HERE[1] - 3.36 && b[3] > HERE[1] + 3.36, "the box holds the 200 nm ring");
  const tiles = C.tiles(v);
  assert.ok(tiles.length > 0 && tiles.length <= 40, "a 1 GB TV draws few tiles: " + tiles.length);
  assert.strictEqual(C.tileUrl(C.MAPS.terrain[0], { z: 7, x: 99, y: 61 }), "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/7/61/99");
  assert.deepStrictEqual(C.RANGES, [25, 50, 100, 200]);
});

test("radar: distance, bearing and the words on the card", () => {
  assert.strictEqual(C.distNm(HERE[0], HERE[1], 8.113, 98.317).toFixed(0), "20");   // Phuket airport
  assert.strictEqual(Math.round(C.bearing(HERE[0], HERE[1], 8.113, 98.317)), 358);
  assert.strictEqual(C.compass(88), "E");
  assert.strictEqual(C.compass(358), "N");
  assert.strictEqual(C.altText({ alt: 13850 }), "13,850 ft");
  assert.strictEqual(C.altText({ ground: true, alt: 0 }), "on the ground");
  assert.notStrictEqual(C.altColor(0), C.altColor(50000));
});

test("radar: the two feeds become one list, one plane per hex, the fresher position wins", () => {
  const t = 1000;
  const a = C.fromAdsb([{ hex: "abc123", flight: "THA249 ", lat: 8, lon: 98, alt_baro: "ground", seen_pos: 5, t: "B738", r: "HS-X", gs: 10, track: 90 }, { hex: "x" }], t);
  assert.strictEqual(a.length, 1, "no position, no plane");
  assert.deepStrictEqual([a[0].flight, a[0].alt, a[0].ground, a[0].at, a[0].src], ["THA249", 0, true, 995, "adsb.lol"]);
  const o = C.fromOpenSky([
    ["abc123", "THA249 ", "TH", 990, 990, 98.1, 8.1, 3048, false, 100, 90, 5, null, 3100, "1234"],
    ["def456", "AIQ1 ", "TH", 900, 900, 99, 9, 1000, false, 50, 10, 0, null, 1000, null],
    ["fed789", "FDB1 ", "AE", 980, 980, 97, 7, 11000, false, 230, 300, 0, null, 11100, null]]);
  assert.strictEqual(Math.round(o[0].alt), 10000, "metres to feet");
  assert.strictEqual(Math.round(o[0].gs), 194, "m/s to knots");
  const m = C.merge(a, o, t, 90).map((p) => p.hex + ":" + p.src).sort();
  assert.deepStrictEqual(m, ["abc123:adsb.lol", "fed789:OpenSky"], "def456 is 100 s old: dropped");
  assert.deepStrictEqual(C.fromOpenSky(null), []);
  assert.deepStrictEqual(C.fromAdsb(undefined, t), []);
});

test("radar: a plane keeps moving along its track between two reads", () => {
  const p = C.now({ lat: 8, lon: 98, gs: 480, track: 90, at: 1000 }, 1060);   // 8 nm east in a minute
  assert.strictEqual(p[0].toFixed(3), "8.000");
  assert.ok(Math.abs(C.distNm(8, 98, p[0], p[1]) - 8) < 0.1);
  assert.deepStrictEqual(C.now({ lat: 8, lon: 98, gs: 480, track: 90, at: 1000, ground: true }, 1060), [8, 98]);
});

test("radar: the remote walks the planes clockwise and wraps", () => {
  const L = [{ hex: "a", brg: 10, nm: 50 }, { hex: "b", brg: 100, nm: 5 }, { hex: "c", brg: 200, nm: 90 }];
  assert.strictEqual(C.pick(L, "", 1), "b", "first press: the nearest");
  assert.strictEqual(C.pick(L, "a", 1), "b");
  assert.strictEqual(C.pick(L, "c", 1), "a", "wraps");
  assert.strictEqual(C.pick(L, "a", -1), "c");
  assert.strictEqual(C.pick(L, "gone", 1), "a", "the picked plane left: start again");
  assert.strictEqual(C.pick([], "", 1), "", "no planes, no pick");
});

test("radar: the box on Home is the same page with the map only, and reads the planes less often", () => {
  const html = fs.readFileSync(R + "index.html", "utf8");
  for (const id of ["#hint", "#clock", "#card"]) assert.ok(new RegExp("\\.widget " + id + "[^{]*\\{[^}]*display: none").test(html) || html.indexOf(".widget " + id) > 0, id + " hidden in the box");
  const js = fs.readFileSync(R + "radar.js", "utf8");
  assert.match(js, /var widget = !!cfg\.widget;/);
  assert.match(js, /widget \? 120 : 60/, "OpenSky every two minutes in the box");
  assert.match(js, /widget \? 20000 : 12000/);
  assert.match(js, /if \(!V \|\| widget\) return k === "back" \? "false" : "true";/, "no remote in the box");
});
