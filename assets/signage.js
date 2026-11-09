/* =====================================================================
   Weather Signage — shared core
   - Settings for location / station / refresh rates (edit CONFIG below)
   - Scales the 1920x1080 stage to any window size
   - Header clock (always in Indiana time, even if the device is on UTC)
   - National Weather Service data helpers with offline caching
   - Sun / moon calculations (no third-party sunrise API needed)
   - Condition classifier shared by icons and backgrounds
   Written for older Chromium-based kiosk browsers (Anthias / QtWebEngine):
   no optional chaining, no newer CSS features.
   ===================================================================== */
(function (global) {
  "use strict";

  // The location comes from the ZIP code set at the top of each page (window.WX_SETTINGS).
  // Everything below it (coordinates, weather station, forecast area, alert zones,
  // time zone) is looked up automatically from the National Weather Service.
  var CONFIG = {
    locationName: "",
    lat: 39.83, lon: -98.58,          // placeholder until the location is resolved
    stations: [],                     // nearest NWS observation stations, closest first
    forecastUrl: "",
    alertArea: "",                    // state, e.g. "IN"
    alertZones: [],                   // NWS county / forecast / fire-weather zone codes
    timeZone: "",                     // e.g. "America/Indiana/Indianapolis"
    // Alerts we do not show on the board
    excludeEvents: ["Special Weather Statement", "Hydrologic Outlook"],
    refreshObsMs: 5 * 60 * 1000,
    refreshForecastMs: 30 * 60 * 1000,
    refreshAlertsMs: 60 * 1000,
    alertPageSeconds: 9,              // when more than 3 alerts, cycle pages this often
    // Background options
    backgroundFps: 30,                // lower (e.g. 20) on slower players
    backgroundPhotos: true,           // use photos from assets/backgrounds/ when present (see README)
    photoDrift: true,                 // slow zoom on the photo (same on every page); false = fixed crop
    animatedBackground: true          // false = static scene, no moving clouds / rain
  };

  // ---------- URL options (for testing) ----------
  // ?cond=tstorm&hour=21&month=1&temp=20&alerts=demo&fps=20&static=1
  var params = {};
  (location.search || "").replace(/^\?/, "").split("&").forEach(function (kv) {
    if (!kv) return;
    var p = kv.split("=");
    params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
  });
  if (params.fps) CONFIG.backgroundFps = Math.max(5, Math.min(60, +params.fps));
  if (params["static"] === "1") CONFIG.animatedBackground = false;
  if (params.photos === "1") CONFIG.backgroundPhotos = true;
  if (params.photos === "0") CONFIG.backgroundPhotos = false;

  // ---------- Location settings ----------
  // Set in each page:  window.WX_SETTINGS = { zip: "46176" }
  // or with latitude / longitude instead:  { lat: 39.52, lon: -85.78 }
  // A URL like current.html?zip=90210 overrides the page setting.
  var settings = global.WX_SETTINGS || {};
  var manualLat = params.lat || settings.lat, manualLon = params.lon || settings.lon;
  var zip = String(params.zip || settings.zip || "").replace(/[^0-9]/g, "").slice(0, 5);
  var useLatLon = manualLat !== undefined && manualLat !== "" && manualLon !== undefined && manualLon !== "";
  var locKey = useLatLon ? "ll" + (+manualLat).toFixed(3) + "," + (+manualLon).toFixed(3) : "zip" + zip;

  // ---------- Time (with optional preview offset) ----------
  // ?hour= and ?month= are applied in the *location's* time zone (including daylight
  // saving), so the offset is recalculated whenever that time zone becomes known.
  var timeOffset = 0;
  function computeTimeOffset() {
    if (!params.hour && !params.month) return;
    var real = new Date();
    var off = 0;
    if (params.month) off = Math.round((+params.month - localParts(real).month) * 30.44) * 86400000;
    var lp = localParts(new Date(real.getTime() + off));
    if (params.hour !== undefined && params.hour !== "") off += (+params.hour - (lp.hour + lp.minute / 60)) * 3600000;
    timeOffset = off;
  }
  function now() { return new Date(Date.now() + timeOffset); }

  var partsFmt = null;
  computeTimeOffset();
  function localParts(date) {
    if (!partsFmt) {
      try {
        partsFmt = new Intl.DateTimeFormat("en-US", {
          timeZone: CONFIG.timeZone || undefined, hour12: false, year: "numeric", month: "numeric",
          day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", weekday: "short"
        });
      } catch (e) { partsFmt = false; }
    }
    if (partsFmt && partsFmt.formatToParts) {
      var o = {};
      partsFmt.formatToParts(date).forEach(function (p) { o[p.type] = p.value; });
      var h = +o.hour; if (h === 24) h = 0;
      return { year: +o.year, month: +o.month, day: +o.day, hour: h, minute: +o.minute, second: +o.second, weekday: o.weekday };
    }
    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds(), weekday: days[date.getDay()] };
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var LONG_DAYS = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };

  function fmtTime(date, opts) {
    var p = localParts(date);
    var h = p.hour % 12 || 12;
    var ap = p.hour >= 12 ? "PM" : "AM";
    if (opts && opts.compact && p.minute === 0) return h + " " + ap;
    return h + ":" + (p.minute < 10 ? "0" : "") + p.minute + " " + ap;
  }
  function dayKey(date) { var p = localParts(date); return p.year * 400 + p.month * 32 + p.day; }
  // "Today 6 PM", "Tonight 11 PM", "Tomorrow 7 AM", "Wed 7 AM"
  function fmtWhen(date) {
    var n = now();
    var p = localParts(date);
    var t = fmtTime(date, { compact: true });
    var dk = dayKey(date), nk = dayKey(n), tk = dayKey(new Date(n.getTime() + 86400000));
    if (dk === nk) return (p.hour >= 18 ? "Tonight " : "Today ") + t;
    if (dk === tk) return "Tomorrow " + t;
    return p.weekday + " " + t;
  }

  // ---------- Stage scaling ----------
  function fitStage() {
    var stage = document.getElementById("stage");
    if (!stage) return;
    var w = window.innerWidth || document.documentElement.clientWidth;
    var h = window.innerHeight || document.documentElement.clientHeight;
    var s = Math.min(w / 1920, h / 1080);
    var x = (w - 1920 * s) / 2, y = (h - 1080 * s) / 2;
    stage.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
  }
  window.addEventListener("resize", fitStage);

  // ---------- Clock ----------
  function startClock() {
    var tEl = document.getElementById("clockTime");
    var dEl = document.getElementById("clockDate");
    var started = Date.now(), lastShape = "";
    function tick() {
      // first load in a new place: wait (briefly) for the location's time zone so the
      // clock never shows the device's own time zone first
      if (!CONFIG.timeZone && Date.now() - started < 5000) { if (tEl) tEl.innerHTML = "&nbsp;"; return; }
      var d = now(), p = localParts(d);
      var h = p.hour % 12 || 12;
      if (tEl) tEl.innerHTML = h + ":" + (p.minute < 10 ? "0" : "") + p.minute + '<span class="sec">:' + (p.second < 10 ? "0" : "") + p.second +
        '</span><span class="ampm">' + (p.hour >= 12 ? "PM" : "AM") + "</span>";
      // the clock is wider at 10:00-12:59; refit the page title whenever its width changes
      var shape = String(h).length + (p.hour >= 12 ? "p" : "a");
      if (shape !== lastShape) { lastShape = shape; var h1 = document.querySelector(".title-block h1"); if (h1) fitText(h1, +h1.getAttribute("data-fit") || 60); }
      if (dEl) dEl.textContent = (LONG_DAYS[p.weekday] || p.weekday) + ", " + MONTHS[p.month - 1] + " " + p.day;
    }
    tick();
    // line the ticks up with the start of each real second
    setTimeout(function () { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000) + 5);
  }

  // Same "Updated ..." line at the bottom-left of every page
  function setUpdated(date, stale) {
    var el = document.getElementById("note");
    if (!el) return;
    if (!date) { el.innerHTML = ""; return; }
    var n = now(), same = localParts(n).day === localParts(date).day && Math.abs(n - date) < 86400000;
    var txt = "Updated " + (same ? "" : localParts(date).weekday + " ") + fmtTime(date);
    el.innerHTML = stale ? '<span class="stale">' + txt + "</span>" : txt;
  }

  // ---------- Fit text into its box ----------
  // Shrinks font-size until the element's content fits its own box.
  function fitText(el, minPx) {
    if (!el) return;
    var max = parseFloat(el.getAttribute("data-max")) || parseFloat(getComputedStyle(el).fontSize);
    el.setAttribute("data-max", max);
    var size = max;
    el.style.fontSize = size + "px";
    var guard = 0;
    while ((el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && size > (minPx || 20) && guard++ < 80) {
      size -= 2;
      el.style.fontSize = size + "px";
    }
  }
  function fitAll(root) {
    var list = (root || document).querySelectorAll("[data-fit]");
    for (var i = 0; i < list.length; i++) fitText(list[i], +list[i].getAttribute("data-fit") || 24);
  }

  // ---------- Storage (safe) ----------
  // Saved data is kept per location, so changing the ZIP never shows another town's weather
  function store(key, val) { try { localStorage.setItem("wx:" + locKey + ":" + key, JSON.stringify({ t: Date.now(), v: val })); } catch (e) {} }
  function recall(key, maxAgeMs) {
    try {
      var raw = localStorage.getItem("wx:" + locKey + ":" + key);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (maxAgeMs && Date.now() - o.t > maxAgeMs) return null;
      return o;
    } catch (e) { return null; }
  }

  // ---------- Fetch helpers ----------
  function getJSON(url, tries) {
    tries = tries || 2;
    return fetch(url, { headers: { Accept: "application/geo+json" }, cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).catch(function (err) {
      if (tries > 1) return new Promise(function (res) { setTimeout(res, 2500); }).then(function () { return getJSON(url, tries - 1); });
      throw err;
    });
  }

  function cToF(c) { return c === null || c === undefined ? null : c * 9 / 5 + 32; }
  function kmhToMph(k) { return k === null || k === undefined ? null : k * 0.621371; }
  function val(o) { return o && o.value !== undefined ? o.value : null; }

  function compass(deg) {
    if (deg === null || deg === undefined) return "";
    var dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  // Latest observation with a valid temperature, from the nearest station that has one.
  function fetchObservation() {
    var list = CONFIG.stations;
    function tryStation(i) {
      if (i >= list.length) return Promise.reject(new Error("No recent observation from nearby stations"));
      return getJSON("https://api.weather.gov/stations/" + list[i].id + "/observations?limit=8").then(function (data) {
        var obs = parseObservation(data);
        if (!obs) return tryStation(i + 1);
        obs.station = list[i].id; obs.stationName = list[i].name;
        return obs;
      }, function () { return tryStation(i + 1); });
    }
    return tryStation(0).then(function (obs) { store("obs", obs); return obs; });
  }
  function parseObservation(data) {
    var feats = (data && data.features) || [];
    var best = null;
    for (var i = 0; i < feats.length; i++) {
      if (val(feats[i].properties.temperature) !== null) { best = feats[i].properties; break; }
    }
    if (!best) return null;
    // ignore stations whose latest reading is more than 3 hours old
    if (Date.now() - new Date(best.timestamp).getTime() > 3 * 3600000) return null;
    var desc = best.textDescription;
    if (!desc) for (var j = 0; j < feats.length; j++) { if (feats[j].properties.textDescription) { desc = feats[j].properties.textDescription; break; } }
    return {
      time: best.timestamp,
      text: desc || "",
      icon: best.icon || "",
      tempF: cToF(val(best.temperature)),
      dewF: cToF(val(best.dewpoint)),
      humidity: val(best.relativeHumidity),
      windMph: kmhToMph(val(best.windSpeed)),
      gustMph: kmhToMph(val(best.windGust)),
      windDir: val(best.windDirection),
      heatIndexF: cToF(val(best.heatIndex)),
      windChillF: cToF(val(best.windChill)),
      visibilityMi: val(best.visibility) === null ? null : val(best.visibility) / 1609.34,
      pressureInHg: val(best.barometricPressure) === null ? null : val(best.barometricPressure) / 3386.39
    };
  }

  // Shared observation used by every page's background (and current page)
  var obsListeners = [];
  var currentObs = null;
  function applySim(obs) {
    obs = obs ? JSON.parse(JSON.stringify(obs)) : { text: "", icon: "", tempF: 50 };
    if (params.cond) { obs.icon = ""; obs.text = SIM_TEXT[params.cond] || params.cond; }
    if (params.temp) obs.tempF = +params.temp;
    return obs;
  }
  var SIM_TEXT = {
    clear: "Clear", "mostly-clear": "Mostly Clear", "partly-cloudy": "Partly Cloudy", "mostly-cloudy": "Mostly Cloudy",
    overcast: "Overcast", rain: "Rain", showers: "Rain Showers", drizzle: "Light Drizzle", tstorm: "Thunderstorm",
    snow: "Snow", "rain-snow": "Rain and Snow", sleet: "Sleet", freezing: "Freezing Rain", fog: "Fog",
    haze: "Haze", smoke: "Smoke", wind: "Windy", blizzard: "Blizzard", tornado: "Tornado", hot: "Hot", cold: "Cold", dust: "Dust"
  };
  function onObservation(fn) { obsListeners.push(fn); if (currentObs) fn(currentObs, true); }
  function publishObs(obs, fromCache) {
    currentObs = applySim(obs);
    obsListeners.forEach(function (fn) { try { fn(currentObs, fromCache); } catch (e) { console.error(e); } });
  }
  function startObservations() {
    var cached = recall("obs", 6 * 3600000);
    if (cached) publishObs(cached.v, true);
    else if (params.cond) publishObs(null, true);
    function load() {
      fetchObservation().then(function (o) { publishObs(o, false); }).catch(function (e) {
        console.warn("Observation fetch failed", e);
        if (!currentObs) publishObs(null, true);
      });
    }
    whenLocated(function () {
      load();
      setInterval(load, CONFIG.refreshObsMs);
    });
  }

  // ---------- Forecast (shared by current + forecast pages) ----------
  function fetchForecast() {
    return getJSON(CONFIG.forecastUrl, 3).then(function (d) {
      var periods = (d.properties && d.properties.periods) || [];
      if (!periods.length) throw new Error("Empty forecast");
      var slim = periods.slice(0, 14).map(function (p) {
        return {
          name: p.name, start: p.startTime, end: p.endTime, isDaytime: p.isDaytime, temp: p.temperature,
          short: p.shortForecast, icon: p.icon, pop: p.probabilityOfPrecipitation ? p.probabilityOfPrecipitation.value : null,
          wind: p.windSpeed, windDir: p.windDirection
        };
      });
      store("forecast", slim);
      return slim;
    });
  }
  function startForecast(cb) {
    var cached = recall("forecast", 12 * 3600000);
    if (cached) cb(dropPast(cached.v), true, cached.t);
    function load() {
      fetchForecast().then(function (p) { cb(dropPast(p), false, Date.now()); })
        .catch(function (e) { console.warn("Forecast fetch failed", e); if (!cached) cb(null, true, null); });
    }
    whenLocated(function () {
      load();
      setInterval(load, CONFIG.refreshForecastMs);
    });
  }
  function dropPast(periods) {
    var t = now().getTime();
    return (periods || []).filter(function (p) { return new Date(p.end).getTime() > t; });
  }

  // ---------- Location lookup ----------
  // ZIP -> coordinates (Zippopotam.us, free, no key), then the NWS "points" service
  // gives the forecast office, nearest stations, alert zones and time zone.
  var locWaiters = [], located = false, locError = null;
  function whenLocated(fn) { if (located) fn(); else locWaiters.push(fn); }
  function applyLocation(loc) {
    CONFIG.lat = loc.lat; CONFIG.lon = loc.lon;
    CONFIG.locationName = loc.name;
    CONFIG.stations = loc.stations;
    CONFIG.forecastUrl = loc.forecastUrl;
    CONFIG.alertArea = loc.state;
    CONFIG.alertZones = loc.zones;
    if (loc.tz && loc.tz !== CONFIG.timeZone) { CONFIG.timeZone = loc.tz; partsFmt = null; computeTimeOffset(); }
  }
  function markLocated() {
    if (located) return;
    located = true;
    var w = locWaiters; locWaiters = [];
    w.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  function lookupZip(z) {
    return fetch("https://api.zippopotam.us/us/" + z).then(function (r) {
      if (r.status === 404) throw new Error("ZIP code " + z + " was not found");
      if (!r.ok) throw new Error("ZIP lookup failed (HTTP " + r.status + ")");
      return r.json();
    }).then(function (d) {
      var p = d.places && d.places[0];
      if (!p) throw new Error("ZIP code " + z + " was not found");
      return { lat: +p.latitude, lon: +p.longitude, name: p["place name"] + ", " + p["state abbreviation"] };
    });
  }
  function resolveLocation() {
    var start;
    if (useLatLon) start = Promise.resolve({ lat: +manualLat, lon: +manualLon, name: "" });
    else if (zip.length === 5) start = lookupZip(zip);
    else start = Promise.reject(new Error("No ZIP code set. Add one to WX_SETTINGS at the top of the page."));
    return start.then(function (ll) {
      return getJSON("https://api.weather.gov/points/" + ll.lat.toFixed(4) + "," + ll.lon.toFixed(4)).then(function (pt) {
        var P = pt.properties || {};
        if (!P.forecast) throw new Error("The National Weather Service has no forecast for this location");
        var zones = [];
        [P.county, P.forecastZone, P.fireWeatherZone].forEach(function (u) { if (u) zones.push(u.split("/").pop()); });
        var rl = P.relativeLocation && P.relativeLocation.properties;
        return getJSON(P.observationStations).then(function (st) {
          var stations = ((st && st.features) || []).slice(0, 4).map(function (f) {
            return { id: f.properties.stationIdentifier, name: f.properties.name };
          });
          return {
            lat: ll.lat, lon: ll.lon, tz: P.timeZone, forecastUrl: P.forecast, stations: stations, zones: zones,
            state: rl && rl.state ? rl.state : (zones[0] || "").slice(0, 2),
            name: ll.name || (rl ? rl.city + ", " + rl.state : "")
          };
        });
      });
    });
  }
  function showLocationError(msg) {
    var el = document.getElementById("note");
    if (el) el.innerHTML = '<span class="stale">Location problem: ' + esc(msg) + "</span>";
  }
  function startLocation() {
    var cached = recall("location", 30 * 86400000);
    if (cached) { applyLocation(cached.v); markLocated(); }
    // refresh the lookup in the background (stations and zones rarely change)
    var stale = !cached || Date.now() - cached.t > 7 * 86400000;
    if (!stale) return;
    resolveLocation().then(function (loc) {
      store("location", loc);
      applyLocation(loc);
      markLocated();
    }).catch(function (e) {
      console.warn("Location lookup failed", e);
      locError = e;
      if (!cached) {
        var show = function () { showLocationError(e.message || String(e)); };
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show); else show();
        setTimeout(startLocation, 5 * 60000); // try again later
      }
    });
  }

  // ---------- Sun & moon ----------
  var RAD = Math.PI / 180;
  function sunAltitude(date, lat, lon) {
    var d = (date.getTime() - 946728000000) / 86400000;
    var g = (357.529 + 0.98560028 * d) * RAD;
    var q = 280.459 + 0.98564736 * d;
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
    var e = (23.439 - 0.00000036 * d) * RAD;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    var dec = Math.asin(Math.sin(e) * Math.sin(L));
    var gmst = (18.697374558 + 24.06570982441908 * d) % 24;
    var ha = (gmst * 15 + lon) * RAD - ra;
    var la = lat * RAD;
    return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha)) / RAD;
  }
  // Sunrise/sunset for the local day containing `date`
  function sunTimes(date) {
    var p = localParts(date);
    // walk from local midnight (approx) in 5-minute steps
    var start = date.getTime() - ((p.hour * 60 + p.minute) * 60 + p.second) * 1000;
    var rise = null, set = null, prev = sunAltitude(new Date(start), CONFIG.lat, CONFIG.lon);
    for (var m = 5; m <= 1440; m += 5) {
      var t = start + m * 60000;
      var a = sunAltitude(new Date(t), CONFIG.lat, CONFIG.lon);
      if (prev < -0.833 && a >= -0.833 && !rise) rise = new Date(t - 5 * 60000 * (a + 0.833) / (a - prev));
      if (prev >= -0.833 && a < -0.833 && !set) set = new Date(t - 5 * 60000 * (a + 0.833) / (a - prev));
      prev = a;
    }
    return { sunrise: rise, sunset: set };
  }
  function isNight(date) { return sunAltitude(date || now(), CONFIG.lat, CONFIG.lon) < -0.833; }
  function moonPhase(date) {
    var P = 29.530588853;
    var age = ((date.getTime() - 947182440000) / 86400000) % P;
    if (age < 0) age += P;
    return { age: age, illum: (1 - Math.cos(2 * Math.PI * age / P)) / 2, waxing: age < P / 2 };
  }
  function season(date) {
    var m = localParts(date || now()).month;
    if (m === 12 || m <= 2) return "winter";
    if (m <= 5) return "spring";
    if (m <= 8) return "summer";
    return "fall";
  }

  // ---------- Condition classification ----------
  // NWS icon URLs carry condition codes, e.g. .../icons/land/day/tsra_sct,40/rain_showers,30?size=medium
  var CODE_MAP = {
    skc: "clear", few: "mostly-clear", sct: "partly-cloudy", bkn: "mostly-cloudy", ovc: "overcast",
    wind_skc: "wind", wind_few: "wind", wind_sct: "wind", wind_bkn: "wind", wind_ovc: "wind",
    snow: "snow", rain_snow: "rain-snow", rain_sleet: "sleet", snow_sleet: "sleet", sleet: "sleet",
    fzra: "freezing", rain_fzra: "freezing", snow_fzra: "freezing",
    rain: "rain", rain_showers: "showers", rain_showers_hi: "showers-hi",
    tsra: "tstorm", tsra_sct: "tstorm-hi", tsra_hi: "tstorm-hi",
    tornado: "tornado", hurricane: "hurricane", tropical_storm: "hurricane",
    dust: "dust", smoke: "smoke", haze: "haze", hot: "hot", cold: "cold", blizzard: "blizzard", fog: "fog"
  };
  var PRIORITY = ["tornado", "hurricane", "tstorm", "tstorm-hi", "blizzard", "freezing", "sleet", "snow", "rain-snow",
    "rain", "showers", "showers-hi", "drizzle", "fog", "smoke", "dust", "haze", "wind", "hot", "cold",
    "overcast", "mostly-cloudy", "partly-cloudy", "mostly-clear", "clear"];

  function classifyText(t) {
    t = (t || "").toLowerCase();
    if (!t) return null;
    var rules = [
      [/tornado|funnel/, "tornado"], [/hurricane|tropical storm/, "hurricane"],
      [/thunder|t-storm|tstm/, /scattered|isolated|slight chance|chance/.test(t) ? "tstorm-hi" : "tstorm"],
      [/blizzard/, "blizzard"], [/freezing/, "freezing"], [/sleet|ice pellet|hail/, "sleet"],
      [/snow.*rain|rain.*snow|wintry mix/, "rain-snow"], [/snow|flurr/, "snow"],
      [/drizzle/, "drizzle"],
      [/shower/, /scattered|isolated|slight chance|chance/.test(t) ? "showers-hi" : "showers"],
      [/rain/, "rain"], [/fog|mist/, "fog"], [/smoke/, "smoke"], [/dust|sand/, "dust"], [/haze/, "haze"],
      [/wind|breez|blustery|gust/, "wind"],
      [/overcast/, "overcast"], [/mostly cloudy|considerable cloud|partly sunny/, "mostly-cloudy"],
      [/partly cloudy|scattered clouds|partly clear/, "partly-cloudy"],
      [/mostly clear|mostly sunny|few clouds/, "mostly-clear"], [/cloudy|clouds/, "overcast"],
      [/clear|sunny|fair/, "clear"], [/hot/, "hot"], [/cold/, "cold"]
    ];
    for (var i = 0; i < rules.length; i++) if (rules[i][0].test(t)) return rules[i][1];
    return null;
  }

  // Returns { key, night, pop } — pop = chance of precip from icon URL if present
  function classify(iconUrl, text, nightHint) {
    var key = null, night = nightHint, pop = null;
    var m = /\/icons\/land\/(day|night)\/([^?]+)/.exec(iconUrl || "");
    if (m) {
      if (night === undefined || night === null) night = m[1] === "night";
      var best = 999;
      m[2].split("/").forEach(function (seg) {
        var bits = seg.split(",");
        var k = CODE_MAP[bits[0]];
        if (bits[1]) pop = Math.max(pop || 0, +bits[1]);
        if (k) { var pr = PRIORITY.indexOf(k); if (pr >= 0 && pr < best) { best = pr; key = k; } }
      });
    }
    // Text is more specific for some things (drizzle, light/heavy, fog with rain)
    var tk = classifyText(text);
    if (!key) key = tk;
    else if (tk && PRIORITY.indexOf(tk) < PRIORITY.indexOf(key)) key = tk;
    if (night === undefined || night === null) night = isNight();
    return { key: key || "partly-cloudy", night: !!night, pop: pop };
  }

  // Short labels that always fit on a forecast card
  function shortLabel(key, night) {
    var L = {
      clear: night ? "Clear" : "Sunny", "mostly-clear": night ? "Mostly Clear" : "Mostly Sunny",
      "partly-cloudy": "Partly Cloudy", "mostly-cloudy": "Mostly Cloudy", overcast: "Cloudy",
      showers: "Showers", "showers-hi": "Scattered Showers", drizzle: "Drizzle", rain: "Rain",
      tstorm: "T-Storms", "tstorm-hi": "Scattered T-Storms", snow: "Snow", "rain-snow": "Rain & Snow",
      sleet: "Sleet", freezing: "Freezing Rain", blizzard: "Blizzard", fog: "Fog", haze: "Haze",
      smoke: "Smoke", dust: "Dust", wind: "Windy", tornado: "Tornado", hurricane: "Tropical Storm",
      hot: "Hot", cold: "Cold"
    };
    return L[key] || "—";
  }

  // Weather profile used by the animated background
  function profile(key, text) {
    var t = (text || "").toLowerCase();
    var P = {
      clear: { cover: 0.0 }, "mostly-clear": { cover: 0.2 }, "partly-cloudy": { cover: 0.45 },
      "mostly-cloudy": { cover: 0.72 }, overcast: { cover: 0.95 },
      drizzle: { cover: 0.95, precip: "rain", amount: 0.35 },
      showers: { cover: 0.8, precip: "rain", amount: 0.7 }, "showers-hi": { cover: 0.6, precip: "rain", amount: 0.45 },
      rain: { cover: 1, precip: "rain", amount: 0.9, dark: 0.25 },
      tstorm: { cover: 1, precip: "rain", amount: 1.2, lightning: 1, dark: 0.5 },
      "tstorm-hi": { cover: 0.85, precip: "rain", amount: 0.7, lightning: 0.5, dark: 0.3 },
      snow: { cover: 1, precip: "snow", amount: 0.8, dark: 0.1 },
      "rain-snow": { cover: 1, precip: "mix", amount: 0.8, dark: 0.15 },
      sleet: { cover: 1, precip: "sleet", amount: 0.8, dark: 0.2 },
      freezing: { cover: 1, precip: "rain", amount: 0.7, dark: 0.2, icy: true },
      blizzard: { cover: 1, precip: "snow", amount: 1.6, wind: 1.8, fog: 0.5, dark: 0.15 },
      fog: { cover: 0.9, fog: 1 }, haze: { cover: 0.3, fog: 0.4, tint: "haze" },
      smoke: { cover: 0.3, fog: 0.5, tint: "smoke" }, dust: { cover: 0.3, fog: 0.5, tint: "dust", wind: 1.5 },
      wind: { cover: 0.4, wind: 2 }, tornado: { cover: 1, precip: "rain", amount: 1.1, lightning: 1, dark: 0.6, wind: 2 },
      hurricane: { cover: 1, precip: "rain", amount: 1.4, wind: 2.5, dark: 0.4 },
      hot: { cover: 0.05 }, cold: { cover: 0.3 }
    }[key] || { cover: 0.45 };
    var out = { cover: P.cover, precip: P.precip || null, amount: P.amount || 0, lightning: P.lightning || 0, fog: P.fog || 0, wind: P.wind || 1, dark: P.dark || 0, tint: P.tint || null, icy: !!P.icy };
    if (/light/.test(t)) out.amount *= 0.6;
    if (/heavy/.test(t)) out.amount *= 1.4;
    if (/fog|mist/.test(t)) out.fog = Math.max(out.fog, 0.6);
    if (/wind|breez/.test(t)) out.wind = Math.max(out.wind, 1.8);
    return out;
  }

  // ---------- Helpers ----------
  function esc(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function round(n) { return n === null || n === undefined || isNaN(n) ? null : Math.round(n); }

  // Restart CSS entrance animations on an element
  function replay(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function boot(fn) {
    function go() {
      fitStage();
      startClock();
      fn();
      // Re-fit text once web fonts have arrived
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitAll(); });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
    else go();
  }

  startLocation();

  global.Signage = {
    CONFIG: CONFIG, params: params, now: now, localParts: localParts, fmtTime: fmtTime, fmtWhen: fmtWhen,
    fitStage: fitStage, fitText: fitText, fitAll: fitAll, store: store, recall: recall, getJSON: getJSON,
    setUpdated: setUpdated, whenLocated: whenLocated, compass: compass, onObservation: onObservation, startObservations: startObservations, startForecast: startForecast,
    sunAltitude: sunAltitude, sunTimes: sunTimes, isNight: isNight, moonPhase: moonPhase, season: season,
    classify: classify, classifyText: classifyText, shortLabel: shortLabel, profile: profile,
    esc: esc, round: round, replay: replay, boot: boot, MONTHS: MONTHS, LONG_DAYS: LONG_DAYS
  };
})(window);
