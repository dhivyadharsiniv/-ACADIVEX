# 🎓 ACADIVEX — Multi-Tenant Student & Campus Management Platform
> *"Smarter Campus. Stronger Futures."*

A modern, multi-tenant **Student & Campus Management Platform** built with **Node.js**, **Express**, **PostgreSQL / Prisma ORM**, and **Tailwind CSS**.

**ACADIVEX** provides strict multi-tenant institution isolation and dedicated role-based portals for **Institution Admins**, **Staff / Faculty**, and **Students**—with custom institution logo uploads, real database persistence, and zero pre-loaded demo clutter.

---

## 🌟 Core Features

### 1. 🏫 Institution Registration & Custom Branding
- **Self-Service Institution Onboarding**: Register your University, College, or Campus directly from the public homepage (`Register Institution`).
- **Institution Logo Upload**:
  - Supports **PNG, JPG, JPEG, and WebP** image formats (up to **2 MB**).
  - Live client-side preview with **Replace** and **Remove** controls before submission.
  - Strict client-side and server-side MIME type and file size validation.
  - Uploaded logos are stored in `backend/uploads/avatars/` and served via `/uploads/avatars/<filename>`, linked to the institution record in the database.
  - If an institution registers without uploading a logo, a clean neutral placeholder crest is displayed (never a fake college logo).
- **Consistent Branding Across the Portal**:
  - The verified institution's **Logo**, **Institution Name**, and **Campus Name** are displayed across the Institution Login page, Admin Dashboard, Staff Dashboard, Student Dashboard, Top Navigation Headers, Hall Ticket / Admit Card, and Institution Settings.

### 2. 🔐 Institution-Scoped Authentication & Logout Workflow
- **Verified Institution Portal**: Users select or enter their registered **Institution Name** and **Campus Name** to open their dedicated Institution Login page.
- **Strictly 3 Portal Login Options**:
  1. **Admin Login**
  2. **Staff Login**
  3. **Student Login**
  *(Platform Super Admin authentication is kept separate from the institution portal.)*
- **Institution-Preserving Logout**: When an Admin, Staff member, or Student logs out, their session and JWT token are terminated and they are redirected directly to their **Institution Login page** (preserving non-sensitive institution/campus context while preventing browser back-button access to protected dashboards).

### 3. 🏛️ Admin Dashboard (Institutional Command Center)
- Real-time KPIs driven by database records (Total Enrolled Students, Active Faculty, Academic Departments, Fee Collection).
- Create and manage **Departments**, **Degree Courses**, **Curriculum Subjects**, **Class Batches**, **Examinations**, **Fee Invoices**, and **Campus Announcements**.
- Enroll **Staff / Faculty** and **Students** with auto-generated unique IDs (`<DEPT>-EMP-001`, `<DEPT><YEAR>001`) and secure bcrypt-hashed login credentials, plus Admin-initiated password resets from Edit Faculty / Edit Student modals.
- **Faculty & Proctor Roster**: Live mentee counts calculated dynamically from student proctor relationships (`proctorId` / `mentorId`), responsive table layout, and duplicate faculty prevention.
- **Campus Attendance & Biometric Register**: Filter attendance logs by Class, Subject, Date, Session (`FN`/`AN`), Department, and Semester; update individual student status (`PRESENT`, `ABSENT`, `LATE`, `ON_DUTY`) while preserving biometric punch timestamps and device IDs.
- **Fee Verification & Financial Ledger**: Review student UPI / Bank Transfer / Gateway submissions and approve or reject payments (`PATCH /api/fees/:id/verify`) with full transaction audit trails.
- Update Institution Branding and upload/replace the Institution Logo at any time from **Branding & Settings**.

### 4. 👨‍🏫 Staff / Faculty & Proctor Dashboard
- View assigned classes, enrolled student rosters, proctor mentee assignments, and department details.
- Record daily class attendance or update individual student attendance statuses and commit records to the database.
- Create examinations, enter internal/semester student marks (`POST /api/exams/marks`), publish coursework assignments, and post class announcements.

### 5. 🎓 Student Dashboard
- View live attendance percentage, subject-wise attendance logs, CGPA, exam grade sheets, enrolled subjects, timetable, assignments, and campus notifications.
- Update personal contact details (`PUT /api/students/:id`) with strict ownership enforcement.
- Download/print the official **University Hall Ticket / Admit Card** bearing the institution's logo, name, and campus.
- **Fee Ledger, Payments & PDF Receipts**: View total fees, paid amount, pending verification, and outstanding balance; submit payments via **UPI**, **NEFT/RTGS Bank Transfer**, or **Online Gateway**; and download official **PDF Fee Receipts** (`jsPDF`) exclusively for verified `PAID` invoices.

