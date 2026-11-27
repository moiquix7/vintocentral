# Architecture

VintoCentral is a static single-page application (SPA) written in plain **HTML, CSS and JavaScript
(ES modules)**. There is no build step: the browser loads the files as they are in the repository.
Firebase (Authentication, Firestore, Storage) is loaded from the official CDN (`www.gstatic.com`).

## Layers

```
index.html ─► js/main.js ─► js/app.js
                               │
        ┌──────────────────────┼──────────────────────────┐
        ▼                      ▼                          ▼
   js/core/*              js/modules/*               js/shared/*
 (infrastructure)       (one folder per feature)   (reusable UI helpers)
        │                      │
        └───────► js/config/* ◄┘   (constants, roles, Firebase web config)
```

| Layer | Responsibility | May import |
|-------|----------------|------------|
| `config/` | Constants: roles, permissions, asset conditions, limits, Firebase web config. Pure data. | nothing |
| `core/` | Infrastructure: Firebase SDK (single place that knows the CDN version), router, session, errors, notifications, DOM helper, preferences, collection stores. | `config/` |
| `shared/` | Reusable UI/browser helpers with no domain knowledge: dialogs, camera, image compression, formatting, script loader. | `core/`, `config/` |
| `modules/<feature>/` | One feature each: `*.model.js` (pure validation/sanitising), `*.service.js` (Firebase access), `*.store.js` (live data), `*.view.js` (DOM). | `core/`, `shared/`, `config/`, and another module's **service/store/model** only (never another module's view). |

Rules that keep **high cohesion / low coupling**:

- Only `core/firebase.js` imports Firebase from the CDN. Everything else imports from it.
- `*.model.js`, `asset-filter.js`, `dashboard.stats.js` and `shared/validation.js` are **pure** (no DOM,
  no Firebase) so they run under Node's test runner.
- Views never call Firestore directly; they call a service.
- Every view exports `render(container, context)` and may return a cleanup function, which the
  router calls before showing the next view (unsubscribes listeners, stops the camera, ...).

## Feature modules

| Module | Route(s) | Permission |
|--------|----------|------------|
| `auth` | `#/login` (username **or** email + password) | public |
| `profile` | `#/profile` (name, username, photo, password) | any signed-in user |
| `dashboard` | `#/dashboard` | `assets.read` |
| `assets` | `#/assets`, `#/assets/new`, `#/assets/:id`, `#/assets/:id/edit` | read / `assets.write` |
| `inventory` | `#/inventory` — inventory-taking grid (see below) | `assets.write` |
| `catalogs` | `#/catalogs` "Catálogos": categories (`assetTypes`), departments (stored as `categories`, with leader history) and locations | `catalogs.write` |
| `reports` | `#/reports` (PDF, optionally with the first photo of each asset) | `reports.view` |
| `users` | `#/users` | `users.manage` |
| `layout` | application shell (header, navigation, preferences) | — |

Interface wording follows the CLAUDE.md terminology: **Artículo** (never "bien"), **Categoría**,
**Departamento**, **Ubicación**, **Etiqueta**, **Usuario**. The mapping to collections and fields is
in `docs/data-model.md`.

## Inventory-taking (`#/inventory`)

A grid to walk through the church and verify every article:

- **Round start date** ("Inventario iniciado el", default today, remembered per browser): an article
  counts as *verified* when its `checkedAt` is on or after that date. A progress bar shows
  "N de M verificados".
- Filters: text, category, department, location and *Pendientes / Verificados / Todos*.
- Each row has three dropdowns — **Ubicación**, **Estado**, **Disponibilidad** — and one
  **Verificar** button that saves those three fields and stamps `checkedAt` (one write per row,
  `asset.service.js → checkAsset()`). Changed rows are highlighted until saved.
- Unsaved choices survive live updates from other users (kept in a per-row draft); after saving,
  focus moves to the next row so the whole list can be done from the keyboard.
- Pure helpers (round date, verified check, progress) live in `inventory.model.js` and are tested.
- Small screens and focus mode: each row becomes a card (same `responsive-table` pattern); on
  tablets the table scrolls horizontally inside its card instead of overflowing the page.

## Routing

Hash routing (`#/path`) is used so the app works on **GitHub Pages** (which cannot rewrite URLs) and on
Firebase Hosting alike.

- Unknown route → redirect to `#/login` (project rule). The login page forwards an already
  signed-in user to `#/dashboard`.
- Route without session → `#/login`.
- Route without permission → `#/dashboard` with a message.
- `404.html` sends any non-hash URL (e.g. `/vintocentral/anything`) back to `#/login`.

