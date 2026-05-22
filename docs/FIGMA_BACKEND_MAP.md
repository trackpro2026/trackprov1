# Track-pro — Figma ↔ Backend (4 roles)

Design: [Track-pro Figma](https://www.figma.com/design/BMiVgXIeVE3c23kCwL4eav/Track-pro?node-id=0-1&p=f)

## Roles

| Figma dashboard | Backend `role` | Sign up | Login |
|-----------------|----------------|---------|-------|
| Farmers | `farmer` | `POST /auth/signup` | `POST /auth/login` |
| Veterinarians | `doctor` | `POST /auth/signup/doctor` | `POST /auth/login/doctor` |
| Slaughter Houses | `slaughterhouse` | `POST /auth/signup/slaughterhouse` | `POST /auth/login/slaughterhouse` |
| Admin | `admin` | `POST /auth/signup/admin` | `POST /auth/login` |

All signups accept optional `phone` (Figma forms).

---

## Shared (every role)

| Figma screen | API |
|--------------|-----|
| Profile | `GET/PATCH /users/me`, `PATCH /users/me/password` |
| Notification | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Map | `GET /map/markers` |
| Logout | `POST /auth/logout` |
| Overview (auto) | `GET /dashboard/me` — picks dashboard by JWT role |

---

## Farmer (Figma: Farmers Dashboard)

| Figma | API |
|-------|-----|
| Create account / Login / Forgot password | `/auth/*` |
| Overview + livestock table | `GET /dashboard/farmer` or `/dashboard/me` |
| Livestocks list/detail | `GET/POST/PATCH/DELETE /livestock` |
| Health history | `GET /veterinary-visits/animal/:id` |
| AI triage / vet chat | `/ai/health-check`, `/ai/vet-assistant` |

**Farmer overview fields:** `totalLivestock`, `healthyLivestock`, `livestockOnTreatment`, `livestockTable[]` (id, species, breed, healthStatus, lastVeterinaryVisit).

---

## Veterinarian (Figma: Veterinarians Dashboard)

| Figma | API |
|-------|-----|
| Create account / Login / Forgot password | `/auth/signup/doctor`, `/auth/login/doctor`, `/auth/forgot-password` … |
| Profile / password / notification toggles | `GET/PATCH /users/me`, `PATCH /users/me/password`, `PATCH /users/me/settings` |
| Complete clinic profile | `PATCH /doctor/profile` |
| Overview + visits table | `GET /dashboard/doctor` or `GET /doctor/overview` or `GET /veterinary-visits/overview` |
| Overview cards (monthly filter) | `?month=5&year=2026` on overview — `totalVisits`, `slaughterhousesVisited`, `healthyAnimals`, `sickAnimals` |
| Visit charts | `GET /veterinary-visits/analytics` or `GET /doctor/analytics` |
| Veterinary visits list | `GET /veterinary-visits` — `ownerName`, `livestockId` (tag), `summary`, `visitDateTime`, `?search=` |
| Visit detail | `GET /veterinary-visits/:id` — `livestock`, `owner`, `veterinarian` cards |
| Log visit | `POST /veterinary-visits` — `reason`, `status` (`pending` \| `completed`) |
| Map | `GET /map/markers` — assigned livestock + farmers |
| Notifications | `GET /notifications` — auto: **New farmer**, **New animal**, visit updates |

**Overview stats:** `totalVisits`, `slaughterhousesVisited`, `healthyAnimals`, `sickAnimals`, `pendingVisits`, `recentVeterinaryVisits[]`.

---

## Slaughterhouse operator (Figma: Slaughter Houses Dashboard)

| Figma | API |
|-------|-----|
| Create account / Login / Forgot password | `/auth/signup/slaughterhouse` (+ optional `address`, `phone`), `/auth/login/slaughterhouse`, `/auth/forgot-password` … |
| Profile / password | `GET/PATCH /users/me`, `PATCH /users/me/password` |
| Overview + process alerts + animals table | `GET /dashboard/slaughterhouse` or `GET /slaughterhouse/overview` — `processAlerts`, `animalsRegisteredTable`, counts |
| Livestock management table | `GET /slaughterhouse/livestock` (?species=) |
| Facility slaughter records | `GET /slaughterhouse/records` or `GET /slaughter-records` (operator sees own facility) |
| Update inspection / processing | `PATCH /slaughter-records/:id` (operator role) |
| Profile + documents | `PATCH /slaughterhouse/profile` (creates facility `SH-001`, …) |
| Slaughterhouses list (pick facility) | `GET /slaughterhouses` (public approved) |
| Map | `GET /map/markers` — linked farmers + booked livestock + own facility |
| Notifications | `GET /notifications` (auto: new booking, new farmer, inspection, etc.) |

---

## Admin (Figma: Admin Dashboard)

| Figma | API |
|-------|-----|
| Overview | `GET /admin/overview` — summary cards, healthy/sick livestock, visit stats, `visitsByMonth`, recent visits |
| Farmers list / detail | `GET /admin/farmers` (+ `livestockCount`), `GET /admin/farmers/:id` |
| Livestocks list / detail | `GET /admin/livestock`, `GET /admin/livestock/stats`, `GET /admin/livestock/:id` |
| Slaughterhouses | `GET /admin/slaughterhouses` (+ active/inactive summary), `GET /admin/slaughterhouses/:id` |
| Slaughterhouse operators | `GET /admin/slaughterhouse-operators` |
| Veterinary visits | `GET /admin/veterinary-visits`, `GET /admin/veterinary-visits/stats`, `GET /admin/veterinary-visits/:id` |
| Veterinarians | `GET /admin/doctors`, `GET /admin/doctors/:id`, `PATCH /admin/doctors/:id/status` |
| Profile / password / settings | `GET/PATCH /users/me`, `PATCH /users/me/password`, `PATCH /users/me/settings` |
| Notifications | `GET /notifications` — auto: new farmer, vet, slaughterhouse operator signups |
| Map | `GET /map/markers` |
| Analytics | `GET /admin/analytics` |

---

## AI (unchanged)

| Endpoint | Purpose |
|----------|---------|
| `POST /ai/health-check` | Photo triage |
| `POST /ai/vet-assistant` | Vet chat |
| `POST /ai/guardian` | Outbreak / guardian |
| `POST /ai/health-score` | Health score |
| `POST /ai/vaccination-schedule` | Vaccination plan |
| `POST /ai/report` | Surveillance report |

Requires `GEMINI_API_KEY`.

---

## Removed (not in Figma)

- `/tracking` — weight/location event log
- `/animals`, `/health-records` — duplicate paths (use `/livestock`, `/veterinary-visits`)
- `platform-settings` — leftover from another project

---

## In-app notifications (auto-created)

| Event | Recipient |
|-------|-----------|
| New farmer / vet / slaughterhouse signup | All **admins** |
| Vet logs visit | Farmer |
| Visit marked completed | Farmer |
| Visit deleted | Farmer |
| Livestock assigned to vet | Doctor |
| Livestock health status changes | Assigned doctor |
| Slaughter scheduled | Farmer + slaughterhouse operator |
| Slaughter completed / cancelled / inspection | Farmer (+ operator on cancel) |
| Admin approves / declines vet | Doctor |

List: `GET /notifications`. Push/email delivery is still out of scope.

## Still not in Figma / backend

- Marketplace / buy-sell livestock
- Social login (Google / Apple) — UI only today
- Push / email notification delivery (in-app records only)
