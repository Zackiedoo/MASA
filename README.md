# MASA — Modern Academic Social Announcements

A role-based academic announcement and communication platform (React + Vite + TypeScript + Tailwind + Firebase, deployed on Vercel).

* **Home** – public feed of official announcements & memoranda (no login)
* **Freedom Wall** – students only, temporary posts (3/6/12/24 h), anonymous option, reports & moderation
* **Messages / Class updates** – subject groups, professor-approved membership, weekly schedule with green/yellow/red status
* **Profile** – avatar + colour, nickname, bio
* **Settings** – Maroon & Gold (default) / Light / Dark, font size, reduce motion, legal documents, password
* **Admin dashboard** (`/admin`) and **Publisher studio** (`/publish`, organizations + admins)

> **Status honesty:** the code in this repository was written without being able to install packages or reach Firebase, so
> it has been type-checked (against stubbed library types) and its pure logic unit-run, but **never built with Vite, never run
> against a real Firebase project, and the Security Rules have not been run in the Firebase Emulator**. Follow
> “First-run checklist” below before real use.

---

## 1. Install dependencies

Requires Node 18.18+ (Node 20/22 recommended).

```bash
npm install
```

## 2. Run locally

```bash
npm run dev          # UI only → http://localhost:5173
```

With no Firebase variables set, MASA starts in a clearly labelled **DEMO MODE** (yellow banner on every screen): sample data lives in
your browser’s localStorage, there are no security rules, and the shared demo password is shown on the login screen. Use it to explore the UI only.

To test the server functions (`/api/*`: account provisioning, memo ingestion, cleanup) locally use the Vercel CLI:

```bash
npm i -g vercel
vercel dev           # serves the app AND /api together
```

## 3. Configure Firebase

