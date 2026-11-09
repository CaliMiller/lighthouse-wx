/* =====================================================================
   Weather Signage — animated SVG icon set
   WxIcons.weather(key, night)  -> SVG markup for a condition
   WxIcons.alert(eventName)     -> SVG markup for an NWS alert type
   Keys come from Signage.classify(): clear, mostly-clear, partly-cloudy,
   mostly-cloudy, overcast, showers, showers-hi, drizzle, rain, tstorm,
   tstorm-hi, snow, rain-snow, sleet, freezing, blizzard, fog, haze,
   smoke, dust, wind, tornado, hurricane, hot, cold
   Extra (alerts): flood, fire, ice, frost, warning, check
   Animations are CSS classes defined in signage.css.
   ===================================================================== */
(function (global) {
  "use strict";
  var uid = 0;

  function defs(P) {
    return '<defs>' +
      '<radialGradient id="' + P + 'sun" cx="40%" cy="36%" r="70%"><stop offset="0" stop-color="#fff6b8"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff9a1f"/></radialGradient>' +
      '<radialGradient id="' + P + 'glow"><stop offset="0" stop-color="#ffd54a" stop-opacity=".6"/><stop offset=".6" stop-color="#ffb52e" stop-opacity=".18"/><stop offset="1" stop-color="#ffb52e" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + P + 'mglow"><stop offset="0" stop-color="#fff8dc" stop-opacity=".28"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + P + 'moon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf0"/><stop offset="1" stop-color="#e3d6a2"/></linearGradient>' +
      '<linearGradient id="' + P + 'cl" gradientUnits="userSpaceOnUse" x1="0" y1="45" x2="0" y2="170"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cdd8e6"/></linearGradient>' +
      '<linearGradient id="' + P + 'cg" gradientUnits="userSpaceOnUse" x1="0" y1="45" x2="0" y2="170"><stop offset="0" stop-color="#d2d9e3"/><stop offset="1" stop-color="#8a96a9"/></linearGradient>' +
      '<linearGradient id="' + P + 'cd" gradientUnits="userSpaceOnUse" x1="0" y1="45" x2="0" y2="170"><stop offset="0" stop-color="#8e98aa"/><stop offset="1" stop-color="#454d5f"/></linearGradient>' +
      '<linearGradient id="' + P + 'drop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe0ff"/><stop offset="1" stop-color="#2f8cf0"/></linearGradient>' +
      '<linearGradient id="' + P + 'ice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9edcff"/></linearGradient>' +
      '<linearGradient id="' + P + 'bolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff38a"/><stop offset="1" stop-color="#ffaa00"/></linearGradient>' +
      '<linearGradient id="' + P + 'fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d62828"/><stop offset=".55" stop-color="#ff7a1a"/><stop offset="1" stop-color="#ffc53d"/></linearGradient>' +
      '<linearGradient id="' + P + 'water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cc2ff"/><stop offset="1" stop-color="#1667c9"/></linearGradient>' +
      '<linearGradient id="' + P + 'ok" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#49d68c"/><stop offset="1" stop-color="#16955a"/></linearGradient>' +
      '<linearGradient id="' + P + 'warn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#ffb000"/></linearGradient>' +
      '</defs>';
  }

  // ---------- primitives ----------
  var CLOUD = '<rect x="20" y="115" width="160" height="55" rx="27.5"/><circle cx="62" cy="118" r="38"/><circle cx="108" cy="95" r="50"/><circle cx="152" cy="120" r="34"/>';
  function cloud(P, x, y, s, tone, cls) {
    return '<g class="' + (cls || "") + '"><g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
      '<g transform="translate(5 10)" fill="#06122a" opacity=".2">' + CLOUD + '</g>' +
      '<g fill="url(#' + P + (tone || "cl") + ')">' + CLOUD + '</g></g></g>';
  }
  function sun(P, cx, cy, r, opts) {
    opts = opts || {};
    var rays = "";
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      var r1 = r * 1.3, r2 = r * 1.68;
      rays += '<line x1="' + (cx + Math.cos(a) * r1).toFixed(1) + '" y1="' + (cy + Math.sin(a) * r1).toFixed(1) +
        '" x2="' + (cx + Math.cos(a) * r2).toFixed(1) + '" y2="' + (cy + Math.sin(a) * r2).toFixed(1) + '"/>';
    }
    var o = 'style="--ox:' + cx + 'px;--oy:' + cy + 'px"';
    return '<g opacity="' + (opts.opacity || 1) + '">' +
      '<circle class="pulse" ' + o + ' cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.9) + '" fill="url(#' + P + 'glow)"/>' +
      '<g class="spin" ' + o + ' stroke="' + (opts.ray || "#ffc531") + '" stroke-width="' + (r * 0.2).toFixed(1) + '" stroke-linecap="round">' + rays + '</g>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (opts.fill || "url(#" + P + "sun)") + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 2) + '" fill="none" stroke="#fff6c0" stroke-opacity=".5" stroke-width="3"/>' +
      '</g>';
  }
  function moon(P, cx, cy, r, withStars) {
    var id = P + "m" + (++uid);
    var s = '<mask id="' + id + '"><rect width="256" height="256" fill="#000"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fff"/>' +
      '<circle cx="' + (cx + r * 0.46) + '" cy="' + (cy - r * 0.34) + '" r="' + (r * 0.84) + '" fill="#000"/></mask>';
    var o = 'style="--ox:' + cx + 'px;--oy:' + cy + 'px"';
    var out = '<defs>' + s + '</defs>' +
      '<circle class="pulse" ' + o + ' cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.7) + '" fill="url(#' + P + 'mglow)"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#' + P + 'moon)" mask="url(#' + id + ')"/>';
    if (withStars) {
      out += star(cx + r * 1.15, cy - r * 0.55, 13, 0) + star(cx + r * 1.5, cy + r * 0.45, 9, 0.9) + star(cx - r * 0.2, cy - r * 1.25, 8, 1.6);
    }
    return out;
  }
  function star(x, y, s, d) {
    var k = s * 0.28;
    return '<path class="twinkle" style="animation-delay:' + d + 's" fill="#fff4c2" d="M' + x + ' ' + (y - s) +
      ' L' + (x + k) + ' ' + (y - k) + ' L' + (x + s) + ' ' + y + ' L' + (x + k) + ' ' + (y + k) +
      ' L' + x + ' ' + (y + s) + ' L' + (x - k) + ' ' + (y + k) + ' L' + (x - s) + ' ' + y + ' L' + (x - k) + ' ' + (y - k) + 'Z"/>';
  }
  function celestial(P, night, cx, cy, r, opts) {
    return night ? moon(P, cx, cy, r * 1.05, false) : sun(P, cx, cy, r, opts);
  }
  var DROP = "M0 -15 C5 -6 10 0 10 6 A10 10 0 0 1 -10 6 C-10 0 -5 -6 0 -15Z";
  function drops(P, pts, scale, fill) {
    return pts.map(function (p) {
      return '<g class="fall" style="animation-delay:' + p[2] + 's"><path transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + (scale || 1) + ')" d="' + DROP + '" fill="' + (fill || "url(#" + P + "drop)") + '"/></g>';
    }).join("");
  }
  function flakes(pts, size) {
    return pts.map(function (p) {
      var s = size || 13, arms = "";
      [90, 30, -30].forEach(function (deg) {
        var a = deg * Math.PI / 180, dx = (Math.cos(a) * s).toFixed(1), dy = (Math.sin(a) * s).toFixed(1);
        arms += '<line x1="' + (-dx) + '" y1="' + (-dy) + '" x2="' + dx + '" y2="' + dy + '"/>';
      });
      return '<g class="fall-slow" style="animation-delay:' + p[2] + 's;transform-box:fill-box;transform-origin:center"><g transform="translate(' + p[0] + ' ' + p[1] + ')" stroke="#ffffff" stroke-width="5" stroke-linecap="round">' + arms + '</g></g>';
    }).join("");
  }
  function pellets(pts) {
    return pts.map(function (p) {
      return '<g class="bounce" style="animation-delay:' + p[2] + 's"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="7" fill="#eef8ff" stroke="#8fcaf3" stroke-width="3"/></g>';
    }).join("");
  }
  function bolt(P, x, y, s) {
    return '<g class="flash"><path transform="translate(' + x + ' ' + y + ') scale(' + (s || 1) + ')" d="M20 0 L0 46 H19 L8 88 L48 30 H27 L40 0 Z" fill="url(#' + P + 'bolt)" stroke="#ff9500" stroke-width="2.5" stroke-linejoin="round"/></g>';
  }
  function icicles(P, x1, x2, y) {
    var out = "", n = 5, w = (x2 - x1) / n;
    for (var i = 0; i < n; i++) {
      var cx = x1 + w * i + w / 2, h = 22 + (i % 2) * 14;
      out += '<path d="M' + (cx - 8) + ' ' + y + ' L' + (cx + 8) + ' ' + y + ' L' + cx + ' ' + (y + h) + ' Z" fill="url(#' + P + 'ice)" stroke="#bfe8ff" stroke-width="2" stroke-linejoin="round"/>';
    }
    return out;
  }
  function fogLines(ys, x1, x2, color, width) {
    return ys.map(function (y, i) {
      var inset = (i % 2) * 22;
      return '<g class="' + (i % 2 ? "slide2" : "slide") + '"><line x1="' + (x1 + inset) + '" y1="' + y + '" x2="' + (x2 - (1 - i % 2) * 18) + '" y2="' + y + '" stroke="' + color + '" stroke-width="' + (width || 13) + '" stroke-linecap="round"/></g>';
    }).join("");
  }
  function windStreaks(color, yOff) {
    yOff = yOff || 0;
    var paths = [
      "M24 " + (110 + yOff) + " H150 C172 " + (110 + yOff) + " 184 " + (94 + yOff) + " 178 " + (78 + yOff) + " C172 " + (62 + yOff) + " 150 " + (62 + yOff) + " 146 " + (80 + yOff),
      "M24 " + (150 + yOff) + " H196 C222 " + (150 + yOff) + " 234 " + (170 + yOff) + " 224 " + (186 + yOff) + " C214 " + (202 + yOff) + " 192 " + (198 + yOff) + " 190 " + (182 + yOff),
      "M44 " + (190 + yOff) + " H136"
    ];
    return '<g fill="none" stroke="' + (color || "#e8f3ff") + '" stroke-width="13" stroke-linecap="round">' +
      paths.map(function (d, i) {
        return '<path class="gust" style="animation-delay:' + (i * 0.45) + 's" pathLength="100" stroke-dasharray="70 30" d="' + d + '"/>';
      }).join("") + "</g>";
  }
  function thermometer(P, x, top, h, level, color) {
    var bulbY = top + h + 16;
    var mTop = top + 10 + (h - 10) * (1 - level);
    var ticks = "";
    for (var i = 1; i <= 4; i++) {
      var ty = top + (h / 5) * i;
      ticks += '<line x1="' + (x + 20) + '" y1="' + ty + '" x2="' + (x + 32) + '" y2="' + ty + '"/>';
    }
    return '<g>' +
      '<rect x="' + (x - 17) + '" y="' + top + '" width="34" height="' + (h + 20) + '" rx="17" fill="#f5f8fc" stroke="#c4cfdc" stroke-width="3"/>' +
      '<circle cx="' + x + '" cy="' + bulbY + '" r="29" fill="#f5f8fc" stroke="#c4cfdc" stroke-width="3"/>' +
      '<circle cx="' + x + '" cy="' + bulbY + '" r="21" fill="' + color + '"/>' +
      '<rect x="' + (x - 8) + '" y="' + mTop + '" width="16" height="' + (bulbY - mTop) + '" rx="8" fill="' + color + '"/>' +
      '<g stroke="#f5f8fc" stroke-width="4" stroke-linecap="round">' + ticks + '</g></g>';
  }

  function wrap(P, body, cls) {
    return '<svg class="wxi ' + (cls || "") + '" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + defs(P) + body + "</svg>";
  }

  // ---------- weather icons ----------
  var KNOWN = ["clear", "mostly-clear", "partly-cloudy", "mostly-cloudy", "overcast", "showers", "showers-hi", "drizzle", "rain",
    "tstorm", "tstorm-hi", "snow", "rain-snow", "sleet", "freezing", "ice", "blizzard", "fog", "haze", "smoke", "dust", "wind",
    "tornado", "hurricane", "hot", "heat", "cold", "frost", "flood", "fire", "air", "check", "warning"];
  function weather(key, night) {
    if (KNOWN.indexOf(key) < 0) key = "partly-cloudy";
    var P = "wx" + (++uid) + "-";
    var b = "";
    var peek = function () { return celestial(P, night, 78, 70, 38); };
    var topCloud = function (tone) { return cloud(P, 28, 8, 1.0, tone, "bob"); };
    switch (key) {
      case "clear":
        b = night ? moon(P, 120, 132, 72, true) : sun(P, 128, 128, 60);
        break;
      case "mostly-clear":
        b = celestial(P, night, 104, 100, 54) + cloud(P, 92, 116, 0.7, "cl", "drift");
        break;
      case "partly-cloudy":
        b = celestial(P, night, 90, 88, 48) + cloud(P, 58, 84, 0.95, "cl", "drift");
        break;
      case "mostly-cloudy":
        b = celestial(P, night, 76, 76, 38) + cloud(P, 104, 34, 0.66, "cg", "drift2") + cloud(P, 26, 84, 0.98, "cl", "drift");
        break;
      case "overcast":
        b = cloud(P, 92, 30, 0.74, "cg", "drift2") + cloud(P, 18, 80, 1.02, "cl", "drift");
        break;
      case "showers":
        b = topCloud("cl") + drops(P, [[88, 200, 0], [128, 200, 0.45], [168, 200, 0.9], [108, 214, 0.25], [148, 214, 0.7]]);
        break;
      case "showers-hi":
        b = peek() + cloud(P, 40, 26, 0.95, "cl", "bob") + drops(P, [[100, 206, 0], [140, 206, 0.5], [180, 206, 0.25]]);
        break;
      case "drizzle":
        b = topCloud("cg") + drops(P, [[82, 198, 0], [116, 206, 0.35], [150, 198, 0.7], [184, 206, 0.2], [100, 222, 0.55], [168, 222, 0.9]], 0.6);
        break;
      case "rain":
        b = topCloud("cg") + drops(P, [[76, 198, 0], [112, 198, 0.4], [148, 198, 0.8], [184, 198, 0.2], [94, 214, 0.6], [130, 214, 1.0], [166, 214, 0.3]]);
        break;
      case "tstorm":
        b = topCloud("cd") + bolt(P, 104, 150, 1.05) + drops(P, [[70, 200, 0], [190, 200, 0.5], [86, 222, 0.8], [174, 222, 0.25]]);
        break;
      case "tstorm-hi":
        b = peek() + cloud(P, 40, 26, 0.95, "cd", "bob") + bolt(P, 112, 160, 0.95) + drops(P, [[84, 210, 0.3], [190, 210, 0.8]]);
        break;
      case "snow":
        b = topCloud("cl") + flakes([[74, 202, 0], [128, 202, 0.9], [182, 202, 1.8], [101, 230, 0.5], [155, 230, 1.4]], 16);
        break;
      case "rain-snow":
        b = topCloud("cg") + flakes([[84, 206, 0], [150, 222, 1.3], [190, 206, 0.6]]) + drops(P, [[118, 204, 0.3], [170, 200, 0.8], [96, 224, 0.6]]);
        break;
      case "sleet":
        b = topCloud("cg") + drops(P, [[80, 200, 0], [140, 200, 0.6], [196, 200, 0.3]]) + pellets([[110, 200, 0.2], [170, 200, 0.8], [124, 222, 0.5]]);
        break;
      case "freezing":
      case "ice":
        b = topCloud("cg") + icicles(P, 64, 196, 168) + drops(P, [[84, 212, 0], [128, 212, 0.5], [172, 212, 0.25]], 0.9, "url(#" + P + "ice)");
        break;
      case "blizzard":
        b = cloud(P, 28, -4, 0.92, "cl", "bob") + flakes([[70, 182, 0], [118, 190, 0.7], [170, 182, 1.4], [212, 194, 2.0]], 12) +
          '<g fill="none" stroke="#ffffff" stroke-width="11" stroke-linecap="round">' +
          '<path class="gust" pathLength="100" stroke-dasharray="70 30" d="M30 222 H170 C192 222 200 240 188 248"/>' +
          '<path class="gust" style="animation-delay:.7s" pathLength="100" stroke-dasharray="70 30" d="M60 246 H130"/></g>';
        break;
      case "fog":
        b = celestial(P, night, 92, 84, 40, { opacity: 0.85 }) + cloud(P, 70, 40, 0.7, "cg", "drift2") +
          fogLines([156, 184, 212, 240], 30, 226, "#e9eff6");
        break;
      case "haze":
        b = sun(P, 128, 104, 50, { opacity: 0.9 }) + fogLines([178, 206, 234], 30, 226, "#ead1a1");
        break;
      case "smoke":
        b = sun(P, 128, 100, 48, { opacity: 0.75, fill: "#ff8d4d", ray: "#e8935a" }) + fogLines([170, 198, 226], 26, 230, "#b8a596", 16);
        break;
      case "dust":
        b = sun(P, 160, 80, 36, { opacity: 0.7, fill: "#f2b35a", ray: "#d9a35a" }) + windStreaks("#e2c08b", 10);
        break;
      case "wind":
        b = cloud(P, 112, 10, 0.62, "cl", "drift") + windStreaks("#eaf4ff", 16);
        break;
      case "tornado":
        b = '<g class="sway">' +
          [[150, 112, 14], [170, 98, 13], [190, 78, 12], [208, 58, 11], [226, 40, 10], [242, 24, 9]].map(function (r, i) {
            var cx = 128 + i * 4;
            return '<line x1="' + (cx - r[1] / 2) + '" y1="' + r[0] + '" x2="' + (cx + r[1] / 2) + '" y2="' + r[0] + '" stroke="' + (i % 2 ? "#8b95a7" : "#a7b0bf") + '" stroke-width="' + r[2] + '" stroke-linecap="round"/>';
          }).join("") + "</g>" + cloud(P, 28, -18, 1.0, "cd", "bob");
        break;
      case "hurricane":
        b = '<g class="spin" style="--ox:128px;--oy:128px;animation-duration:6s" fill="none" stroke-linecap="round">' +
          '<path d="M98 128 C98 80 138 44 200 46" stroke="#ff6b3d" stroke-width="24"/>' +
          '<path d="M158 128 C158 176 118 212 56 210" stroke="#ff6b3d" stroke-width="24"/>' +
          '<circle cx="128" cy="128" r="32" stroke="#ffd0bf" stroke-width="20"/></g>';
        break;
      case "hot":
      case "heat":
        b = sun(P, 98, 96, 50) + thermometer(P, 192, 52, 120, 0.92, "#ef3b2d") +
          '<g stroke="#ffb36b" stroke-width="7" stroke-linecap="round" fill="none">' +
          '<path class="heat" d="M44 232 q8 -10 0 -20 q-8 -10 0 -20"/><path class="heat" style="animation-delay:.6s" d="M80 236 q8 -10 0 -20 q-8 -10 0 -20"/><path class="heat" style="animation-delay:1.2s" d="M116 232 q8 -10 0 -20 q-8 -10 0 -20"/></g>';
        break;
      case "cold":
        b = thermometer(P, 170, 44, 130, 0.18, "#2f8cf0") +
          '<g class="spin" style="--ox:82px;--oy:110px;animation-duration:14s" stroke="#e6f6ff" stroke-width="10" stroke-linecap="round">' +
          snowflakeLines(82, 110, 52) + "</g>";
        break;
      case "frost":
        b = '<g class="spin" style="--ox:128px;--oy:128px;animation-duration:18s" stroke="#e6f6ff" stroke-width="13" stroke-linecap="round" fill="none">' +
          snowflakeLines(128, 128, 92) + "</g>";
        break;
      case "flood":
        b = cloud(P, 34, -6, 0.86, "cg", "bob") + drops(P, [[90, 158, 0], [130, 158, 0.5], [170, 158, 0.25]], 0.85) +
          '<g fill="none" stroke-linecap="round" stroke-width="14">' +
          '<path class="wave" stroke="url(#' + P + 'water)" d="M22 204 q18 -16 36 0 t36 0 t36 0 t36 0 t36 0 t36 0"/>' +
          '<path class="wave2" stroke="#2f8cf0" d="M22 236 q18 -16 36 0 t36 0 t36 0 t36 0 t36 0 t36 0"/></g>';
        break;
      case "fire":
        b = '<g class="flicker"><path fill="url(#' + P + 'fire)" d="M128 22 C152 66 200 94 200 160 C200 206 168 238 128 238 C88 238 56 206 56 160 C56 124 78 102 92 78 C96 104 106 118 118 122 C112 88 114 52 128 22Z"/>' +
          '<path fill="#ffe27a" d="M128 120 C141 148 164 160 164 192 C164 216 148 232 128 232 C108 232 92 216 92 193 C92 172 104 160 113 149 C115 166 121 172 128 175 C124 156 124 138 128 120Z"/></g>';
        break;
      case "air":
        b = fogLines([96, 128, 160, 192], 34, 222, "#c9b8a8", 16);
        break;
      case "check":
        b = '<circle cx="128" cy="128" r="104" fill="url(#' + P + 'ok)"/><circle cx="128" cy="128" r="104" fill="none" stroke="#b9f5d3" stroke-opacity=".5" stroke-width="4"/>' +
          '<path class="drawcheck" pathLength="100" d="M80 132 L114 166 L178 96" fill="none" stroke="#ffffff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>';
        break;
      case "warning":
      default:
        b = '<g class="pulse" style="--ox:128px;--oy:140px"><path d="M128 34 L230 214 H26 Z" fill="url(#' + P + 'warn)" stroke="#ffc400" stroke-width="22" stroke-linejoin="round"/>' +
          '<rect x="116" y="96" width="24" height="70" rx="12" fill="#2a1c00"/><circle cx="128" cy="192" r="14" fill="#2a1c00"/></g>';
    }
    return wrap(P, b);
  }
  function snowflakeLines(cx, cy, r) {
    var out = "";
    for (var i = 0; i < 3; i++) {
      var a = (90 + i * 60) * Math.PI / 180, dx = Math.cos(a) * r, dy = Math.sin(a) * r;
      out += '<line x1="' + (cx - dx).toFixed(1) + '" y1="' + (cy - dy).toFixed(1) + '" x2="' + (cx + dx).toFixed(1) + '" y2="' + (cy + dy).toFixed(1) + '"/>';
    }
    for (var j = 0; j < 6; j++) {
      var b = (90 + j * 60) * Math.PI / 180;
      var px = cx + Math.cos(b) * r * 0.6, py = cy + Math.sin(b) * r * 0.6;
      [-40, 40].forEach(function (off) {
        var c = b + off * Math.PI / 180;
        out += '<line x1="' + px.toFixed(1) + '" y1="' + py.toFixed(1) + '" x2="' + (px + Math.cos(c) * r * 0.32).toFixed(1) + '" y2="' + (py + Math.sin(c) * r * 0.32).toFixed(1) + '"/>';
      });
    }
    return out;
  }

  // ---------- alert icons ----------
  var ALERT_RULES = [
    [/tornado/i, "tornado"],
    [/hurricane|tropical|typhoon|storm surge/i, "hurricane"],
    [/thunderstorm|lightning/i, "tstorm"],
    [/flood|hydrologic/i, "flood"],
    [/blizzard|snow squall/i, "blizzard"],
    [/ice storm|freezing (rain|drizzle|spray|fog)/i, "ice"],
    [/winter|snow|lake effect|sleet/i, "snow"],
    [/wind chill|extreme cold|cold weather|hard freeze/i, "cold"],
    [/freeze|frost/i, "frost"],
    [/heat/i, "heat"],
    [/red flag|fire/i, "fire"],
    [/dust|blowing/i, "dust"],
    [/smoke|air quality|air stagnation|ashfall/i, "air"],
    [/fog/i, "fog"],
    [/wind|gale/i, "wind"]
  ];
  function alertKey(event) {
    for (var i = 0; i < ALERT_RULES.length; i++) if (ALERT_RULES[i][0].test(event || "")) return ALERT_RULES[i][1];
    return "warning";
  }
  function alert(event) { return weather(alertKey(event), false); }

  global.WxIcons = { weather: weather, alert: alert, alertKey: alertKey };
})(window);
