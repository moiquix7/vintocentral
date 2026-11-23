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
| `catalogs` | `#/catalogs` (departments — stored as `categories` — and locations) | `catalogs.write` |
| `reports` | `#/reports` (PDF) | `reports.view` |
| `users` | `#/users` | `users.manage` |
| `layout` | application shell (header, navigation, preferences) | — |

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
- **User menu** (avatar button in the header): Mi perfil, appearance, focus mode, text size, Salir.
- **Theme**: Sistema / Claro / Oscuro. **Palette**: five soft palettes (teal, salvia, lavanda,
  terracota, cielo); each sets `--primary*`, `--accent`, `--label`, `--bg` for light and dark, all
  with AA contrast. Buttons, links, labels and focus rings take their color from these tokens.
- Appearance is chosen in the user menu **or on the login page** and applies everywhere at once.
- **Focus mode (ADHD-friendly)**: larger spacing, no animations, stronger focus ring, one column,
  cards instead of tables, secondary information hidden.
- **Text size**: normal / large / extra large (for older users).
- Preferences are saved per browser (`localStorage`) and applied by a tiny inline script in
  `index.html` before the first paint (no flash of the wrong theme); `core/preferences.js` owns them
  afterwards. Both use the same storage key and value names.
- Large touch targets (≥ 44 px; ≥ 52 px on touch screens via `@media (pointer: coarse)`), visible
  labels, inline errors, skip link, `aria-live` notifications, focus moved to the page title on every
  navigation.
- Dropdowns (`<select>`): full width, tall, 2 px border, large text and a chevron in the palette
  color; the user menu is wide with tall rows.
- The **open list** uses the browser's customizable select (`appearance: base-select`, Chrome/Edge
  135+) so it takes the palette: border and checked option in `--primary`, hover in
  `--primary-soft`, 48 px rows. It is wrapped in `@supports`, so browsers without it (Firefox,
  older Safari) keep their native list — still a plain `<select>`, no JavaScript, fully accessible.
