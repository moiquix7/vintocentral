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
| `shared/` | Reusable UI/browser helpers with no domain knowledge: dialogs, camera, image compression, formatting, script loader, charts (KPI tile, bar list, segmented bar). | `core/`, `config/` |
| `modules/<feature>/` | One feature each: `*.model.js` (pure validation/sanitising), `*.service.js` (Firebase access), `*.store.js` (live data), `*.view.js` (DOM). | `core/`, `shared/`, `config/`, and another module's **service/store/model** only (never another module's view). |

Rules that keep **high cohesion / low coupling**:

- Only `core/firebase.js` imports Firebase from the CDN. Everything else imports from it.
- `*.model.js`, `asset-filter.js`, `dashboard.stats.js` and `shared/validation.js` are **pure** (no DOM,
  no Firebase) so they run under Node's test runner.
- Views never call Firestore directly; they call a service.
- A module may also offer **components** (DOM builders without a route, e.g.
  `history/history.timeline.js`) that other modules' views reuse; route views (`*.view.js`) are never
  imported by another module.
- Every view exports `render(container, context)` and may return a cleanup function, which the
  router calls before showing the next view (unsubscribes listeners, stops the camera, ...).

## Feature modules

| Module | Route(s) | Permission |
|--------|----------|------------|
| `auth` | `#/login` (username **or** email + password) | public |
| `profile` | `#/profile` (name, username, photo, password) | any signed-in user |
| `home` | `#/home` "Inicio" — overview for every role | `assets.read` |
| `dashboard` | `#/dashboard` "Tablero" (admin and editor only) | `dashboard.view` |
| `presence` | no route — heartbeat of connected users, read by the dashboard | any signed-in user writes its own |
| `history` | `#/history` "Historial" (recent changes of all articles) + a section in the article detail | `history.view` (admin, editor) |
| `assets` | `#/assets`, `#/assets/new`, `#/assets/:id`, `#/assets/:id/edit` | read / `assets.write` |
| `inventory` | `#/inventory` — inventory-taking grid (see below) | `assets.write` |
| `catalogs` | `#/records` "Registros" (hub) and `#/records/:kind` — tipos de artículo (`assetTypes`), departments (stored as `categories`, with leader history) and locations (see below) | `catalogs.write`; delete: `catalogs.delete` (admin) |
| `reports` | `#/reports` (PDF, optionally with the first photo of each asset) | `reports.view` |
| `users` | `#/users` | `users.manage` |
| `layout` | application shell (header, navigation, preferences) | — |

Interface wording follows the CLAUDE.md terminology: **Artículo** (never "bien"), **Tipo de artículo** (never "categoría"),
**Departamento**, **Ubicación**, **Etiqueta**, **Usuario**. The mapping to collections and fields is
in `docs/data-model.md`.

## Home (`#/home`, "Inicio")

For every signed-in user (viewers land here after sign-in; the logo also leads here).

- Indicators: articles registered, units, and bar lists by Tipo de artículo and by Ubicación.
- **Últimos movimientos**: the last 10 articles added or updated, drawn as a vertical timeline in
  **chronological order** (oldest of the ten first, the most recent at the bottom, marked "Lo más
  reciente"). Each point: date and time, what happened (*Registrado*, *Modificado* or *Verificado
  en la toma de inventario*, deduced from `createdAt` / `checkedAt` / `updatedAt`), the article's
  category and location, and links **Ver** and **Editar** (Editar only with `assets.write`).
- Built from the in-memory asset store (no extra reads, works for viewers, who cannot read the
  change history). Pure logic in `home.model.js` (tested); totals reuse `dashboard.stats.js`, and the
  KPI tile and bar lists come from `shared/charts.js` (also used by the Tablero).

## Dashboard (`#/dashboard`, "Tablero")

Only **admin** and **editor** (`dashboard.view`); it is their landing page after sign-in.

- KPIs: articles, units, estimated value, **needs attention** (condition *Malo* / *Fuera de
  servicio*, or availability *En reparación* / *Extraviado*) and **users connected now**.
- The **Necesitan atención** card is a link to `#/assets?filtro=atencion`: the article list showing
  only those articles (filter "Solo los que necesitan atención", which the user can turn off), each
  with Ver (its name) and Editar / Eliminar according to the role. `needsAttention()` lives in
  `asset.model.js` (shared by the dashboard and the list).
- Charts: 100 % segmented bars for *Estado* and *Disponibilidad* (legend with number and %, so
  identity is never color alone) and a horizontal bar list (units) by Tipo de artículo.
- **Artículos por departamento** and **Artículos por ubicación**: horizontal bar charts with axes —
  each department / location on the **Y axis**, the number of articles on the **X axis** (a "nice"
  0…max scale with 3–6 ticks and faint grid lines, `shared/chart-scale.js`, tested). **Every**
  department / location is listed, also those with 0 articles (largest first; "Sin departamento" /
  "Sin ubicación" only when some article has none). One series → one color, no legend (the title
  names it); every bar shows its number and has a tooltip.
