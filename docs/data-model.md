# Data model (Firestore + Storage)

All collections are top level. Every write stamps `updatedAt` (server time) and `updatedBy` (uid);
the security rules verify both.

## Terminology ↔ technical names

The interface uses the church's terminology (CLAUDE.md → THERMINOLOGY); the code keeps English
technical names. Collections were never renamed, so no data migration is needed.

| Interface (es) | Meaning | Collection / field |
|----------------|---------|--------------------|
| **Artículo** | a fixed asset (furniture, equipment, vehicle…) | `assets` |
| **Tipo de artículo** | type of asset (Mobiliario, Equipo de sonido, Vehículos…) | `assetTypes` · `asset.typeId` |
| **Departamento** | ministry responsible for the asset (Jóvenes, Música…) | `categories` · `asset.categoryId` (legacy name) |
| **Ubicación** | physical place (Templo, Salón de jóvenes…) | `locations` · `asset.locationId` |
| **Etiqueta** | free tag for classification / tracking | `asset.tags` |
| **Usuario** | person who uses the application | `users` |
| **IASD** | Iglesia Adventista del Séptimo Día | `APP.churchName` |

## `users/{uid}`

The document id is the Firebase Authentication uid.

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | 3–254 (Firebase Auth needs an email; also used for password recovery) |
| `username` | string | `^[a-z0-9._-]{3,30}$`, unique (see `usernames`). Required on create; optional on legacy docs |
| `displayName` | string | 1–80 |
| `role` | string | `admin` \| `editor` \| `viewer` |
| `active` | bool | `false` blocks all access |
| `photoUrl`, `photoPath` | string | optional profile photo (`profiles/{uid}/...`) |
| `departmentId` | string | 0–64, optional — id from `categories` (the user's **Departamento**). Set by the admin in *Usuarios*; pre-fills the department when registering an article. Never self-edited |
| `createdAt`, `updatedAt` | timestamp | server time |
| `updatedBy` | string | uid of whoever wrote it |

A signed-in account **without** this document (or with `active: false`) has no access.

Who may write:
- **admin**: create (with username) and change role / active of others.
- **the user themself**: only `displayName`, `username`, `photoUrl`, `photoPath` (+ stamps) — the
  "Mi perfil" page. Role and active can never be self-edited.

## `usernames/{username}`

Login lookup index: lets people sign in with a username instead of their email.

| Field | Type | Rules |
|-------|------|-------|
| `uid` | string | owner |
| `email` | string | owner's Auth email |

- Document id = the username (lowercase). Creating an existing id fails → usernames are unique.
- `get` is public (needed before sign-in); `list` is denied, so usernames cannot be enumerated.
  Trade-off: whoever knows a username can learn its email.
- Written in the same batch as `users/{uid}`; the rules check both sides with `getAfter()`.

## `assets/{assetId}`

| Field | Type | Rules |
|-------|------|-------|
| `code` | string | 0–30, optional inventory label (e.g. `SILLA-001`) |
| `name` | string | 1–120, required |
| `description` | string | 0–500 |
| `brand` | string | 0–60, optional — Marca |
| `model` | string | 0–60, optional — Modelo |
| `serialNumber` | string | 0–60, optional — Nro. de serie |
| `builtIn` | bool | optional — *Empotrado* (fixed to the building). Missing = `false` |
| `insured` | bool | optional — *Asegurado*. Missing = `false` |
| `typeId` | string | id from `assetTypes` — **Tipo de artículo**. Required by the form; optional in the rules (articles registered before asset types existed) |
| `categoryId` | string | id from `categories` — shown in the UI as **Departamento**, required |
| `locationId` | string | id from `locations`, required |
| `condition` | string | `new` \| `good` \| `fair` \| `poor` \| `out_of_service` |
| `availability` | string | `available` \| `in_use` \| `loaned` \| `in_repair` \| `missing` (Disponible, En uso, Prestado, En reparación, Extraviado). Optional in the rules; missing = `available` |
| `unavailableReason` | string | 0–200, optional — why the article is not available. Only kept for `loaned`, `in_repair`, `missing` (the model empties it otherwise) |
| `notes` | string | 0–500, optional — comments about the article's status (Observaciones) |
| `tags` | string[] | max 10, each 1–30, lowercase, unique |
| `acquisitionDate` | string | `YYYY-MM-DD` or empty |
| `value` | number | 0 – 1 000 000 000 (unit value, local currency) |
| `quantity` | int | 1 – 100 000 |
| `photos` | `{ path, url }[]` | max 4 |
| `checkedAt` | timestamp | optional — last time the article was verified in an inventory-taking (`#/inventory`). The rules only accept the current server time when it changes |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | | stamps |

`brand`, `model`, `serialNumber`, `builtIn` and `insured` are optional in the rules (articles registered
before they existed stay valid); the app always writes them.

**No duplicates:** the app refuses to save an article whose name (ignoring case and accents) already
exists **in the same location** (`findDuplicateAsset()` in `asset.model.js`, checked against the
live asset list). The same name in another location is allowed; identical units go in `quantity`.

### Inventory-taking update

The `#/inventory` grid changes only `locationId`, `condition`, `availability`,
`unavailableReason`, `notes` and stamps `checkedAt` + `updatedAt` + `updatedBy`
(`asset.service.js → checkAsset()`). The whole document is still validated by `validAsset()`.

## `assetHistory/{entryId}`

Audit trail of article changes (UI: "Historial"). One entry per article write, written in the same
batch as the article (`asset.service.js`). Immutable.

| Field | Type | Rules |
|-------|------|-------|
| `assetId` | string | 1–64, the article's document id |
| `assetName` | string | 1–120, the article's name at the time (kept after deletion) |
| `action` | string | `create` \| `update` \| `check` \| `delete` (Registró, Modificó, Verificó, Eliminó) |
| `changes` | `{ field, from, to }[]` | max 20; `field` is an asset field name, `from`/`to` readable text ≤ 200 (validated by `history.model.js`; the rules check list type and size) |
| `by` | string | uid of the author (must be the signed-in user) |
| `byName` | string | 1–80, author's display name at the time |
| `at` | timestamp | must be the server time of the write |

- Read: `admin`, `editor`. Create: `admin`, `editor`, only together with the article write
  (`create`/`update`/`check`: the article's `updatedAt` after the batch is this same server time;
  `delete`: the article no longer exists after the batch). Update / delete: never.
- Queries: by `assetId` (equality, sorted on the client) and by `at` descending with a limit — both use
  automatic single-field indexes, no composite index needed.

## `presence/{uid}`

Heartbeat used by the dashboard to count connected users. Document id = the user's uid.

| Field | Type | Rules |
|-------|------|-------|
| `displayName` | string | 1–80 |
| `lastSeen` | timestamp | must be the server time of the write |

- Read: `admin`, `editor` (the dashboard). Create/update/delete: only the user themself, with an
  active profile. No other fields are accepted.
- Connected = `lastSeen` within the last 5 minutes. Old documents are harmless (they just count as
  not connected) and are deleted on sign-out.

## `categories/{id}` (UI: "Departamentos"), `assetTypes/{id}` (UI: "Tipos de artículo") and `locations/{id}`

The collection keeps its technical name `categories`; only the interface calls it *Departamento*
(e.g. Jóvenes, Escuela Sabática, Música), so no data migration is needed.

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | 1–60, unique (case-insensitive, checked by the app) |
| `description` | string | 0–200 |
| `leaders` | `{ name, from, to }[]` | **departments only**, max 30 — leader history (see below) |
| `createdAt`, `updatedAt`, `updatedBy` | | stamps |

`leaders` items (validated by `catalog.model.js`; the rules check the list type and size):

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | 1–80 |
| `from` | int | year the term (*gestión*) started, 1950 … next year |
| `to` | int \| null | year it ended (≥ `from`); `null` = still leading ("Actualidad") |

Stored sorted: current leaders first, then by `from` descending. The UI picks years from dropdowns.

`locations` and `assetTypes` documents never have `leaders` (rules: `validCatalog`); `categories`
documents always have it, possibly empty (rules: `validDepartment`).

Legacy: a short-lived version stored a single `leader` + `term` (`"2026"` / `"2025-2026"`). The app
still reads them as a one-item history, and the first edit replaces them with `leaders` (the old
fields are deleted).

A tipo de artículo, department or location cannot be deleted while an article uses it.
Create/update: `admin`, `editor`. Delete: `admin` only (`catalogs.delete`; rules: `isAdmin()`).

## Storage

```
assets/{assetId}/{timestamp}-{random}.jpg
```

- Only images (`jpeg`, `png`, `webp`), max 5 MB (the app uploads ≤ 1600 px JPEGs, usually < 500 KB).
- Read: any active user. Create/delete: `admin`, `editor`.

```
profiles/{uid}/{timestamp}-{random}.jpg
```

- Profile photo, ≤ 512 px JPEG, max 2 MB. Read: any active user. Create/delete: only that user.

## Permissions matrix

| Permission | admin | editor | viewer |
|------------|:-----:|:------:|:------:|
| `dashboard.view` (+ read `presence`) | ✔ | ✔ | |
| `history.view` (read `assetHistory`) | ✔ | ✔ | |
| `assets.read` | ✔ | ✔ | ✔ |
| `assets.write` | ✔ | ✔ | |
| `assets.delete` | ✔ | | |
| `catalogs.write` ("Registros": create, edit) | ✔ | ✔ | |
| `catalogs.delete` (delete records) | ✔ | | |
| `reports.view` | ✔ | ✔ | ✔ |
| `users.manage` | ✔ | | |
| own profile (`#/profile`) | ✔ | ✔ | ✔ |
