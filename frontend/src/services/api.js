/**
 * EduManage Frontend API Service Client
 * Connects Next.js / React frontend to the Node.js / Express backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const api = {
  // Analytics
  getDashboardStats: async () => {
    const res = await fetch(`${API_BASE_URL}/analytics/stats`);
    return res.json();
  },

  // Students
  getStudents: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/students?${query}`);
    return res.json();
  },

  getStudentById: async (id) => {
    const res = await fetch(`${API_BASE_URL}/students/${id}`);
    return res.json();
  },

  createStudent: async (studentData) => {
    const res = await fetch(`${API_BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData),
    });
    return res.json();
  },

  updateStudent: async (id, updateData) => {
    const res = await fetch(`${API_BASE_URL}/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });
    return res.json();
  },

  deleteStudent: async (id) => {
    const res = await fetch(`${API_BASE_URL}/students/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // Faculty & Teachers
  getTeachers: async () => {
    const res = await fetch(`${API_BASE_URL}/teachers`);
    return res.json();
  },

  // Attendance
  getAttendance: async (date, className) => {
    const query = new URLSearchParams({ date, className }).toString();
    const res = await fetch(`${API_BASE_URL}/attendance?${query}`);
    return res.json();
  },

  markAttendance: async (records) => {
    const res = await fetch(`${API_BASE_URL}/attendance/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    return res.json();
  },

  // Exams & Gradebook
  getExams: async () => {
    const res = await fetch(`${API_BASE_URL}/exams`);
    return res.json();
  },

  getReportCard: async (studentId) => {
    const res = await fetch(`${API_BASE_URL}/exams/report-card/${studentId}`);
    return res.json();
  },

  // Fees & Receipts
  getFees: async () => {
    const res = await fetch(`${API_BASE_URL}/fees`);
    return res.json();
  },

  payFee: async (invoiceId, paymentMethod = 'Online Portal') => {
    const res = await fetch(`${API_BASE_URL}/fees/pay/${invoiceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod }),
    });
    return res.json();
  },

  getReceipt: async (invoiceId) => {
    const res = await fetch(`${API_BASE_URL}/fees/receipt/${invoiceId}`);
    return res.json();
  },
};

export default api;
