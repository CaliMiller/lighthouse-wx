# Lighthouse Weather Signage
https://shelbylight.house/weather/

Four full-screen weather pages for digital signage. They're designed for a 1920×1080 screen and readable from across a parking lot. All weather data comes from the US National Weather Service (NWS), which is free and needs no API key. The pages are plain HTML and JavaScript with no build step, and they run in any modern browser or kiosk player such as Anthias or Screenly.

| Page | What it shows |
|---|---|
| `current.html`  | Current conditions: icon, temperature, conditions, feels-like temperature, wind, today's high and low |
| `forecast.html` | Five-day forecast (tonight or today, then the next four days) |
| `alerts.html`   | Active NWS watches, warnings and advisories for the county |
| `radar.html`    | Animated regional radar from radar.weather.gov, under the same header and clock |

Features:
- Large text for drive-by reading, and a live clock with seconds
- Animated weather icons and entrance animations
- Photo backgrounds that change with the season, time of day and weather, with live rain, snow, fog and lightning drawn on top

## Quick start

1. Copy the whole folder to a web server, or any place your signage player can load web pages from. Keep `assets/` next to the HTML files.
2. **Set your ZIP code** at the top of each HTML file:
   ```html
   <script>
     window.WX_SETTINGS = { zip: "90210" };
   </script>
   ```
3. Add the four pages to your signage player as web-page assets.

That's it. On first load, each page:
1. Looks up the ZIP code's coordinates. This uses [Zippopotam.us](https://zippopotam.us), which is free and needs no key.
2. Asks the NWS for:
   - the forecast area
   - the nearest weather stations
   - the alert zones that cover the location (county, forecast zone and fire-weather zone)
   - the local time zone

The result is saved in the browser for 30 days and checked again weekly. The ZIP lookup service only needs to be reachable the first time.

**Other ways to set the location:**
- **Latitude and longitude:** use these instead of a ZIP code, for example `window.WX_SETTINGS = { lat: 39.77, lon: -86.16 };`. This skips the ZIP lookup.1
- **URL:** the page address overrides the file setting, so one copy can serve several screens, for example `current.html?zip=90210`.

If the location can't be found (a mistyped ZIP, say), the message at the bottom-left of the page says so.

**Coverage:** the NWS covers the US and its territories. The ZIP lookup covers US ZIP codes.

## Radar page

