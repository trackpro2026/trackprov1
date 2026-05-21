# Trackpro

NestJS + MongoDB backend for **Track-pro**, a livestock and animal tracking platform (farmers, veterinarians, animals, health records, and weight/location tracking). Structure mirrors [Aidport](../E-COMMERCE/AIDPORT-BACKEND).

Design: [Track-pro Figma](https://www.figma.com/design/BMiVgXIeVE3c23kCwL4eav/Track-pro?node-id=0-1&p=f)

**Figma ↔ API map:** see [`docs/FIGMA_BACKEND_MAP.md`](docs/FIGMA_BACKEND_MAP.md) (full module list, aliases, gaps).

## Project structure

```
src/
├── core/encryption/       # Argon2 password hashing
├── common/                # Guards, decorators, pipes, CORS, Swagger, throttler
├── integrations/          # Email (Gmail OAuth), Cloudinary
├── modules/
│   ├── auth/              # Signup, login (farmer, doctor, admin)
│   ├── user/              # Profile, settings, public doctor directory
│   ├── doctor/            # Veterinarian profile completion
│   ├── animal/            # Herd / animal registry (+ `/livestock` Figma alias)
│   ├── health-record/     # Vet visits (+ `/veterinary-visits` Figma alias)
│   ├── slaughterhouse/    # Abattoirs & slaughter scheduling
│   ├── tracking/          # Weight, location, feeding events
│   ├── dashboard/         # Farmer & doctor dashboards
│   ├── admin/             # Farmer/doctor management, analytics
│   ├── ai/                # Gemini livestock AI (6 endpoints)
│   └── upload/            # Cloudinary file uploads
├── app.module.ts
├── health.controller.ts
└── main.ts
```

## Setup

```bash
cp .env.example .env
npm install
npm run start:dev
```

Default MongoDB: `mongodb://localhost:27017/trackpro`

Swagger UI: `http://localhost:3000/api/docs`

API base path: `http://localhost:3000/api/v1`

## Mobile & web

| Client | How to authenticate |
|--------|---------------------|
| **Mobile** | `Authorization: Bearer <accessToken>` from login — no CSRF, no cookies |
| **Web (SPA)** | Same Bearer header (recommended) |
| **Web (cookies)** | `credentials: 'include'` + optional CSRF when `CSRF_ENABLED=true` |

- **CORS:** `CORS_UNIVERSAL=true` in `.env` allows any origin (default).
- **CSRF:** `GET /api/v1/auth/csrf` returns `{ csrfToken }` for cookie-based web only. Default `CSRF_ENABLED=false`.
- Optional header: `X-Client-Platform: mobile` or `web`.

## Postman

Import:

- `postman/Trackpro.postman_collection.json`
- `postman/Trackpro.local.postman_environment.json`

Regenerate the collection after API changes:

```bash
node scripts/generate-postman.mjs
```

Signup/login tests save `{{accessToken}}`. Use **Sign Up Doctor** + **Login Doctor** for veterinarian routes. Verify email before login (except admin).

## API overview

### Auth (public) — prefix `/api/v1`
- `POST /api/v1/auth/signup` — Farmer registration
- `POST /auth/signup/doctor` — Veterinarian registration
- `POST /auth/signup/admin` — Admin registration
- `POST /auth/login` — Farmer login
- `POST /auth/login/doctor` — Doctor-only login
- `POST /auth/forgot-password` / `POST /auth/reset-password`
- `POST /auth/verify-email` / `POST /auth/request-verification-code`

### Users (protected)
- `GET /users/me` — Current profile
- `PATCH /users/me` — Update profile (farm name, location, assigned doctor)
- `PATCH /users/me/settings` — Notification preferences
- `PATCH /users/me/password` — Change password

### Doctors (public directory)
- `GET /doctors` — List veterinarians
- `GET /doctors/:id` — Doctor profile

### Doctor portal (protected, doctor role)
- `PATCH /doctor/profile` — Complete veterinarian profile

### Livestock `/api/v1/livestock` — Figma alias (same as `/animals`)

| Method | Description |
|--------|-------------|
| POST | Create (farmer) |
| GET | List herd |
| GET `:id` | One animal |
| PATCH `:id` | Update |
| DELETE `:id` | Delete |

### Animals `/api/v1/animals` — full CRUD (canonical)
| Method | Description |
|--------|-------------|
| POST | Create (farmer) |
| GET | List (farmer / doctor / admin) |
| GET `:id` | One animal |
| PATCH `:id` | **Update** animal (farmer, assigned doctor, admin) |
| DELETE `:id` | Delete (farmer, admin) |

### Tracking `/api/v1/tracking` — full CRUD (farmer)
| Method | Description |
|--------|-------------|
| POST | Create event (weight updates animal `weightKg`) |
| GET | List all events (`?animalId=` optional) |
| GET `animal/:animalId` | List for one animal |
| GET `:id` | One event |
| PATCH `:id` | **Update** event |
| DELETE `:id` | Delete event |

### Veterinary visits `/api/v1/veterinary-visits` — Figma alias (same as health-records)

| Method | Description |
|--------|-------------|
| POST | Log visit (doctor) |
| GET | Doctor’s visits |
| GET `animal/:animalId` | Visit history per animal |
| GET/PATCH/DELETE `:id` | One visit |

### Health records `/api/v1/health-records` — full CRUD (canonical)
| Method | Description |
|--------|-------------|
| POST | Create (doctor) |
| GET | Doctor’s records |
| GET `animal/:animalId` | By animal (farmer / doctor / admin) |
| GET `:id` | One record |
| PATCH `:id` | **Update** (doctor who created, or admin) |
| DELETE `:id` | Delete (doctor who created, or admin) |

### Slaughterhouse

| Method | Path | Description |
|--------|------|-------------|
| GET | `/slaughterhouses` | Approved facilities (public) |
| GET | `/slaughterhouses/all` | All facilities (admin) |
| POST | `/slaughterhouses` | Register facility (admin) |
| POST | `/slaughter-records` | Schedule slaughter (farmer) |
| GET | `/slaughter-records` | List records |
| PATCH | `/slaughter-records/:id` | Inspection / update (doctor, admin, farmer cancel) |

### AI `/api/v1/ai` (JWT, `GEMINI_API_KEY`)

- `POST /ai/health-check` — photo triage  
- `POST /ai/vet-assistant` — multilingual vet chat  
- `POST /ai/guardian` — outbreak detection  
- `POST /ai/health-score` — score 0–100  
- `POST /ai/vaccination-schedule` — due dates  
- `POST /ai/report` — surveillance Markdown report  

### Dashboard (protected)
- `GET /dashboard/me` — Role-based summary
- `GET /dashboard/farmer` — Herd stats & recent activity
- `GET /dashboard/doctor` — Assigned animals & recent visits

### Admin (protected, admin role)
- `GET /admin/farmers` / `GET /admin/doctors`
- `GET /admin/analytics`
- `PATCH /admin/doctors/:id/status` — Approve or decline veterinarians

### Upload (protected)
- `POST /upload/single` / `POST /upload/multiple` — Cloudinary uploads
- Farmers → `userFileUrls`; doctors → `doctorProfile.documentUrls`

## Tests

```bash
npm test                 # unit
npm run test:integration # integration (in-memory MongoDB)
npm run test:e2e         # full app e2e
```

## Email

Gmail OAuth only (no SMTP). Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and `EMAIL_LOGO_URL` in `.env`.
# trackprov1
# trackprov1
