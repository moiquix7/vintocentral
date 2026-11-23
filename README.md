# IASD Vinto Central - Inventario

Web application to register, classify, track and report the fixed assets of a Seventh-day Adventist
church. Plain **HTML + JavaScript (ES modules) + CSS**, with **Firebase** Authentication, Firestore and
Storage. No build step.

## Features

- Sign in with **username** (or email) and password; roles **admin**, **editor**, **viewer**
  (enforced by security rules).
- Assets: create, edit, delete (admin), search, filter by department / location / condition, sort.
- Departments and locations catalogs; free tags per asset.
- User menu: **Mi perfil** (name, username, photo, password), light/dark theme, five soft color
  palettes (also selectable on the login page), focus mode, text size.
- Up to 4 photos per asset: from the gallery or the device **camera**; compressed before upload.
- Dashboard: total assets, units, estimated value, assets needing attention, units by category,
  location and condition.
- PDF inventory report with filters and summary.
- User administration (admin): create accounts, change role, deactivate, send password reset.
- Soft colors, automatic dark mode, **focus mode (ADHD-friendly)** and adjustable text size.
- Unknown routes go back to the login page.

## Quick start

```bash
npm start   # http://localhost:8080  (Node 20 via Volta; no dependencies)
npm test    # unit tests for models, filters and stats
```

Before the first run, fill in `js/config/firebase-config.js` and create the first admin —
see **[docs/deployment.md](docs/deployment.md)**.

## Documentation

- [docs/architecture.md](docs/architecture.md) — layers, modules, routing, roles, error handling, UI rules
- [docs/data-model.md](docs/data-model.md) — Firestore collections, Storage paths, permission matrix
- [docs/deployment.md](docs/deployment.md) — Firebase setup, security rules, first admin, GitHub Pages

## Project layout

```
index.html, 404.html        entry page; 404 sends unknown paths to #/login (GitHub Pages)
css/                        tokens (palette, focus mode), base, layout, components
js/main.js                  boot: preferences, global error handlers, config check
js/app.js                   routes and session → data wiring
js/config/                  app constants, roles, limits, Firebase web config
js/core/                    firebase SDK, router, session, errors, notifications, stores, DOM helper
js/shared/                  forms, dialogs, camera, image compression, formatting
js/modules/<feature>/       auth, layout, dashboard, assets, catalogs, reports, users
firestore.rules, storage.rules, firebase.json, .firebaserc
.github/workflows/deploy-pages.yml
tests/                      node --test
```
