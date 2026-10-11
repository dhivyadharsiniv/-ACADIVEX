const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const examRoutes = require('./routes/examRoutes');
const feeRoutes = require('./routes/feeRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const authRoutes = require('./routes/authRoutes');
const academicRoutes = require('./routes/academicRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const saasRoutes = require('./routes/saasRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all frontend requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser with 10mb limit for profile image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploaded avatars / images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request Logger Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Root API Health & Directory
app.get(['/api', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    system: 'ACADIVEX Smart Education & Campus Management Platform API',
    tagline: 'Smarter Campus. Stronger Futures.',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth/login',
      analytics: '/api/analytics/stats',
      students: '/api/students',
      teachers: '/api/teachers',
      attendance: '/api/attendance',
      exams: '/api/exams',
      fees: '/api/fees',
      departments: '/api/departments',
      courses: '/api/courses',
      classes: '/api/classes',
      subjects: '/api/subjects',
      assignments: '/api/assignments',
      submissions: '/api/submissions',
      timetable: '/api/timetable',
      notifications: '/api/notifications'
    }
  });
});

// Explicit Favicon Routes
const frontendPath = path.join(__dirname, '../../frontend');
app.get(['/favicon.ico', '/favicon.svg'], (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(frontendPath, 'favicon.svg'));
});

// Serve frontend static files
app.use(express.static(frontendPath));

// Serve Root UI & HTML Fallback for client-side routing
app.get(['/', '/login', '/login/*', '/institutions/*/login', '/student*', '/teacher*', '/admin*', '/unauthorized'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/saas', saasRoutes);
app.use('/api', academicRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 ACADIVEX API Server running on port ${PORT}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}/api`);
  console.log(`📊 Analytics: http://localhost:${PORT}/api/analytics/stats`);
  console.log('====================================================');
});
