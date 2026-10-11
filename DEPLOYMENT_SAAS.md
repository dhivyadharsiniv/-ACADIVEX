# ACADIVEX Multi-Tenant SaaS Platform — Architecture & Production Deployment Manual

## 1. System Architecture Overview

**ACADIVEX** has been upgraded from a single-institution system into a secure, production-ready Multi-Tenant Education & Campus Management SaaS platform.

### Multi-Tenancy Design
* **Shared-Process / Isolated-Data Model:** All tenant queries across PostgreSQL / Prisma ORM and the in-memory data state engine enforce strict tenant boundaries via `institutionId`.
* **Zero Data Leakage:** Every entity (`User`, `Student`, `Teacher`, `Department`, `Course`, `Class`, `Subject`, `Attendance`, `Exam`, `FeeInvoice`, `AuditLog`) is tagged with an immutable `institutionId`.
* **Cross-Tenant Access Denial:** Any read, edit, or delete attempt accessing another institution's data is rejected immediately with HTTP `403 Forbidden` (`FORBIDDEN_CROSS_TENANT_ACCESS`).

```
                +-----------------------------------------+
                |         ACADIVEX Platform Client        |
                |   (Web / Bootstrap / Tailwind Glass UI) |
                +--------------------+--------------------+
                                     | JWT + Tenant Context
                                     v
                +-----------------------------------------+
                |       Express REST API Server           |
                |  - requireAuth + Tenant Verification    |
                |  - Suspended Status Guard (403 Lockout) |
                +--------------------+--------------------+
                                     | Scoped by institutionId
                +--------------------+--------------------+
                |            Data Access Layer            |
                |     (PostgreSQL + Prisma ORM Engine)    |
                +--------------------+--------------------+
                 /                   |                   \
    +-----------------+     +-----------------+     +-----------------+
    |   Institution   |     |   Institution   |     |   Institution   |
    |    inst-001     |     |    inst-002     |     |    inst-XXXX    |
    | (Apex Institute)|     |  (St. Xavier)   |     | (Self-Enrolled) |
    +-----------------+     +-----------------+     +-----------------+
```

---

## 2. Authentication & Roles Hierarchy

| Role | Access Level | Description |
|---|---|---|
| `SUPER_ADMIN` | Platform-wide | Manages registered colleges, toggles account status (`ACTIVE`, `SUSPENDED`, `PENDING`), inspects global audit logs. |
| `ADMIN` (Dean / Registrar) | Institution-scoped | Full administrative authority exclusively within their own institution (Add/Edit Students & Faculty, Academic Structure, Fees, Exams). |
| `TEACHER` (Faculty) | Class-scoped | Marks attendance, creates assignments, grades submissions, manages students in their assigned lecture batches. |
| `STUDENT` | Self-scoped | Views personal timetables, marks, attendance, downloads Hall Tickets, pays fees via UPI/NetBanking, submits assignments. |

---

## 3. Endpoints Implemented

### Multi-Tenant SaaS Management
* `POST /api/saas/register-institution`: Self-service onboarding for new schools/colleges. Creates institution record and provisions the Dean/Admin master account.
* `GET /api/saas/institutions`: Super Admin view of all onboarded institutions.
* `GET /api/saas/institutions/:id`: Super Admin inspection of a specific institution.
* `PATCH /api/saas/institutions/:id/status`: Super Admin suspension or activation (`ACTIVE` / `SUSPENDED`).
* `GET /api/saas/audit-logs`: Platform-wide audit logs (Super Admin) or institution-scoped audit trail (Institution Admin).

### Secure Password Recovery
* `POST /api/auth/forgot-password`: Generates secure recovery token and logs action.
* `POST /api/auth/reset-password`: Validates token and resets account password with cryptographic hash.

---

## 4. Environment Variables (`backend/.env`)

```ini
PORT=5000
NODE_ENV=production
DATABASE_URL="postgresql://your_db_user:your_db_password@localhost:5432/acadivex_db?schema=public"
JWT_SECRET="replace_with_a_strong_random_jwt_secret_key"
JWT_EXPIRES_IN="7d"
SUPER_ADMIN_EMAIL="superadmin@yourdomain.edu"
SUPER_ADMIN_PASSWORD="replace_with_strong_super_admin_password"
UPLOAD_DIR="uploads/avatars"
```

---

## 5. Deployment & Migration Runbook

1. **Install Dependencies:**
   ```bash
   cd backend
   npm install
   ```
2. **Apply Prisma Schema Migrations:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```
3. **Execute Automated Verification Test Suites:**
   ```bash
   node backend/test_suite.js           # 100% Passed (Single-tenant regression suite)
   node backend/test_saas_isolation.js  # 18/18 Passed (Multi-tenant isolation & security)
   ```
4. **Launch Application in Production (e.g., via PM2 or systemd):**
   ```bash
   pm2 start src/server.js --name "acadivex-saas-api"
   ```
5. **Periodic Database Snapshot / Backup Routine:**
   ```bash
   pg_dump -U postgres -d acadivex_db -F c -b -v -f "/var/backups/acadivex_$(date +%Y%m%d_%H%M%S).backup"
   ```
