# Trackseam — Client Measurement Records

An app for tailors to save, retrieve and export client measurements. It runs
on the web, Android and iOS (Capacitor).

---

## Project Structure

```
trackseam/
├── backend/                 Express API + MySQL (Prisma)
│   ├── server.js            app setup, CORS, public pages, error handling
│   ├── routes/              auth, clients, measurements
│   ├── prisma/              schema.prisma + migrations
│   ├── public/              privacy, terms, support, delete-account, reset-password pages
│   └── scripts/             migrate-from-mongo.js, build-website.js
├── frontend/                React (Vite) app, wrapped by Capacitor
│   ├── App.jsx              the whole UI
│   ├── capacitor.config.json
│   ├── resources/           icon + splash sources (npx capacitor-assets generate --assetPath resources)
│   ├── android/             Android Studio project
│   └── ios/                 Xcode project (Swift Package Manager, no CocoaPods)
├── website/                 policy pages for trackseam.com (generated: npm run build:website)
├── docs/
│   ├── RELEASE.md           building, signing, store upload, lost-key recovery
│   └── STORE_LISTING.md     listing copy, Data safety / App Privacy answers, review notes
└── .github/workflows/mobile-release.yml   iOS + Android store builds in CI
```

---

## Running locally

### Prerequisites
- Node.js 22+ (Capacitor 8 requires it; the backend alone works on 18.18+)
- A MySQL database (production uses Aiven)

### Backend

```bash
cd backend
npm install                   # also runs prisma generate
cp .env.example .env          # set DATABASE_URL, JWT_SECRET, MAIL_USER, MAIL_PASS, ...
npm run db:migrate            # create/upgrade tables
npm run dev                   # http://localhost:5000
```

`GET /api/health` reports `db: "ok"` once the database is reachable.

### Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:3002
```

The API URL comes from `VITE_API_BASE` in `frontend/.env`
(default `https://trackseam.onrender.com/api`).

---

## Deploying the backend (Render)

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `npm install && npx prisma migrate deploy` |
| Start command | `npm start` |
| Environment | everything in `backend/.env.example` (`DATABASE_URL`, `JWT_SECRET`, `MAIL_USER`, `MAIL_PASS`, `PUBLIC_URL`, `SUPPORT_EMAIL`, …) |

The privacy policy, terms, support and account-deletion pages are served by the
backend at `/privacy`, `/terms`, `/support` and `/delete-account`. The same pages are
published on trackseam.com from `website/` (see docs/RELEASE.md).

### Moving data from the old MongoDB

```bash
cd backend
MONGO_URI="mongodb+srv://..." npm run migrate:mongo -- --dry-run   # counts only
MONGO_URI="mongodb+srv://..." npm run migrate:mongo
```

Ids and password hashes are preserved, so existing users sign in as before. The
script skips rows that already exist, so it can be re-run after cut-over to pick
up accounts created in the meantime. If Node can't resolve the `mongodb+srv`
host (`querySrv ECONNREFUSED`), add `MONGO_DNS=8.8.8.8`.

---

## API Reference

All `/api/clients` routes require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account `{ shopName, email, password }` |
| POST | `/api/auth/login` | Sign in `{ email, password }` |
| GET | `/api/auth/me` | Current account |
| PATCH | `/api/auth/me` | Update `{ shopName?, preferredUnit? }` (`"in"` or `"cm"`) |
| DELETE | `/api/auth/me` | Delete account and all data `{ password }` |
| POST | `/api/auth/forgot-password` | Email a reset link `{ email }` |
| POST | `/api/auth/reset-password/:token` | Set new password `{ password }` |

### Clients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | List clients |
| GET | `/api/clients/search?q=name` | Search clients by name |
| GET | `/api/clients/:id` | One client |
| POST | `/api/clients` | Create `{ clientId, name, phone, email, notes }` |
| DELETE | `/api/clients/:id` | Delete client and their measurements |

### Measurements

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients/:id/measurements` | Measurements for a client, newest first |
| POST | `/api/clients/:id/measurements` | Add `{ outfitType, description, fields, notes, unit }` |
| DELETE | `/api/clients/:id/measurements/:measId` | Delete a measurement |

`fields` is an object of measurement name to value, e.g.
`{ "Chest": "42", "Waist": "34" }`; its key order is preserved. `unit` (`"in"` or
`"cm"`) is the unit the values were entered in. It defaults to `"cm"` when omitted,
which is what app versions before units meant. Values are stored as entered; the app
converts for display and PDF export.
