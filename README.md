# IASD Vinto Central - Inventario

Web application to register, classify, track and report the fixed assets of a Seventh-day Adventist
church. Plain **HTML + JavaScript (ES modules) + CSS**, with **Firebase** Authentication, Firestore and
Storage. No build step.

## Features

- Sign in with **username** (or email) and password; roles **admin**, **editor**, **viewer**
  (enforced by security rules). The login page names the system administrator to contact for an account.
- Articles (*artículos*): create, edit, delete (admin), search, filter by category / department /
  location / condition / availability, sort by any of them.
- **Inventory-taking grid**: update location, condition, availability, the reason it is not available
  and notes row by row — changes are **saved automatically** and mark the article as verified — with
  progress ("N de M verificados"), filters and sorting.
- Catalogs: categories (type of asset), departments (responsible ministry, with leader history) and
  locations; free tags (*etiquetas*) per article.
- User menu: **Mi perfil** (name, username, photo, password), light/dark theme, five soft color
  palettes, focus mode, text size.
- Up to 4 photos per asset: from the gallery or the device **camera**; compressed before upload.
- Home page (*Inicio*, every role): totals, articles by category and by location, and a chronological
  timeline of the last 10 articles added or updated, with links to view or edit them.
- Dashboard (*Tablero*, admin and editor): total articles, units, estimated value, articles needing attention,
  **users connected now**, charts by condition, availability, category, department and location, and
  shortcuts to each section.
- PDF inventory report with filters and summary.
- **Change history** (admin and editor): who registered, changed, verified or deleted each article and
  when, field by field ("Estado: Bueno → Malo") — in the article detail (chronological) and on the
  *Historial* page (all articles, newest first). Immutable audit trail.
- User administration (admin): create accounts, change role, deactivate, send password reset.
- Soft colors, light/dark mode (automatic or one-tap header button), responsive from phone to desktop, **focus mode (ADHD-friendly)** and adjustable text size.
- Unknown routes go back to the login page.

## Quick start

```bash
npm start   # http://localhost:8080  (Node 20 via Volta; no dependencies)
# Do not open index.html with a double click (file://): browsers block ES modules there;
# the page then shows how to start the local server instead of loading forever.
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
js/modules/<feature>/       auth, layout, home, dashboard, presence, history, assets, inventory, catalogs, reports, users
firestore.rules, storage.rules, firebase.json, .firebaserc
.github/workflows/deploy-pages.yml
tests/                      node --test
```