`radar.html` shows the live animated radar from [radar.weather.gov](https://radar.weather.gov) in a frame, with the same header and clock as the other pages. The radar site's own title bar is hidden under the page header.

The view is built from the ZIP code automatically. In `WX_SETTINGS` at the top of `radar.html`:
- `radarNorth` and `radarSouth` are the latitudes of the top and bottom edges of the visible map. The page works out the zoom and center to fit them.
- `radarCenterLon` sets the longitude of the map's center. Without it, the map centers on your location, shifted west by `radarWest` (default 0.8 degrees) so approaching weather is in view.
- `radarZoom` sets the zoom level when no north and south edges are given. About 7 shows several states; about 9 shows a few counties.
- `radarMarker` sets where the white location dot is drawn, for example `{ lat: 39.769, lon: -86.158 }`. It defaults to the ZIP location; `false` hides it. The dot is drawn on top because the radar site's own marker is hard to see on a large screen.
- `radarUrl` shows an exact view instead. Paste any radar.weather.gov link and the page shows that view; the white dot still works.

If the dot or the map edges sit slightly off on your screen, adjust `MAP` and `VISIBLE` near the top of the script in `radar.html`. They describe where the radar site's map sits inside the frame.

The page reloads the radar every 20 minutes, cross-fading to the new copy so the screen never goes blank.

## Customizing

- **Logo:** replace `assets/logo.png`. It's shown 146 px tall in the header; any width works.
- **Settings** are in the `CONFIG` block at the top of `assets/signage.js`:
  - which alert types to hide (`excludeEvents`)
  - refresh rates
  - how long each set of alerts shows (`alertPageSeconds`)
  - background options
- **Text and layout:** each page's layout is in a `<style>` block at the top of its HTML file. Shared styles are in `assets/signage.css`.

## Performance

On slower players, lower `backgroundFps` (for example to 20), set `animatedBackground: false`, or set `photoDrift: false`. You can also add these to a page's URL:
- `?fps=20` lowers the background frame rate.
- `?static=1` turns off background animation.
- `?photos=0` uses the drawn landscape instead of photos.

## Preview any weather, time or season

Add these to a page's URL to see how it looks in other conditions:
- `?cond=tstorm`. The options are clear, mostly-clear, partly-cloudy, mostly-cloudy, overcast, showers, drizzle, rain, tstorm, snow, rain-snow, sleet, freezing, blizzard, fog, haze, smoke, wind and tornado.
- `?hour=19.5&month=1` sets the time of day and the month.
- `?temp=15` sets the temperature.
- On `alerts.html`: `?alerts=demo`, `?alerts=one`, `?alerts=two`, `?alerts=none` or `?alerts=error`.

Combine them with `&`, for example `current.html?cond=snow&hour=8&month=12`.

## Photo backgrounds

`assets/backgrounds/` holds 44 photos of one farm scene (about 7.6 MB), covering every season, time of day and type of weather. Each photo drifts slowly. The drift follows the clock, so every page shows the same crop at the same moment. Set `photoDrift: false` for a fixed crop.

**Fallback:** if no photo fits, or `backgroundPhotos: false` is set, the page shows an animated drawn landscape instead.

**Loading:** while a photo loads, the page shows a gradient in that photo's colors. The colors and the list of available photos are in `assets/backgrounds/manifest.js`.

**How the page picks a photo.** Each name is made of up to three parts:
- **Weather:** `clear`, `cloudy`, `rain`, `storm`, `snow` or `fog`
- **Time of day:** `dawn`, `day`, `dusk` or `night`
- **Season:** `spring`, `summer`, `fall` or `winter`

The page uses the most specific photo it finds. It looks for these names in order:
1. `rain-night-fall.jpg`
2. `rain-night.jpg`
3. `rain-fall.jpg`
4. `rain.jpg`

For clear and cloudy weather only, it also tries:
- `night-fall.jpg`
- `night.jpg`

**To replace or add photos:**
1. Save each one as a 1920×1080 JPG under the right name.
2. Add a line for each to `manifest.js`, for example `"dusk-spring": [],`. The colors are optional.

A low horizon with plenty of sky works best behind the text.

## How it works

| File | Purpose |
|---|---|
| `assets/signage.js` | Settings, location lookup, NWS data with offline caching, clock, sunrise/sunset and moon phase, stage scaling |
| `assets/sky.js` | Background engine: photos, drawn landscape, rain, snow, fog and lightning |
| `assets/icons.js` | Animated weather and alert icons, drawn as SVG in code |
| `assets/signage.css` | Shared styles and animations |

Notes:
- **Fits any screen:** each page is laid out on a fixed 1920×1080 stage that scales to fit the window, so it looks the same at any player resolution.
- **Offline caching:** the last good data is saved per location and shown immediately when a page loads, then refreshed.
- **Alerts safety:** the alerts page never shows "No Active Alerts" from data more than 15 minutes old. If it can't reach the NWS, it says alerts are unavailable.
- **Older browsers:** the code avoids newer JavaScript and CSS features so it runs on older kiosk browsers.

## Credits

- Weather data: [National Weather Service API](https://www.weather.gov/documentation/services-web-api). Public domain, no key required.
- ZIP code lookup: [Zippopotam.us](https://zippopotam.us).
- Fonts: [Barlow and Barlow Semi Condensed](https://fonts.google.com/specimen/Barlow), SIL Open Font License, loaded from Google Fonts. The pages fall back to Arial if the fonts can't be loaded.
- Code and design developed in collaboration with Claude (Anthropic).
- Background images generated with Stable Diffusion (Juggernaut XL) and processed with Claude.