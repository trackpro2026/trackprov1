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
| Livestocks list/detail | `GET/POST/PATCH/DELETE /livestock` or `/animals` |
| Health history | `GET /health-records/animal/:id` or `/veterinary-visits/animal/:id` |
| Tracking | `/tracking` |
| AI triage / vet chat | `/ai/health-check`, `/ai/vet-assistant` |

**Farmer overview fields:** `totalLivestock`, `healthyLivestock`, `livestockOnTreatment`, `livestockTable[]` (id, species, breed, healthStatus, lastVaccinationDate).

---

## Veterinarian (Figma: Veterinarians Dashboard)

| Figma | API |
|-------|-----|
| Create account / Login | `/auth/signup/doctor`, `/auth/login/doctor` |
| Complete profile | `PATCH /doctor/profile` |
| Overview cards | `GET /dashboard/doctor` + `GET /health-records/stats` |
| Veterinary visits table | `GET /health-records` or `GET /veterinary-visits` (enriched: farmerName, livestockType, status) |
| Visit detail | `GET /health-records/:id` |
| Log visit | `POST /health-records` — body: `reason`, `status` (`pending` \| `completed`) |
| Map | `GET /map/markers` |

**Overview stats:** `totalLivestock`, `totalFarmers`, `totalVisits`, `pendingVisits`.

---

## Slaughterhouse operator (Figma: Slaughter Houses Dashboard)

| Figma | API |
|-------|-----|
| Create account / Login | `/auth/signup/slaughterhouse`, `/auth/login/slaughterhouse` |
| Profile + documents | `PATCH /slaughterhouse/profile` (creates facility `SH-001`, …) |
| Overview | `GET /dashboard/slaughterhouse` — `totalCattle`, `totalGoat`, `recentSlaughtered[]` |
| Slaughterhouses list | `GET /slaughterhouses` (public approved) |
| Schedule / records | `POST/GET /slaughter-records` |
| Map | `GET /map/markers` |

---

## Admin (Figma: Admin Dashboard)

| Figma | API |
|-------|-----|
| Overview | `GET /admin/overview` |
| Farmers | `GET /admin/farmers` |
| Livestocks | `GET /admin/livestock` |
| Slaughterhouses | `GET /admin/slaughterhouses` |
| Slaughterhouse operators | `GET /admin/slaughterhouse-operators` |
| Veterinary visits | `GET /admin/veterinary-visits` |
| Veterinarians | `GET /admin/doctors`, `PATCH /admin/doctors/:id/status` |
| Analytics | `GET /admin/analytics` |
| Map | `GET /map/markers` |

---

## Path aliases (Figma naming)

| Figma label | Canonical | Alias |
|-------------|-----------|-------|
| Livestock | `/animals` | `/livestock` |
| Veterinary visits | `/health-records` | `/veterinary-visits` |

---

## Still not in Figma / backend

- Marketplace / buy-sell livestock
- Social login (Google / Apple) — UI only today
- Push notification delivery — in-app list only; create via `NotificationService.createForUser()` from other modules when you wire events
