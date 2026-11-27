# Data model (Firestore + Storage)

All collections are top level. Every write stamps `updatedAt` (server time) and `updatedBy` (uid);
the security rules verify both.

## Terminology ↔ technical names

The interface uses the church's terminology (CLAUDE.md → THERMINOLOGY); the code keeps English
technical names. Collections were never renamed, so no data migration is needed.

| Interface (es) | Meaning | Collection / field |
|----------------|---------|--------------------|
| **Artículo** | a fixed asset (furniture, equipment, vehicle…) | `assets` |
| **Categoría** | type of asset (Mobiliario, Equipo de sonido, Vehículos…) | `assetTypes` · `asset.typeId` |
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
| `typeId` | string | id from `assetTypes` — **Categoría**. Required by the form; optional in the rules (articles registered before categories existed) |
| `categoryId` | string | id from `categories` — shown in the UI as **Departamento**, required |
| `locationId` | string | id from `locations`, required |
| `condition` | string | `new` \| `good` \| `fair` \| `poor` \| `out_of_service` |
| `availability` | string | `available` \| `in_use` \| `loaned` \| `in_repair` \| `missing` (Disponible, En uso, Prestado, En reparación, Extraviado). Optional in the rules; missing = `available` |
| `tags` | string[] | max 10, each 1–30, lowercase, unique |
| `acquisitionDate` | string | `YYYY-MM-DD` or empty |
| `value` | number | 0 – 1 000 000 000 (unit value, local currency) |
| `quantity` | int | 1 – 100 000 |
| `photos` | `{ path, url }[]` | max 4 |
| `checkedAt` | timestamp | optional — last time the article was verified in an inventory-taking (`#/inventory`). The rules only accept the current server time when it changes |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | | stamps |

### Inventory-taking update

The `#/inventory` grid changes only `locationId`, `condition`, `availability` and stamps
`checkedAt` + `updatedAt` + `updatedBy` (`asset.service.js → checkAsset()`). The whole document is
still validated by `validAsset()`.

## `categories/{id}` (UI: "Departamentos"), `assetTypes/{id}` (UI: "Categorías") and `locations/{id}`

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

A department, category or location cannot be deleted while an article uses it.

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
| `assets.read` | ✔ | ✔ | ✔ |
| `assets.write` | ✔ | ✔ | |
| `assets.delete` | ✔ | | |
| `catalogs.write` | ✔ | ✔ | |
| `reports.view` | ✔ | ✔ | ✔ |
| `users.manage` | ✔ | | |
| own profile (`#/profile`) | ✔ | ✔ | ✔ |
