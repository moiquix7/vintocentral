# Data model (Firestore + Storage)

All collections are top level. Every write stamps `updatedAt` (server time) and `updatedBy` (uid);
the security rules verify both.

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
| `categoryId` | string | id from `categories` — shown in the UI as **Departamento**, required |
| `locationId` | string | id from `locations`, required |
| `condition` | string | `new` \| `good` \| `fair` \| `poor` \| `out_of_service` |
| `tags` | string[] | max 10, each 1–30, lowercase, unique |
| `acquisitionDate` | string | `YYYY-MM-DD` or empty |
| `value` | number | 0 – 1 000 000 000 (unit value, local currency) |
| `quantity` | int | 1 – 100 000 |
| `photos` | `{ path, url }[]` | max 4 |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | | stamps |

## `categories/{id}` (UI: "Departamentos") and `locations/{id}`

The collection keeps its technical name `categories`; only the interface calls it *Departamento*
(e.g. Jóvenes, Escuela Sabática, Música), so no data migration is needed.

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | 1–60, unique (case-insensitive, checked by the app) |
| `description` | string | 0–200 |
| `createdAt`, `updatedAt`, `updatedBy` | | stamps |

A category or location cannot be deleted while an asset uses it.

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