---

## ⚙️ Environment Variables & Configuration

1. Copy the example environment file:
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Edit `backend/.env` and configure your values:
   - `PORT`: Backend server port (default: `5000`).
   - `NODE_ENV`: `development` or `production`.
   - `DATABASE_URL`: PostgreSQL connection string (`postgresql://user:password@localhost:5432/acadivex_db?schema=public`).
   - `RUNTIME_DB_PATH`: Path to the local JSON persistence file (`data/acadivex_runtime_db.json`).
   - `JWT_SECRET`: Strong random secret string used to sign authentication tokens.
   - `JWT_EXPIRES_IN`: Token expiration window (e.g. `7d`).
   - `SUPER_ADMIN_EMAIL` & `SUPER_ADMIN_PASSWORD`: *(Optional)* Credentials for the separate Platform Super Admin console.
   - `UPLOAD_DIR`: Directory for uploaded institution logos and profile images (`uploads/avatars`).
   - `MAX_LOGO_SIZE_BYTES`: Maximum allowed institution logo size in bytes (`2097152` = 2 MB).

---

## 🗄️ Database & Storage Setup

### Local Persistent Store & Clean Database Initialization
ACADIVEX persists runtime records to `backend/data/acadivex_runtime_db.json` (excluded from Git via `.gitignore`) and supports PostgreSQL via Prisma (`backend/prisma/schema.prisma`).

- **Clean Any Demo / Legacy Data**:
  ```bash
  cd backend
  npm run db:clean
  ```
- **PostgreSQL / Prisma Migrations** *(when connecting to an external PostgreSQL instance)*:
  ```bash
  cd backend
  npx prisma generate
  npx prisma migrate deploy
  ```

### File Storage Configuration
- Uploaded institution logos and user avatars are stored on disk under `backend/uploads/avatars/` and served statically by Express at `/uploads/avatars/*`.
- All uploaded files in `backend/uploads/avatars/*` (except `.gitkeep`) are excluded from Git by `.gitignore`.

---

## 🚀 Running the Project Locally

1. **Install Backend Dependencies**:
   ```bash
   cd backend
   npm install
   ```
2. **Ensure Clean Database State** *(optional if starting fresh)*:
   ```bash
   npm run db:clean
   ```
3. **Start the Server**:
   ```bash
   npm start
   ```
   *(Or run `node src/server.js` inside `backend/`)*
4. Open **[http://localhost:5000](http://localhost:5000)** in your browser.

---

## 🧪 Complete End-to-End Workflow (Registering Your Institution & Testing Accounts)

1. **Open the Public Homepage**: Navigate to `http://localhost:5000`.
2. **Register Your Institution**:
   - Click **Register Institution** in the top navigation bar.
   - Enter your **Institution / College Name**, **Campus Name**, and **Institution Code**.
   - Upload your **Institution Logo** (PNG, JPG, JPEG, or WebP, max 2 MB) and verify the live preview.
   - Enter the initial **Admin / Dean Name**, **Official Admin Email**, and **Admin Password**, then submit.
3. **Sign In as Institution Admin**:
   - After registration, you are directed to your branded **Institution Login Portal** displaying your uploaded logo, institution name, and campus name, with strictly three role tabs: **Admin Login**, **Staff Login**, and **Student Login**.
   - Sign in on the **Admin Login** tab using the Admin email and password you just created.
4. **Create Academic Structure, Staff, and Students**:
   - In the Admin Dashboard, create your **Departments**, **Courses**, **Subjects**, and **Class Batches** (or immediately open **Faculty / Staff -> Register Faculty** and **Students -> Add Student**).
   - Register a **Staff / Faculty** account with an official email and initial password. Note the generated Employee ID (e.g., `CSE-EMP-001`).
   - Enroll a **Student** account with an official email and initial password. Note the generated Register / Roll Number (e.g., `CSE2026001`).
5. **Test Admin Logout**:
   - Click **Sign Out** in the Admin sidebar. Confirm you are redirected to your **Institution Login Page** (not the public homepage) with your institution's logo, name, and campus preserved.
6. **Test Staff & Student Logins**:
   - Switch to **Staff Login** and sign in with the Staff ID or Email and password created by the Admin. Verify the institution logo appears in the Staff sidebar and header, and test taking attendance or creating an assignment.
   - Click **Logout** to return to the Institution Login page, switch to **Student Login**, and sign in with the Student ID or Email and password created by the Admin. Verify the institution logo appears in the Student sidebar, header, and Hall Ticket.
