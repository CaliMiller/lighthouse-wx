/* =====================================================================
   Weather Signage — living background
   Paints a rolling Indiana countryside whose sky, light, landscape and
   weather follow the real sun position, the season and the current NWS
   observation: sunrise/sunset colours, moon phase and stars at night,
   drifting clouds, rain, snow, sleet, fog and lightning.

   Four stacked canvases (sky, clouds, land, effects). Only the clouds
   and effects animate; sky and land are repainted once a minute.
   Animated layers run at half resolution to stay light on small players.
   ===================================================================== */
(function (global) {
  "use strict";
  var S = global.Signage, C = S.CONFIG;
  var W = 1920, H = 1080, HR = 0.5; // half-res factor for animated layers

  // ---------- colour helpers ----------
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function mix(a, b, t) { if (typeof a === "string") a = hex(a); if (typeof b === "string") b = hex(b); t = Math.max(0, Math.min(1, t)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, a) { if (typeof c === "string") c = hex(c); return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + (a === undefined ? 1 : a) + ")"; }
  function gray(c) { if (typeof c === "string") c = hex(c); var l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return [l, l, l]; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // Sky colours keyed by sun altitude: [top, middle, horizon]
  var SKY = [
    [-90, "#02040b", "#050a18", "#0b1428"],
    [-18, "#03060f", "#070d1f", "#111b35"],
    [-12, "#060c1e", "#101d40", "#24315c"],
    [-6, "#101c44", "#2f3a6e", "#7a5578"],
    [-2, "#1f3170", "#6c5b8e", "#ec8a5a"],
    [2, "#2d509a", "#a5809f", "#f9a760"],
    [8, "#3a73cb", "#89b4e2", "#f3d49e"],
    [20, "#2e6fd1", "#6ca8e8", "#b9ddf7"],
    [90, "#1d60cb", "#5a9ae4", "#a7d2f5"]
  ];
  function skyAt(alt) {
    for (var i = 1; i < SKY.length; i++) {
      if (alt <= SKY[i][0]) {
        var a = SKY[i - 1], b = SKY[i], t = (alt - a[0]) / (b[0] - a[0]);
        return [mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t)];
      }
    }
    var l = SKY[SKY.length - 1]; return [hex(l[1]), hex(l[2]), hex(l[3])];
  }

  var PALETTES = {
    spring: { land: ["#86b46c", "#5f9c45", "#407e30"], trees: ["#6dbb4c", "#8bcf68", "#58a83c", "#f3b0c8"], bare: false },
    summer: { land: ["#6a9558", "#418132", "#2c6424"], trees: ["#2f7a2a", "#3d8f33", "#276b22", "#4a9a3a"], bare: false },
    fall:   { land: ["#a89662", "#9c7038", "#6f4b28"], trees: ["#e07b24", "#c8432a", "#f2b33d", "#b0561f", "#d99a2b"], bare: false },
    winter: { land: ["#8e8a74", "#77715b", "#5a5444"], trees: ["#4a3b2c"], bare: true },
    snow:   { land: ["#e8eef6", "#dae4ef", "#ccd9e7"], trees: ["#4a3b2c"], bare: true, snow: true }
  };

  // ---------- state ----------
  var el, cvSky, cvCloud, cvLand, cvFx, xSky, xCloud, xLand, xFx;
  var scene = null;       // derived look (colours, counts)
  var clouds = [], particles = [], fogBands = [];
  var flash = 0, nextStrike = 0, bolt = null;
  var lastFrame = 0, running = false;
  var obs = null;

  function makeCanvas(scale, z) {
    var c = document.createElement("canvas");
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    c.style.width = W + "px"; c.style.height = H + "px"; c.style.position = "absolute"; c.style.left = "0"; c.style.top = "0";
    el.appendChild(c);
    return c;
  }

  // ---------- derive scene ----------
  function buildScene() {
    var t = S.now();
    var cls = S.classify(obs && obs.icon, obs && obs.text);
    var prof = S.profile(cls.key, obs && obs.text);
    var alt = S.sunAltitude(t, C.lat, C.lon);
    var light = clamp((alt + 9) / 19, 0, 1);              // 0 = night, 1 = full day
    var warmth = Math.exp(-Math.pow((alt - 1.5) / 6, 2));  // peaks at sunrise / sunset
    var season = S.season(t);
    var tempF = obs ? obs.tempF : null;
    var snowy = prof.precip === "snow" || cls.key === "blizzard" ||
      (season === "winter" && (prof.precip === "mix" || prof.precip === "sleet" || (tempF !== null && tempF <= 28)));
    if (season === "summer") snowy = false;
    var grey = clamp((prof.cover - 0.45) / 0.55, 0, 1) * 0.85 + prof.dark * 0.3;

    var sk = skyAt(alt);
    var gTop = mix("#1d222b", "#7a8494", light), gHor = mix("#272c35", "#adb6c1", light);
    var top = mix(sk[0], gTop, grey), mid = mix(sk[1], mix(gTop, gHor, 0.5), grey), hor = mix(sk[2], gHor, grey);
    var dk = 1 - prof.dark * 0.45;
    top = top.map(function (v) { return v * dk; }); mid = mid.map(function (v) { return v * dk; }); hor = hor.map(function (v) { return v * dk; });
    if (prof.tint) {
      var tc = { haze: "#d8c08e", smoke: "#b59a86", dust: "#d2ad73" }[prof.tint];
      mid = mix(mid, tc, 0.35 * light + 0.1); hor = mix(hor, tc, 0.5 * light + 0.1);
    }

    // cloud colours
    var cLight = mix("#ffffff", "#c3c9d2", grey), cShade = mix("#c6d0dc", "#7f8996", grey);
    cLight = mix(cLight, "#ffc9a3", warmth * 0.55 * (1 - grey)); cShade = mix(cShade, "#a67f98", warmth * 0.5 * (1 - grey));
    var nightL = mix("#3b4559", "#262c38", grey), nightS = mix("#1b2232", "#141820", grey);
    cLight = mix(nightL, cLight, light); cShade = mix(nightS, cShade, light);
    cLight = cLight.map(function (v) { return v * (1 - prof.dark * 0.4); }); cShade = cShade.map(function (v) { return v * (1 - prof.dark * 0.5); });

    return {
      key: cls.key, prof: prof, alt: alt, light: light, warmth: warmth, season: season, snowy: snowy, grey: grey,
      top: top, mid: mid, hor: hor, cLight: cLight, cShade: cShade, time: t,
      palette: PALETTES[snowy ? "snow" : season]
    };
  }

  // ---------- static layers ----------
  function paintSky() {
    var x = xSky, s = scene, w = cvSky.width, h = cvSky.height, k = w / W;
    var g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(s.top)); g.addColorStop(0.5, css(s.mid)); g.addColorStop(0.78, css(s.hor)); g.addColorStop(1, css(s.hor));
    x.fillStyle = g; x.fillRect(0, 0, w, h);

    var clearness = 1 - clamp(s.prof.cover * 1.1, 0, 1);
    // stars
    if (s.light < 0.4 && clearness > 0.05) {
      var r = rng(42), a0 = (1 - s.light / 0.4) * clearness;
      for (var i = 0; i < 320; i++) {
        var sx = r() * w, sy = r() * h * 0.72, sr = (0.4 + r() * r() * 1.6) * k * 2, al = a0 * (0.35 + r() * 0.65) * (1 - sy / (h * 0.8));
        x.fillStyle = css("#f4f6ff", al); x.beginPath(); x.arc(sx, sy, sr, 0, 6.283); x.fill();
      }
    }
    // sun
    if (s.alt > -4 && s.prof.cover < 0.92) {
      var st = S.sunTimes(s.time), f = 0.5;
      if (st.sunrise && st.sunset) f = clamp((s.time - st.sunrise) / (st.sunset - st.sunrise), -0.03, 1.03);
      var px = (180 + f * 1560) * k, py = (800 - Math.sin(Math.PI * clamp(f, 0, 1)) * 600) * k;
      var vis = (1 - clamp(s.prof.cover * 1.05, 0, 1)) * clamp((s.alt + 4) / 4, 0, 1);
      var sunCol = mix("#fff6d8", "#ffa25a", s.warmth);
      var gg = x.createRadialGradient(px, py, 0, px, py, 420 * k);
      gg.addColorStop(0, css(sunCol, 0.55 * vis)); gg.addColorStop(0.25, css(sunCol, 0.18 * vis)); gg.addColorStop(1, css(sunCol, 0));
      x.fillStyle = gg; x.fillRect(0, 0, w, h);
      x.fillStyle = css(mix("#ffffff", "#ffc27a", s.warmth), vis); x.beginPath(); x.arc(px, py, 50 * k, 0, 6.283); x.fill();
    }
    // moon
    if (s.light < 0.5 && s.prof.cover < 0.9) {
      var ph = S.moonPhase(s.time);
      if (ph.illum > 0.04) drawMoon(x, 1240 * k, 270 * k, 44 * k, ph, (1 - s.light / 0.5) * (1 - clamp(s.prof.cover * 1.1, 0, 1)));
    }
  }

  function drawMoon(x, cx, cy, r, ph, vis) {
    var g = x.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 5);
    g.addColorStop(0, css("#dfe6ff", 0.28 * vis * ph.illum)); g.addColorStop(1, css("#dfe6ff", 0));
    x.fillStyle = g; x.fillRect(cx - r * 5, cy - r * 5, r * 10, r * 10);
    var m = document.createElement("canvas"); m.width = m.height = Math.ceil(r * 2 + 4);
    var mx = m.getContext("2d"), c = r + 2;
    mx.fillStyle = "rgba(200,210,235,0.12)"; mx.beginPath(); mx.arc(c, c, r, 0, 6.283); mx.fill(); // earthshine
    var lit = document.createElement("canvas"); lit.width = lit.height = m.width;
    var lx = lit.getContext("2d");
    lx.fillStyle = "#fbf6e2";
    lx.beginPath(); // lit half: right side when waxing (northern hemisphere)
    if (ph.waxing) lx.arc(c, c, r, -Math.PI / 2, Math.PI / 2, false); else lx.arc(c, c, r, Math.PI / 2, -Math.PI / 2, false);
    lx.fill();
    var ew = Math.abs(1 - 2 * ph.illum) * r;
    lx.beginPath(); lx.ellipse(c, c, Math.max(ew, 0.01), r, 0, 0, 6.283);
    if (ph.illum < 0.5) { lx.globalCompositeOperation = "destination-out"; lx.fill(); lx.globalCompositeOperation = "source-over"; }
    else lx.fill();
    mx.drawImage(lit, 0, 0);
    x.globalAlpha = vis; x.drawImage(m, cx - c, cy - c); x.globalAlpha = 1;
  }

  function shade(col, s, extra) {
    var c = typeof col === "string" ? hex(col) : col;
    c = mix(c, gray(c), s.grey * 0.45);                                  // dull under cloud
    c = mix(c, "#ff9a5a", s.warmth * 0.16 * (1 - s.grey));                // sunset glow
    c = mix(c, "#0a1020", (1 - s.light) * 0.86 + (extra || 0));           // night
    return c.map(function (v) { return v * (1 - s.prof.dark * 0.35); });
  }

  function ridge(layer, x) {
    return layer.base - layer.amp * (0.6 * Math.sin(x * layer.f[0] + layer.p[0]) + 0.3 * Math.sin(x * layer.f[1] + layer.p[1]) + 0.1 * Math.sin(x * layer.f[2] + layer.p[2]));
  }
  var RIDGES = [
    { base: 790, amp: 40, f: [0.0021, 0.0057, 0.013], p: [0.4, 1.9, 3.1] },
    { base: 880, amp: 36, f: [0.0016, 0.0049, 0.011], p: [2.2, 0.3, 1.2] },
    { base: 975, amp: 28, f: [0.0019, 0.0062, 0.015], p: [4.1, 2.6, 0.7] }
  ];

  function paintLand() {
    var x = xLand, s = scene, pal = s.palette;
    x.clearRect(0, 0, W, H);
    for (var li = 0; li < RIDGES.length; li++) {
      var L = RIDGES[li];
      var base = hex(pal.land[li]);
      if (li === 0) base = mix(base, s.hor, 0.35); // distance haze
      var col = shade(base, s);
      var g = x.createLinearGradient(0, L.base - L.amp, 0, H);
      g.addColorStop(0, css(mix(col, [255, 255, 255], pal.snow ? 0.06 : 0.04))); g.addColorStop(1, css(col.map(function (v) { return v * 0.78; })));
      x.fillStyle = g;
      x.beginPath(); x.moveTo(0, H);
      for (var px = 0; px <= W; px += 12) x.lineTo(px, ridge(L, px));
      x.lineTo(W, H); x.closePath(); x.fill();

      if (li === 0) paintTrees(x, s, RIDGES[0], 0.55, 7, 0.7);
      if (li === 1) { paintBarn(x, s, 1360, ridge(RIDGES[1], 1420)); paintTrees(x, s, RIDGES[1], 0.85, 11, 1); }
      if (li === 2) paintTrees(x, s, RIDGES[2], 1.25, 5, 1.3);
    }
  }

  function paintTrees(x, s, L, scale, count, seedMul) {
    var r = rng(Math.round(97 * seedMul)), pal = s.palette;
    for (var i = 0; i < count; i++) {
      var tx = r() * W;
      if (scale > 0.8 && scale < 1 && tx > 1300 && tx < 1560) continue; // leave room for the barn
      var ty = ridge(L, tx) + 6 * scale, h = (60 + r() * 50) * scale;
      var conifer = r() < 0.28;
      var trunk = shade("#4a3826", s);
      if (conifer) {
        var green = shade("#24522c", s);
        for (var k = 0; k < 3; k++) {
          var w = (36 - k * 9) * scale, y0 = ty - h * 0.15 - k * h * 0.26;
          x.fillStyle = css(green); x.beginPath(); x.moveTo(tx - w, y0); x.lineTo(tx + w, y0); x.lineTo(tx, y0 - h * 0.42); x.closePath(); x.fill();
          if (pal.snow) { x.fillStyle = css(shade("#f4f8fc", s)); x.beginPath(); x.moveTo(tx - w * 0.45, y0 - h * 0.24); x.lineTo(tx + w * 0.45, y0 - h * 0.24); x.lineTo(tx, y0 - h * 0.42); x.closePath(); x.fill(); }
        }
        x.fillStyle = css(trunk); x.fillRect(tx - 3 * scale, ty - h * 0.16, 6 * scale, h * 0.18);
      } else if (pal.bare) {
        x.strokeStyle = css(shade("#3d3024", s)); x.lineCap = "round";
        x.lineWidth = 5 * scale; x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx, ty - h * 0.8); x.stroke();
        x.lineWidth = 2.4 * scale;
        for (var b = 0; b < 6; b++) {
          var by = ty - h * (0.3 + b * 0.09), dir = b % 2 ? 1 : -1, len = h * (0.34 - b * 0.03);
          x.beginPath(); x.moveTo(tx, by); x.lineTo(tx + dir * len * 0.8, by - len * 0.75); x.stroke();
        }
      } else {
        x.fillStyle = css(trunk); x.fillRect(tx - 4 * scale, ty - h * 0.45, 8 * scale, h * 0.47);
        var cA = pal.trees[Math.floor(r() * pal.trees.length)], cB = pal.trees[Math.floor(r() * pal.trees.length)];
        var puffs = [[0, -h * 0.62, h * 0.3, cA], [-h * 0.2, -h * 0.5, h * 0.22, cB], [h * 0.2, -h * 0.52, h * 0.23, cA], [0, -h * 0.82, h * 0.2, cB]];
        puffs.forEach(function (p) {
          x.fillStyle = css(shade(p[3], s)); x.beginPath(); x.arc(tx + p[0], ty + p[1], p[2], 0, 6.283); x.fill();
        });
        x.fillStyle = css([255, 255, 255], 0.08 * s.light); x.beginPath(); x.arc(tx - h * 0.08, ty - h * 0.72, h * 0.14, 0, 6.283); x.fill();
      }
    }
  }

  function paintBarn(x, s, bx, by) {
    var w = 120, h = 74, red = shade("#a5322a", s), roof = shade("#4b1c18", s), trim = shade("#f1ede4", s);
    by += 8;
    // silo
    x.fillStyle = css(shade("#9aa3a9", s)); x.fillRect(bx + w + 14, by - h - 48, 40, h + 48);
    x.beginPath(); x.arc(bx + w + 34, by - h - 48, 20, Math.PI, 0); x.fill();
    if (s.palette.snow) { x.fillStyle = css(shade("#f4f8fc", s)); x.beginPath(); x.arc(bx + w + 34, by - h - 48, 20, Math.PI, 0); x.fill(); }
    // body
    x.fillStyle = css(red); x.fillRect(bx, by - h, w, h);
    // gambrel roof
    x.fillStyle = css(s.palette.snow ? shade("#eef3f8", s) : roof);
    x.beginPath(); x.moveTo(bx - 8, by - h); x.lineTo(bx + 10, by - h - 34); x.lineTo(bx + w / 2, by - h - 52); x.lineTo(bx + w - 10, by - h - 34); x.lineTo(bx + w + 8, by - h); x.closePath(); x.fill();
    // door + trim
    x.strokeStyle = css(trim); x.lineWidth = 3;
    x.strokeRect(bx + w / 2 - 22, by - 48, 44, 48);
    x.beginPath(); x.moveTo(bx + w / 2 - 22, by - 48); x.lineTo(bx + w / 2 + 22, by); x.moveTo(bx + w / 2 + 22, by - 48); x.lineTo(bx + w / 2 - 22, by); x.stroke();
    // hayloft window, glows at night
    var glow = 1 - s.light;
    x.fillStyle = glow > 0.4 ? css("#ffcf6e", 0.5 + glow * 0.5) : css(trim);
    x.fillRect(bx + w / 2 - 12, by - h - 26, 24, 18);
    if (glow > 0.4) {
      var gg = x.createRadialGradient(bx + w / 2, by - h - 17, 2, bx + w / 2, by - h - 17, 60);
      gg.addColorStop(0, css("#ffcf6e", 0.35 * glow)); gg.addColorStop(1, css("#ffcf6e", 0));
      x.fillStyle = gg; x.fillRect(bx + w / 2 - 60, by - h - 77, 120, 120);
    }
  }

  // ---------- clouds ----------
  function cloudSprite(r, w, h, light, shadeCol) {
    var pad = 16;
    var raw = document.createElement("canvas"); raw.width = Math.ceil(w); raw.height = Math.ceil(h);
    var x = raw.getContext("2d");
    var n = 9 + Math.floor(r() * 7), puffs = [];
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n, px = w * (0.12 + t * 0.76) + (r() - 0.5) * w * 0.06;
      var pr = h * (0.2 + Math.sin(t * Math.PI) * (0.18 + r() * 0.14));
      puffs.push([px, h * 0.68 - pr * (0.4 + r() * 0.5), pr]);
    }
    puffs.forEach(function (p) { x.fillStyle = css(shadeCol, 1); x.beginPath(); x.arc(p[0], p[1] + p[2] * 0.18, p[2], 0, 6.283); x.fill(); });
    puffs.forEach(function (p) {
      var g = x.createRadialGradient(p[0] - p[2] * 0.3, p[1] - p[2] * 0.5, p[2] * 0.1, p[0], p[1], p[2] * 1.05);
      g.addColorStop(0, css(light, 1)); g.addColorStop(0.7, css(mix(light, shadeCol, 0.35), 0.85)); g.addColorStop(1, css(mix(light, shadeCol, 0.6), 0));
      x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1] - p[2] * 0.06, p[2] * 0.95, 0, 6.283); x.fill();
    });
    // flatten base
    x.globalCompositeOperation = "destination-out";
    var fg = x.createLinearGradient(0, h * 0.7, 0, h);
    fg.addColorStop(0, "rgba(0,0,0,0)"); fg.addColorStop(1, "rgba(0,0,0,1)");
    x.fillStyle = fg; x.fillRect(0, h * 0.7, w, h * 0.3);
    // soften edges (done once per sprite, so it costs nothing per frame)
    var c = document.createElement("canvas"); c.width = Math.ceil(w + pad * 2); c.height = Math.ceil(h + pad * 2);
    var cx = c.getContext("2d");
    if ("filter" in cx) { cx.filter = "blur(" + Math.max(2, Math.round(w / 90)) + "px)"; }
    cx.drawImage(raw, pad, pad);
    return c;
  }
  function buildClouds() {
    var s = scene, r = rng(7), cover = s.prof.cover;
    var n = Math.round(1 + cover * 15 + (cover > 0.9 ? 6 : 0));
    if (s.key === "clear" || s.key === "hot") n = 1;
    var wf = s.prof.wind;
    clouds = [];
    for (var i = 0; i < n; i++) {
      var big = 0.7 + cover * 0.8 + r() * 0.5;
      var w = (170 + r() * 190) * big, h = w * (0.36 + r() * 0.12);
      clouds.push({
        img: cloudSprite(r, w, h, s.cLight, s.cShade),
        x: r() * (W * HR + w) - w, y: (10 + r() * (cover > 0.8 ? 230 : 300)) * 1, w: w, h: h,
        v: (5 + r() * 9) * wf * (1 - i / n * 0.4), a: cover > 0.85 ? 0.95 : 0.82 + r() * 0.15
      });
    }
    clouds.sort(function (a, b) { return a.w - b.w; });
  }

  // ---------- precipitation, fog, lightning ----------
  function buildParticles() {
    var p = scene.prof, r = Math.random;
    particles = [];
    var cw = W * HR, ch = H * HR;
    var n = Math.round(p.amount * 300);
    for (var i = 0; i < n; i++) {
      var type = p.precip === "mix" ? (i % 2 ? "rain" : "snow") : p.precip;
      particles.push(newParticle(type, r() * cw, r() * ch));
    }
    fogBands = [];
    if (p.fog > 0) {
      for (var j = 0; j < 7; j++) fogBands.push({ x: r() * cw, y: ch * (0.45 + r() * 0.5), w: cw * (0.6 + r() * 0.6), h: ch * (0.12 + r() * 0.14), v: (2 + r() * 4) * (r() < 0.5 ? -1 : 1) });
    }
  }
  function newParticle(type, x, y) {
    var r = Math.random;
    if (type === "snow") return { t: "snow", x: x, y: y, vy: 22 + r() * 30, r: 0.8 + r() * 1.8, ph: r() * 6.28, sw: 6 + r() * 10 };
    if (type === "sleet") return { t: "sleet", x: x, y: y, vy: 260 + r() * 120, r: 0.9 + r() * 0.8 };
    return { t: "rain", x: x, y: y, vy: 520 + r() * 260, len: 9 + r() * 10 };
  }

  function frame(ts) {
    if (!running) return;
    requestAnimationFrame(frame);
    var minDt = 1000 / C.backgroundFps;
    if (ts - lastFrame < minDt - 1) return;
    var dt = Math.min(0.1, (ts - (lastFrame || ts)) / 1000);
    lastFrame = ts;
    draw(dt, ts);
  }

  function draw(dt, ts) {
    if (!scene) return;
    var cw = W * HR, ch = H * HR, s = scene, p = s.prof;
    // clouds (skipped while a photo is showing)
    xCloud.clearRect(0, 0, cw, ch);
    for (var i = 0; i < (photoOn ? 0 : clouds.length); i++) {
      var c = clouds[i];
      c.x += c.v * dt;
      if (c.x > cw + 10) c.x = -c.w - Math.random() * 120;
      xCloud.globalAlpha = c.a; xCloud.drawImage(c.img, c.x, c.y);
    }
    xCloud.globalAlpha = 1;

    // effects
    xFx.clearRect(0, 0, cw, ch);
    var light = s.light, slant = 0.08 * p.wind;
    if (fogBands.length) {
      var fc = mix("#59606c", "#e3e8ee", light);
      for (var f = 0; f < fogBands.length; f++) {
        var b = fogBands[f];
        b.x += b.v * dt; if (b.x > cw + b.w / 2) b.x = -b.w / 2; if (b.x < -b.w / 2) b.x = cw + b.w / 2;
        var g = xFx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.w / 2);
        g.addColorStop(0, css(fc, 0.32 * p.fog)); g.addColorStop(1, css(fc, 0));
        xFx.save(); xFx.translate(b.x, b.y); xFx.scale(1, b.h / b.w); xFx.translate(-b.x, -b.y);
        xFx.fillStyle = g; xFx.fillRect(b.x - b.w / 2, b.y - b.w / 2, b.w, b.w); xFx.restore();
      }
    }
    if (particles.length) {
      var rainCol = css(mix("#8d9bb3", "#dbe6f5", light), (p.icy ? 0.65 : 0.5) + (photoOn ? 0.15 : 0));
      xFx.strokeStyle = rainCol; xFx.lineWidth = photoOn ? 1.4 : 1.1; xFx.beginPath();
      var snowCol = css(mix("#9aa6ba", "#ffffff", light), 0.9);
      for (var k = 0; k < particles.length; k++) {
        var q = particles[k];
        q.y += q.vy * dt;
        if (q.t === "rain") {
          q.x += q.vy * slant * dt;
          xFx.moveTo(q.x, q.y); xFx.lineTo(q.x - q.len * slant, q.y - q.len);
        } else if (q.t === "snow") {
          q.ph += dt * 1.5; q.x += (Math.sin(q.ph) * q.sw + 14 * (p.wind - 1) * 3) * dt;
        } else {
          q.x += q.vy * slant * dt;
        }
        if (q.y > ch + 20 || q.x > cw + 20 || q.x < -20) { var n2 = newParticle(q.t, Math.random() * (cw + 80) - 80 * slant * 4, -10); particles[k] = n2; }
      }
      xFx.stroke();
      xFx.fillStyle = snowCol;
      for (var m = 0; m < particles.length; m++) {
        var sp = particles[m];
        if (sp.t !== "rain") { xFx.beginPath(); xFx.arc(sp.x, sp.y, sp.r, 0, 6.283); xFx.fill(); }
      }
    }
    // lightning
    if (p.lightning > 0) {
      if (!nextStrike) nextStrike = ts + 2500 + Math.random() * 4000;
      if (ts > nextStrike) {
        flash = 1; bolt = makeBolt(cw, ch); nextStrike = ts + (3500 + Math.random() * 9000) / p.lightning;
      }
      if (flash > 0) {
        var fl = flash > 0.75 || (flash > 0.4 && flash < 0.55) ? flash : flash * 0.4;
        xFx.fillStyle = "rgba(225,232,255," + (0.45 * fl) + ")"; xFx.fillRect(0, 0, cw, ch);
        if (bolt && flash > 0.45) {
          xFx.strokeStyle = "rgba(255,255,255," + flash + ")"; xFx.lineWidth = 2.2; xFx.shadowColor = "#b9c8ff"; xFx.shadowBlur = 14;
          xFx.beginPath(); xFx.moveTo(bolt[0][0], bolt[0][1]);
          for (var bi = 1; bi < bolt.length; bi++) xFx.lineTo(bolt[bi][0], bolt[bi][1]);
          xFx.stroke(); xFx.shadowBlur = 0;
        }
        flash -= dt * 2.4;
      }
    }
  }
  function makeBolt(cw, ch) {
    var x = cw * (0.15 + Math.random() * 0.7), y = 0, pts = [[x, y]];
    while (y < ch * 0.75) { y += 10 + Math.random() * 18; x += (Math.random() - 0.5) * 26; pts.push([x, y]); }
    return pts;
  }

  // ---------- photo backgrounds ----------
  // Picks the most specific photo available in assets/backgrounds/, e.g.
  // rain-night-fall.jpg -> rain-night.jpg -> rain-fall.jpg -> rain.jpg -> night-fall.jpg -> night.jpg
  var WX_GROUP = { clear: "clear", "mostly-clear": "clear", hot: "clear", cold: "clear", "partly-cloudy": "cloudy", "mostly-cloudy": "cloudy",
    overcast: "cloudy", wind: "cloudy", showers: "rain", "showers-hi": "rain", drizzle: "rain", rain: "rain", freezing: "rain",
    tstorm: "storm", "tstorm-hi": "storm", tornado: "storm", hurricane: "storm", snow: "snow", blizzard: "snow", "rain-snow": "snow",
    sleet: "snow", fog: "fog", haze: "fog", smoke: "fog", dust: "fog" };
  function timeOfDay(s) {
    if (s.alt < -6) return "night";
    if (s.alt < 8) return S.localParts(s.time).hour < 12 ? "dawn" : "dusk";
    return "day";
  }
  function photoCandidates(s) {
    var wx = WX_GROUP[s.key] || "cloudy", tod = timeOfDay(s), se = s.season;
    var names = [wx + "-" + tod + "-" + se, wx + "-" + tod, wx + "-" + se, wx];
    // generic time-of-day photos only make sense for fair weather
    if (wx === "clear" || wx === "cloudy") names.push(tod + "-" + se, tod);
    return names.map(function (n) { return "assets/backgrounds/" + n + ".jpg"; });
  }
  var photoLayers = [], photoFront = 0, photoUrl = null, photoMissing = {}, photoOn = false;
  var MANIFEST = global.WX_BACKGROUNDS || null;
  var DEFAULT_GRAD = ["#2a3a55", "#59647a", "#2e3a2a"];
  var DRIFT_PERIOD = 120; // seconds for one full slow zoom in + out

  function gradient(c) {
    c = c && c.length === 3 ? c : DEFAULT_GRAD;
    return "linear-gradient(to bottom, " + c[0] + " 0%, " + c[1] + " 55%, " + c[2] + " 100%)";
  }
  function nameOf(url) { return url.replace(/^.*\//, "").replace(/\.jpg$/, ""); }

  // Everything that drifts is tied to the clock, so every page shows the same crop at the same moment
  function syncDrift(layer) {
    layer.style.animationDelay = (-((Date.now() / 1000) % DRIFT_PERIOD)).toFixed(2) + "s";
  }

  function showPhoto(url) {
    if (url === photoUrl) return;
    photoUrl = url;
    var colors = MANIFEST && MANIFEST[nameOf(url)];
    el.style.background = gradient(colors);
    try { localStorage.setItem("wx:bg", JSON.stringify({ url: url, colors: colors || null })); } catch (e) {}
    setPhotoMode(true);
    var img = new Image();
    img.onload = function () {
      if (url !== photoUrl) return;
      var next = photoLayers[1 - photoFront], cur = photoLayers[photoFront];
      var first = !cur.classList.contains("on");
      // already in the browser cache on a page's first paint: show it straight away, no fade
      next.classList.toggle("instant", first && img.complete && (performance.now() - t0) < 250);
      next.style.backgroundImage = "url('" + url + "')";
      syncDrift(next);
      next.classList.add("on"); cur.classList.remove("on");
      photoFront = 1 - photoFront;
    };
    img.onerror = function () {
      photoMissing[url] = true;
      if (url === photoUrl) { photoUrl = null; updatePhoto(); }
    };
    var t0 = performance.now();
    img.src = url;
  }
  function setPhotoMode(on) {
    photoOn = on;
    if (on) el.classList.add("photo-on"); else el.classList.remove("photo-on");
  }
  function noPhoto() {
    photoUrl = null;
    photoLayers.forEach(function (l) { l.classList.remove("on"); });
    setPhotoMode(false);
  }
  function updatePhoto() {
    var list = photoCandidates(scene).filter(function (u) { return !photoMissing[u]; });
    if (MANIFEST) {
      // the manifest lists what exists, so the choice is instant (no probing)
      for (var i = 0; i < list.length; i++) if (MANIFEST.hasOwnProperty(nameOf(list[i]))) { showPhoto(list[i]); return; }
      noPhoto();
      return;
    }
    (function tryNext(i) {
      if (i >= list.length) { noPhoto(); return; }
      if (list[i] === photoUrl) return;
      var img = new Image();
      img.onload = function () { showPhoto(list[i]); };
      img.onerror = function () { photoMissing[list[i]] = true; tryNext(i + 1); };
      img.src = list[i];
    })(0);
  }

  // ---------- public ----------
  var lastKey = null;
  function refresh(full) {
    scene = buildScene();
    if (!photoOn) { paintSky(); paintLand(); }
    var sig = scene.key + "|" + scene.snowy + "|" + Math.round(scene.light * 10);
    if (full || sig !== lastKey) { buildClouds(); buildParticles(); lastKey = sig; }
    if (photoLayers.length) {
      var wasOn = photoOn;
      updatePhoto();
      if (wasOn && !photoOn) { paintSky(); paintLand(); }
    }
    if (!C.animatedBackground) draw(0.016, performance.now());
  }

  function init(containerId) {
    el = document.getElementById(containerId || "sky");
    if (!el) return;
    cvSky = makeCanvas(HR, 0); cvCloud = makeCanvas(HR, 1); cvLand = makeCanvas(1, 2); cvFx = makeCanvas(HR, 3);
    xSky = cvSky.getContext("2d"); xCloud = cvCloud.getContext("2d"); xLand = cvLand.getContext("2d"); xFx = cvFx.getContext("2d");
    [cvSky, cvCloud, cvLand].forEach(function (c) { c.className = "scene"; });
    if (C.backgroundPhotos) {
      for (var i = 0; i < 2; i++) {
        var d = document.createElement("div"); d.className = "bg-photo" + (C.photoDrift ? "" : " still");
        el.insertBefore(d, cvFx); photoLayers.push(d);
      }
      // Start in photo mode: never flash the drawn scene. Until the photo is ready,
      // show a gradient in the last photo's colours.
      var last = null;
      try { last = JSON.parse(localStorage.getItem("wx:bg") || "null"); } catch (e) {}
      el.style.background = gradient(last && last.colors);
      setPhotoMode(true);
    } else {
      el.style.opacity = "0"; el.style.transition = "opacity 1.6s ease";
    }
    S.onObservation(function (o) { obs = o; refresh(false); el.style.opacity = "1"; });
    setInterval(function () { refresh(false); }, 60000);
    // first run in a new location: redraw once the real coordinates / time zone are known
    S.whenLocated(function () { if (scene) refresh(false); });
    if (C.animatedBackground) { running = true; requestAnimationFrame(frame); }
    // pick a background even if no weather data has arrived yet
    setTimeout(function () { if (!scene) { refresh(true); } el.style.opacity = "1"; }, 1500);
  }

  global.Sky = { init: init, refresh: refresh };
})(window);