- Quick links to the features the role may use (same permission list as the navigation).
- Pure computations live in `dashboard.stats.js` and `presence.model.js` (tested).

## Connected users (`modules/presence`)

- While signed in, the browser writes `presence/{uid}` = `{ displayName, lastSeen }` every
  2 minutes (only while the tab is visible) and once more when the tab becomes visible.
- A user counts as *connected* when `lastSeen` is within the last 5 minutes
  (`PRESENCE` in `app-config.js`), so a closed browser drops out on its own.
- On sign-out the document is deleted (best effort, at most 2 s so sign-out never hangs:
  `session.beforeSignOut()` hook).

## Change history (`modules/history`)

Audit trail of every change to an article, for **admin** and **editor** (`history.view`).

- Every article write (`asset.service.js`: create, edit, inventory check, delete) adds one entry to
  `assetHistory` **in the same batch** as the article write, so both succeed or both fail.
- Each entry stores who (`by` uid + `byName`), when (`at`, server time), the action (Registró,
  Modificó, Verificó, Eliminó) and the changed fields as readable text (`Estado: Bueno → Malo`).
  Values are stored already described (catalog names, labels), so the history still reads well after
  a location or category is renamed or deleted, and after the article itself is deleted.
- Entries are immutable (rules: no update, no delete) and the rules only accept an entry written
  together with a real article write.
- Article detail → "Historial de cambios": that article's entries in **chronological order**
  (oldest first). `#/history` → the latest changes of all articles (newest first, "Cargar más"),
  with a text filter (article or user) and an action filter; deleted articles are listed too.
- The diff and the entry shape are pure (`history.model.js`, tested); Firestore access is in
  `history.service.js`.
- Articles changed before this feature existed simply have no earlier entries.

## Articles (`#/assets`, "Artículos")

- Table columns: photo, Nombre (link to the detail), Tipo de artículo, Departamento, Ubicación,
  Estado, Disponibilidad, Cantidad, Valor unitario and a last **Acciones** column: **Editar**
  (`assets.write`) and **Eliminar** (`assets.delete`, admin only — same confirmation as the detail).
  Viewers see no Acciones column.
- Search (also by marca, modelo and nro. de serie), filters and sorting as before, plus the switch
  **Solo los que necesitan atención** (turned on by `#/assets?filtro=atencion`, the dashboard card).

### Registrar artículo (`#/assets/new`)

- Fields: Código, Nombre, Descripción, Marca, Modelo, Nro. de serie, Empotrado (checkbox),
  Asegurado (checkbox), Tipo de artículo, Departamento, Ubicación, Etiquetas, Estado,
  Disponibilidad, Motivo (only when not available), Observaciones, Cantidad, Valor, Fecha de
  adquisición and up to 4 photos (gallery or camera, compressed before upload).
- **Departamento** is pre-filled with the signed-in user's department (`users.departmentId`);
  anyone who can register may change it.
- **Similar names**: while typing the name, a list shows up to 6 existing articles whose name
  contains the typed words (name · ubicación · código). Choosing one shows a notice with links to
  that article (Ver / Editar) so the user can confirm whether it is already registered.
- **Duplicates**: saving is refused when an article with the same name already exists in the same
  location (message under the name field). Also applies when editing.
- After registering, the user returns to the article list (`#/assets`). Editing still returns to
  the detail.

## Inventory-taking (`#/inventory`)

A grid to walk through the church and verify every article:

- **Round start date** ("Inventario iniciado el", default today, remembered per browser): an article
  counts as *verified* when its `checkedAt` is on or after that date. A progress bar shows
  "N de M verificados".
- Columns: Artículo, Tipo de artículo, Departamento, **Ubicación**, **Estado**, **Disponibilidad**,
  **Motivo / Observaciones**, **Verificado**.
- **Automatic save**: changing a dropdown saves at once; the two text fields save when they lose
  focus (or Enter). Every save writes only the inventory fields and stamps `checkedAt`
  (`asset.service.js → checkAsset()`). The **Verificado** checkbox stamps `checkedAt` for an article
  that needs no change; once verified in the round it stays checked (the date is shown).
- **Motivo** (why the article is not available) is shown only for *Prestado*, *En reparación* and
  *Extraviado*; it is cleared when the article becomes available again. **Observaciones** is free.
- Rows saved while a filter such as *Pendientes* is active stay visible until the filters change,
  so a row does not vanish after its first dropdown change.
- Saves of one row are queued (never two writes of the same row at once); unsaved values survive
  live updates from other users (per-row draft); a failed save marks the row and keeps the values.
- Filters: text, category, department, location, condition, availability and
  *Pendientes / Verificados / Todos*; sort by location (walking order, default), name, category,
  department, condition or availability.
- Pure helpers (round date, verified check, progress) live in `inventory.model.js` and are tested.
- Small screens and focus mode: each row becomes a card (same `responsive-table` pattern); on
  tablets the table scrolls horizontally inside its card instead of overflowing the page.

## Records (`#/records`, "Registros")

