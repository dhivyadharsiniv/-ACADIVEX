# EduManage Backend API

A high-performance Node.js / Express REST API with PostgreSQL and Prisma ORM for the EduManage Student Management System.

## Architecture

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma Client & Prisma Migrate
- **Fallback Data Store**: In-Memory & Stateful persistence for instant local preview

## Folder Structure

```
backend/
├── prisma/
│   └── schema.prisma        # Complete PostgreSQL Prisma Data Models
├── src/
│   ├── config/
│   │   └── database.js      # DB connection & unified store
│   ├── controllers/         # REST API Route Controllers
│   │   ├── studentController.js
│   │   ├── teacherController.js
│   │   ├── attendanceController.js
│   │   ├── examController.js
│   │   ├── feeController.js
│   │   └── analyticsController.js
│   ├── routes/              # Modular Express Routers
│   │   ├── studentRoutes.js
│   │   ├── teacherRoutes.js
│   │   ├── attendanceRoutes.js
│   │   ├── examRoutes.js
│   │   ├── feeRoutes.js
│   │   └── analyticsRoutes.js
│   ├── data/
│   │   ├── seedData.js      # Comprehensive realistic mock dataset
│   │   └── seedDatabase.js  # Prisma database seeder
│   └── server.js            # Server entry point
├── .env.example             # Environment variables template
└── package.json
```

## Setup & Running

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Database (.env)**:
   ```env
   DATABASE_URL="postgresql://your_db_user:your_db_password@localhost:5432/acadivex_db?schema=public"
   PORT=5000
   ```

3. **Run Prisma Migrations (optional if using PostgreSQL)**:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. **Start the API Server**:
   ```bash
   npm start
   ```
   Server will run at `http://localhost:5000/api`.

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics/stats` | Dashboard executive KPI counters & charts |
| `GET` | `/api/students` | Get all students (filters: `grade`, `section`, `status`, `search`) |
| `POST` | `/api/students` | Enroll a new student |
| `GET` | `/api/students/:id` | Get student details |
| `PUT` | `/api/students/:id` | Update student record |
| `DELETE` | `/api/students/:id` | Delete student record |
| `GET` | `/api/teachers` | Get teacher roster |
| `POST` | `/api/teachers` | Register new faculty member |
| `GET` | `/api/attendance` | Get attendance records |
| `POST` | `/api/attendance/mark` | Bulk mark attendance |
| `GET` | `/api/exams` | Get examination timetable |
| `POST` | `/api/exams` | Create exam schedule |
| `GET` | `/api/exams/report-card/:studentId` | Get printable academic report card |
| `GET` | `/api/fees` | Get all fee records & dues |
| `POST` | `/api/fees/pay/:invoiceId` | Process fee payment |
| `GET` | `/api/fees/receipt/:invoiceId` | Generate official payment receipt |