## Roles

| Role | Can do |
|------|--------|
| `admin` | Everything, including deleting assets and managing users. |
| `editor` | Register and update assets, manage categories and locations, reports. |
| `viewer` | View assets, dashboard and reports. |

The role lives in `users/{uid}` (Firestore). The UI hides what a role cannot do, and the **security
rules enforce it** (`firestore.rules`, `storage.rules`) — the UI is never the only barrier.

## Error handling

- `core/errors.js` turns any thrown value into an `AppError` with a friendly Spanish message
  (Firebase error codes are mapped one by one).
- Services throw `AppError`/`ValidationError`; views catch them and show a toast or inline field errors.
- Global `error` and `unhandledrejection` handlers catch anything that escaped.
- Startup failures (no network, Firebase not configured) show a dedicated screen instead of a blank page.

## PDF report with photos

- jsPDF + AutoTable are loaded from cdnjs only when a report is generated.
- With "Incluir fotos" checked, the first photo of each asset is downloaded (`fetch`, 4 at a time,
  progress shown on the button), center-cropped to a 240 px square JPEG and drawn in the first
  column. Rows are taller so the photo fits.
- A photo that cannot be downloaded never stops the report: its cell shows "—" and the user is told
  how many were left out.
- Downloading requires a **CORS policy on the bucket** (`storage-cors.json`, docs/deployment.md 4b):
  without it Storage returns photos without `Access-Control-Allow-Origin` and `fetch` fails with a
  network `TypeError`. The app reports that case separately (code `app/image-blocked`) so the message
  names the real cause.

## "Don't allow excess data"

Data is limited in three places:

1. **Forms** — `maxlength`, `min`/`max`, limited photo count.
2. **Models** — `sanitize*()` keeps only whitelisted fields, trims and truncates strings, normalises
   tags; `validate*()` rejects invalid values.
3. **Security rules** — `keys().hasOnly([...])`, string length and type checks, image size/type limits.

Photos are resized in the browser (max 1600 px, JPEG) before upload.

## Interface

- Logo: one file, path in `APP.logo` (`js/config/app-config.js`) and the favicon in `index.html`.
- Login page: church photo background (`static/img/login-bg.jpg`) under a soft overlay.
  Follows "don't make me think": logo, `h1` with the church name (`APP.churchFullName`),
  subtitle with the system name (`APP.systemName`), two fields with a leading icon (user, lock),
  a show/hide-password eye button inside the password field, one primary button and the
  "¿Olvidó su contraseña?" link. No appearance options on this page.
- **User menu** (avatar button in the header): Mi perfil, appearance, focus mode, text size, Salir.
- **Theme**: Sistema / Claro / Oscuro, in the user menu; a sun/moon button in the header switches
  light ↔ dark in one tap (it shows the mode it will switch to). **Palette**: five soft palettes (teal, salvia, lavanda,
  terracota, cielo); each sets `--primary*`, `--accent`, `--label`, `--bg` for light and dark, all
  with AA contrast. Buttons, links, labels and focus rings take their color from these tokens.
- Appearance is chosen in the user menu (or Mi perfil) and applies everywhere at once; the login
  page uses the preferences already saved in the browser.
- **Focus mode (ADHD-friendly)**: larger spacing, no animations, stronger focus ring, one column,
  cards instead of tables, secondary information hidden.
- **Text size**: normal / large / extra large (for older users).
- Preferences are saved per browser (`localStorage`) and applied by a tiny inline script in
  `index.html` before the first paint (no flash of the wrong theme); `core/preferences.js` owns them
  afterwards. Both use the same storage key and value names.
- **Responsive**: one layout from 320 px phones to desktops — side navigation becomes a menu
  button under 800 px, grids collapse to one column, tables become cards, wide tables scroll inside
  their card, the user menu becomes a full-width sheet on phones.
- Large touch targets (≥ 44 px; ≥ 52 px on touch screens via `@media (pointer: coarse)`), visible
  labels, inline errors, skip link, `aria-live` notifications, focus moved to the page title on every
  navigation.
- Dropdowns (`<select>`): full width, tall, 2 px border, large text and a chevron in the palette
  color; the user menu is wide with tall rows.
- The **open list** uses the browser's customizable select (`appearance: base-select`, Chrome/Edge
  135+) so it takes the palette: border and checked option in `--primary`, hover in
  `--primary-soft`, 48 px rows. It is wrapped in `@supports`, so browsers without it (Firefox,
  older Safari) keep their native list — still a plain `<select>`, no JavaScript, fully accessible.