1. [Firebase console](https://console.firebase.google.com) → **Add project**.
2. **Project settings → General → Your apps → Web app** → copy the config values.
3. `cp .env.example .env.local` and fill the `VITE_FIREBASE_*` values. (`src/lib/firebase.ts` reads exactly these seven.)
4. **Project settings → Service accounts → Generate new private key.** Keep the JSON **out of git**. Its contents go only into the server variable `FIREBASE_SERVICE_ACCOUNT_JSON` (never a `VITE_` variable).

## 4. Create the Realtime Database
Build → **Realtime Database → Create database** (choose a region, start in *locked mode*). Put its URL in `VITE_FIREBASE_DATABASE_URL` and `FIREBASE_DATABASE_URL`.

## 5. Configure Firebase Authentication
Build → **Authentication → Get started → Sign-in method → Email/Password → Enable** (leave “Email link” off).
Student IDs are mapped to a synthetic e-mail `<id>@<LOGIN_EMAIL_DOMAIN>` (default `masa-login.example.com`). No e-mail is ever sent. `VITE_LOGIN_EMAIL_DOMAIN` and `LOGIN_EMAIL_DOMAIN` **must match**. Accounts are created only by administrators through `/api/admin/users`; there is no self-registration.

## 6. Configure Firebase Storage
Build → **Storage → Get started**. Put the bucket in `VITE_FIREBASE_STORAGE_BUCKET` / `FIREBASE_STORAGE_BUCKET`. (Storage may require the Blaze plan on new projects.) Used for announcement images/attachments, memo documents and organization logos.

## 7. Apply Security Rules
```bash
npm i -g firebase-tools && firebase login
firebase use <your-project-id>
firebase deploy --only database,storage     # uses database.rules.json and storage.rules
```
`database.rules.json` is generated from `scripts/generate-rules.mjs` (edit that, then `npm run rules:generate`). **Test them in the Emulator** (`firebase emulators:start --only database,auth`) — especially the Freedom Wall create rule, which uses multi-path cross-checks (`newData.parent().parent()`), and report/post rate-limits.

Storage rules read roles from **custom claims**, which `/api/admin/users` sets on account creation / role change.

### Create the first administrator
```bash
FIREBASE_SERVICE_ACCOUNT_FILE=./serviceAccount.json \
FIREBASE_DATABASE_URL=https://<project>-default-rtdb.firebaseio.com \
npm run admin:create -- admin01 "Site Administrator"
```
It prints a temporary password; you must change it at first login. Then sign in, open **Menu → Administrator dashboard**, create organizations, professors and students (single or bulk), register subjects, upload class lists.

## 8. Vercel environment variables
Project → Settings → Environment Variables (Production + Preview):

| Variable | Notes |
|---|---|
| `VITE_FIREBASE_*` (7) | from the web-app config |
| `VITE_LOGIN_EMAIL_DOMAIN` / `LOGIN_EMAIL_DOMAIN` | identical values |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | whole JSON, one line — **server only** |
| `FIREBASE_DATABASE_URL`, `FIREBASE_STORAGE_BUCKET` | server |
| `CRON_SECRET` | long random string; protects `/api/cron/cleanup` |
| `MEMO_WEBHOOK_SECRET` | optional; leave empty to disable the memo webhook |

## 9. Deploy to Vercel
Push to GitHub → Vercel **Add New Project** → import. Framework *Vite* is detected (`vercel.json` sets build, output and the SPA rewrite that excludes `/api`). Add the variables above, deploy, then add your Vercel domain under **Firebase → Authentication → Settings → Authorized domains**.

---

## Roles and permissions (RBAC)

| Capability | System Administrator | Organization account | Professor / Instructor | Student |
|---|---|---|---|---|
| How the account is obtained | Created with `npm run admin:create` | **Self-registers** at `/register`; **needs admin approval** | **Self-registers** at `/register`; **needs admin approval** | Created by an administrator |
| Create / edit / delete / disable any user, reset passwords | ✅ | – | – | – |
| Approve or reject Professor and Organization registrations | ✅ (Admin → Approvals) | – | – | – |
| Create / update / delete courses, assign professors, set meeting times | ✅ | – | – | – |
| View announcements and share their link | ✅ | ✅ | ✅ | ✅ (also signed-out visitors) |
| Create announcements | ✅ | ✅ (after approval) | – | – |
| Edit / delete announcements | ✅ any | ✅ **only their own** | – | – |
| Flag / hide / delete any announcement | ✅ | – | – | – |
| View assigned courses | ✅ all | – | ✅ only courses assigned to them | ✅ only courses they are enrolled in |
| Enroll an existing student in a course / remove a student | ✅ | – | ✅ **own courses only** | – |
| Update class status (green / yellow / red) | ✅ | – | ✅ own courses | – |
| Freedom Wall: view | ✅ | ✅ view-only | ✅ view-only | ✅ |
| Freedom Wall: post, report | – | – | – | ✅ |
| Freedom Wall: edit / delete a post | ✅ moderate any (flag, hide, remove, look up author) | – | – | ✅ **only their own** |
| Review user reports | ✅ | – | – | – |

**Where it is enforced.** Three layers, so hiding a button is never the only protection:

1. **Interface** – `src/lib/permissions.ts` is the one permission matrix. Pages use `AuthGate` (route level: wrong role → a clear "You don't have permission" screen with a way back; pending/rejected → a status screen) and `can(profile, 'action')` (buttons shown or hidden).
2. **Database** – `database.rules.json` (generated by `scripts/generate-rules.mjs`) and `storage.rules` check the signed-in user's role, approval and ownership on every read and write. A user who edits the front end still gets `PERMISSION_DENIED`, which the app shows as a plain-language message.
3. **Server** – everything that needs elevated power (creating accounts, approving registrations, deleting users, assigning roles) runs in `/api/*` functions that verify the caller's token and re-read their role from the database before acting.

**Registration flow.** `/register` → server function `api/register.ts` creates a login that is `pending` and inactive (rate-limited per IP, honeypot field) → the applicant sees a "Waiting for approval" screen → an administrator approves (organizations are linked to, or create, an organization record) or rejects with an optional reason → on approval the account becomes active and custom claims are set.

**Upgrading an existing deployment.** Accounts created before this version have no `approvalStatus`; they are treated as approved. After deploying, sign in as an administrator → **Admin → Settings → Rebuild the student lookup** once. This builds the Student-ID index professors use to enroll students and upgrades older course rosters so names show.

## How the main pieces work

**Authentication** – Firebase Auth (e-mail/password) behind a Student-ID login. Passwords are never stored in the database. First login with a temporary password forces a change. “Forgot password” files a request (`/resetRequests/<id>`) that an admin resolves by issuing a new temporary password (students cannot receive e-mail).

**Roles** – `users/<uid>/role` (student · organization · professor · admin). Users cannot write their own role (rules). Frontend role guards are only UX; the Rules enforce access.

**Freedom Wall privacy** – the public record (`/freedomWall`) holds no identity. The real author is in `/freedomWallPrivate` (admin-read only); each admin lookup is logged. Optional moderation-first mode (Admin → Settings) routes posts through `/freedomWallQueue`.

**Expiry** – posts carry `expiresAt`; the UI hides expired posts immediately, and `/api/cron/cleanup` deletes them (plus identities and reports). Vercel Hobby only allows a **daily** cron (configured in `vercel.json`); for hourly cleanup enable `.github/workflows/cleanup.yml` (secrets `MASA_URL`, `CRON_SECRET`).

**Subjects** – student requests → `joinRequests/<subject>/<uid>` + `userSubjects/<uid>/<subject>=pending` (duplicate requests blocked by rules) → professor sees the Student ID with an “on class list” check → approval writes `subjectMembers`. Group data is readable only by approved members, the subject’s professor and admins.

**Schedule** – each subject has slots (default **green**). Only the subject’s professor/admin can change a slot’s status; changes are append-logged in `scheduleHistory` and appear live on students’ schedules.

**Memoranda** – `POST /api/memos/ingest` accepts (a) `x-masa-webhook-secret` for an external system or (b) an admin’s ID token (used by the dashboard form). It validates, detects duplicates (hash of office + reference number, or title + content), records source office and publication status, and creates the matching homepage announcement. **No source system is connected**: you must supply the sender and set `MEMO_WEBHOOK_SECRET`. Text auto-extraction of reference number/subject works on pasted/`.txt` content only; **PDF text extraction is not implemented**.

## First-run checklist (things I could not test)
1. `npm install && npm run build` — fix any version-related type errors.
2. Run the Rules in the Emulator; try posting, reporting, joining a subject as the wrong user.
3. Create accounts of each role and walk through each section on a phone.
4. Verify `vercel dev` → `/api/admin/users` create + reset flows.
5. Run your own accessibility pass (contrast, screen reader) and have the legal templates in `src/content/legal.ts` reviewed.

## Known limitations

- Professor/organization sign-up uses a username, not a verified e-mail address; the contact e-mail you collect is for the administrator to check identity manually.
- Editing a Freedom Wall post is disabled while "Require approval" is on (delete and repost instead), so edits can't bypass moderation.
- Renaming a student does not rewrite the name already stored on old course rosters until the next "Rebuild the student lookup".
- Demo mode simulates these rules in the browser; only the real Firebase rules/server functions actually enforce them.
* Reset-request and login rate-limiting for *unauthenticated* actions rely on Firebase’s own throttling; enable **App Check** for stronger protection.
* Swipe navigation is touch-only and disabled inside inputs/dialogs.
* The profanity filter is a tiny starter list.
* Archived announcements remain technically readable by direct database access (the homepage hides them).
* No push notifications; unread/pending indicators are in-app only.
