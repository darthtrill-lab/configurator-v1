# Wundershed configurator

3D configurator for Wundershed backyard studios: model, size and use, exterior, windows and doors, interior, climate, electrical, review, with live pricing and AR ("View in your yard").

The source matches Vercel deployment `i8084sh1c` (13 Nov 2026), project `wundershed-configurator`.

## Files (`public/`)
| File | What it does |
|---|---|
| `index.html` | Page, styles, import map (three.js 0.170.0, model-viewer 3.5.0 via jsDelivr) |
| `app/main.js` | State (kept in the URL hash), steps, use-case guidance, events, AR hand-off |
| `app/catalog.js` | Options, rules and prices: included + credits, CAD before HST |
| `app/openings.js` | Windows, doors and skylights per *Configurator Business Rules v1.0* (list price × 1.10; 12″ corner and gap rules) |
| `app/building.js` | Parametric 3D shell, steel ribs, trims, openings, mini split, skylights |
| `app/furniture.js` | Use-case staging (office, gym, art, guest, flex, music) at true scale, with clash checks |
| `app/scene.js` | Viewer, Backyard/Studio/Dusk scenes, AR export |
| `app/textures.js` | Procedural materials at real-world scale |

## Run locally
It's a static site with no build step. Serve `public/` with any static server, for example `npx serve public`. `dev-server.mjs` is the test server used during development; it maps the CDN URLs to `node_modules`.

## Not in this repo yet
The `/lookup` address tool (`api/`, `lib/`, `public/lookup/`) and `vercel.json` live only in the Vercel deployments. The lookup code contains a secret, so it stays out of this public repo until the secret moves to a Vercel environment variable.