Admin and editor only (`catalogs.write`). Replaces the former "Catálogos" page (`#/catalogs` no
longer exists; like any unknown route it goes to `#/login`, which forwards a signed-in user home).

- **Hub** `#/records` (`records.view.js`): three large buttons, one per record type —
  **Tipo de artículo**, **Departamento**, **Ubicación** — each with an icon, a one-line hint and
  how many records it has.
- **List page** `#/records/:kind` (`catalog-list.view.js`), `kind` = `asset-types` | `departments` |
  `locations` (defined once in `catalog-kinds.js`; an unknown kind goes back to the hub):
  - Header with "← Registros" and **Agregar** (opens the same form in a dialog as **Editar**).
  - **Search** by name, description and (departments) leader names — accent- and case-insensitive.
  - **Filters**: *Uso* (todos / en uso / sin uso) and, for departments, *Líder* (con líder actual /
    sin líder actual).
  - **Sort**: nombre A → Z / Z → A, más / menos artículos, modificados recientemente.
  - Each record shows how many articles use it (counted from the in-memory asset store, no extra
    reads).
  - **Eliminar** only with `catalogs.delete` (admin); the rules enforce it too. A record that is
    still used by an article cannot be deleted.
- Filtering and sorting are pure functions in `catalog-filter.js` (tested).

## Routing

Hash routing (`#/path`) is used so the app works on **GitHub Pages** (which cannot rewrite URLs) and on
Firebase Hosting alike.

- A route may carry a query after `?` (e.g. `#/assets?filtro=atencion`); the router matches the
  path without it and passes `query` (`URLSearchParams`) to the view next to `params`.
- Unknown route → redirect to `#/login` (project rule). The login page forwards an already
  signed-in user to their **home**: `#/dashboard` for admin/editor, `#/home` for viewer
  (`homePath()` in `app.js`, given to the router).
- Route without session → `#/login`.
- Route without permission → home with a message.
- `404.html` sends any non-hash URL (e.g. `/vintocentral/anything`) back to `#/login`.

## Roles

| Role | Can do |
|------|--------|
| `admin` | Everything, including deleting assets and managing users. |
| `editor` | Dashboard, register and update assets, inventory-taking, create and edit records (no delete), reports, change history. |
| `viewer` | Home page, view assets and reports (no dashboard, no history). |

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
- Design (CLAUDE.md "REPORT DESIGN"), A4 landscape, minimalist:
  - **Header** — left: report title, *Departamento* (the department filter, or "Todos los
    departamentos"), report date and *Reportado por*; right: the IASD logo (`APP.logo`) and the
    church name. A muted line lists the other filters only when some are applied. If the logo cannot
    be loaded the report is still produced without it.
  - **Table** — [Foto], Fecha de adquisición, Artículo, Marca, Modelo, Nro. de serie, Cantidad,
    Estado. Plain style: soft header, thin row separators, no value columns.
  - **Signatures** after the table (on a new page if they do not fit): three lines labelled
    *Anciano del Departamento*, *Líder entrante* and *Líder saliente*.
  - **Footer** on every page: generation date (left) and "Página X de Y" (right).
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
  "¿Olvidó su contraseña?" link. Below, "¿No tiene cuenta?": the system administrator
  (`APP.adminContact`: name, role, optional email and phone shown as `mailto:` / `tel:` /
  WhatsApp links; empty values are simply not shown). No appearance options on this page.
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
  color; the user menu is wide with tall rows. The chosen text stays on **one line** (never wraps
  or spills over the border); option labels are kept short (e.g. "Actualidad", not
  "Actualidad (sigue)") so they fit.
- **Loading indicator** (`inventoryLoader()` in `core/dom.js`, styles `.inv-loader`): an inventory
  box whose lid bobs gently while a scan line sweeps its barcode label, always with a text
  ("Cargando…", "Guardando…"). Two sizes: `large` (pages, `role="status"`) and `small` (inside buttons
  and messages). Used everywhere the user waits: app start (`index.html` keeps a static copy of the
  same SVG), page changes slower than 250 ms (the router shows it in the content area), every
  `runSubmit()` button (save, sign in, create user, records), deleting an article, the PDF report,
  photo processing, the change history, the inventory grid while a row saves, the user list and the
  connected-users tile. Built with `createElementNS` (never `innerHTML`). The animation stops (static
  icon + text) with *prefers-reduced-motion* and in focus mode.
- Forms placed inside narrow cards adapt to the **card width**, not the screen width (CSS container
  queries). Example: the department leader editor shows Desde / Hasta / Quitar in one row only
  when the card is wide; otherwise Desde and Hasta share a row and Quitar goes below; in very
  narrow cards everything stacks.
- The **open list** uses the browser's customizable select (`appearance: base-select`, Chrome/Edge
  135+) so it takes the palette: border and checked option in `--primary`, hover in
  `--primary-soft`, 48 px rows. It is wrapped in `@supports`, so browsers without it (Firefox,
  older Safari) keep their native list — still a plain `<select>`, no JavaScript, fully accessible.
