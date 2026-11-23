# Setup and deployment

Firebase project: `db-vintocentral` · Repository: `moiquix7/vintocentral`

## 1. Firebase console (one time)

1. **Authentication → Sign-in method**: enable **Email/Password**.
2. **Authentication → Settings → Authorized domains**: add `moiquix7.github.io`
   (and `localhost` for local work, usually present already).
3. **Firestore Database**: create it (production mode).
4. **Storage**: create the default bucket. New buckets require the **Blaze** (pay-as-you-go) plan;
   a small church inventory stays inside the free quota.
5. **Project settings → General → Your apps**: add a **Web app** and copy its config.

## 2. Web configuration

Either:

- **Commit it**: paste the values into `js/config/firebase-config.js`. The web config is a public
  identifier, not a secret — the security rules protect the data. Or
- **Keep it out of git**: create the repository secret `FIREBASE_WEB_CONFIG` with the config as JSON
  (`{"apiKey":"…","authDomain":"…","projectId":"…","storageBucket":"…","messagingSenderId":"…","appId":"…"}`).
  The deploy workflow writes it into `js/config/firebase-config.js` at build time.

While the placeholders are still in place the app shows a "Firebase is not configured" screen.

## 3. Security rules

Install the Firebase CLI once (`npm i -g firebase-tools`), then:

```bash
firebase login
firebase deploy --only firestore:rules,firestore:indexes,storage
```

The first Storage deploy asks to allow Storage rules to read Firestore (needed to check roles) — accept.

## 4. First administrator

Users cannot sign themselves up. Create the first admin by hand:

1. **Authentication → Users → Add user** (email + password). Copy the **User UID**.
2. **Firestore → Start collection** `users`, document id = that UID, fields:

   | field | type | value |
   |-------|------|-------|
   | `email` | string | the email |
   | `displayName` | string | the person's name |
   | `role` | string | `admin` |
   | `active` | boolean | `true` |
   | `createdAt` | timestamp | now |
   | `updatedAt` | timestamp | now |
   | `updatedBy` | string | the same UID |

Then sign in **with the email** (the first admin has no username yet), open the user menu →
**Mi perfil**, choose a username and save. From then on that username works on the login page.

From then on, the admin creates every other user from the **Usuarios** page (name, username,
email, role, temporary password); each person can change their password and photo in **Mi perfil**.

Whenever `firestore.rules` or `storage.rules` change, publish them again (CLI or paste in the console).

## 4b. Photos in PDF reports — enable CORS on the bucket (required, one time)

`<img>` tags can show Storage photos without CORS, but the PDF report has to *download* each photo
(`fetch`), and Firebase Storage only allows that when the bucket has a CORS policy. Without it the
report comes out with "—" instead of photos and the app says CORS is missing.

1. Open https://console.cloud.google.com/?project=db-vintocentral (same Google account as Firebase).
2. Click the **Activate Cloud Shell** button (`>_`, top right) and wait for the terminal.
3. Paste and run (it writes the same policy as `storage-cors.json` and applies it):

```bash
echo '[{"origin":["http://localhost:8080","https://moiquix7.github.io","https://db-vintocentral.web.app","https://db-vintocentral.firebaseapp.com"],"method":["GET"],"maxAgeSeconds":3600}]' > cors.json && gcloud storage buckets update gs://db-vintocentral.firebasestorage.app --cors-file=cors.json && gcloud storage buckets describe gs://db-vintocentral.firebasestorage.app --format="default(cors_config)"
```

The last command prints the policy so you can confirm it was saved. Add any new site address
(e.g. a custom domain) to `origin` and run it again.

## 5. GitHub Pages

1. GitHub → repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main` (or run the workflow by hand). `.github/workflows/deploy-pages.yml`:
   runs the unit tests → copies only the site files to `_site` → (optionally) writes the Firebase
   config from the secret → publishes.
3. Site: `https://moiquix7.github.io/vintocentral/`

## 6. Firebase Hosting (alternative)

`firebase.json` is ready: it publishes the repository root (ignoring docs, tests, rules and tooling)
and rewrites every path to `index.html` so the SPA always loads.

```bash
firebase deploy --only hosting
```

## Local development

Node 20 is pinned with Volta (`package.json`). No dependencies to install.

```bash
npm start      # static server on http://localhost:8080 (ES modules do not work from file://)
npm test       # unit tests for the pure modules (node --test)
```
