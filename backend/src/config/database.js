/**
 * Camu & eVarsity College Campus Data Store & State Engine
 * EduManage Enterprise Student Management Platform
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

class DataStore {
  constructor() {
    this.dbFilePath = process.env.DB_FILE_PATH || path.join(__dirname, '../../data/acadivex_runtime_db.json');
    this.revokedTokens = new Set();

    const useDemoSeed = process.env.SEED_DEMO_DATA === 'true';
    const initialData = useDemoSeed ? require('../data/seedData') : {};

    this.departments = JSON.parse(JSON.stringify(initialData.departments || []));
    this.courses = JSON.parse(JSON.stringify(initialData.courses || []));
    this.classes = JSON.parse(JSON.stringify(initialData.classes || []));
    this.subjects = JSON.parse(JSON.stringify(initialData.subjects || []));
    this.teachers = JSON.parse(JSON.stringify(initialData.teachers || []));
    this.students = JSON.parse(JSON.stringify(initialData.students || []));
    this.attendanceRecords = JSON.parse(JSON.stringify(initialData.attendanceRecords || []));
    this.exams = JSON.parse(JSON.stringify(initialData.exams || []));
    this.academicTranscripts = JSON.parse(JSON.stringify(initialData.academicTranscripts || []));
    this.feeInvoices = JSON.parse(JSON.stringify(initialData.feeInvoices || []));
    this.announcements = JSON.parse(JSON.stringify(initialData.announcements || []));
    this.users = JSON.parse(JSON.stringify(initialData.users || []));
    this.assignments = JSON.parse(JSON.stringify(initialData.assignments || []));
    this.submissions = JSON.parse(JSON.stringify(initialData.submissions || []));
    this.timetable = JSON.parse(JSON.stringify(initialData.timetable || []));
    this.notifications = JSON.parse(JSON.stringify(initialData.notifications || []));
    this.institution = initialData.institution || null;
    this.institutions = [];
    this.auditLogs = [];

    this.loadFromDisk();
    this.normalizeAndSyncStore();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const collections = [
            'institutions', 'departments', 'courses', 'classes', 'subjects',
            'teachers', 'students', 'attendanceRecords', 'exams',
            'academicTranscripts', 'feeInvoices', 'announcements', 'users',
            'assignments', 'submissions', 'timetable', 'notifications', 'auditLogs'
          ];
          collections.forEach(key => {
            if (Array.isArray(parsed[key])) {
              this[key] = parsed[key];
            }
          });
        }
      }
    } catch (err) {
      console.error('[DataStore] Failed to load persistent state from disk:', err.message);
    }
  }

  saveToDisk() {
    try {
      const dir = path.dirname(this.dbFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const payload = {
        updatedAt: new Date().toISOString(),
        institutions: this.institutions,
        departments: this.departments,
        courses: this.courses,
        classes: this.classes,
        subjects: this.subjects,
        teachers: this.teachers,
        students: this.students,
        attendanceRecords: this.attendanceRecords,
        exams: this.exams,
        academicTranscripts: this.academicTranscripts,
        feeInvoices: this.feeInvoices,
        announcements: this.announcements,
        users: this.users,
        assignments: this.assignments,
        submissions: this.submissions,
        timetable: this.timetable,
        notifications: this.notifications,
        auditLogs: this.auditLogs
      };
      fs.writeFileSync(this.dbFilePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      console.error('[DataStore] Failed to persist state to disk:', err.message);
    }
  }

  cleanDemoData() {
    const demoInstIds = new Set(['inst-001', 'inst-002']);
    const demoEmails = new Set([
      'admin@edumanage.ac.in',
      'admin@sxist.edu.in',
      'arvind.s@edumanage.ac.in',
      'meenakshi.r@edumanage.ac.in',
      'anjali.m@sxist.edu.in',
      'aarav.sharma@edumanage.ac.in',
      'diya.nair@edumanage.ac.in',
      'rohan.verma@edumanage.ac.in',
      'ananya.iyer@edumanage.ac.in',
      'vikram.reddy@edumanage.ac.in',
      'neha.kapoor@sxist.edu.in'
    ]);

    this.institutions = this.institutions.filter(i => !demoInstIds.has(i.id));
    const filterByTenant = (arr) => arr.filter(item => !demoInstIds.has(item.institutionId));

    this.departments = filterByTenant(this.departments);
    this.courses = filterByTenant(this.courses);
    this.classes = filterByTenant(this.classes);
    this.subjects = filterByTenant(this.subjects);
    this.teachers = filterByTenant(this.teachers).filter(t => !demoEmails.has((t.email || '').toLowerCase()));
    this.students = filterByTenant(this.students).filter(s => !demoEmails.has((s.email || '').toLowerCase()));
    this.attendanceRecords = filterByTenant(this.attendanceRecords);
    this.exams = filterByTenant(this.exams);
    this.academicTranscripts = filterByTenant(this.academicTranscripts);
    this.feeInvoices = filterByTenant(this.feeInvoices);
    this.announcements = filterByTenant(this.announcements);
    this.assignments = filterByTenant(this.assignments);
    this.submissions = filterByTenant(this.submissions);
    this.timetable = filterByTenant(this.timetable);
    this.notifications = filterByTenant(this.notifications);
    this.auditLogs = filterByTenant(this.auditLogs);
    this.users = this.users.filter(u => !demoInstIds.has(u.institutionId) && !demoEmails.has((u.email || '').toLowerCase()));

    this.saveToDisk();
  }

  normalizeAndSyncStore() {
    // Hash passwords for users if not already hashed
    this.users.forEach(u => {
      if (!u.passwordHash && u.password) {
        if (String(u.password).startsWith('$2')) {
          u.passwordHash = u.password;
        } else {
          try {
            u.passwordHash = bcrypt.hashSync(u.password, 10);
          } catch (e) {
            u.passwordHash = u.password;
          }
        }
      }
      if (!u.profileImageUrl && u.avatar) u.profileImageUrl = u.avatar;
    });

    // Seed Platform Super Admin account from environment variables (separate from institution portals)
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || '';
    if (superAdminEmail && superAdminPassword) {
      let superAdmin = this.users.find(u => u.role === 'SUPER_ADMIN' || u.email?.toLowerCase() === superAdminEmail);
      if (!superAdmin) {
        const saHash = bcrypt.hashSync(superAdminPassword, 10);
        superAdmin = {
          id: 'usr-superadmin-01',
          username: 'superadmin',
          email: superAdminEmail,
          password: saHash,
          passwordHash: saHash,
          role: 'SUPER_ADMIN',
          name: 'ACADIVEX Platform Super Admin',
          title: 'Platform Super Administrator',
          department: 'ACADIVEX Cloud Operations',
          departmentId: 'dept-global',
          institutionId: 'system',
          status: 'ACTIVE',
          avatar: null,
          profileImageUrl: null
        };
        this.users.unshift(superAdmin);
      }
    }

    // Synchronize all teachers with users table so Staff login works by Email, Username, or Employee ID
    this.teachers.forEach(t => {
      let u = this.users.find(usr =>
        usr.teacherId === t.id ||
        usr.id === t.userId ||
        (t.email && usr.email && usr.email.toLowerCase() === t.email.toLowerCase()) ||
        (t.employeeId && usr.employeeId && usr.employeeId.toLowerCase() === t.employeeId.toLowerCase())
      );
      if (!u) {
        const fallbackFacultySecret = process.env.DEFAULT_FACULTY_PASSWORD || process.env.DEFAULT_INITIAL_PASSWORD || require('crypto').randomBytes(16).toString('hex');
        const defaultHash = bcrypt.hashSync(fallbackFacultySecret, 10);
        u = {
          id: t.userId || `usr-${t.id}`,
          institutionId: t.institutionId || 'inst-001',
          username: t.username || t.employeeId || (t.email ? t.email.split('@')[0] : t.id),
          email: t.email || `${t.id}@acadivex.edu`,
          password: defaultHash,
          passwordHash: defaultHash,
          role: 'TEACHER',
          name: `${t.designation || ''} ${t.firstName || ''} ${t.lastName || ''}`.trim(),
          title: t.designation || 'Faculty',
          department: t.department || 'Academic Faculty',
          departmentId: t.departmentId || 'dept-01',
          teacherId: t.id,
          employeeId: t.employeeId,
          assignedClasses: t.assignedClasses || [],
          status: t.status || 'ACTIVE',
          avatar: t.avatar || t.profileImageUrl || null,
          profileImageUrl: t.profileImageUrl || t.avatar || null
        };
        this.users.push(u);
      } else {
        u.teacherId = t.id;
        u.employeeId = t.employeeId || u.employeeId;
        u.institutionId = t.institutionId || u.institutionId || 'inst-001';
        if (t.email) u.email = t.email;
        if (t.username) u.username = t.username;
        if (t.status) u.status = t.status;
        if (t.assignedClasses) u.assignedClasses = t.assignedClasses;
        if (t.departmentId) u.departmentId = t.departmentId;
        if (t.department) u.department = t.department;
      }
    });

    // Synchronize all students with users table so Student login works by Email, Username, Roll No, or Register No
    this.students.forEach(s => {
      let u = this.users.find(usr =>
        usr.studentId === s.id ||
        usr.id === s.userId ||
        (s.email && usr.email && usr.email.toLowerCase() === s.email.toLowerCase()) ||
        (s.registerNumber && usr.registerNumber && usr.registerNumber.toLowerCase() === s.registerNumber.toLowerCase()) ||
        (s.rollNumber && usr.rollNumber && usr.rollNumber.toLowerCase() === s.rollNumber.toLowerCase())
      );
      if (!u) {
        const fallbackStudentSecret = process.env.DEFAULT_STUDENT_PASSWORD || process.env.DEFAULT_INITIAL_PASSWORD || require('crypto').randomBytes(16).toString('hex');
        const defaultHash = bcrypt.hashSync(fallbackStudentSecret, 10);
        u = {
          id: s.userId || `usr-${s.id}`,
          institutionId: s.institutionId || 'inst-001',
          username: s.username || s.registerNumber || s.rollNumber || (s.email ? s.email.split('@')[0] : s.id),
          email: s.email || `${s.id}@acadivex.edu`,
          password: defaultHash,
          passwordHash: defaultHash,
          role: 'STUDENT',
          name: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
          title: `Student • ${s.departmentName || s.branch || 'Scholar'}`,
          department: s.departmentName || s.branch || 'Computer Science & Engineering',
          departmentId: s.departmentId || 'dept-01',
          studentId: s.id,
          rollNumber: s.rollNumber || s.registerNumber,
          registerNumber: s.registerNumber || s.rollNumber,
          status: s.status || 'ACTIVE',
          avatar: s.avatar || s.profileImageUrl || null,
          profileImageUrl: s.profileImageUrl || s.avatar || null
        };
        this.users.push(u);
      } else {
        u.studentId = s.id;
        u.rollNumber = s.rollNumber || s.registerNumber || u.rollNumber;
        u.registerNumber = s.registerNumber || s.rollNumber || u.registerNumber;
        u.institutionId = s.institutionId || u.institutionId || 'inst-001';
        if (s.email) u.email = s.email;
        if (s.username) u.username = s.username;
        if (s.status) u.status = s.status;
        if (s.departmentId) u.departmentId = s.departmentId;
        if (s.departmentName) u.department = s.departmentName;
      }
    });

    // Recalculate teacher mentee counts and department counts from actual relationships
    if (typeof this.recalculateTeacherMenteeCounts === 'function') {
      this.recalculateTeacherMenteeCounts();
    }
    this.departments.forEach(d => {
      const instId = d.institutionId || 'inst-001';
      d.facultyCount = this.teachers.filter(t => (t.institutionId || 'inst-001') === instId && t.status !== 'INACTIVE' && (t.departmentId === d.id || t.department === d.name)).length;
      d.studentCount = this.students.filter(s => (s.institutionId || 'inst-001') === instId && s.status !== 'INACTIVE' && (s.departmentId === d.id || s.departmentName === d.name)).length;
    });
  }

  // ==========================================
  // SEQUENTIAL NUMBER GENERATORS
  // ==========================================
  generateNextRegisterNumber(departmentIdOrCode, year = 2026) {
    let dept = this.departments.find(d => 
      d.id === departmentIdOrCode || 
      d.code.toLowerCase() === (departmentIdOrCode || '').toLowerCase() ||
      d.name.toLowerCase() === (departmentIdOrCode || '').toLowerCase()
    );
    const rawCode = dept ? dept.code : (departmentIdOrCode || 'CSE');
    const cleanCode = rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const prefix = `${cleanCode}${year}`;
    const pattern = new RegExp(`^${cleanCode}${year}(\\d+)$`, 'i');

    let maxSeq = 0;
    this.students.forEach(s => {
      if (s.registerNumber) {
        const m = s.registerNumber.match(pattern);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }
      if (s.rollNumber) {
        const m = s.rollNumber.match(pattern);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }
    });

    let nextSeq = maxSeq + 1;
    let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
    while (this.students.some(s => s.registerNumber === candidate || s.rollNumber === candidate)) {
      nextSeq++;
      candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
    }

    return candidate;
  }

  generateNextEmployeeId(departmentIdOrCode) {
    let dept = this.departments.find(d => 
      d.id === departmentIdOrCode || 
      d.code.toLowerCase() === (departmentIdOrCode || '').toLowerCase() ||
      d.name.toLowerCase() === (departmentIdOrCode || '').toLowerCase()
    );
    const rawCode = dept ? dept.code : (departmentIdOrCode || 'CSE');
    const cleanCode = rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const prefix = `${cleanCode}-EMP-`;
    const pattern = new RegExp(`^${cleanCode}-EMP-(\\d+)$`, 'i');

    let maxSeq = 0;
    this.teachers.forEach(t => {
      if (t.employeeId) {
        const m = t.employeeId.match(pattern);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }
    });

    let nextSeq = maxSeq + 1;
    let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
    while (this.teachers.some(t => t.employeeId === candidate)) {
      nextSeq++;
      candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
    }

    return candidate;
  }

  // ==========================================
  // STUDENT METHODS
  // ==========================================
  getStudents(filters = {}, requestingUser = null) {
    let list = this.students;

    // Multi-tenant isolation: Scoped strictly to requesting user's institution unless SUPER_ADMIN
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const userTenantId = requestingUser.institutionId || 'inst-001';
      list = list.filter(s => (s.institutionId || 'inst-001') === userTenantId);
    }

    // Faculty Scoping: Teachers can ONLY see students from their assigned classes
    if (requestingUser && requestingUser.role === 'TEACHER') {
      const teacher = this.teachers.find(t => 
        t.id === requestingUser.teacherId || 
        t.userId === requestingUser.id || 
        t.email?.toLowerCase() === requestingUser.email?.toLowerCase()
      );
      const myClasses = teacher?.assignedClasses || [];
      list = list.filter(s => myClasses.includes(s.className) || (teacher && s.teacherId === teacher.id));
    }

    if (filters.branch && filters.branch !== 'ALL') {
      const b = filters.branch.toLowerCase();
      list = list.filter(s => 
        (s.branchCode && s.branchCode.toLowerCase() === b) || 
        (s.branch && s.branch.toLowerCase().includes(b)) ||
        (s.department && s.department.toLowerCase().includes(b)) ||
        (s.departmentId && s.departmentId === filters.branch)
      );
    }
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      list = list.filter(s => s.departmentId === filters.departmentId);
    }
    if (filters.className && filters.className !== 'ALL') {
      list = list.filter(s => s.className === filters.className || s.classId === filters.className);
    }
    if (filters.semester && filters.semester !== 'ALL') {
      list = list.filter(s => s.semester === parseInt(filters.semester));
    }
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(s => s.status && s.status.toLowerCase() === filters.status.toLowerCase());
    }
    if (filters.examEligibility && filters.examEligibility !== 'ALL') {
      list = list.filter(s => s.examEligibility === filters.examEligibility);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(s =>
        (s.firstName && s.firstName.toLowerCase().includes(q)) ||
        (s.lastName && s.lastName.toLowerCase().includes(q)) ||
        (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
        (s.registerNumber && s.registerNumber.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.branch && s.branch.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q)) ||
        (s.className && s.className.toLowerCase().includes(q))
      );
    }

    // Attach enriched department and class names via database relation lookup
    return list.map(s => {
      const dept = this.departments.find(d => d.id === s.departmentId || d.name === s.department);
      const crs = this.courses.find(c => c.id === s.courseId);
      const cls = this.classes.find(c => c.id === s.classId || c.name === s.className);
      const tch = this.teachers.find(t => t.id === s.teacherId);
      return {
        ...s,
        department: dept ? { id: dept.id, name: dept.name, code: dept.code } : (typeof s.department === 'object' ? s.department : { id: s.departmentId, name: s.department }),
        departmentName: dept ? dept.name : (typeof s.department === 'string' ? s.department : s.branch),
        departmentCode: dept ? dept.code : (s.branchCode || 'CSE'),
        course: crs ? { id: crs.id, name: crs.name, code: crs.code } : { id: s.courseId, name: s.courseName },
        courseName: crs ? crs.name : s.courseName,
        class: cls ? { id: cls.id, name: cls.name, section: cls.section } : { id: s.classId, name: s.className },
        className: cls ? cls.name : (s.className || 'Unassigned Class'),
        teacher: tch ? { id: tch.id, firstName: tch.firstName, lastName: tch.lastName, designation: tch.designation } : null,
        proctorName: tch ? `${tch.designation} ${tch.firstName} ${tch.lastName}` : (s.proctor || 'Assigned Proctor')
      };
    });
  }

  getStudentById(id, requestingUser = null) {
    const student = this.students.find(s => 
      s.id === id || 
      s.rollNumber === id || 
      s.registerNumber === id || 
      s.userId === id
    );
    if (!student) return null;

    // Multi-tenant check: Block cross-tenant access
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const userTenantId = requestingUser.institutionId || 'inst-001';
      if ((student.institutionId || 'inst-001') !== userTenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Access denied. Cannot view records belonging to another institution.');
      }
    }

    if (requestingUser && requestingUser.role === 'TEACHER') {
      const teacher = this.teachers.find(t => 
        t.id === requestingUser.teacherId || 
        t.userId === requestingUser.id || 
        t.email?.toLowerCase() === requestingUser.email?.toLowerCase()
      );
      const myClasses = teacher?.assignedClasses || [];
      if (!myClasses.includes(student.className) && teacher?.id !== student.teacherId) {
        throw new Error('FORBIDDEN_TEACHER_CLASS: You do not have permission to access students from outside your assigned class batch.');
      }
    }

    const dept = this.departments.find(d => d.id === student.departmentId || d.name === student.department);
    const crs = this.courses.find(c => c.id === student.courseId);
    const cls = this.classes.find(c => c.id === student.classId || c.name === student.className);
    const tch = this.teachers.find(t => t.id === student.teacherId);

    return {
      ...student,
      department: dept ? { id: dept.id, name: dept.name, code: dept.code } : (typeof student.department === 'object' ? student.department : { id: student.departmentId, name: student.department }),
      departmentName: dept ? dept.name : (typeof student.department === 'string' ? student.department : student.branch),
      departmentCode: dept ? dept.code : (student.branchCode || 'CSE'),
      course: crs ? { id: crs.id, name: crs.name, code: crs.code } : { id: student.courseId, name: student.courseName },
      courseName: crs ? crs.name : student.courseName,
      class: cls ? { id: cls.id, name: cls.name, section: cls.section } : { id: student.classId, name: student.className },
      className: cls ? cls.name : (student.className || 'Unassigned Class'),
      teacher: tch ? { id: tch.id, firstName: tch.firstName, lastName: tch.lastName, designation: tch.designation } : null,
      proctorName: tch ? `${tch.designation} ${tch.firstName} ${tch.lastName}` : (student.proctor || 'Assigned Proctor')
    };
  }

  createStudent(studentData, requestingUser = null) {
    // 1. Role validation
    if (requestingUser && requestingUser.role === 'STUDENT') {
      throw new Error('FORBIDDEN_STUDENT: Students are not permitted to matriculate new students.');
    }

    // Email validation
    if (!studentData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentData.email)) {
      throw new Error('INVALID_EMAIL: Please provide a valid email address.');
    }

    // Check email uniqueness across both users and students
    const emailLower = studentData.email.trim().toLowerCase();
    const emailInUsers = this.users.some(u => u.email && u.email.toLowerCase() === emailLower);
    const emailInStudents = this.students.some(s => s.email && s.email.toLowerCase() === emailLower);
    if (emailInUsers || emailInStudents) {
      throw new Error('DUPLICATE_EMAIL: This email is already registered.');
    }

    let dept = null;
    let cls = null;
    let tch = null;
    let crs = null;

    // Faculty Scoping: Teachers can ONLY add students to their own assigned class and department
    if (requestingUser && requestingUser.role === 'TEACHER') {
      const teacher = this.teachers.find(t => 
        t.id === requestingUser.teacherId || 
        t.userId === requestingUser.id || 
        t.email?.toLowerCase() === requestingUser.email?.toLowerCase()
      );
      if (!teacher) {
        throw new Error('Faculty profile not found for the requesting teacher.');
      }

      const myClasses = teacher.assignedClasses || [];
      const requestedClass = studentData.className || studentData.classId || (myClasses.length > 0 ? myClasses[0] : 'B.Tech CSE - 4A');
      
      // Match class against teacher's assigned classes
      const matchedClass = this.classes.find(c => 
        (c.id === requestedClass || c.name === requestedClass) && 
        myClasses.includes(c.name)
      );

      if (!matchedClass && !myClasses.includes(requestedClass)) {
        throw new Error(`FORBIDDEN_TEACHER_CLASS: Permission Denied. You may only matriculate students into your own assigned class batches (${myClasses.join(', ')}).`);
      }

      cls = matchedClass || this.classes.find(c => c.name === requestedClass) || (this.classes.find(c => myClasses.includes(c.name)));
      dept = this.departments.find(d => d.id === teacher.departmentId || d.name === teacher.department);
      tch = teacher;
      crs = this.courses.find(c => c.departmentId === (dept ? dept.id : teacher.departmentId));
    } else {
      // ADMIN (or unauthenticated/root): Must save the EXACT department, course, class, and teacher selected
      const targetInstId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN') 
        ? requestingUser.institutionId 
        : (studentData.institutionId || 'inst-001');
      const tenantDepts = this.departments.filter(d => (d.institutionId || 'inst-001') === targetInstId);
      const tenantClasses = this.classes.filter(c => (c.institutionId || 'inst-001') === targetInstId);
      const tenantCourses = this.courses.filter(c => (c.institutionId || 'inst-001') === targetInstId);
      const tenantTeachers = this.teachers.filter(t => (t.institutionId || 'inst-001') === targetInstId);

      const findDept = (val) => {
        if (!val) return null;
        const vLower = String(val).toLowerCase();
        return tenantDepts.find(d => d.id === val || d.name.toLowerCase() === vLower || d.code.toLowerCase() === vLower);
      };

      if (studentData.departmentId) dept = findDept(studentData.departmentId);
      if (!dept && studentData.department) dept = findDept(studentData.department);
      if (!dept && studentData.branch) dept = findDept(studentData.branch);

      // If no department was provided at all, default to the tenant's first department if one exists
      if (!dept && !studentData.departmentId && !studentData.department && !studentData.branch) {
        dept = tenantDepts[0] || null;
      }

      // If the tenant has no departments yet (freshly registered institution) or a new department name/code was entered, create it for this tenant
      if (!dept) {
        const rawDeptInput = String(studentData.department || studentData.branch || studentData.departmentId || 'General Studies').trim();
        const deptCode = (studentData.branchCode || rawDeptInput.replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'GEN').toUpperCase();
        dept = {
          id: `dept-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
          institutionId: targetInstId,
          name: rawDeptInput,
          code: deptCode,
          hod: (requestingUser && requestingUser.name) || 'Department Head',
          facultyCount: tenantTeachers.length,
          studentCount: 1,
          established: new Date().getFullYear().toString(),
          building: 'Main Academic Block',
          email: (requestingUser && requestingUser.email) || ''
        };
        this.departments.push(dept);
      }

      if (studentData.classId) {
        cls = tenantClasses.find(c => c.id === studentData.classId || c.name.toLowerCase() === studentData.classId.toLowerCase());
      }
      if (!cls && studentData.className) {
        cls = tenantClasses.find(c => c.name.toLowerCase() === studentData.className.toLowerCase() || c.id === studentData.className);
      }
      if (!cls && tenantClasses.length > 0 && !studentData.className) {
        cls = tenantClasses.find(c => c.departmentId === dept.id) || tenantClasses[0];
      }

      if (studentData.courseId) {
        crs = tenantCourses.find(c => c.id === studentData.courseId || c.name.toLowerCase() === studentData.courseId.toLowerCase());
      }
      if (!crs && studentData.courseName) {
        crs = tenantCourses.find(c => c.name.toLowerCase() === studentData.courseName.toLowerCase());
      }
      if (!crs && dept) {
        crs = tenantCourses.find(c => c.departmentId === dept.id || c.department === dept.name);
      }

      if (!crs && dept) {
        const deg = studentData.degree || 'B.Tech';
        crs = {
          id: `crs-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
          institutionId: targetInstId,
          name: studentData.courseName || `${deg} ${dept.name}`,
          code: `${deg} ${dept.code}`,
          degree: deg,
          departmentId: dept.id,
          department: dept.name,
          durationYears: 4,
          totalSemesters: 8,
          totalCredits: 160,
          annualFee: parseFloat(studentData.annualFee) || 85000,
          intake: 60
        };
        this.courses.push(crs);
      }

      if (studentData.teacherId) {
        tch = tenantTeachers.find(t => t.id === studentData.teacherId || `${t.firstName} ${t.lastName}`.toLowerCase().includes(studentData.teacherId.toLowerCase()));
      }
      if (!tch && studentData.proctor) {
        tch = tenantTeachers.find(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(studentData.proctor.toLowerCase()));
      }
      if (!tch && cls && cls.teacherId) {
        tch = tenantTeachers.find(t => t.id === cls.teacherId);
      }
      if (!tch && tenantTeachers.length > 0) {
        tch = tenantTeachers.find(t => t.departmentId === dept.id) || tenantTeachers[0];
      }

      if (!cls) {
        const deg = studentData.degree || (crs ? crs.degree : 'B.Tech');
        const sem = parseInt(studentData.semester) || 1;
        const sec = studentData.section || 'A';
        const resolvedClassName = studentData.className || `${deg} ${dept.code} - ${sem}${sec}`;
        cls = {
          id: `cls-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
          institutionId: targetInstId,
          name: resolvedClassName,
          degree: deg,
          branch: dept.code,
          departmentId: dept.id,
          department: dept.name,
          courseId: crs ? crs.id : '',
          semester: sem,
          section: sec,
          studentCount: 1,
          advisor: tch ? `${tch.designation || ''} ${tch.firstName} ${tch.lastName}`.trim() : ((requestingUser && requestingUser.name) || 'Faculty Advisor'),
          teacherId: tch ? tch.id : '',
          room: 'Room 101'
        };
        this.classes.push(cls);
      }
    }

    const departmentId = dept ? dept.id : 'dept-01';
    const departmentName = dept ? dept.name : (studentData.department || 'General Department');
    const branch = departmentName;
    const branchCode = dept ? dept.code : 'GEN';
    const courseId = crs ? crs.id : (studentData.courseId || 'crs-01');
    const courseName = crs ? crs.name : `${studentData.degree || 'B.Tech'} in ${departmentName}`;
    const classId = cls ? cls.id : (studentData.classId || 'cls-01');
    const className = cls ? cls.name : (studentData.className || `${studentData.degree || 'B.Tech'} ${branchCode} - ${studentData.semester || 1}${studentData.section || 'A'}`);
    const teacherId = tch ? tch.id : '';
    const proctor = tch ? `${tch.designation || ''} ${tch.firstName} ${tch.lastName}`.trim() : (studentData.proctor || (cls ? cls.advisor : 'Unassigned'));

    // Unique roll number & user credentials
    const year = parseInt(studentData.year) || (cls ? Math.ceil((cls.semester || 1) / 2) : 1);
    const semester = parseInt(studentData.semester) || (cls ? cls.semester : 1);
    
    // Auto-generate Sequential Register Number (e.g. CSE2026001)
    const regNo = this.generateNextRegisterNumber(departmentId, new Date().getFullYear());
    const rollNo = studentData.rollNumber || regNo;
    const username = (studentData.username || studentData.userId || emailLower.split('@')[0]).toLowerCase().trim();
    
    const initialPassword = studentData.password || process.env.DEFAULT_STUDENT_PASSWORD || process.env.DEFAULT_INITIAL_PASSWORD || require('crypto').randomBytes(16).toString('hex');
    const passwordHash = bcrypt.hashSync(initialPassword, 10);

    const stdId = `std-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
    const userId = `usr-${stdId}`;
    const avatar = studentData.avatar || studentData.profileImageUrl || null;

    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN') 
      ? requestingUser.institutionId 
      : (studentData.institutionId || 'inst-001');

    const newStudent = {
      id: stdId,
      institutionId: institutionId,
      userId: userId,
      username: username,
      rollNumber: rollNo,
      registerNumber: regNo,
      firstName: studentData.firstName,
      lastName: studentData.lastName || '',
      gender: studentData.gender || 'OTHER',
      dateOfBirth: studentData.dob || studentData.dateOfBirth || '',
      dob: studentData.dob || studentData.dateOfBirth || '',
      nationality: studentData.nationality || 'Indian',
      community: studentData.community || 'General',
      fatherName: studentData.fatherName || '',
      fatherPhone: studentData.fatherPhone || '',
      motherName: studentData.motherName || '',
      motherPhone: studentData.motherPhone || '',
      email: studentData.email,
      phone: studentData.phone || '',
      address: studentData.address || studentData.hostelBlock || '',
      linkedInUrl: studentData.linkedInUrl || '',
      degree: studentData.degree || 'B.Tech',
      departmentId: departmentId,
      department: { id: dept.id, name: dept.name, code: dept.code },
      departmentName: dept.name,
      departmentCode: branchCode,
      branch: branch,
      branchCode: branchCode,
      courseId: courseId,
      course: crs ? { id: crs.id, name: crs.name, code: crs.code } : { id: courseId, name: courseName },
      courseName: courseName,
      classId: classId,
      class: cls ? { id: cls.id, name: cls.name, section: cls.section } : { id: classId, name: className },
      className: className,
      teacherId: teacherId,
      teacher: tch ? { id: tch.id, firstName: tch.firstName, lastName: tch.lastName, designation: tch.designation } : null,
      proctor: proctor,
      proctorName: proctor,
      year: year,
      semester: semester,
      section: studentData.section || (cls ? cls.section : 'A'),
      bloodGroup: studentData.bloodGroup || '',
      hostelStatus: studentData.hostelStatus || 'Day Scholar',
      hostelBlock: studentData.hostelBlock || studentData.address || 'Day Scholar',
      parentName: studentData.parentName || studentData.fatherName || '',
      parentPhone: studentData.parentPhone || studentData.fatherPhone || '',
      cgpa: studentData.cgpa !== undefined ? parseFloat(studentData.cgpa) : 0,
      sgpa: studentData.sgpa !== undefined ? parseFloat(studentData.sgpa) : 0,
      creditsEarned: studentData.creditsEarned !== undefined ? parseInt(studentData.creditsEarned) : 0,
      totalCredits: crs ? (crs.totalCredits || 160) : 160,
      attendancePercentage: studentData.attendancePercentage !== undefined ? parseFloat(studentData.attendancePercentage) : 0,
      examEligibility: studentData.examEligibility || 'ELIGIBLE',
      feeStatus: studentData.feeStatus || 'PENDING',
      status: 'ACTIVE',
      avatar: avatar,
      profileImageUrl: avatar
    };

    this.students.unshift(newStudent);

    // Update student count on department and class
    if (dept) {
      dept.studentCount = this.students.filter(s => s.institutionId === institutionId && s.departmentId === dept.id && s.status !== 'INACTIVE').length;
    }
    if (cls) {
      cls.studentCount = this.students.filter(s => s.institutionId === institutionId && (s.classId === cls.id || s.className === cls.name) && s.status !== 'INACTIVE').length;
    }

    // Create User record for credentials immediately
    const userRecord = {
      id: userId,
      institutionId: institutionId,
      username: username,
      email: newStudent.email,
      password: passwordHash,
      passwordHash: passwordHash,
      role: 'STUDENT',
      name: `${newStudent.firstName} ${newStudent.lastName}`.trim(),
      studentId: newStudent.id,
      rollNumber: newStudent.rollNumber,
      registerNumber: newStudent.registerNumber,
      departmentId: newStudent.departmentId,
      department: newStudent.departmentName,
      classId: newStudent.classId,
      className: newStudent.className,
      status: 'ACTIVE',
      avatar: avatar,
      profileImageUrl: avatar
    };
    this.users.push(userRecord);

    // Optional initial fee invoice if feeAmount / tuitionFee was specified
    if (studentData.tuitionFee || studentData.feeAmount) {
      const feeAmt = parseFloat(studentData.tuitionFee || studentData.feeAmount) || 0;
      if (feeAmt > 0) {
        this.feeInvoices.push({
          id: `fee-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
          institutionId: institutionId,
          studentId: newStudent.id,
          studentName: `${newStudent.firstName} ${newStudent.lastName}`.trim(),
          rollNumber: newStudent.rollNumber,
          className: newStudent.className,
          term: `Semester ${newStudent.semester} (${new Date().getFullYear()})`,
          amount: feeAmt,
          paidAmount: newStudent.feeStatus === 'PAID' ? feeAmt : 0,
          dueDate: studentData.feeDueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          status: newStudent.feeStatus || 'PENDING',
          paymentMethod: newStudent.feeStatus === 'PAID' ? 'Institutional Counter' : null,
          receiptNumber: newStudent.feeStatus === 'PAID' ? `RCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}` : null
        });
      }
    }

    this.recalculateTeacherMenteeCounts(institutionId);
    this.saveToDisk();
    return newStudent;
  }

  updateStudent(id, updateData, requestingUser = null) {
    if (requestingUser && requestingUser.role === 'STUDENT') {
      const ownIds = [
        requestingUser.studentId,
        requestingUser.rollNumber,
        requestingUser.registerNumber,
        requestingUser.id
      ].filter(Boolean);
      if (ownIds.length > 0 && !ownIds.includes(id)) {
        throw new Error('FORBIDDEN_STUDENT_OWN_RECORD: Students can only update their own personal profile.');
      }
    }

    const index = this.students.findIndex(s => s.id === id || s.rollNumber === id || s.userId === id);
    if (index === -1) return null;

    const currentStudent = this.students[index];

    // Multi-Tenant Isolation: Cannot update another institution's student
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const userTenantId = requestingUser.institutionId || 'inst-001';
      if ((currentStudent.institutionId || 'inst-001') !== userTenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Access denied. Cannot update student belonging to another institution.');
      }
    }

    // Role Enforcement
    if (requestingUser) {
      if (requestingUser.role === 'STUDENT') {
        // Student can only update their own profile
        const isOwn = currentStudent.id === requestingUser.studentId || 
                      currentStudent.email?.toLowerCase() === requestingUser.email?.toLowerCase() || 
                      currentStudent.userId === requestingUser.id;
        if (!isOwn) {
          throw new Error('FORBIDDEN_STUDENT_OWN_RECORD: Students can only update their own personal profile.');
        }

        // Check if student attempts to edit immutable academic fields
        const immutableFields = [
          'id', 'userId', 'registerNumber', 'rollNumber', 'departmentId', 'department',
          'departmentName', 'branch', 'branchCode', 'courseId', 'course', 'courseName',
          'classId', 'className', 'teacherId', 'teacher', 'proctor', 'proctorName',
          'cgpa', 'sgpa', 'creditsEarned', 'totalCredits', 'attendancePercentage',
          'examEligibility', 'feeStatus', 'year', 'semester', 'degree', 'section'
        ];

        for (const field of immutableFields) {
          if (updateData[field] !== undefined) {
            const currentVal = currentStudent[field];
            // Compare value
            if (typeof currentVal === 'object' && currentVal !== null) {
              // If object, check ID or name
              if (updateData[field] !== currentVal.id && updateData[field] !== currentVal.name) {
                throw new Error(`FORBIDDEN_STUDENT_IMMUTABLE_FIELD: Students are not permitted to modify academic or institutional records (${field}).`);
              }
            } else if (String(updateData[field]) !== String(currentVal)) {
              throw new Error(`FORBIDDEN_STUDENT_IMMUTABLE_FIELD: Students are not permitted to modify academic or institutional records (${field}).`);
            }
          }
        }

        // Permitted fields only for student: phone, parentPhone, parentName, address, hostelBlock, hostelStatus, bloodGroup, avatar, profileImageUrl, dob, gender, fatherName, fatherPhone, motherName, motherPhone, linkedInUrl, nationality, community
        const sanitized = {};
        if (updateData.phone !== undefined) sanitized.phone = updateData.phone;
        if (updateData.parentPhone !== undefined) sanitized.parentPhone = updateData.parentPhone;
        if (updateData.parentName !== undefined) sanitized.parentName = updateData.parentName;
        if (updateData.fatherName !== undefined) sanitized.fatherName = updateData.fatherName;
        if (updateData.fatherPhone !== undefined) sanitized.fatherPhone = updateData.fatherPhone;
        if (updateData.motherName !== undefined) sanitized.motherName = updateData.motherName;
        if (updateData.motherPhone !== undefined) sanitized.motherPhone = updateData.motherPhone;
        if (updateData.bloodGroup !== undefined) sanitized.bloodGroup = updateData.bloodGroup;
        if (updateData.hostelBlock !== undefined) sanitized.hostelBlock = updateData.hostelBlock;
        if (updateData.hostelStatus !== undefined) sanitized.hostelStatus = updateData.hostelStatus;
        if (updateData.address !== undefined) sanitized.address = updateData.address;
        if (updateData.linkedInUrl !== undefined) sanitized.linkedInUrl = updateData.linkedInUrl;
        if (updateData.avatar !== undefined) sanitized.avatar = updateData.avatar;
        if (updateData.profileImageUrl !== undefined) sanitized.profileImageUrl = updateData.profileImageUrl;
        if (updateData.dob !== undefined) {
          sanitized.dob = updateData.dob;
          sanitized.dateOfBirth = updateData.dob;
        }
        if (updateData.dateOfBirth !== undefined) {
          sanitized.dateOfBirth = updateData.dateOfBirth;
          sanitized.dob = updateData.dateOfBirth;
        }
        if (updateData.gender !== undefined) sanitized.gender = updateData.gender;
        if (updateData.nationality !== undefined) sanitized.nationality = updateData.nationality;
        if (updateData.community !== undefined) sanitized.community = updateData.community;

        if (sanitized.avatar && !sanitized.profileImageUrl) sanitized.profileImageUrl = sanitized.avatar;
        if (sanitized.profileImageUrl && !sanitized.avatar) sanitized.avatar = sanitized.profileImageUrl;

        this.students[index] = { ...currentStudent, ...sanitized };

        // Sync user cache
        const u = this.users.find(usr => usr.studentId === currentStudent.id || usr.email?.toLowerCase() === currentStudent.email?.toLowerCase());
        if (u) {
          if (sanitized.avatar) {
            u.avatar = sanitized.avatar;
            u.profileImageUrl = sanitized.avatar;
          }
        }

        this.saveToDisk();
        return this.students[index];
      }

      if (requestingUser.role === 'TEACHER') {
        // Teacher can ONLY update students in their assigned class
        const teacher = this.teachers.find(t => 
          t.id === requestingUser.teacherId || 
          t.userId === requestingUser.id || 
          t.email?.toLowerCase() === requestingUser.email?.toLowerCase()
        );
        const myClasses = teacher?.assignedClasses || [];
        if (!myClasses.includes(currentStudent.className) && teacher?.id !== currentStudent.teacherId) {
          throw new Error(`FORBIDDEN_TEACHER_CLASS: Permission Denied. You may only edit students in your assigned class batches (${myClasses.join(', ')}).`);
        }

        // Disallow modifying immutable IDs: userId, rollNumber, registerNumber
        delete updateData.userId;
        delete updateData.username;
        delete updateData.rollNumber;
        delete updateData.registerNumber;
      }
    }

    const tenantId = currentStudent.institutionId || 'inst-001';
    // If departmentId or classId is updated by Admin, resolve relations within tenant
    if (updateData.departmentId) {
      const d = this.departments.find(dep => (dep.institutionId || 'inst-001') === tenantId && (dep.id === updateData.departmentId || dep.name === updateData.departmentId));
      if (d) {
        updateData.departmentId = d.id;
        updateData.department = { id: d.id, name: d.name, code: d.code };
        updateData.departmentName = d.name;
        updateData.branch = d.name;
        updateData.branchCode = d.code;
      }
    }
    if (updateData.courseId) {
      const crs = this.courses.find(c => (c.institutionId || 'inst-001') === tenantId && (c.id === updateData.courseId || c.name === updateData.courseId));
      if (crs) {
        updateData.courseId = crs.id;
        updateData.courseName = crs.name;
        updateData.course = { id: crs.id, name: crs.name, code: crs.code };
      }
    }
    if (updateData.classId || updateData.className) {
      const targetClassRef = updateData.classId || updateData.className;
      const c = this.classes.find(cls => (cls.institutionId || 'inst-001') === tenantId && (cls.id === targetClassRef || cls.name === targetClassRef));
      if (c) {
        updateData.classId = c.id;
        updateData.className = c.name;
        updateData.class = { id: c.id, name: c.name, section: c.section };
      }
    }
    if (updateData.teacherId !== undefined || updateData.proctor !== undefined || updateData.proctorId !== undefined || updateData.mentorId !== undefined) {
      const rawTch = updateData.teacherId !== undefined
        ? updateData.teacherId
        : (updateData.proctorId !== undefined ? updateData.proctorId : (updateData.mentorId !== undefined ? updateData.mentorId : updateData.proctor));
      if (!rawTch || rawTch === 'UNASSIGNED' || rawTch === 'Unassigned') {
        updateData.teacherId = '';
        updateData.proctorId = '';
        updateData.mentorId = '';
        updateData.teacher = null;
        updateData.proctor = 'Unassigned';
        updateData.proctorName = 'Unassigned';
      } else {
        const tch = this.teachers.find(t =>
          (t.institutionId || 'inst-001') === tenantId &&
          (t.id === rawTch || t.employeeId === rawTch || `${t.firstName} ${t.lastName}`.toLowerCase().includes(String(rawTch).toLowerCase()))
        );
        if (tch) {
          updateData.teacherId = tch.id;
          updateData.proctorId = tch.id;
          updateData.mentorId = tch.id;
          updateData.teacher = { id: tch.id, firstName: tch.firstName, lastName: tch.lastName, designation: tch.designation };
          updateData.proctor = `${tch.designation || ''} ${tch.firstName} ${tch.lastName}`.trim();
          updateData.proctorName = updateData.proctor;
        }
      }
    }
    if (updateData.dob && !updateData.dateOfBirth) updateData.dateOfBirth = updateData.dob;
    if (updateData.dateOfBirth && !updateData.dob) updateData.dob = updateData.dateOfBirth;

    if (updateData.avatar && !updateData.profileImageUrl) updateData.profileImageUrl = updateData.avatar;
    if (updateData.profileImageUrl && !updateData.avatar) updateData.avatar = updateData.profileImageUrl;

    const rawNewPassword = updateData.password ? String(updateData.password).trim() : '';
    const sanitizedStudentUpdate = { ...updateData };
    delete sanitizedStudentUpdate.password;

    this.students[index] = { ...currentStudent, ...sanitizedStudentUpdate };

    // Sync user cache
    const u = this.users.find(usr => usr.studentId === currentStudent.id || usr.id === currentStudent.userId || usr.email?.toLowerCase() === currentStudent.email?.toLowerCase());
    if (u) {
      if (updateData.firstName || updateData.lastName) {
        u.name = `${this.students[index].firstName} ${this.students[index].lastName}`.trim();
      }
      if (updateData.email) u.email = updateData.email;
      if (updateData.username) u.username = updateData.username;
      if (updateData.rollNumber) u.rollNumber = updateData.rollNumber;
      if (updateData.registerNumber) u.registerNumber = updateData.registerNumber;
      if (updateData.status) u.status = updateData.status;
      if (updateData.departmentId) u.departmentId = updateData.departmentId;
      if (updateData.departmentName) u.department = updateData.departmentName;
      if (updateData.avatar) {
        u.avatar = updateData.avatar;
        u.profileImageUrl = updateData.avatar;
      }
      if (rawNewPassword && rawNewPassword.length >= 4) {
        const hashed = bcrypt.hashSync(rawNewPassword, 10);
        u.password = hashed;
        u.passwordHash = hashed;
      }
    }

    // Recompute department, class, and teacher mentee counts
    this.recalculateTeacherMenteeCounts(tenantId);
    this.saveToDisk();
    return this.students[index];
  }

  deleteStudent(id, requestingUser = null) {
    if (requestingUser && requestingUser.role === 'STUDENT') {
      throw new Error('FORBIDDEN_STUDENT: Students are not permitted to drop students.');
    }

    const index = this.students.findIndex(s => s.id === id || s.rollNumber === id || s.userId === id);
    if (index === -1) return false;

    const student = this.students[index];

    if (requestingUser) {
      if (requestingUser.role === 'STUDENT') {
        throw new Error('FORBIDDEN_STUDENT: Students are not permitted to drop students.');
      }
      if (requestingUser.role === 'TEACHER') {
        const teacher = this.teachers.find(t => 
          t.id === requestingUser.teacherId || 
          t.userId === requestingUser.id || 
          t.email?.toLowerCase() === requestingUser.email?.toLowerCase()
        );
        const myClasses = teacher?.assignedClasses || [];
        if (!myClasses.includes(student.className) && teacher?.id !== student.teacherId) {
          throw new Error(`FORBIDDEN_TEACHER_CLASS: Permission Denied. You may only drop students from your own assigned class batches (${myClasses.join(', ')}).`);
        }
      }
    }

    // Soft delete: preserve academic history, transcript and attendance
    student.status = 'INACTIVE';

    const u = this.users.find(usr => usr.studentId === student.id || usr.email?.toLowerCase() === student.email?.toLowerCase());
    if (u) {
      u.status = 'INACTIVE';
    }

    this.recalculateTeacherMenteeCounts(student.institutionId || 'inst-001');
    this.saveToDisk();
    return true;
  }

  // ==========================================
  // TEACHER METHODS & DYNAMIC MENTEE COUNT
  // ==========================================
  recalculateTeacherMenteeCounts(institutionId = null) {
    this.teachers.forEach(t => {
      const tTenant = t.institutionId || 'inst-001';
      if (institutionId && tTenant !== institutionId) return;
      if (t.status === 'INACTIVE') {
        t.menteeCount = 0;
        t.mentees = [];
        return;
      }
      const fullNameLower = `${t.firstName || ''} ${t.lastName || ''}`.trim().toLowerCase();
      // Find unique active students assigned to this teacher
      const seenStudentIds = new Set();
      const assignedStudents = [];
      this.students.forEach(s => {
        if ((s.institutionId || 'inst-001') !== tTenant) return;
        if (s.status === 'INACTIVE') return;
        if (seenStudentIds.has(s.id)) return;

        const matchById = s.teacherId === t.id || (s.teacher && s.teacher.id === t.id);
        const matchByName = !s.teacherId && s.proctor && fullNameLower && String(s.proctor).toLowerCase().includes(fullNameLower);
        if (matchById || matchByName) {
          seenStudentIds.add(s.id);
          if (!s.teacherId) {
            s.teacherId = t.id;
            s.teacher = { id: t.id, firstName: t.firstName, lastName: t.lastName, designation: t.designation };
          }
          assignedStudents.push({
            id: s.id,
            name: `${s.firstName} ${s.lastName || ''}`.trim(),
            rollNumber: s.rollNumber,
            registerNumber: s.registerNumber,
            className: s.className,
            semester: s.semester
          });
        }
      });
      t.menteeCount = assignedStudents.length;
      t.mentees = assignedStudents;
    });
  }

  getTeachers(filters = {}, requestingUser = null) {
    this.recalculateTeacherMenteeCounts();
    let list = this.teachers;

    // Multi-tenant isolation: Scoped strictly to requesting user's institution unless SUPER_ADMIN
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const userTenantId = requestingUser.institutionId || 'inst-001';
      list = list.filter(t => (t.institutionId || 'inst-001') === userTenantId);
    }

    if (filters.department) {
      list = list.filter(t => (t.department || '').toLowerCase().includes(filters.department.toLowerCase()) || t.departmentId === filters.department);
    }
    if (filters.status) {
      list = list.filter(t => t.status?.toLowerCase() === filters.status.toLowerCase());
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(t =>
        (t.firstName || '').toLowerCase().includes(q) ||
        (t.lastName || '').toLowerCase().includes(q) ||
        (t.employeeId || '').toLowerCase().includes(q) ||
        (t.department || '').toLowerCase().includes(q) ||
        (t.specialization && t.specialization.toLowerCase().includes(q))
      );
    }
    return list;
  }

  getTeacherById(id, requestingUser = null) {
    this.recalculateTeacherMenteeCounts();
    const teacher = this.teachers.find(t => t.id === id || t.employeeId === id || t.userId === id);
    if (!teacher) return null;

    // Multi-tenant check: Block cross-tenant access
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const userTenantId = requestingUser.institutionId || 'inst-001';
      if ((teacher.institutionId || 'inst-001') !== userTenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Access denied. Cannot view faculty belonging to another institution.');
      }
    }
    return teacher;
  }

  createTeacher(teacherData, requestingUser = null) {
    if (requestingUser && requestingUser.role !== 'ADMIN') {
      throw new Error('FORBIDDEN_ADMIN_ONLY: Only institutional administrators can appoint new faculty.');
    }

    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (teacherData.institutionId || 'inst-001');

    // Email validation
    if (!teacherData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherData.email)) {
      throw new Error('INVALID_EMAIL: Please provide a valid email address.');
    }

    // Uniqueness check across users and teachers
    const emailLower = teacherData.email.trim().toLowerCase();
    const emailInUsers = this.users.some(u => u.email && u.email.toLowerCase() === emailLower);
    const emailInTeachers = this.teachers.some(t => t.email && t.email.toLowerCase() === emailLower);
    if (emailInUsers || emailInTeachers) {
      throw new Error('DUPLICATE_EMAIL: This email is already registered.');
    }

    const tenantDepts = this.departments.filter(d => (d.institutionId || 'inst-001') === institutionId);
    const tenantClasses = this.classes.filter(c => (c.institutionId || 'inst-001') === institutionId);
    const reqDept = (teacherData.departmentId || teacherData.department || '').trim().toLowerCase();

    let dept = tenantDepts.find(d => 
      d.id === teacherData.departmentId || 
      d.name.toLowerCase() === reqDept || 
      d.code.toLowerCase() === reqDept
    );

    if (!dept && !reqDept && tenantDepts.length > 0) {
      dept = tenantDepts[0];
    }

    if (!dept) {
      const rawDeptName = String(teacherData.department || teacherData.departmentId || 'General Studies').trim();
      const rawDeptCode = (teacherData.departmentCode || rawDeptName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'GEN').toUpperCase();
      dept = {
        id: `dept-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
        institutionId: institutionId,
        name: rawDeptName,
        code: rawDeptCode,
        hod: `${teacherData.designation || 'Prof.'} ${teacherData.firstName} ${teacherData.lastName || ''}`.trim(),
        facultyCount: 1,
        studentCount: 0,
        established: new Date().getFullYear().toString(),
        building: 'Main Academic Block',
        email: emailLower
      };
      this.departments.push(dept);
    }

    const departmentId = dept.id;
    const department = dept.name;
    const deptCode = dept.code;

    // Auto-generate Sequential Employee ID (e.g. CSE-EMP-001)
    const empId = this.generateNextEmployeeId(departmentId);
    const tchId = `tch-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
    const userId = `usr-${tchId}`;
    const username = (teacherData.username || emailLower.split('@')[0]).toLowerCase();
    
    // Bcrypt hash password
    const password = teacherData.password || process.env.DEFAULT_FACULTY_PASSWORD || process.env.DEFAULT_INITIAL_PASSWORD || require('crypto').randomBytes(16).toString('hex');
    const passwordHash = bcrypt.hashSync(password, 10);

    const assignedClasses = Array.isArray(teacherData.assignedClasses) 
      ? teacherData.assignedClasses 
      : (typeof teacherData.assignedClasses === 'string' && teacherData.assignedClasses.trim()
          ? teacherData.assignedClasses.split(',').map(s => s.trim()).filter(Boolean)
          : (tenantClasses.length > 0 ? [tenantClasses[0].name] : [`B.Tech ${deptCode} - 1A`]));

    // Ensure assigned classes exist in tenantClasses so students can be enrolled into them
    assignedClasses.forEach(clsName => {
      if (!this.classes.some(c => (c.institutionId || 'inst-001') === institutionId && c.name.toLowerCase() === clsName.toLowerCase())) {
        this.classes.push({
          id: `cls-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
          institutionId: institutionId,
          name: clsName,
          degree: 'B.Tech',
          branch: deptCode,
          departmentId: departmentId,
          department: department,
          semester: 1,
          section: 'A',
          studentCount: 0,
          advisor: `${teacherData.designation || 'Assistant Professor'} ${teacherData.firstName} ${teacherData.lastName || ''}`.trim(),
          teacherId: tchId,
          room: teacherData.officeCabin || 'Room 101'
        });
      }
    });

    const subjects = Array.isArray(teacherData.subjects)
      ? teacherData.subjects
      : (typeof teacherData.subjects === 'string' && teacherData.subjects.trim()
          ? teacherData.subjects.split(',').map(s => s.trim()).filter(Boolean)
          : []);

    const avatar = teacherData.avatar || teacherData.profileImageUrl || null;

    const newTeacher = {
      id: tchId,
      institutionId: institutionId,
      userId: userId,
      username: username,
      employeeId: empId,
      firstName: teacherData.firstName,
      lastName: teacherData.lastName || '',
      gender: teacherData.gender || 'OTHER',
      dateOfBirth: teacherData.dob || teacherData.dateOfBirth || '',
      dob: teacherData.dob || teacherData.dateOfBirth || '',
      nationality: teacherData.nationality || 'Indian',
      email: teacherData.email,
      phone: teacherData.phone || '',
      address: teacherData.address || '',
      linkedInUrl: teacherData.linkedInUrl || '',
      designation: teacherData.designation || 'Assistant Professor',
      departmentId: departmentId,
      department: department,
      qualification: teacherData.qualification || 'M.Tech / Ph.D.',
      specialization: teacherData.specialization || department,
      officeCabin: teacherData.officeCabin || '',
      officeHours: teacherData.officeHours || '',
      assignedClasses: assignedClasses,
      subjects: subjects,
      assignedCourses: subjects,
      menteeCount: 0,
      mentees: [],
      rating: 0,
      experienceYears: parseInt(teacherData.experienceYears) || 1,
      status: 'ACTIVE',
      avatar: avatar,
      profileImageUrl: avatar
    };

    this.teachers.unshift(newTeacher);

    // If menteeStudentIds were passed during faculty creation, assign those students (deduplicated)
    if (Array.isArray(teacherData.menteeStudentIds)) {
      const uniqueIds = [...new Set(teacherData.menteeStudentIds)];
      uniqueIds.forEach(stdId => {
        const std = this.students.find(s => s.id === stdId && (s.institutionId || 'inst-001') === institutionId);
        if (std) {
          std.teacherId = newTeacher.id;
          std.teacher = { id: newTeacher.id, firstName: newTeacher.firstName, lastName: newTeacher.lastName, designation: newTeacher.designation };
          std.proctor = `${newTeacher.designation || ''} ${newTeacher.firstName} ${newTeacher.lastName}`.trim();
          std.proctorName = std.proctor;
        }
      });
    }

    this.recalculateTeacherMenteeCounts(institutionId);

    if (dept) {
      dept.facultyCount = this.teachers.filter(t => t.institutionId === institutionId && t.departmentId === dept.id && t.status !== 'INACTIVE').length;
    }

    // Create user login record
    const userRecord = {
      id: userId,
      institutionId: institutionId,
      username: username,
      email: newTeacher.email,
      password: passwordHash,
      passwordHash: passwordHash,
      role: 'TEACHER',
      name: `${newTeacher.firstName} ${newTeacher.lastName}`.trim(),
      teacherId: newTeacher.id,
      employeeId: newTeacher.employeeId,
      title: newTeacher.designation,
      departmentId: newTeacher.departmentId,
      department: newTeacher.department,
      assignedClasses: newTeacher.assignedClasses,
      status: 'ACTIVE',
      avatar: avatar,
      profileImageUrl: avatar
    };
    this.users.push(userRecord);

    this.saveToDisk();
    return newTeacher;
  }

  updateTeacher(id, updateData, requestingUser = null) {
    const index = this.teachers.findIndex(t => t.id === id || t.employeeId === id || t.userId === id);
    if (index === -1) return null;

    const currentTeacher = this.teachers[index];

    // Multi-tenant check: Block cross-tenant update
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const userTenantId = requestingUser.institutionId || 'inst-001';
      if ((currentTeacher.institutionId || 'inst-001') !== userTenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Access denied. Cannot modify faculty belonging to another institution.');
      }
    }

    if (requestingUser) {
      if (requestingUser.role === 'TEACHER') {
        const isOwn = currentTeacher.id === requestingUser.teacherId || 
                      currentTeacher.email?.toLowerCase() === requestingUser.email?.toLowerCase() ||
                      currentTeacher.userId === requestingUser.id;
        if (!isOwn) {
          throw new Error('FORBIDDEN_TEACHER_OWN_PROFILE: Faculty can only view and update their own profile.');
        }

        // Permitted self-update fields for staff: phone, address, linkedInUrl, officeCabin, officeHours, specialization, avatar, profileImageUrl
        const sanitized = {};
        if (updateData.phone !== undefined) sanitized.phone = updateData.phone;
        if (updateData.address !== undefined) sanitized.address = updateData.address;
        if (updateData.linkedInUrl !== undefined) sanitized.linkedInUrl = updateData.linkedInUrl;
        if (updateData.officeCabin !== undefined) sanitized.officeCabin = updateData.officeCabin;
        if (updateData.officeHours !== undefined) sanitized.officeHours = updateData.officeHours;
        if (updateData.specialization !== undefined) sanitized.specialization = updateData.specialization;
        if (updateData.avatar !== undefined) sanitized.avatar = updateData.avatar;
        if (updateData.profileImageUrl !== undefined) sanitized.profileImageUrl = updateData.profileImageUrl;

        if (sanitized.avatar && !sanitized.profileImageUrl) sanitized.profileImageUrl = sanitized.avatar;
        if (sanitized.profileImageUrl && !sanitized.avatar) sanitized.avatar = sanitized.profileImageUrl;

        this.teachers[index] = { ...currentTeacher, ...sanitized };

        // Sync to user record
        const u = this.users.find(usr => usr.teacherId === currentTeacher.id || usr.email?.toLowerCase() === currentTeacher.email?.toLowerCase());
        if (u) {
          if (sanitized.avatar) {
            u.avatar = sanitized.avatar;
            u.profileImageUrl = sanitized.avatar;
          }
        }

        this.recalculateTeacherMenteeCounts(currentTeacher.institutionId || 'inst-001');
        this.saveToDisk();
        return this.teachers[index];
      }

      if (requestingUser.role !== 'ADMIN') {
        throw new Error('FORBIDDEN_ADMIN_ONLY: Only institutional administrators can modify faculty appointments.');
      }
    }

    if (updateData.avatar && !updateData.profileImageUrl) updateData.profileImageUrl = updateData.avatar;
    if (updateData.profileImageUrl && !updateData.avatar) updateData.avatar = updateData.profileImageUrl;

    const tenantId = currentTeacher.institutionId || 'inst-001';
    if (updateData.departmentId || updateData.department) {
      const d = this.departments.find(dep => (dep.institutionId || 'inst-001') === tenantId && (dep.id === updateData.departmentId || dep.name === updateData.department || dep.id === updateData.department));
      if (d) {
        updateData.departmentId = d.id;
        updateData.department = d.name;
      }
    }

    if (updateData.assignedClasses && typeof updateData.assignedClasses === 'string') {
      updateData.assignedClasses = updateData.assignedClasses.split(',').map(s => s.trim()).filter(Boolean);
    }

    const rawNewPassword = updateData.password ? String(updateData.password).trim() : '';
    const sanitizedTeacherUpdate = { ...updateData };
    delete sanitizedTeacherUpdate.password;

    this.teachers[index] = { ...currentTeacher, ...sanitizedTeacherUpdate };
    const updatedTeacher = this.teachers[index];

    // If menteeStudentIds array is explicitly provided, synchronize student assignments (preventing duplicates)
    if (Array.isArray(updateData.menteeStudentIds)) {
      const uniqueIds = new Set(updateData.menteeStudentIds);
      this.students.forEach(s => {
        if ((s.institutionId || 'inst-001') !== tenantId) return;
        if (uniqueIds.has(s.id)) {
          s.teacherId = updatedTeacher.id;
          s.teacher = { id: updatedTeacher.id, firstName: updatedTeacher.firstName, lastName: updatedTeacher.lastName, designation: updatedTeacher.designation };
          s.proctor = `${updatedTeacher.designation || ''} ${updatedTeacher.firstName} ${updatedTeacher.lastName}`.trim();
          s.proctorName = s.proctor;
        } else if (s.teacherId === updatedTeacher.id) {
          s.teacherId = '';
          s.teacher = null;
          s.proctor = 'Unassigned';
          s.proctorName = 'Unassigned';
        }
      });
    } else {
      // Update proctor display name on existing assigned mentees if teacher's name/designation changed
      this.students.forEach(s => {
        if (s.teacherId === updatedTeacher.id) {
          s.teacher = { id: updatedTeacher.id, firstName: updatedTeacher.firstName, lastName: updatedTeacher.lastName, designation: updatedTeacher.designation };
          s.proctor = `${updatedTeacher.designation || ''} ${updatedTeacher.firstName} ${updatedTeacher.lastName}`.trim();
          s.proctorName = s.proctor;
        }
      });
    }

    // If teacher was marked INACTIVE, unassign their active mentees
    if (updatedTeacher.status === 'INACTIVE') {
      this.students.forEach(s => {
        if (s.teacherId === updatedTeacher.id) {
          s.teacherId = '';
          s.teacher = null;
          s.proctor = 'Unassigned';
          s.proctorName = 'Unassigned';
        }
      });
    }

    this.recalculateTeacherMenteeCounts(tenantId);

    // Sync to user
    const u = this.users.find(usr => usr.teacherId === currentTeacher.id || usr.id === currentTeacher.userId || usr.email?.toLowerCase() === currentTeacher.email?.toLowerCase());
    if (u) {
      if (updateData.firstName || updateData.lastName) {
        u.name = `${this.teachers[index].firstName} ${this.teachers[index].lastName}`.trim();
      }
      if (updateData.email) u.email = updateData.email;
      if (updateData.username) u.username = updateData.username;
      if (updateData.employeeId) u.employeeId = updateData.employeeId;
      if (updateData.designation) u.title = updateData.designation;
      if (updateData.departmentId) u.departmentId = updateData.departmentId;
      if (updateData.department) u.department = updateData.department;
      if (updateData.assignedClasses) u.assignedClasses = updateData.assignedClasses;
      if (updateData.status) u.status = updateData.status;
      if (updateData.avatar) {
        u.avatar = updateData.avatar;
        u.profileImageUrl = updateData.avatar;
      }
      if (rawNewPassword && rawNewPassword.length >= 4) {
        const hashed = bcrypt.hashSync(rawNewPassword, 10);
        u.password = hashed;
        u.passwordHash = hashed;
      }
    }

    this.saveToDisk();
    return this.teachers[index];
  }

  deleteTeacher(id, requestingUser = null) {
    if (requestingUser && requestingUser.role !== 'ADMIN') {
      throw new Error('FORBIDDEN_ADMIN_ONLY: Only institutional administrators can remove faculty members.');
    }

    const index = this.teachers.findIndex(t => t.id === id || t.employeeId === id || t.userId === id);
    if (index === -1) return false;

    const teacher = this.teachers[index];
    teacher.status = 'INACTIVE';

    // Unassign active mentees from deactivated teacher so mentee counts stay accurate
    this.students.forEach(s => {
      if (s.teacherId === teacher.id) {
        s.teacherId = '';
        s.teacher = null;
        s.proctor = 'Unassigned';
        s.proctorName = 'Unassigned';
      }
    });

    this.recalculateTeacherMenteeCounts(teacher.institutionId || 'inst-001');

    const u = this.users.find(usr => usr.teacherId === teacher.id || usr.email?.toLowerCase() === teacher.email?.toLowerCase());
    if (u) {
      u.status = 'INACTIVE';
    }

    this.saveToDisk();
    return true;
  }

  // ==========================================
  // AUTHENTICATION & CREDENTIALS
  // ==========================================
  authenticate(identifier, password, requestedRole = null, requestedInstitutionId = null) {
    if (!identifier || !password) {
      return { success: false, message: "Invalid email or password." };
    }

    const idLower = String(identifier).trim().toLowerCase();
    const idAlias = idLower
      .replace('@acadivex.edu', '@edumanage.ac.in')
      .replace('@acadivex.ac.in', '@edumanage.ac.in');
    const gnuAlias = idLower.endsWith('@gnu.in')
      ? idLower.replace(/@gnu\.in$/, '@gn.in')
      : (idLower.endsWith('@gn.in') ? idLower.replace(/@gn\.in$/, '@gnu.in') : idLower);

    let user = this.users.find(u => 
      (u.email && (u.email.toLowerCase() === idLower || u.email.toLowerCase() === idAlias || u.email.toLowerCase() === gnuAlias)) ||
      (u.username && (u.username.toLowerCase() === idLower || u.username.toLowerCase() === idAlias || u.username.toLowerCase() === gnuAlias)) ||
      (u.rollNumber && u.rollNumber.toLowerCase() === idLower) ||
      (u.registerNumber && u.registerNumber.toLowerCase() === idLower) ||
      (u.id && u.id.toLowerCase() === idLower) ||
      (u.studentId && u.studentId.toLowerCase() === idLower) ||
      (u.teacherId && u.teacherId.toLowerCase() === idLower) ||
      (u.employeeId && u.employeeId.toLowerCase() === idLower)
    );

    // Fallback: search student registry if user was created or roll/register number entered
    if (!user) {
      const student = this.students.find(s => 
        (s.id && s.id.toLowerCase() === idLower) ||
        (s.rollNumber && s.rollNumber.toLowerCase() === idLower) ||
        (s.registerNumber && s.registerNumber.toLowerCase() === idLower) ||
        (s.email && (s.email.toLowerCase() === idLower || s.email.toLowerCase() === gnuAlias)) ||
        (s.userId && s.userId.toLowerCase() === idLower) ||
        (s.username && s.username.toLowerCase() === idLower)
      );
      if (student) {
        user = this.users.find(u => 
          u.studentId === student.id || 
          u.id === student.userId || 
          (u.email && u.email.toLowerCase() === student.email?.toLowerCase()) ||
          (u.username && u.username.toLowerCase() === student.username?.toLowerCase())
        );
      }
    }

    // Fallback: search teacher registry
    if (!user) {
      const teacher = this.teachers.find(t =>
        (t.id && t.id.toLowerCase() === idLower) ||
        (t.employeeId && t.employeeId.toLowerCase() === idLower) ||
        (t.email && (t.email.toLowerCase() === idLower || t.email.toLowerCase() === gnuAlias)) ||
        (t.userId && t.userId.toLowerCase() === idLower) ||
        (t.username && t.username.toLowerCase() === idLower)
      );
      if (teacher) {
        user = this.users.find(u =>
          u.teacherId === teacher.id ||
          u.id === teacher.userId ||
          (u.email && u.email.toLowerCase() === teacher.email?.toLowerCase()) ||
          (u.username && u.username.toLowerCase() === teacher.username?.toLowerCase())
        );
      }
    }

    if (!user) {
      return { success: false, message: "Invalid email or password." };
    }

    // Normalize role aliases (STAFF/FACULTY -> TEACHER, ADMINISTRATOR/DEAN -> ADMIN)
    const normalizeRole = (r) => {
      if (!r) return null;
      const upper = String(r).trim().toUpperCase();
      if (['STAFF', 'FACULTY', 'PROFESSOR', 'TEACHER'].includes(upper)) return 'TEACHER';
      if (['ADMIN', 'ADMINISTRATOR', 'DEAN'].includes(upper)) return 'ADMIN';
      if (['STUDENT', 'LEARNER', 'SCHOLAR'].includes(upper)) return 'STUDENT';
      return upper;
    };

    const userRole = normalizeRole(user.role);
    const normRequestedRole = normalizeRole(requestedRole);

    // Keep SUPER_ADMIN strictly isolated from institution portal login roles
    if (normRequestedRole && (normRequestedRole === 'SUPER_ADMIN' || userRole === 'SUPER_ADMIN') && userRole !== normRequestedRole) {
      return { 
        success: false, 
        message: `Access denied. Account is not registered as ${normRequestedRole}.` 
      };
    }

    // Soft deletion check
    if (user.status === 'INACTIVE') {
      return { 
        success: false, 
        statusCode: 403, 
        message: "Your account has been deactivated. Please contact your administrator." 
      };
    }

    // Check associated student or teacher status
    if (userRole === 'STUDENT') {
      const std = this.students.find(s => s.id === user.studentId || s.email?.toLowerCase() === user.email?.toLowerCase());
      if (std && std.status === 'INACTIVE') {
        return { 
          success: false, 
          statusCode: 403, 
          message: "Your account has been deactivated. Please contact your administrator." 
        };
      }
    } else if (userRole === 'TEACHER') {
      const tch = this.teachers.find(t => t.id === user.teacherId || t.email?.toLowerCase() === user.email?.toLowerCase());
      if (tch && tch.status === 'INACTIVE') {
        return { 
          success: false, 
          statusCode: 403, 
          message: "Your account has been deactivated. Please contact your administrator." 
        };
      }
    }

    // Password verification using bcrypt
    let isPasswordValid = false;
    const storedHash = user.passwordHash || user.password;
    if (storedHash && String(storedHash).startsWith('$2')) {
      try {
        isPasswordValid = bcrypt.compareSync(password, storedHash);
      } catch (e) {
        isPasswordValid = false;
      }
    } else if (user.password && user.password === password) {
      isPasswordValid = true;
    }

    if (!isPasswordValid) {
      return { success: false, message: "Invalid email or password." };
    }

    // Check Institution Status & Tenant Portal Match (SaaS multi-tenant enforcement)
    const userInstId = user.institutionId || 'inst-001';
    if (user.role !== 'SUPER_ADMIN' && userInstId !== 'system') {
      if (requestedInstitutionId) {
        const reqInstLower = String(requestedInstitutionId).trim().toLowerCase();
        const targetInst = this.institutions.find(i =>
          i.id.toLowerCase() === reqInstLower ||
          (i.code && i.code.toLowerCase() === reqInstLower) ||
          (i.slug && i.slug.toLowerCase() === reqInstLower) ||
          (i.name && i.name.toLowerCase() === reqInstLower)
        );
        const resolvedTargetId = targetInst ? targetInst.id : requestedInstitutionId;
        if (userInstId !== resolvedTargetId) {
          return {
            success: false,
            statusCode: 403,
            message: "Access denied. This account does not belong to the selected institution portal."
          };
        }
      }

      const institution = this.institutions.find(i => i.id === userInstId);
      if (institution && institution.status === 'SUSPENDED') {
        return {
          success: false,
          statusCode: 403,
          message: "Institution subscription is suspended. Access denied. Please contact system administrator."
        };
      }
    }

    // Lookup full teacher or student details
    let assignedClasses = [];
    if (user.role === 'TEACHER') {
      const tch = this.teachers.find(t => t.id === user.teacherId || t.email?.toLowerCase() === user.email?.toLowerCase());
      if (tch) assignedClasses = tch.assignedClasses || [];
    }

    const institutionObj = this.institutions.find(i => i.id === userInstId);

    const safeUser = {
      id: user.id,
      institutionId: userInstId,
      institutionName: institutionObj ? institutionObj.name : "ACADIVEX Campus",
      campusName: institutionObj ? (institutionObj.campusName || "Main Campus") : "Main Campus",
      institutionCampusName: institutionObj ? (institutionObj.campusName || "Main Campus") : "Main Campus",
      institutionCode: institutionObj ? institutionObj.code : "ACADIVEX",
      institutionLogo: institutionObj ? (institutionObj.logoUrl || null) : null,
      institutionType: institutionObj ? (institutionObj.institutionType || "COLLEGE") : "COLLEGE",
      institutionTagline: institutionObj ? (institutionObj.tagline || "Smarter Campus. Stronger Futures.") : "Smarter Campus. Stronger Futures.",
      institutionAccreditation: institutionObj ? (institutionObj.accreditation || "") : "",
      institutionPrimaryColor: institutionObj ? (institutionObj.primaryColor || "#7C3AED") : "#7C3AED",
      institutionSecondaryColor: institutionObj ? (institutionObj.secondaryColor || "#06B6D4") : "#06B6D4",
      institutionEmail: institutionObj ? institutionObj.contactEmail : "",
      institutionPhone: institutionObj ? institutionObj.contactPhone : "",
      institutionAddress: institutionObj ? institutionObj.address : "",
      academicYear: institutionObj ? institutionObj.academicYear : "2026 - 2027",
      currentTerm: institutionObj ? institutionObj.currentTerm : "Semester 1",
      minAttendancePercent: institutionObj ? (institutionObj.minAttendancePercent || 75) : 75,
      gradingSystem: institutionObj ? (institutionObj.gradingSystem || "CBCS 10-Point CGPA") : "CBCS 10-Point CGPA",
      website: institutionObj ? (institutionObj.website || "") : "",
      username: user.username || user.email.split('@')[0],
      email: user.email,
      role: user.role,
      name: user.name,
      firstName: user.firstName || (user.name ? user.name.split(' ')[0] : ''),
      lastName: user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : ''),
      title: user.title || user.designation || (user.role === 'ADMIN' ? 'Dean of Academic Operations' : ''),
      designation: user.designation || user.title || (user.role === 'ADMIN' ? 'Dean of Academic Operations' : ''),
      phone: user.phone || (institutionObj ? institutionObj.contactPhone : '') || '',
      address: user.address || (institutionObj ? institutionObj.address : '') || '',
      qualification: user.qualification || '',
      specialization: user.specialization || '',
      experience: user.experience || '',
      joiningDate: user.joiningDate || '',
      dob: user.dob || user.dateOfBirth || '',
      gender: user.gender || '',
      officeCabin: user.officeCabin || '',
      linkedInUrl: user.linkedInUrl || '',
      bio: user.bio || '',
      avatar: user.avatar || user.profileImageUrl || null,
      profileImageUrl: user.profileImageUrl || user.avatar || null,
      department: user.department || (user.role === 'ADMIN' ? 'Institutional Administration' : ''),
      departmentId: user.departmentId || '',
      studentId: user.studentId,
      rollNumber: user.rollNumber,
      registerNumber: user.registerNumber,
      teacherId: user.teacherId,
      employeeId: user.employeeId || (user.role === 'ADMIN' ? (user.adminCode || 'ADM-HQ-001') : ''),
      assignedClasses: assignedClasses,
      status: user.status
    };

    // Log successful login audit
    this.logAudit({
      institutionId: userInstId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      role: user.role,
      action: 'USER_LOGIN',
      resource: 'AUTH',
      resourceId: user.id,
      details: `Successful authentication for ${user.email} (${user.role})`
    });

    return {
      success: true,
      token: `edumanage_jwt_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user: safeUser
    };
  }

  isTokenRevoked(token) {
    if (!token || typeof token !== 'string') return false;
    return this.revokedTokens.has(token.trim());
  }

  logout(token, user = null, requestedInstitutionId = null) {
    if (token && typeof token === 'string') {
      this.revokedTokens.add(token.trim());
    }

    const instId = (user && user.institutionId && user.institutionId !== 'system')
      ? user.institutionId
      : (requestedInstitutionId && requestedInstitutionId !== 'system' ? requestedInstitutionId : null);

    let safeInstitution = null;
    if (instId && (!user || user.role !== 'SUPER_ADMIN')) {
      const inst = this.getInstitutionById(instId);
      if (inst && inst.status === 'ACTIVE') {
        safeInstitution = {
          id: inst.id,
          name: inst.name,
          campusName: inst.campusName || 'Main Campus',
          code: inst.code,
          slug: inst.slug,
          institutionType: inst.institutionType || 'COLLEGE',
          status: inst.status,
          logoUrl: inst.logoUrl || null,
          tagline: inst.tagline || 'Smarter Campus. Stronger Futures.',
          accreditation: inst.accreditation,
          primaryColor: inst.primaryColor || '#7C3AED',
          secondaryColor: inst.secondaryColor || '#06B6D4'
        };
      }
    }

    if (user) {
      this.logAudit({
        institutionId: user.institutionId || instId || 'system',
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        role: user.role,
        action: 'USER_LOGOUT',
        resource: 'AUTH',
        resourceId: user.id,
        details: `Session terminated for ${user.email || user.id} (${user.role})`
      });
    }

    return {
      success: true,
      institution: safeInstitution,
      role: user?.role || null
    };
  }

  getUsers() {
    return this.users;
  }

  updateAdminProfile(identifier, updateData, requestingUser = null) {
    if (!requestingUser || requestingUser.role !== 'ADMIN') {
      throw new Error('FORBIDDEN: Only authorized administrators/deans can update admin profile.');
    }

    const idLower = (identifier || '').trim().toLowerCase();
    const user = this.users.find(u =>
      u.institutionId === requestingUser.institutionId &&
      u.role === 'ADMIN' &&
      (
        (u.id && u.id.toLowerCase() === idLower) ||
        (u.username && u.username.toLowerCase() === idLower) ||
        (u.email && u.email.toLowerCase() === idLower) ||
        idLower === 'admin' || idLower === 'admin-root' || !idLower
      )
    ) || this.users.find(u => u.id === requestingUser.id);

    if (!user) {
      throw new Error('Administrator account not found.');
    }

    // Strict tenant & role protection: Admin cannot change role or institutionId
    if (user.institutionId !== requestingUser.institutionId) {
      throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot modify profile of another institution.');
    }
    if (updateData.role && updateData.role !== 'ADMIN') {
      throw new Error('FORBIDDEN: Administrative role privilege cannot be modified via profile edit.');
    }
    if (updateData.institutionId && updateData.institutionId !== user.institutionId) {
      throw new Error('FORBIDDEN: Institution ownership and tenant binding cannot be altered via profile edit.');
    }

    // Check email uniqueness if email is changed
    if (updateData.email && updateData.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const emailExists = this.users.some(u => u.id !== user.id && u.email?.toLowerCase() === updateData.email.trim().toLowerCase());
      if (emailExists) {
        throw new Error('This email is already registered to another account.');
      }
      user.email = updateData.email.trim().toLowerCase();
    }

    if (updateData.username && updateData.username.trim()) {
      user.username = updateData.username.trim();
    }
    if (updateData.name && updateData.name.trim()) {
      user.name = updateData.name.trim();
      const parts = user.name.split(' ');
      user.firstName = updateData.firstName || parts[0] || '';
      user.lastName = updateData.lastName || parts.slice(1).join(' ') || '';
    } else if (updateData.firstName !== undefined || updateData.lastName !== undefined) {
      if (updateData.firstName !== undefined) user.firstName = String(updateData.firstName).trim();
      if (updateData.lastName !== undefined) user.lastName = String(updateData.lastName).trim();
      const combined = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      if (combined) user.name = combined;
    }

    if (updateData.title !== undefined) {
      user.title = String(updateData.title).trim();
      user.designation = user.title;
    } else if (updateData.designation !== undefined) {
      user.designation = String(updateData.designation).trim();
      user.title = user.designation;
    }

    if (updateData.phone !== undefined) user.phone = String(updateData.phone).trim();
    if (updateData.address !== undefined) user.address = String(updateData.address).trim();
    if (updateData.department !== undefined) user.department = String(updateData.department).trim();
    if (updateData.departmentId !== undefined) user.departmentId = String(updateData.departmentId).trim();
    if (updateData.employeeId !== undefined) user.employeeId = String(updateData.employeeId).trim();
    if (updateData.qualification !== undefined) user.qualification = String(updateData.qualification).trim();
    if (updateData.specialization !== undefined) user.specialization = String(updateData.specialization).trim();
    if (updateData.experience !== undefined) user.experience = String(updateData.experience).trim();
    if (updateData.joiningDate !== undefined) user.joiningDate = String(updateData.joiningDate).trim();
    if (updateData.dob !== undefined) user.dob = String(updateData.dob).trim();
    if (updateData.dateOfBirth !== undefined && updateData.dob === undefined) user.dob = String(updateData.dateOfBirth).trim();
    if (updateData.gender !== undefined) user.gender = String(updateData.gender).trim();
    if (updateData.officeCabin !== undefined) user.officeCabin = String(updateData.officeCabin).trim();
    if (updateData.linkedInUrl !== undefined) user.linkedInUrl = String(updateData.linkedInUrl).trim();
    if (updateData.bio !== undefined) user.bio = String(updateData.bio).trim();

    if (updateData.avatar !== undefined) {
      user.avatar = updateData.avatar;
      user.profileImageUrl = updateData.avatar;
    }
    if (updateData.profileImageUrl !== undefined) {
      user.profileImageUrl = updateData.profileImageUrl;
      user.avatar = updateData.profileImageUrl;
    }

    this.saveToDisk();

    const institutionObj = this.institutions.find(i => i.id === user.institutionId);

    const safeUser = {
      id: user.id,
      institutionId: user.institutionId,
      institutionName: institutionObj ? institutionObj.name : "ACADIVEX Campus",
      campusName: institutionObj ? (institutionObj.campusName || "Main Campus") : "Main Campus",
      institutionCampusName: institutionObj ? (institutionObj.campusName || "Main Campus") : "Main Campus",
      institutionCode: institutionObj ? institutionObj.code : "ACADIVEX",
      institutionLogo: institutionObj ? (institutionObj.logoUrl || null) : null,
      institutionType: institutionObj ? (institutionObj.institutionType || "COLLEGE") : "COLLEGE",
      institutionTagline: institutionObj ? (institutionObj.tagline || "") : "",
      institutionAccreditation: institutionObj ? (institutionObj.accreditation || "") : "",
      institutionPrimaryColor: institutionObj ? (institutionObj.primaryColor || "#7C3AED") : "#7C3AED",
      institutionSecondaryColor: institutionObj ? (institutionObj.secondaryColor || "#06B6D4") : "#06B6D4",
      institutionEmail: institutionObj ? institutionObj.contactEmail : "",
      institutionPhone: institutionObj ? institutionObj.contactPhone : "",
      institutionAddress: institutionObj ? institutionObj.address : "",
      academicYear: institutionObj ? institutionObj.academicYear : "2026 - 2027",
      currentTerm: institutionObj ? institutionObj.currentTerm : "Semester 1",
      username: user.username || user.email.split('@')[0],
      email: user.email,
      role: user.role,
      name: user.name,
      firstName: user.firstName || (user.name ? user.name.split(' ')[0] : ''),
      lastName: user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : ''),
      title: user.title || "Dean of Academic Operations",
      designation: user.designation || user.title || "Dean of Academic Operations",
      phone: user.phone || "",
      address: user.address || "",
      qualification: user.qualification || "",
      specialization: user.specialization || "",
      experience: user.experience || "",
      joiningDate: user.joiningDate || "",
      dob: user.dob || "",
      gender: user.gender || "",
      officeCabin: user.officeCabin || "",
      linkedInUrl: user.linkedInUrl || "",
      bio: user.bio || "",
      employeeId: user.employeeId || "ADM-HQ-001",
      avatar: user.avatar || user.profileImageUrl || null,
      profileImageUrl: user.profileImageUrl || user.avatar || null,
      department: user.department || "Institutional Administration",
      departmentId: user.departmentId || "",
      status: user.status
    };

    return safeUser;
  }

  changePassword(identifier, currentPassword, newPassword, requestingUser = null) {
    const idLower = identifier.trim().toLowerCase();
    const user = this.users.find(u =>
      (u.id && u.id.toLowerCase() === idLower) ||
      (u.username && u.username.toLowerCase() === idLower) ||
      (u.email && u.email.toLowerCase() === idLower) ||
      (u.studentId && u.studentId.toLowerCase() === idLower) ||
      (u.teacherId && u.teacherId.toLowerCase() === idLower) ||
      (u.rollNumber && u.rollNumber.toLowerCase() === idLower) ||
      (u.registerNumber && u.registerNumber.toLowerCase() === idLower)
    );

    if (!user) {
      return { success: false, message: 'User account not found.' };
    }

    // Student, Faculty, or Admin can only change their OWN password unless requestingUser is Admin
    if (requestingUser) {
      if (requestingUser.role === 'STUDENT') {
        if (user.id !== requestingUser.id && user.studentId !== requestingUser.studentId && user.email?.toLowerCase() !== requestingUser.email?.toLowerCase()) {
          return { success: false, message: 'Permission Denied: Students may only change their own password.' };
        }
      } else if (requestingUser.role === 'TEACHER') {
        if (user.id !== requestingUser.id && user.teacherId !== requestingUser.teacherId && user.email?.toLowerCase() !== requestingUser.email?.toLowerCase()) {
          return { success: false, message: 'Permission Denied: Faculty may only change their own password.' };
        }
      }
    }

    let isCurrentValid = false;
    const storedHash = user.passwordHash || user.password;
    if (storedHash && String(storedHash).startsWith('$2')) {
      try {
        isCurrentValid = bcrypt.compareSync(currentPassword, storedHash);
      } catch (e) {
        isCurrentValid = false;
      }
    } else if (user.password && user.password === currentPassword) {
      isCurrentValid = true;
    }

    if (!isCurrentValid) {
      return { success: false, message: 'Current password does not match.' };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    user.password = newHash;
    user.passwordHash = newHash;
    this.saveToDisk();
    return { success: true, message: 'Password successfully updated.' };
  }

  // ==========================================
  // ACADEMIC & INSTITUTIONAL ENTITIES
  // ==========================================
  getDepartments(requestingUser = null) {
    let list = this.departments;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      list = list.filter(d => (d.institutionId || 'inst-001') === tenantId);
    }
    return list.map(d => {
      const tenantId = d.institutionId || 'inst-001';
      const dynFaculty = this.teachers.filter(t =>
        (t.institutionId || 'inst-001') === tenantId &&
        t.status !== 'INACTIVE' &&
        (t.departmentId === d.id || (t.department && (t.department === d.name || t.department === d.code)))
      ).length;
      const dynStudents = this.students.filter(s =>
        (s.institutionId || 'inst-001') === tenantId &&
        s.status !== 'INACTIVE' &&
        (s.departmentId === d.id || s.branch === d.name || s.branchCode === d.code || s.department === d.name)
      ).length;
      return {
        ...d,
        facultyCount: dynFaculty > 0 ? dynFaculty : (parseInt(d.facultyCount) || 0),
        studentCount: dynStudents > 0 ? dynStudents : (parseInt(d.studentCount) || 0)
      };
    });
  }
  createDepartment(data, requestingUser = null) {
    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (data.institutionId || 'inst-001');

    const newDept = {
      id: `dept-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
      institutionId: institutionId,
      name: (data.name || '').trim(),
      code: (data.code || (data.name ? data.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() : "DEPT")).trim().toUpperCase(),
      hod: (data.hod || "To Be Appointed").trim(),
      facultyCount: parseInt(data.facultyCount) || 0,
      studentCount: parseInt(data.studentCount) || 0,
      established: data.established || new Date().getFullYear().toString(),
      building: (data.building || "Main Academic Block").trim(),
      email: (data.email || "").trim(),
      phone: (data.phone || "").trim(),
      description: (data.description || "").trim()
    };
    this.departments.push(newDept);
    this.saveToDisk();
    return newDept;
  }
  updateDepartment(id, data, requestingUser = null) {
    const idx = this.departments.findIndex(d => d.id === id);
    if (idx === -1) return null;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.departments[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot update department of another institution.');
      }
    }
    const cur = this.departments[idx];
    this.departments[idx] = {
      ...cur,
      ...data,
      id: cur.id,
      institutionId: cur.institutionId,
      name: data.name !== undefined ? String(data.name).trim() : cur.name,
      code: data.code !== undefined ? String(data.code).trim().toUpperCase() : cur.code
    };
    this.saveToDisk();
    return this.departments[idx];
  }
  deleteDepartment(id, requestingUser = null) {
    const idx = this.departments.findIndex(d => d.id === id);
    if (idx === -1) return false;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.departments[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot delete department of another institution.');
      }
    }
    this.departments.splice(idx, 1);
    this.saveToDisk();
    return true;
  }

  getCourses(requestingUser = null) {
    let list = this.courses;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      list = list.filter(c => (c.institutionId || 'inst-001') === tenantId);
    }
    return list.map(c => {
      const dept = this.departments.find(d => d.id === c.departmentId || d.name === c.department || d.code === c.department);
      return {
        ...c,
        department: dept ? dept.name : (c.department || 'Academic Department'),
        departmentCode: dept ? dept.code : (c.departmentCode || '')
      };
    });
  }
  createCourse(data, requestingUser = null) {
    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (data.institutionId || 'inst-001');

    const dept = this.departments.find(d =>
      (d.institutionId || 'inst-001') === institutionId &&
      (d.id === data.departmentId || d.name === data.department || d.code === data.departmentId)
    );

    const newCourse = {
      id: `crs-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
      institutionId: institutionId,
      name: (data.name || '').trim(),
      code: (data.code || "CRS").trim().toUpperCase(),
      degree: (data.degree || "B.Tech").trim(),
      departmentId: dept ? dept.id : (data.departmentId || ""),
      department: dept ? dept.name : (data.department || "General Department"),
      durationYears: parseInt(data.durationYears) || 4,
      totalSemesters: parseInt(data.totalSemesters) || 8,
      totalCredits: parseInt(data.totalCredits) || 160,
      annualFee: parseFloat(data.annualFee) || 0,
      intake: parseInt(data.intake) || 60,
      description: (data.description || "").trim(),
      status: data.status || "ACTIVE"
    };
    this.courses.push(newCourse);
    this.saveToDisk();
    return newCourse;
  }
  updateCourse(id, data, requestingUser = null) {
    const idx = this.courses.findIndex(c => c.id === id);
    if (idx === -1) return null;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.courses[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot modify course of another institution.');
      }
    }
    const cur = this.courses[idx];
    const dept = data.departmentId
      ? this.departments.find(d => d.id === data.departmentId || d.name === data.departmentId)
      : null;
    this.courses[idx] = {
      ...cur,
      ...data,
      id: cur.id,
      institutionId: cur.institutionId,
      departmentId: dept ? dept.id : (data.departmentId !== undefined ? data.departmentId : cur.departmentId),
      department: dept ? dept.name : (data.department !== undefined ? data.department : cur.department),
      durationYears: data.durationYears !== undefined ? (parseInt(data.durationYears) || 4) : cur.durationYears,
      totalSemesters: data.totalSemesters !== undefined ? (parseInt(data.totalSemesters) || 8) : cur.totalSemesters,
      totalCredits: data.totalCredits !== undefined ? (parseInt(data.totalCredits) || 160) : cur.totalCredits,
      annualFee: data.annualFee !== undefined ? (parseFloat(data.annualFee) || 0) : cur.annualFee,
      intake: data.intake !== undefined ? (parseInt(data.intake) || 60) : cur.intake
    };
    this.saveToDisk();
    return this.courses[idx];
  }
  deleteCourse(id, requestingUser = null) {
    const idx = this.courses.findIndex(c => c.id === id);
    if (idx === -1) return false;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.courses[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot delete course of another institution.');
      }
    }
    this.courses.splice(idx, 1);
    this.saveToDisk();
    return true;
  }

  getClasses(requestingUser = null) {
    let list = this.classes;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      list = list.filter(c => (c.institutionId || 'inst-001') === tenantId);
    }
    return list.map(c => {
      const tenantId = c.institutionId || 'inst-001';
      const dynStudents = this.students.filter(s =>
        (s.institutionId || 'inst-001') === tenantId &&
        s.status !== 'INACTIVE' &&
        (s.classId === c.id || s.className === c.name)
      ).length;
      const dept = this.departments.find(d => d.id === c.departmentId || d.name === c.department);
      const crs = this.courses.find(cr => cr.id === c.courseId || cr.name === c.courseName);
      return {
        ...c,
        department: dept ? dept.name : (c.department || 'Academic Department'),
        courseName: crs ? crs.name : (c.courseName || c.degree || ''),
        studentCount: dynStudents > 0 ? dynStudents : (parseInt(c.studentCount) || 0)
      };
    });
  }
  createClass(data, requestingUser = null) {
    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (data.institutionId || 'inst-001');

    const dept = this.departments.find(d =>
      (d.institutionId || 'inst-001') === institutionId &&
      (d.id === data.departmentId || d.name === data.department)
    );
    const crs = this.courses.find(c =>
      (c.institutionId || 'inst-001') === institutionId &&
      (c.id === data.courseId || c.name === data.courseName)
    );
    const tch = this.teachers.find(t =>
      (t.institutionId || 'inst-001') === institutionId &&
      (t.id === data.teacherId || `${t.firstName} ${t.lastName}` === data.advisor)
    );

    const newClass = {
      id: `cls-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
      institutionId: institutionId,
      name: (data.name || '').trim(),
      academicYear: data.academicYear || "2026 - 2027",
      year: parseInt(data.year) || Math.ceil((parseInt(data.semester) || 1) / 2),
      semester: parseInt(data.semester) || 1,
      section: (data.section || "A").trim().toUpperCase(),
      courseId: crs ? crs.id : (data.courseId || ""),
      courseName: crs ? crs.name : (data.courseName || data.degree || ""),
      degree: crs ? (crs.degree || crs.name) : (data.degree || "B.Tech"),
      branch: dept ? dept.code : (data.branch || "GEN"),
      departmentId: dept ? dept.id : (data.departmentId || ""),
      department: dept ? dept.name : (data.department || "General Department"),
      studentCount: parseInt(data.studentCount) || 0,
      capacity: parseInt(data.capacity) || 60,
      advisor: tch ? `${tch.firstName} ${tch.lastName}` : (data.advisor || "Unassigned"),
      teacherId: tch ? tch.id : (data.teacherId || ""),
      room: (data.room || "LH-101").trim()
    };
    this.classes.push(newClass);
    this.saveToDisk();
    return newClass;
  }
  updateClass(id, data, requestingUser = null) {
    const idx = this.classes.findIndex(c => c.id === id);
    if (idx === -1) return null;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.classes[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot modify class of another institution.');
      }
    }
    const cur = this.classes[idx];
    const dept = data.departmentId ? this.departments.find(d => d.id === data.departmentId || d.name === data.departmentId) : null;
    const crs = data.courseId ? this.courses.find(c => c.id === data.courseId || c.name === data.courseId) : null;
    const tch = data.teacherId ? this.teachers.find(t => t.id === data.teacherId) : null;
    this.classes[idx] = {
      ...cur,
      ...data,
      id: cur.id,
      institutionId: cur.institutionId,
      departmentId: dept ? dept.id : (data.departmentId !== undefined ? data.departmentId : cur.departmentId),
      department: dept ? dept.name : (data.department !== undefined ? data.department : cur.department),
      courseId: crs ? crs.id : (data.courseId !== undefined ? data.courseId : cur.courseId),
      courseName: crs ? crs.name : (data.courseName !== undefined ? data.courseName : cur.courseName),
      teacherId: tch ? tch.id : (data.teacherId !== undefined ? data.teacherId : cur.teacherId),
      advisor: tch ? `${tch.firstName} ${tch.lastName}` : (data.advisor !== undefined ? data.advisor : cur.advisor),
      semester: data.semester !== undefined ? (parseInt(data.semester) || 1) : cur.semester,
      year: data.year !== undefined ? (parseInt(data.year) || 1) : cur.year,
      capacity: data.capacity !== undefined ? (parseInt(data.capacity) || 60) : cur.capacity
    };
    this.saveToDisk();
    return this.classes[idx];
  }
  deleteClass(id, requestingUser = null) {
    const idx = this.classes.findIndex(c => c.id === id);
    if (idx === -1) return false;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.classes[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot delete class of another institution.');
      }
    }
    this.classes.splice(idx, 1);
    this.saveToDisk();
    return true;
  }

  getSubjects(requestingUser = null) {
    let list = this.subjects;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      list = list.filter(s => (s.institutionId || 'inst-001') === tenantId);
    }
    return list.map(s => {
      const crs = this.courses.find(c => c.id === s.courseId || c.name === s.courseName);
      const dept = this.departments.find(d => d.id === s.departmentId || d.name === s.department || (crs && d.id === crs.departmentId));
      return {
        ...s,
        courseName: crs ? crs.name : (s.courseName || ''),
        courseCode: crs ? crs.code : (s.courseCode || ''),
        department: dept ? dept.name : (s.department || 'Academic Department')
      };
    });
  }
  createSubject(data, requestingUser = null) {
    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (data.institutionId || 'inst-001');

    const crs = this.courses.find(c =>
      (c.institutionId || 'inst-001') === institutionId &&
      (c.id === data.courseId || c.name === data.courseName)
    );
    const dept = this.departments.find(d =>
      (d.institutionId || 'inst-001') === institutionId &&
      (d.id === data.departmentId || d.name === data.department || (crs && d.id === crs.departmentId))
    );
    const tch = this.teachers.find(t =>
      (t.institutionId || 'inst-001') === institutionId &&
      (t.id === data.teacherId || `${t.firstName} ${t.lastName}` === data.teacher)
    );

    const newSub = {
      id: `sub-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
      institutionId: institutionId,
      name: (data.name || '').trim(),
      code: (data.code || "SUB101").trim().toUpperCase(),
      credits: parseInt(data.credits) || 4,
      category: data.category || "Core Theory",
      courseId: crs ? crs.id : (data.courseId || ""),
      courseName: crs ? crs.name : (data.courseName || ""),
      departmentId: dept ? dept.id : (data.departmentId || ""),
      department: dept ? dept.name : (data.department || "Academic Department"),
      semester: parseInt(data.semester) || 1,
      teacherId: tch ? tch.id : (data.teacherId || ""),
      teacher: tch ? `${tch.firstName} ${tch.lastName}` : (data.teacher || "Assigned Faculty")
    };
    this.subjects.push(newSub);
    this.saveToDisk();
    return newSub;
  }
  updateSubject(id, data, requestingUser = null) {
    const idx = this.subjects.findIndex(s => s.id === id);
    if (idx === -1) return null;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.subjects[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot modify subject of another institution.');
      }
    }
    const cur = this.subjects[idx];
    const crs = data.courseId ? this.courses.find(c => c.id === data.courseId || c.name === data.courseId) : null;
    const dept = data.departmentId ? this.departments.find(d => d.id === data.departmentId || d.name === data.departmentId) : null;
    const tch = data.teacherId ? this.teachers.find(t => t.id === data.teacherId) : null;
    this.subjects[idx] = {
      ...cur,
      ...data,
      id: cur.id,
      institutionId: cur.institutionId,
      courseId: crs ? crs.id : (data.courseId !== undefined ? data.courseId : cur.courseId),
      courseName: crs ? crs.name : (data.courseName !== undefined ? data.courseName : cur.courseName),
      departmentId: dept ? dept.id : (data.departmentId !== undefined ? data.departmentId : cur.departmentId),
      department: dept ? dept.name : (data.department !== undefined ? data.department : cur.department),
      teacherId: tch ? tch.id : (data.teacherId !== undefined ? data.teacherId : cur.teacherId),
      teacher: tch ? `${tch.firstName} ${tch.lastName}` : (data.teacher !== undefined ? data.teacher : cur.teacher),
      credits: data.credits !== undefined ? (parseInt(data.credits) || 4) : cur.credits,
      semester: data.semester !== undefined ? (parseInt(data.semester) || 1) : cur.semester
    };
    this.saveToDisk();
    return this.subjects[idx];
  }
  deleteSubject(id, requestingUser = null) {
    const idx = this.subjects.findIndex(s => s.id === id);
    if (idx === -1) return false;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.subjects[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot delete subject of another institution.');
      }
    }
    this.subjects.splice(idx, 1);
    this.saveToDisk();
    return true;
  }

  // Attendance
  recalculateStudentAttendance(studentId) {
    const studentRecords = this.attendanceRecords.filter(a => a.studentId === studentId);
    const std = this.students.find(s => s.id === studentId);
    if (!std) return;
    if (studentRecords.length === 0) {
      std.attendancePercentage = 100;
      std.examEligibility = 'ELIGIBLE';
      return;
    }
    const presentCount = studentRecords.filter(a => ['PRESENT', 'ON_DUTY', 'LATE'].includes((a.status || '').toUpperCase())).length;
    const pct = parseFloat(((presentCount / studentRecords.length) * 100).toFixed(1));
    std.attendancePercentage = pct;
    if (pct >= 75) std.examEligibility = 'ELIGIBLE';
    else if (pct >= 65) std.examEligibility = 'CONDONATION';
    else std.examEligibility = 'DETAINED';
  }

  resolveTeacherAllowedClasses(requestingUser) {
    if (!requestingUser || requestingUser.role !== 'TEACHER') return null;
    const teacher = this.teachers.find(t =>
      t.id === requestingUser.teacherId ||
      t.userId === requestingUser.id ||
      (t.email && requestingUser.email && t.email.toLowerCase() === requestingUser.email.toLowerCase()) ||
      (t.employeeId && requestingUser.username && t.employeeId.toLowerCase() === requestingUser.username.toLowerCase())
    );
    const classes = new Set();
    if (teacher && Array.isArray(teacher.assignedClasses)) {
      teacher.assignedClasses.forEach(c => classes.add(String(c).trim().toLowerCase()));
    }
    if (Array.isArray(requestingUser.assignedClasses)) {
      requestingUser.assignedClasses.forEach(c => classes.add(String(c).trim().toLowerCase()));
    }
    if (teacher) {
      this.classes.forEach(c => {
        if (c.teacherId === teacher.id || (classes.size === 0 && c.departmentId && c.departmentId === teacher.departmentId)) {
          classes.add(String(c.name).trim().toLowerCase());
        }
      });
    }
    return { teacher, allowedClasses: classes };
  }

  getAttendance(dateOrFilters, className, requestingUser = null) {
    let filters = {};
    let reqUser = requestingUser;
    if (dateOrFilters && typeof dateOrFilters === 'object' && !Array.isArray(dateOrFilters)) {
      filters = dateOrFilters;
      reqUser = className || requestingUser;
    } else {
      filters = { date: dateOrFilters, className };
    }

    let list = this.attendanceRecords;
    if (reqUser && reqUser.role !== 'SUPER_ADMIN') {
      const tenantId = reqUser.institutionId || 'inst-001';
      list = list.filter(a => (a.institutionId || 'inst-001') === tenantId);
    }

    const enriched = list.map(att => {
      const std = this.students.find(s => s.id === att.studentId || (att.rollNumber && s.rollNumber === att.rollNumber));
      const cls = this.classes.find(c =>
        ((c.institutionId || 'inst-001') === (att.institutionId || 'inst-001')) &&
        (c.id === att.classId || c.name === att.className || c.name === att.class)
      );
      return {
        ...att,
        studentName: att.studentName || (std ? `${std.firstName} ${std.lastName || ''}`.trim() : 'Student'),
        rollNumber: att.rollNumber || (std ? std.rollNumber : ''),
        registerNumber: att.registerNumber || (std ? std.registerNumber : ''),
        department: att.department || (std ? (std.departmentName || std.branch || std.department?.name) : (cls ? cls.department : '')),
        departmentId: att.departmentId || (std ? std.departmentId : (cls ? cls.departmentId : '')),
        academicYear: att.academicYear || (cls ? cls.academicYear : '2026 - 2027'),
        semester: Number(att.semester || (std ? std.semester : (cls ? cls.semester : 1))),
        className: att.className || att.class || (std ? std.className : 'General Batch'),
        class: att.class || att.className || (std ? std.className : 'General Batch'),
        subject: att.subject || 'General Session',
        session: att.session || att.period || 'Period 1 (FN)',
        source: att.source || (att.biometricId ? 'BIOMETRIC' : 'MANUAL'),
        status: (att.status || 'PRESENT').toUpperCase(),
        auditHistory: Array.isArray(att.auditHistory) ? att.auditHistory : []
      };
    });

    return enriched.filter(att => {
      let match = true;
      if (filters.date) {
        match = match && att.date === filters.date;
      }
      if (filters.academicYear && filters.academicYear !== 'ALL') {
        match = match && String(att.academicYear || '').toLowerCase() === String(filters.academicYear).toLowerCase();
      }
      if (filters.semester && filters.semester !== 'ALL') {
        match = match && String(att.semester) === String(filters.semester);
      }
      if (filters.department && filters.department !== 'ALL') {
        const dFilter = String(filters.department).toLowerCase();
        match = match && (
          String(att.department || '').toLowerCase().includes(dFilter) ||
          String(att.departmentId || '').toLowerCase() === dFilter
        );
      }
      if (filters.className && filters.className !== 'ALL') {
        const cFilter = String(filters.className).toLowerCase();
        match = match && (
          String(att.class || '').toLowerCase() === cFilter ||
          String(att.className || '').toLowerCase() === cFilter ||
          String(att.classId || '').toLowerCase() === cFilter
        );
      }
      if (filters.subject && filters.subject !== 'ALL') {
        const sFilter = String(filters.subject).toLowerCase();
        match = match && (
          String(att.subject || '').toLowerCase().includes(sFilter) ||
          String(att.subjectCode || '').toLowerCase() === sFilter
        );
      }
      if (filters.session && filters.session !== 'ALL') {
        const sesFilter = String(filters.session).toLowerCase();
        match = match && String(att.session || '').toLowerCase().includes(sesFilter);
      }
      if (filters.studentId) {
        match = match && (
          att.studentId === filters.studentId ||
          att.rollNumber === filters.studentId ||
          att.registerNumber === filters.studentId
        );
      }
      if (filters.search) {
        const q = String(filters.search).toLowerCase().trim();
        match = match && (
          String(att.studentName || '').toLowerCase().includes(q) ||
          String(att.rollNumber || '').toLowerCase().includes(q) ||
          String(att.registerNumber || '').toLowerCase().includes(q) ||
          String(att.studentId || '').toLowerCase().includes(q) ||
          String(att.subject || '').toLowerCase().includes(q)
        );
      }
      return match;
    });
  }

  markAttendance(records, requestingUser = null) {
    if (requestingUser && requestingUser.role === 'STUDENT') {
      throw new Error('FORBIDDEN_STUDENT_ATTENDANCE: Students are not authorized to record or modify attendance.');
    }

    const tenantId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : 'inst-001';

    const teacherAuth = this.resolveTeacherAllowedClasses(requestingUser);

    const savedRecords = [];
    records.forEach(rec => {
      const std = this.students.find(s =>
        ((s.institutionId || 'inst-001') === tenantId) &&
        (s.id === rec.studentId || s.rollNumber === rec.studentId || s.registerNumber === rec.studentId)
      );
      const resolvedStudentId = std ? std.id : rec.studentId;
      const clsObj = rec.classId ? this.classes.find(c => c.id === rec.classId) : null;
      const subjectKey = String(rec.subject || rec.subjectId || rec.subjectCode || 'General Session').trim();
      const classKey = String(rec.className || rec.class || (clsObj ? clsObj.name : '') || (std ? std.className : 'General Batch')).trim();
      const dateKey = rec.date || new Date().toISOString().split('T')[0];
      const sessionKey = String(rec.session || rec.period || 'Period 1 (FN)').trim();
      const newStatus = String(rec.status || 'PRESENT').toUpperCase();

      // Faculty authorization check: Teacher can only manage attendance for their permitted classes or mentees
      if (teacherAuth && teacherAuth.allowedClasses.size > 0) {
        const isAllowedClass = teacherAuth.allowedClasses.has(classKey.toLowerCase()) ||
          (std && std.className && teacherAuth.allowedClasses.has(String(std.className).toLowerCase())) ||
          (std && teacherAuth.teacher && std.teacherId === teacherAuth.teacher.id);
        if (!isAllowedClass) {
          throw new Error(`FORBIDDEN_TEACHER_ATTENDANCE: You are not authorized to mark attendance for class batch "${classKey}".`);
        }
      }

      // Match existing record on (studentId, date, subject, className, session) to prevent duplicate entries
      const existingIdx = this.attendanceRecords.findIndex(a => {
        if ((a.institutionId || 'inst-001') !== tenantId) return false;
        if (a.studentId !== resolvedStudentId) return false;
        if (a.date !== dateKey) return false;
        const aSub = String(a.subject || 'General Session').trim().toLowerCase();
        const aCls = String(a.className || a.class || (std ? std.className : 'General Batch')).trim().toLowerCase();
        const aSes = String(a.session || a.period || 'Period 1 (FN)').trim().toLowerCase();
        const subMatches = aSub === subjectKey.toLowerCase() || (a.subjectCode && rec.subjectCode && a.subjectCode.toLowerCase() === rec.subjectCode.toLowerCase());
        const clsMatches = aCls === classKey.toLowerCase() || classKey === 'All Batches' || aCls === 'all batches';
        const sesMatches = aSes === sessionKey.toLowerCase();
        return subMatches && clsMatches && sesMatches;
      });

      const actorName = requestingUser ? (requestingUser.name || requestingUser.email) : 'Administrator';
      const nowIso = new Date().toISOString();

      if (existingIdx !== -1) {
        const existing = this.attendanceRecords[existingIdx];
        const isBiometric = existing.source === 'BIOMETRIC' || Boolean(existing.biometricId || existing.biometricDevice || existing.biometricTime);

        // Preserve biometric records if an unrelated bulk manual submission didn't explicitly override them
        if (isBiometric && rec.source !== 'BIOMETRIC' && !rec.forceOverride && existing.status === newStatus) {
          savedRecords.push(existing);
          this.recalculateStudentAttendance(resolvedStudentId);
          return;
        }

        const auditHistory = Array.isArray(existing.auditHistory) ? [...existing.auditHistory] : [];
        if (existing.status !== newStatus) {
          auditHistory.push({
            previousStatus: existing.status,
            newStatus: newStatus,
            updatedBy: actorName,
            updatedAt: nowIso,
            source: rec.source || (isBiometric ? 'BIOMETRIC_MANUAL_OVERRIDE' : 'MANUAL'),
            remarks: rec.remarks || (isBiometric ? 'Manual faculty/admin override on biometric log' : 'Attendance status updated')
          });
        }

        this.attendanceRecords[existingIdx] = {
          ...existing,
          studentName: rec.studentName || existing.studentName || (std ? `${std.firstName} ${std.lastName || ''}`.trim() : 'Student'),
          rollNumber: rec.rollNumber || existing.rollNumber || (std ? std.rollNumber : ''),
          registerNumber: rec.registerNumber || existing.registerNumber || (std ? std.registerNumber : ''),
          department: rec.department || existing.department || (std ? (std.departmentName || std.branch) : ''),
          departmentId: rec.departmentId || existing.departmentId || (std ? std.departmentId : ''),
          semester: Number(rec.semester || existing.semester || (std ? std.semester : 1)),
          academicYear: rec.academicYear || existing.academicYear || '2026 - 2027',
          class: classKey,
          className: classKey,
          subject: subjectKey,
          subjectCode: rec.subjectCode || existing.subjectCode || (subjectKey.includes(' - ') ? subjectKey.split(' - ')[0].trim() : ''),
          session: sessionKey,
          status: newStatus,
          remarks: rec.remarks !== undefined ? rec.remarks : existing.remarks,
          // Preserve biometric fields and audit history
          biometricVerified: Boolean(existing.biometricVerified || isBiometric || rec.biometricVerified),
          biometricId: existing.biometricId || rec.biometricId || null,
          biometricDeviceId: existing.biometricDeviceId || existing.biometricDevice || rec.biometricDeviceId || rec.biometricDevice || null,
          biometricDevice: existing.biometricDevice || existing.biometricDeviceId || rec.biometricDevice || rec.biometricDeviceId || null,
          biometricTimestamp: existing.biometricTimestamp || existing.biometricTime || rec.biometricTimestamp || rec.biometricTime || null,
          biometricTime: existing.biometricTime || existing.biometricTimestamp || rec.biometricTime || rec.biometricTimestamp || null,
          source: isBiometric ? (existing.status !== newStatus ? 'BIOMETRIC_MANUAL_OVERRIDE' : 'BIOMETRIC') : (rec.source || existing.source || 'MANUAL'),
          auditHistory,
          markedBy: actorName,
          updatedAt: nowIso
        };
        savedRecords.push(this.attendanceRecords[existingIdx]);
      } else {
        const isInitialBio = Boolean(rec.biometricVerified || rec.biometricId || rec.biometricDevice || rec.biometricTime || rec.source === 'BIOMETRIC');
        const created = {
          id: `att-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900 + 100)}`,
          institutionId: tenantId,
          studentId: resolvedStudentId,
          studentName: rec.studentName || (std ? `${std.firstName} ${std.lastName || ''}`.trim() : 'Student'),
          rollNumber: rec.rollNumber || (std ? std.rollNumber : ''),
          registerNumber: rec.registerNumber || (std ? std.registerNumber : ''),
          department: rec.department || (std ? (std.departmentName || std.branch) : ''),
          departmentId: rec.departmentId || (std ? std.departmentId : ''),
          semester: Number(rec.semester || (std ? std.semester : 1)),
          academicYear: rec.academicYear || '2026 - 2027',
          class: classKey,
          className: classKey,
          classId: rec.classId || (clsObj ? clsObj.id : '') || (std ? std.classId : ''),
          subject: subjectKey,
          subjectId: rec.subjectId || '',
          subjectCode: rec.subjectCode || (subjectKey.includes(' - ') ? subjectKey.split(' - ')[0].trim() : ''),
          session: sessionKey,
          date: dateKey,
          status: newStatus,
          remarks: rec.remarks || '',
          biometricVerified: isInitialBio,
          source: rec.source || (isInitialBio ? 'BIOMETRIC' : 'MANUAL'),
          biometricId: rec.biometricId || null,
          biometricDeviceId: rec.biometricDeviceId || rec.biometricDevice || null,
          biometricDevice: rec.biometricDevice || rec.biometricDeviceId || null,
          biometricTimestamp: rec.biometricTimestamp || rec.biometricTime || (isInitialBio ? nowIso : null),
          biometricTime: rec.biometricTime || rec.biometricTimestamp || (isInitialBio ? nowIso : null),
          auditHistory: [{
            previousStatus: null,
            newStatus: newStatus,
            updatedBy: actorName,
            updatedAt: nowIso,
            source: rec.source || (isInitialBio ? 'BIOMETRIC' : 'MANUAL'),
            remarks: 'Initial attendance entry'
          }],
          markedBy: actorName,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        this.attendanceRecords.unshift(created);
        savedRecords.push(created);
      }

      this.recalculateStudentAttendance(resolvedStudentId);
    });
    this.saveToDisk();
    return savedRecords;
  }

  updateAttendanceRecord(id, data, requestingUser = null) {
    if (requestingUser && requestingUser.role === 'STUDENT') {
      throw new Error('FORBIDDEN_STUDENT_ATTENDANCE: Students are not permitted to modify attendance records.');
    }

    const idx = this.attendanceRecords.findIndex(a => a.id === id);
    if (idx === -1) return null;
    const cur = this.attendanceRecords[idx];

    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((cur.institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot modify attendance of another institution.');
      }
    }

    // Faculty authorization check
    const teacherAuth = this.resolveTeacherAllowedClasses(requestingUser);
    if (teacherAuth && teacherAuth.allowedClasses.size > 0) {
      const std = this.students.find(s => s.id === cur.studentId);
      const recClass = String(cur.className || cur.class || (std ? std.className : '')).toLowerCase();
      const isAllowed = teacherAuth.allowedClasses.has(recClass) ||
        (std && std.className && teacherAuth.allowedClasses.has(String(std.className).toLowerCase())) ||
        (std && teacherAuth.teacher && std.teacherId === teacherAuth.teacher.id);
      if (!isAllowed) {
        throw new Error(`FORBIDDEN_TEACHER_ATTENDANCE: You are only permitted to modify attendance records for your assigned classes.`);
      }
    }

    const newStatus = data.status ? String(data.status).toUpperCase() : cur.status;
    const isBiometric = Boolean(cur.biometricVerified || cur.source === 'BIOMETRIC' || cur.source === 'BIOMETRIC_MANUAL_OVERRIDE' || cur.biometricId || cur.biometricDevice || cur.biometricTime);
    const actorName = requestingUser ? (requestingUser.name || requestingUser.email) : 'Administrator';
    const nowIso = new Date().toISOString();

    const auditHistory = Array.isArray(cur.auditHistory) ? [...cur.auditHistory] : [];
    if (cur.status !== newStatus) {
      auditHistory.push({
        previousStatus: cur.status,
        newStatus: newStatus,
        updatedBy: actorName,
        updatedAt: nowIso,
        source: isBiometric ? 'BIOMETRIC_MANUAL_OVERRIDE' : 'MANUAL',
        remarks: data.remarks || (isBiometric ? 'Authorized status override on biometric record' : 'Individual status update')
      });
    }

    this.attendanceRecords[idx] = {
      ...cur,
      ...data,
      id: cur.id,
      institutionId: cur.institutionId,
      studentId: cur.studentId,
      status: newStatus,
      // Never wipe out original biometric metadata
      biometricVerified: Boolean(cur.biometricVerified || isBiometric || data.biometricVerified),
      biometricId: cur.biometricId || data.biometricId || null,
      biometricDeviceId: cur.biometricDeviceId || cur.biometricDevice || data.biometricDeviceId || data.biometricDevice || null,
      biometricDevice: cur.biometricDevice || cur.biometricDeviceId || data.biometricDevice || data.biometricDeviceId || null,
      biometricTimestamp: cur.biometricTimestamp || cur.biometricTime || data.biometricTimestamp || data.biometricTime || null,
      biometricTime: cur.biometricTime || cur.biometricTimestamp || data.biometricTime || data.biometricTimestamp || null,
      source: isBiometric ? (cur.status !== newStatus ? 'BIOMETRIC_MANUAL_OVERRIDE' : cur.source) : (cur.source || 'MANUAL'),
      auditHistory,
      markedBy: actorName,
      updatedAt: nowIso
    };
    this.recalculateStudentAttendance(cur.studentId);
    this.saveToDisk();
    return this.attendanceRecords[idx];
  }

  deleteAttendanceRecord(id, requestingUser = null) {
    if (requestingUser && requestingUser.role === 'STUDENT') {
      throw new Error('FORBIDDEN_STUDENT_ATTENDANCE: Students cannot delete attendance records.');
    }
    const idx = this.attendanceRecords.findIndex(a => a.id === id);
    if (idx === -1) return false;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.attendanceRecords[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot delete attendance of another institution.');
      }
    }
    const studentId = this.attendanceRecords[idx].studentId;
    this.attendanceRecords.splice(idx, 1);
    if (studentId) this.recalculateStudentAttendance(studentId);
    this.saveToDisk();
    return true;
  }

  // Exams
  getExams(requestingUser = null) {
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      return this.exams.filter(e => (e.institutionId || 'inst-001') === tenantId);
    }
    return this.exams;
  }
  createExam(examData, requestingUser = null) {
    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (examData.institutionId || 'inst-001');

    const newExam = {
      id: `exm-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
      institutionId: institutionId,
      title: (examData.title || examData.subject || 'University Examination').trim(),
      examName: (examData.examName || examData.examType || examData.type || 'End-Semester Examination').trim(),
      examType: (examData.examType || examData.type || 'End-Semester Theory').trim(),
      subject: (examData.subject || examData.title || '').trim(),
      subjectCode: (examData.subjectCode || 'EXM101').trim().toUpperCase(),
      courseId: examData.courseId || '',
      courseName: examData.courseName || '',
      department: examData.department || '',
      semester: parseInt(examData.semester) || 1,
      credits: parseInt(examData.credits) || 4,
      className: examData.className || '',
      type: examData.type || examData.examType || 'END_SEMESTER',
      date: examData.date,
      session: examData.session || 'FN (09:30 AM - 12:30 PM)',
      time: examData.time || examData.session || '09:30 AM - 12:30 PM',
      venue: (examData.venue || examData.room || 'Main Examination Hall').trim(),
      room: (examData.room || examData.venue || 'Main Examination Hall').trim(),
      maxMarks: parseInt(examData.maxMarks) || 100,
      passMarks: parseInt(examData.passMarks || examData.passingMarks) || 40,
      passingMarks: parseInt(examData.passingMarks || examData.passMarks) || 40,
      status: examData.status || 'SCHEDULED'
    };
    this.exams.unshift(newExam);
    this.saveToDisk();
    return newExam;
  }
  updateExam(id, examData, requestingUser = null) {
    const idx = this.exams.findIndex(e => e.id === id);
    if (idx === -1) return null;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.exams[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot modify exam of another institution.');
      }
    }
    const cur = this.exams[idx];
    this.exams[idx] = {
      ...cur,
      ...examData,
      id: cur.id,
      institutionId: cur.institutionId,
      title: examData.title !== undefined ? examData.title : cur.title,
      subject: examData.subject !== undefined ? examData.subject : (examData.title || cur.subject),
      venue: examData.venue || examData.room || cur.venue,
      room: examData.room || examData.venue || cur.room
    };
    this.saveToDisk();
    return this.exams[idx];
  }
  deleteExam(id, requestingUser = null) {
    const idx = this.exams.findIndex(e => e.id === id);
    if (idx === -1) return false;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.exams[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot delete exam of another institution.');
      }
    }
    this.exams.splice(idx, 1);
    this.saveToDisk();
    return true;
  }
  getExamResults(filtersOrUser = null, requestingUser = null) {
    let reqUser = requestingUser;
    let filters = {};
    if (filtersOrUser && !requestingUser && (filtersOrUser.role || filtersOrUser.institutionId)) {
      reqUser = filtersOrUser;
    } else if (filtersOrUser && typeof filtersOrUser === 'object') {
      filters = filtersOrUser;
    }

    const tenantId = (reqUser && reqUser.role !== 'SUPER_ADMIN')
      ? (reqUser.institutionId || 'inst-001')
      : null;
    const results = [];
    this.academicTranscripts.forEach(tr => {
      if (tenantId && (tr.institutionId || 'inst-001') !== tenantId) return;
      if (filters.studentId && tr.studentId !== filters.studentId) return;
      const std = this.students.find(s => s.id === tr.studentId);
      (tr.courses || []).forEach(c => {
        if (filters.subjectCode && c.code !== filters.subjectCode) return;
        const resStatus = c.grade === 'RA' ? 'FAIL' : 'PASS';
        results.push({
          id: `${tr.studentId}_${c.code}`,
          studentId: tr.studentId,
          studentName: tr.studentName || (std ? `${std.firstName} ${std.lastName}`.trim() : 'Student'),
          rollNumber: tr.rollNumber || (std ? std.rollNumber : ''),
          registerNumber: tr.registerNumber || (std ? std.registerNumber : ''),
          semester: c.semester || (std ? std.semester : 1),
          subjectCode: c.code,
          subjectTitle: c.title,
          subjectName: c.title,
          credits: c.credits || 4,
          internalMarks: c.internalMarks !== undefined ? c.internalMarks : Math.round((c.marks || 0) * 0.4),
          externalMarks: c.externalMarks !== undefined ? c.externalMarks : Math.round((c.marks || 0) * 0.6),
          totalMarks: c.marks || 0,
          maxMarks: c.maxMarks || 100,
          grade: c.grade || 'B',
          gradePoint: c.gradePoint || 0,
          status: resStatus,
          resultStatus: resStatus,
          cgpa: tr.cgpa || 0
        });
      });
    });
    return results;
  }
  deleteExamResult(studentId, subjectCode, requestingUser = null) {
    const tr = this.academicTranscripts.find(t => t.studentId === studentId);
    if (!tr) return false;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((tr.institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot delete exam result of another institution.');
      }
    }
    const idx = (tr.courses || []).findIndex(c => c.code === subjectCode);
    if (idx === -1) return false;
    tr.courses.splice(idx, 1);

    const totalRegCredits = tr.courses.reduce((sum, c) => sum + (c.credits || 4), 0);
    const earnedCredits = tr.courses.filter(c => c.grade !== 'RA').reduce((sum, c) => sum + (c.credits || 4), 0);
    const weightedPoints = tr.courses.reduce((sum, c) => sum + ((c.gradePoint || 0) * (c.credits || 4)), 0);
    const computedGpa = totalRegCredits > 0 ? parseFloat((weightedPoints / totalRegCredits).toFixed(2)) : 0;
    tr.registeredCredits = totalRegCredits;
    tr.earnedCredits = earnedCredits;
    tr.sgpa = computedGpa;
    tr.cgpa = computedGpa;

    const rawStd = this.students.find(s => s.id === studentId);
    if (rawStd) {
      rawStd.sgpa = computedGpa;
      rawStd.cgpa = computedGpa;
      rawStd.creditsEarned = earnedCredits;
    }
    this.saveToDisk();
    return true;
  }

  // Hall Ticket
  getStudentHallTicket(studentId, requestingUser = null) {
    const student = this.getStudentById(studentId, requestingUser);
    if (!student) return null;

    const tenantId = student.institutionId || 'inst-001';
    const inst = this.institutions.find(i => i.id === tenantId) || {
      id: tenantId,
      name: 'ACADIVEX Institution',
      campusName: 'Main Campus',
      logoUrl: null,
      academicYear: '2026 - 2027'
    };

    const tenantExams = this.exams.filter(e =>
      (e.institutionId || 'inst-001') === tenantId &&
      (!e.className || !student.className || e.className === student.className)
    );

    const examList = tenantExams.map(e => ({
      code: e.subjectCode || e.code || 'EXM',
      subject: e.subject || e.title || 'Scheduled Examination',
      date: e.date || 'TBA',
      session: e.session || e.time || 'FN (09:30 AM - 12:30 PM)',
      hall: e.venue || 'Main Examination Hall',
      seatNo: `S-${(student.rollNumber || '001').slice(-3)}`
    }));

    const hasAttendanceRecords = this.attendanceRecords.some(a => a.studentId === student.id);
    const isEligible = !hasAttendanceRecords ? (student.examEligibility !== 'DETAINED') : (student.attendancePercentage >= 75);

    return {
      institution: inst,
      student,
      hallTicketNumber: `HT-${student.registerNumber || student.rollNumber}`,
      academicYear: inst.academicYear || "2026 - 2027",
      semester: `Semester ${student.semester || 1}`,
      examCenter: `${inst.name} • ${inst.campusName || 'Main Campus'}`,
      exams: examList,
      isEligible: isEligible,
      eligibilityStatus: isEligible
        ? "ELIGIBLE FOR SEMESTER EXAMINATION"
        : student.attendancePercentage >= 65
          ? "CONDONATION PERMITTED WITH SPECIAL CHALAN"
          : "DETAINED - SHORTAGE OF ATTENDANCE",
      issuedDate: new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }),
      controllerSignature: "Controller of Examinations"
    };
  }

  // Transcripts
  getStudentTranscript(studentId, requestingUser = null) {
    const student = this.getStudentById(studentId, requestingUser);
    if (!student) return null;
    const found = this.academicTranscripts.find(t => t.studentId === student.id || t.rollNumber === student.rollNumber);
    if (found) return { student, transcript: found };

    return {
      student,
      transcript: {
        studentId: student.id,
        institutionId: student.institutionId,
        rollNumber: student.rollNumber,
        registerNumber: student.registerNumber,
        studentName: `${student.firstName} ${student.lastName || ''}`.trim(),
        degree: `${student.degree || 'Program'} in ${student.departmentName || student.branch || 'General Studies'}`,
        semester: `Semester ${student.semester || 1}`,
        courses: [],
        registeredCredits: 0,
        earnedCredits: student.creditsEarned || 0,
        sgpa: student.sgpa || 0,
        cgpa: student.cgpa || 0,
        standing: student.cgpa >= 8.5 ? "First Class with Distinction" : student.cgpa >= 6.5 ? "First Class" : student.cgpa > 0 ? "Pass" : "No Results Published"
      }
    };
  }

  // ==========================================
  // FEES, MULTI-METHOD PAYMENTS & RECEIPTS
  // ==========================================
  resolveAuthenticatedStudent(requestingUser) {
    if (!requestingUser) return null;
    const tenantId = requestingUser.institutionId || 'inst-001';
    return this.students.find(s =>
      (s.institutionId || 'inst-001') === tenantId &&
      (
        (requestingUser.studentId && s.id === requestingUser.studentId) ||
        (requestingUser.id && s.userId === requestingUser.id) ||
        (requestingUser.email && s.email && s.email.toLowerCase() === requestingUser.email.toLowerCase()) ||
        (requestingUser.rollNumber && s.rollNumber && s.rollNumber.toLowerCase() === requestingUser.rollNumber.toLowerCase()) ||
        (requestingUser.registerNumber && s.registerNumber && s.registerNumber.toLowerCase() === requestingUser.registerNumber.toLowerCase()) ||
        (requestingUser.username && (s.username === requestingUser.username || s.rollNumber === requestingUser.username))
      )
    ) || null;
  }

  normalizeFeeInvoice(f) {
    const std = this.students.find(s => s.id === f.studentId || (f.rollNumber && s.rollNumber === f.rollNumber));
    const amount = Number(f.amount || 0);
    const adjustmentAmount = Number(f.adjustmentAmount || f.scholarshipAmount || 0);
    const rawStatus = String(f.status || 'PENDING').toUpperCase();
    const confirmedPaid = rawStatus === 'PAID'
      ? Math.max(0, amount - adjustmentAmount)
      : (rawStatus === 'REFUNDED' ? 0 : Number(f.paidAmount || 0));
    const outstandingBalance = Math.max(0, amount - adjustmentAmount - confirmedPaid);
    const desc = f.description || f.particulars || f.category || `Semester ${f.semester || (std ? std.semester : 1)} Tuition & Academic Fee`;

    let computedStatus = rawStatus;
    if (rawStatus !== 'VERIFICATION_PENDING' && rawStatus !== 'FAILED' && rawStatus !== 'REFUNDED') {
      if (outstandingBalance <= 0 && amount > 0) computedStatus = 'PAID';
      else if (confirmedPaid > 0 && outstandingBalance > 0) computedStatus = 'PARTIAL';
    }

    const txHistory = Array.isArray(f.transactionHistory) ? [...f.transactionHistory] : [];
    if (txHistory.length === 0 && (computedStatus === 'PAID' || confirmedPaid > 0)) {
      txHistory.push({
        id: `txn-${f.id || 'init'}`,
        transactionRef: f.transactionRef || f.receiptNumber || `TXN-${f.id}`,
        amount: confirmedPaid,
        paymentMethod: f.paymentMethod || 'Institutional Counter',
        status: 'SUCCESSFUL',
        receiptNumber: f.receiptNumber || null,
        timestamp: f.paidAt || f.paidDate || new Date().toISOString(),
        verifiedBy: f.verifiedBy || 'Institutional Accounts Office',
        description: desc
      });
    }

    return {
      ...f,
      studentId: std ? std.id : f.studentId,
      studentName: f.studentName || (std ? `${std.firstName} ${std.lastName || ''}`.trim() : 'Student'),
      rollNumber: f.rollNumber || (std ? std.rollNumber : ''),
      registerNumber: f.registerNumber || (std ? std.registerNumber : ''),
      className: f.className || (std ? std.className : ''),
      semester: Number(f.semester || (std ? std.semester : 1)),
      academicYear: f.academicYear || '2026 - 2027',
      description: desc,
      particulars: f.particulars || desc,
      category: f.category || desc,
      amount,
      adjustmentAmount,
      paidAmount: confirmedPaid,
      outstandingBalance,
      receiptNumber: f.receiptNumber || f.receiptNo || null,
      receiptNo: f.receiptNumber || f.receiptNo || null,
      status: computedStatus,
      paymentStatus: computedStatus === 'PAID' ? 'SUCCESSFUL' : computedStatus,
      transactionHistory: txHistory
    };
  }

  syncStudentFeeStatus(studentId) {
    if (!studentId) return;
    const std = this.students.find(s => s.id === studentId);
    if (!std) return;
    const studentInvoices = this.feeInvoices
      .filter(f => f.studentId === std.id || (std.rollNumber && f.rollNumber === std.rollNumber))
      .map(f => this.normalizeFeeInvoice(f));
    if (studentInvoices.length === 0) {
      std.feeStatus = 'NO_DUES';
      return;
    }
    const totalDue = studentInvoices.reduce((sum, f) => sum + f.outstandingBalance, 0);
    const hasVerifPending = studentInvoices.some(f => f.status === 'VERIFICATION_PENDING');
    const totalPaid = studentInvoices.reduce((sum, f) => sum + f.paidAmount, 0);
    if (totalDue <= 0) std.feeStatus = 'PAID';
    else if (hasVerifPending) std.feeStatus = 'VERIFICATION_PENDING';
    else if (totalPaid > 0) std.feeStatus = 'PARTIAL';
    else std.feeStatus = 'PENDING';
  }

  isDuplicateTransactionRef(transactionRef, excludeInvoiceId = null) {
    if (!transactionRef) return false;
    const refNorm = String(transactionRef).trim().toUpperCase();
    return this.feeInvoices.some(f => {
      if (excludeInvoiceId && f.id === excludeInvoiceId && f.status === 'FAILED') return false;
      if (f.transactionRef && String(f.transactionRef).trim().toUpperCase() === refNorm && f.status !== 'FAILED') {
        return true;
      }
      if (Array.isArray(f.transactionHistory)) {
        return f.transactionHistory.some(t =>
          t.transactionRef &&
          String(t.transactionRef).trim().toUpperCase() === refNorm &&
          t.status !== 'FAILED'
        );
      }
      return false;
    });
  }

  getFees(requestingUser = null) {
    let list = this.feeInvoices;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      list = list.filter(f => (f.institutionId || 'inst-001') === tenantId);

      // Strict Student Isolation: Students can ONLY view their own fee records
      if (requestingUser.role === 'STUDENT') {
        const student = this.resolveAuthenticatedStudent(requestingUser);
        if (!student) return [];
        list = list.filter(f =>
          f.studentId === student.id ||
          (student.rollNumber && f.rollNumber === student.rollNumber) ||
          (student.registerNumber && f.registerNumber === student.registerNumber)
        );
      }
    }
    return list.map(f => this.normalizeFeeInvoice(f));
  }

  createFeeInvoice(data, requestingUser = null) {
    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (data.institutionId || 'inst-001');

    const student = this.students.find(s =>
      (s.institutionId || 'inst-001') === institutionId &&
      (s.id === data.studentId || s.rollNumber === data.studentId || s.registerNumber === data.studentId)
    );

    const amount = Math.max(0, parseFloat(data.amount) || 0);
    const adjustmentAmount = Math.max(0, parseFloat(data.adjustmentAmount || data.scholarshipAmount) || 0);
    const netPayable = Math.max(0, amount - adjustmentAmount);
    const rawStatus = (data.status || 'PENDING').toUpperCase();
    const paidAmt = rawStatus === 'PAID' ? netPayable : Math.min(netPayable, Math.max(0, parseFloat(data.paidAmount) || 0));
    const outstandingBalance = Math.max(0, netPayable - paidAmt);
    const resolvedStatus = outstandingBalance <= 0 && amount > 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : rawStatus);

    const invId = `fee-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
    const invoiceNo = data.invoiceNo || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const desc = (data.description || data.particulars || data.category || `Semester ${student ? student.semester : 1} Tuition & Development Fee`).trim();
    const nowIso = new Date().toISOString();
    const receiptNumber = (resolvedStatus === 'PAID' || paidAmt > 0)
      ? (data.receiptNumber || `RCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)
      : null;
    const txRef = (resolvedStatus === 'PAID' || paidAmt > 0)
      ? (data.transactionRef || `ADM-TXN-${Date.now().toString().slice(-6)}`)
      : null;

    const transactionHistory = [];
    if (paidAmt > 0) {
      transactionHistory.push({
        id: `txn-${Date.now().toString().slice(-5)}`,
        transactionRef: txRef,
        amount: paidAmt,
        paymentMethod: data.paymentMethod || 'Campus Accounts Counter',
        status: 'SUCCESSFUL',
        receiptNumber,
        timestamp: nowIso,
        verifiedBy: requestingUser ? (requestingUser.name || requestingUser.email) : 'Administrator',
        description: desc
      });
    }

    const invoice = {
      id: invId,
      invoiceNo,
      institutionId,
      studentId: student ? student.id : (data.studentId || ''),
      studentName: student ? `${student.firstName} ${student.lastName || ''}`.trim() : (data.studentName || 'Student'),
      rollNumber: student ? student.rollNumber : (data.rollNumber || ''),
      registerNumber: student ? student.registerNumber : (data.registerNumber || ''),
      className: student ? student.className : (data.className || ''),
      semester: parseInt(data.semester) || (student ? student.semester : 1),
      academicYear: data.academicYear || '2026 - 2027',
      category: data.category || desc,
      particulars: desc,
      description: desc,
      term: data.term || `Semester ${student ? student.semester : 1} (${new Date().getFullYear()})`,
      amount,
      adjustmentAmount,
      paidAmount: paidAmt,
      outstandingBalance,
      dueDate: data.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: resolvedStatus,
      paymentMethod: (resolvedStatus === 'PAID' || paidAmt > 0) ? (data.paymentMethod || 'Campus Accounts Counter') : null,
      transactionRef: txRef,
      paidDate: (resolvedStatus === 'PAID' || paidAmt > 0) ? (data.paidDate || nowIso.split('T')[0]) : null,
      paidAt: (resolvedStatus === 'PAID' || paidAmt > 0) ? nowIso : null,
      verifiedBy: (resolvedStatus === 'PAID' || paidAmt > 0) ? (requestingUser ? (requestingUser.name || requestingUser.email) : 'Administrator') : null,
      verifiedAt: (resolvedStatus === 'PAID' || paidAmt > 0) ? nowIso : null,
      receiptNumber,
      transactionHistory,
      remarks: data.remarks || ''
    };
    this.feeInvoices.unshift(invoice);
    if (student) {
      this.syncStudentFeeStatus(student.id);
    }
    this.saveToDisk();
    return this.normalizeFeeInvoice(invoice);
  }

  updateFeeInvoice(id, data, requestingUser = null) {
    const idx = this.feeInvoices.findIndex(f => f.id === id || f.invoiceNo === id);
    if (idx === -1) return null;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.feeInvoices[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot modify fee invoice of another institution.');
      }
    }
    const cur = this.feeInvoices[idx];
    const amount = data.amount !== undefined ? Math.max(0, parseFloat(data.amount) || 0) : Number(cur.amount || 0);
    const adjustmentAmount = data.adjustmentAmount !== undefined
      ? Math.max(0, parseFloat(data.adjustmentAmount) || 0)
      : Number(cur.adjustmentAmount || 0);
    const netPayable = Math.max(0, amount - adjustmentAmount);
    const requestedStatus = data.status ? String(data.status).toUpperCase() : cur.status;
    let paidAmount = requestedStatus === 'PAID'
      ? netPayable
      : (requestedStatus === 'REFUNDED' ? 0 : (data.paidAmount !== undefined ? Math.max(0, parseFloat(data.paidAmount) || 0) : Number(cur.paidAmount || 0)));
    paidAmount = Math.min(netPayable, paidAmount);
    const outstandingBalance = Math.max(0, netPayable - paidAmount);

    let resolvedStatus = requestedStatus;
    if (requestedStatus !== 'VERIFICATION_PENDING' && requestedStatus !== 'FAILED' && requestedStatus !== 'REFUNDED') {
      if (outstandingBalance <= 0 && amount > 0) resolvedStatus = 'PAID';
      else if (paidAmount > 0 && outstandingBalance > 0) resolvedStatus = 'PARTIAL';
      else resolvedStatus = 'PENDING';
    }

    const nowIso = new Date().toISOString();
    const desc = data.description !== undefined ? data.description : (cur.description || cur.particulars || 'Semester Tuition Fee');
    const receiptNumber = (resolvedStatus === 'PAID' || paidAmount > 0)
      ? (cur.receiptNumber || `RCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)
      : cur.receiptNumber;
    const txRef = (resolvedStatus === 'PAID' || paidAmount > 0)
      ? (data.transactionRef || cur.transactionRef || `ADM-TXN-${Date.now().toString().slice(-6)}`)
      : cur.transactionRef;

    const txHistory = Array.isArray(cur.transactionHistory) ? [...cur.transactionHistory] : [];
    if (paidAmount > Number(cur.paidAmount || 0)) {
      const diff = paidAmount - Number(cur.paidAmount || 0);
      txHistory.unshift({
        id: `txn-${Date.now().toString().slice(-5)}`,
        transactionRef: txRef,
        amount: diff,
        paymentMethod: data.paymentMethod || cur.paymentMethod || 'Campus Accounts Counter',
        status: 'SUCCESSFUL',
        receiptNumber,
        timestamp: nowIso,
        verifiedBy: requestingUser ? (requestingUser.name || requestingUser.email) : 'Administrator',
        description: `Authorized Fee Update / Payment (${desc})`
      });
    } else if (resolvedStatus === 'REFUNDED') {
      txHistory.unshift({
        id: `txn-${Date.now().toString().slice(-5)}`,
        transactionRef: `RFD-${Date.now().toString().slice(-6)}`,
        amount: Number(cur.paidAmount || amount),
        paymentMethod: data.paymentMethod || cur.paymentMethod || 'Institutional Refund',
        status: 'REFUNDED',
        timestamp: nowIso,
        verifiedBy: requestingUser ? (requestingUser.name || requestingUser.email) : 'Administrator',
        description: `Fee Refund Processed (${desc})`
      });
    }

    this.feeInvoices[idx] = {
      ...cur,
      ...data,
      id: cur.id,
      institutionId: cur.institutionId,
      description: desc,
      particulars: desc,
      category: data.category || desc,
      amount,
      adjustmentAmount,
      paidAmount,
      outstandingBalance,
      status: resolvedStatus,
      transactionRef: txRef,
      receiptNumber,
      paidDate: resolvedStatus === 'PAID' ? (cur.paidDate || nowIso.split('T')[0]) : cur.paidDate,
      paidAt: resolvedStatus === 'PAID' ? (cur.paidAt || nowIso) : cur.paidAt,
      verifiedBy: resolvedStatus === 'PAID' ? (cur.verifiedBy || (requestingUser ? (requestingUser.name || requestingUser.email) : 'Administrator')) : cur.verifiedBy,
      verifiedAt: resolvedStatus === 'PAID' ? (cur.verifiedAt || nowIso) : cur.verifiedAt,
      transactionHistory: txHistory
    };
    this.syncStudentFeeStatus(cur.studentId);
    this.saveToDisk();
    return this.normalizeFeeInvoice(this.feeInvoices[idx]);
  }

  deleteFeeInvoice(id, requestingUser = null) {
    const idx = this.feeInvoices.findIndex(f => f.id === id || f.invoiceNo === id);
    if (idx === -1) return false;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.feeInvoices[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot delete fee invoice of another institution.');
      }
    }
    const studentId = this.feeInvoices[idx].studentId;
    this.feeInvoices.splice(idx, 1);
    if (studentId) this.syncStudentFeeStatus(studentId);
    this.saveToDisk();
    return true;
  }

  // Student submits UPI / Bank Transfer payment details for verification
  submitStudentFeePayment(invoiceId, paymentDetails = {}, requestingUser = null) {
    const invoice = this.feeInvoices.find(f => f.id === invoiceId || f.invoiceNo === invoiceId);
    if (!invoice) return null;

    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((invoice.institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot submit payment for another institution.');
      }
      if (requestingUser.role === 'STUDENT') {
        const student = this.resolveAuthenticatedStudent(requestingUser);
        if (!student || (invoice.studentId !== student.id && invoice.rollNumber !== student.rollNumber)) {
          throw new Error('FORBIDDEN_STUDENT_FEE: You can only submit payments for your own fee invoices.');
        }
      }
    }

    const norm = this.normalizeFeeInvoice(invoice);
    if (norm.status === 'PAID' || norm.outstandingBalance <= 0) {
      throw new Error('DUPLICATE_PAYMENT: This fee invoice is already settled and paid in full.');
    }

    const method = String(paymentDetails.paymentMethod || 'UPI').trim();
    const txRef = String(paymentDetails.transactionRef || paymentDetails.utrNumber || '').trim().toUpperCase();
    if (!txRef || txRef.length < 6) {
      throw new Error('INVALID_TRANSACTION_REF: A valid transaction reference / 12-digit UTR number (minimum 6 characters) is required for payment verification.');
    }

    if (this.isDuplicateTransactionRef(txRef, invoice.id)) {
      throw new Error(`DUPLICATE_TRANSACTION_REF: Transaction reference "${txRef}" has already been recorded. Duplicate payment submissions are blocked.`);
    }

    const submittedAmount = paymentDetails.amount !== undefined
      ? Math.min(norm.outstandingBalance, Math.max(1, parseFloat(paymentDetails.amount) || norm.outstandingBalance))
      : norm.outstandingBalance;

    const nowIso = new Date().toISOString();
    invoice.status = 'VERIFICATION_PENDING';
    invoice.paymentMethod = method;
    invoice.transactionRef = txRef;
    invoice.pendingPayment = {
      paymentMethod: method,
      transactionRef: txRef,
      submittedAmount,
      payerUpiId: paymentDetails.payerUpiId || '',
      bankName: paymentDetails.bankName || '',
      accountHolder: paymentDetails.accountHolder || '',
      transferDate: paymentDetails.transferDate || nowIso.split('T')[0],
      remarks: paymentDetails.remarks || '',
      submittedAt: nowIso,
      submittedBy: requestingUser ? (requestingUser.name || requestingUser.email || requestingUser.id) : 'Student'
    };

    if (!Array.isArray(invoice.transactionHistory)) invoice.transactionHistory = [];
    invoice.transactionHistory.unshift({
      id: `txn-${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`,
      transactionRef: txRef,
      amount: submittedAmount,
      paymentMethod: method,
      bankName: paymentDetails.bankName || null,
      payerUpiId: paymentDetails.payerUpiId || null,
      status: 'VERIFICATION_PENDING',
      timestamp: nowIso,
      description: `${method} reference submitted by student — awaiting verification`
    });

    this.syncStudentFeeStatus(invoice.studentId);
    this.saveToDisk();
    return this.normalizeFeeInvoice(invoice);
  }

  // Admin verifies (APPROVE / REJECT / REFUND) a pending payment or records counter payment
  verifyFeePayment(invoiceId, verificationData = {}, requestingUser = null) {
    if (!requestingUser || (requestingUser.role !== 'ADMIN' && requestingUser.role !== 'SUPER_ADMIN')) {
      throw new Error('FORBIDDEN_ADMIN_ONLY: Only authorized institutional administrators can verify and approve fee payments.');
    }

    const invoice = this.feeInvoices.find(f => f.id === invoiceId || f.invoiceNo === invoiceId);
    if (!invoice) return null;

    if (requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((invoice.institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot verify payment for another institution.');
      }
    }

    const action = String(verificationData.action || 'APPROVE').toUpperCase();
    const nowIso = new Date().toISOString();
    const verifierName = requestingUser.name || requestingUser.email || 'Administrator';
    const norm = this.normalizeFeeInvoice(invoice);

    if (!Array.isArray(invoice.transactionHistory)) invoice.transactionHistory = [];

    if (action === 'REJECT') {
      invoice.status = Number(invoice.paidAmount || 0) > 0 ? 'PARTIAL' : 'FAILED';
      const pendingRef = invoice.pendingPayment?.transactionRef || invoice.transactionRef;
      const histItem = invoice.transactionHistory.find(t => t.transactionRef === pendingRef && t.status === 'VERIFICATION_PENDING');
      if (histItem) {
        histItem.status = 'FAILED';
        histItem.verifiedBy = verifierName;
        histItem.verifiedAt = nowIso;
        histItem.description = verificationData.reason || 'Payment reference rejected during verification';
      } else {
        invoice.transactionHistory.unshift({
          id: `txn-${Date.now().toString().slice(-5)}`,
          transactionRef: pendingRef || 'UNVERIFIED',
          amount: invoice.pendingPayment?.submittedAmount || norm.outstandingBalance,
          paymentMethod: invoice.paymentMethod || 'Bank / UPI',
          status: 'FAILED',
          timestamp: nowIso,
          verifiedBy: verifierName,
          description: verificationData.reason || 'Payment verification failed'
        });
      }
      invoice.pendingPayment = null;
      this.syncStudentFeeStatus(invoice.studentId);
      this.saveToDisk();
      return this.normalizeFeeInvoice(invoice);
    }

    if (action === 'REFUND') {
      const refundedAmt = Number(invoice.paidAmount || invoice.amount || 0);
      invoice.paidAmount = 0;
      invoice.status = 'REFUNDED';
      invoice.pendingPayment = null;
      invoice.transactionHistory.unshift({
        id: `txn-${Date.now().toString().slice(-5)}`,
        transactionRef: `RFD-${Date.now().toString().slice(-6)}`,
        amount: refundedAmt,
        paymentMethod: invoice.paymentMethod || 'Institutional Refund',
        status: 'REFUNDED',
        timestamp: nowIso,
        verifiedBy: verifierName,
        description: verificationData.reason || 'Authorized fee refund processed'
      });
      this.syncStudentFeeStatus(invoice.studentId);
      this.saveToDisk();
      return this.normalizeFeeInvoice(invoice);
    }

    // Default: APPROVE
    if (norm.status === 'PAID' && norm.outstandingBalance <= 0) {
      throw new Error('DUPLICATE_PAYMENT: This fee invoice is already verified and paid in full.');
    }

    const approvedAmount = invoice.pendingPayment?.submittedAmount
      ? Number(invoice.pendingPayment.submittedAmount)
      : (verificationData.paidAmount !== undefined ? Number(verificationData.paidAmount) : norm.outstandingBalance);

    const netPayable = Math.max(0, Number(invoice.amount || 0) - Number(invoice.adjustmentAmount || 0));
    invoice.paidAmount = Math.min(netPayable, Number(invoice.paidAmount || 0) + approvedAmount);
    const remaining = Math.max(0, netPayable - invoice.paidAmount);
    invoice.status = remaining <= 0 ? 'PAID' : 'PARTIAL';
    invoice.paidDate = nowIso.split('T')[0];
    invoice.paidAt = nowIso;
    invoice.paymentMethod = verificationData.paymentMethod || invoice.pendingPayment?.paymentMethod || invoice.paymentMethod || 'Verified Institutional Payment';
    invoice.transactionRef = verificationData.transactionRef || invoice.pendingPayment?.transactionRef || invoice.transactionRef || `TXN-${Date.now().toString().slice(-6)}`;
    invoice.receiptNumber = invoice.receiptNumber || `RCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    invoice.verifiedBy = verifierName;
    invoice.verifiedAt = nowIso;

    const pendingHist = invoice.transactionHistory.find(t => t.status === 'VERIFICATION_PENDING');
    if (pendingHist) {
      pendingHist.status = 'SUCCESSFUL';
      pendingHist.receiptNumber = invoice.receiptNumber;
      pendingHist.verifiedBy = verifierName;
      pendingHist.verifiedAt = nowIso;
      pendingHist.description = `Verified & Approved by ${verifierName}`;
    } else {
      invoice.transactionHistory.unshift({
        id: `txn-${Date.now().toString().slice(-5)}`,
        transactionRef: invoice.transactionRef,
        amount: approvedAmount,
        paymentMethod: invoice.paymentMethod,
        status: 'SUCCESSFUL',
        receiptNumber: invoice.receiptNumber,
        timestamp: nowIso,
        verifiedBy: verifierName,
        verifiedAt: nowIso,
        description: `Verified Payment (${invoice.paymentMethod})`
      });
    }

    invoice.pendingPayment = null;
    this.syncStudentFeeStatus(invoice.studentId);
    this.saveToDisk();
    return this.normalizeFeeInvoice(invoice);
  }

  payFee(invoiceId, paymentDetails = {}, requestingUser = null) {
    const invoice = this.feeInvoices.find(f => f.id === invoiceId || f.invoiceNo === invoiceId);
    if (!invoice) return null;

    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((invoice.institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot process payment for another institution.');
      }
    }

    // Security enforcement: Students cannot mark an invoice PAID directly by clicking a button!
    // Student submissions via /pay are routed to submitStudentFeePayment (status = VERIFICATION_PENDING)
    if (requestingUser && requestingUser.role === 'STUDENT') {
      return this.submitStudentFeePayment(invoiceId, paymentDetails, requestingUser);
    }

    if (requestingUser && requestingUser.role === 'TEACHER') {
      throw new Error('FORBIDDEN_ADMIN_ONLY: Only administrators can mark fee invoices as paid.');
    }

    return this.verifyFeePayment(invoiceId, {
      action: 'APPROVE',
      paymentMethod: paymentDetails.paymentMethod || 'Campus Accounts Counter',
      transactionRef: paymentDetails.transactionRef,
      paidAmount: paymentDetails.paidAmount
    }, requestingUser || { role: 'ADMIN', name: 'Institutional Accounts Counter', institutionId: invoice.institutionId || 'inst-001' });
  }

  getPaymentConfig(requestingUser = null) {
    const tenantId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : 'inst-001';
    const inst = this.institutions.find(i => i.id === tenantId) || {
      id: tenantId,
      name: 'ACADIVEX Institution',
      campusName: 'Main Campus',
      code: 'ACDVX'
    };
    const instCode = (inst.code || 'ACDVX').toLowerCase().replace(/[^a-z0-9]/g, '');
    const hasGateway = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

    return {
      institutionName: inst.name,
      campusName: inst.campusName || 'Main Campus',
      currency: 'INR',
      upi: {
        enabled: true,
        upiId: inst.upiId || `${instCode}.fees@sbi`,
        merchantName: `${inst.name} Fee Collection Account`,
        instructions: 'Scan the dynamic UPI QR or pay to the verified institutional UPI ID using GPay, PhonePe, Paytm, or BHIM, then submit your 12-digit UPI / UTR reference number for verification.'
      },
      bankTransfer: {
        enabled: true,
        accountName: inst.bankAccountName || `${inst.name} – Institutional Fee Account`,
        accountNumber: inst.bankAccountNumber || '30984710293847',
        ifscCode: inst.bankIfscCode || 'SBIN0004125',
        bankName: inst.bankName || 'State Bank of India (SBI)',
        branchName: inst.bankBranch || `${inst.campusName || 'University'} Treasury Branch`,
        accountType: 'Current / Institutional Escrow Account',
        instructions: 'Initiate NEFT, RTGS, or IMPS transfer to the verified bank account above and submit the UTR / Reference Number for Finance Office verification.'
      },
      gateway: {
        provider: 'Razorpay',
        configured: hasGateway,
        keyId: hasGateway ? process.env.RAZORPAY_KEY_ID : null,
        status: hasGateway ? 'OPERATIONAL' : 'AWAITING_CONFIGURATION',
        setupInstructions: hasGateway
          ? 'Online gateway verified with server-side HMAC-SHA256 signature verification.'
          : 'Online Payment Gateway is awaiting institutional merchant configuration. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env to enable instant automated gateway checkout. Until configured, please use UPI or Bank Transfer (NEFT/RTGS/IMPS).'
      }
    };
  }

  getFeeReceiptData(invoiceId, requestingUser = null) {
    const rawInvoice = this.feeInvoices.find(f => f.id === invoiceId || f.invoiceNo === invoiceId || f.receiptNumber === invoiceId);
    if (!rawInvoice) return null;

    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((rawInvoice.institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot access receipt from another institution.');
      }
      if (requestingUser.role === 'STUDENT') {
        const student = this.resolveAuthenticatedStudent(requestingUser);
        if (!student || (rawInvoice.studentId !== student.id && rawInvoice.rollNumber !== student.rollNumber)) {
          throw new Error('FORBIDDEN_STUDENT_RECEIPT: Access denied. You may only download receipts for your own fee payments.');
        }
      }
    }

    const invoice = this.normalizeFeeInvoice(rawInvoice);
    if (invoice.status !== 'PAID' || invoice.paidAmount <= 0) {
      throw new Error(`RECEIPT_NOT_AVAILABLE: Official paid fee receipts can only be generated for verified successful payments (Current status: ${invoice.status}).`);
    }

    if (!rawInvoice.receiptNumber) {
      rawInvoice.receiptNumber = `RCP-${new Date().getFullYear()}-${String(rawInvoice.id || '1001').replace(/[^0-9]/g, '').slice(-4).padStart(4, '0')}`;
      invoice.receiptNumber = rawInvoice.receiptNumber;
      this.saveToDisk();
    }

    const student = this.students.find(s => s.id === invoice.studentId || (invoice.rollNumber && s.rollNumber === invoice.rollNumber)) || {};
    const inst = this.institutions.find(i => i.id === (invoice.institutionId || 'inst-001')) || {
      id: invoice.institutionId || 'inst-001',
      name: 'ACADIVEX Smart Campus Institution',
      campusName: 'Main Campus',
      code: 'ACDVX',
      academicYear: '2026 - 2027'
    };

    const studentName = invoice.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
    const registerNumber = invoice.registerNumber || student.registerNumber || student.rollNumber || 'N/A';
    const rollNumber = invoice.rollNumber || student.rollNumber || 'N/A';
    const department = student.departmentName || student.branch || student.department?.name || 'Academic Department';
    const course = student.courseName || student.degree || 'Undergraduate Degree Program';
    const className = invoice.className || student.className || 'Regular Batch';
    const semester = invoice.semester || student.semester || 1;
    const academicYear = invoice.academicYear || inst.academicYear || '2026 - 2027';
    const feeCategory = invoice.category || 'Tuition & Institutional Fee';
    const description = invoice.description || invoice.particulars || `Semester ${semester} Tuition & Academic Fee`;
    const paymentMethod = invoice.paymentMethod || 'Verified Institutional Channel';
    const transactionRef = invoice.transactionRef || invoice.receiptNumber;
    const paidAt = invoice.paidAt || invoice.paidDate || new Date().toISOString();
    const verifiedBy = invoice.verifiedBy || 'Institutional Accounts & Finance Office';

    return {
      receiptNumber: invoice.receiptNumber,
      receiptNo: invoice.receiptNumber,
      invoiceNo: invoice.invoiceNo || invoice.id,
      invoiceId: invoice.id,
      institutionName: inst.name,
      campusName: inst.campusName || 'Main Campus',
      institutionAddress: inst.address || 'University Main Campus',
      institutionEmail: inst.contactEmail || 'accounts@institution.edu',
      institutionPhone: inst.contactPhone || '+91 80 4125 0000',
      studentName,
      registerNumber,
      rollNumber,
      department,
      course,
      className,
      semester,
      academicYear,
      feeCategory,
      category: feeCategory,
      description,
      totalFees: invoice.amount,
      adjustments: invoice.adjustmentAmount || 0,
      amountPaid: invoice.paidAmount,
      outstandingBalance: invoice.outstandingBalance,
      currency: 'INR',
      paymentMethod,
      transactionRef,
      paidAt,
      verifiedBy,
      paymentStatus: 'SUCCESSFUL (VERIFIED)',
      verifiedStatus: 'VERIFIED & PAID',
      institution: {
        id: inst.id,
        name: inst.name,
        campusName: inst.campusName || 'Main Campus',
        code: inst.code || 'ACDVX',
        logoUrl: inst.logoUrl || null,
        address: inst.address || 'University Main Campus',
        contactEmail: inst.contactEmail || 'accounts@institution.edu',
        contactPhone: inst.contactPhone || '+91 80 4125 0000'
      },
      student: {
        id: student.id || invoice.studentId,
        name: studentName,
        registerNumber,
        rollNumber,
        department,
        course,
        className,
        semester,
        academicYear,
        email: student.email || ''
      },
      payment: {
        feeCategory,
        description,
        academicYear,
        semester: `Semester ${semester}`,
        totalBilled: invoice.amount,
        adjustmentAmount: invoice.adjustmentAmount || 0,
        amountPaid: invoice.paidAmount,
        outstandingBalance: invoice.outstandingBalance,
        currency: 'INR',
        paymentMethod,
        transactionRef,
        paidDate: paidAt,
        verifiedBy,
        status: 'VERIFIED SUCCESSFUL (PAID)'
      },
      receipt: invoice,
      issuedAt: new Date().toISOString()
    };
  }

  // Announcements / Campus Circulars
  getAnnouncements(requestingUser = null) {
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      return this.announcements.filter(a => (a.institutionId || 'inst-001') === tenantId);
    }
    return this.announcements;
  }
  createAnnouncement(data, requestingUser = null) {
    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (data.institutionId || 'inst-001');
    const bodyText = (data.content || data.message || '').trim();
    const dateStr = data.date || new Date().toISOString().split('T')[0];
    const newAnn = {
      id: `ann-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
      institutionId,
      title: (data.title || 'Campus Circular').trim(),
      category: data.category || 'ACADEMIC NOTICE',
      priority: data.priority || 'NORMAL',
      target: data.target || data.audience || 'ALL',
      audience: data.audience || data.target || 'ALL',
      department: data.department || 'All Departments',
      date: dateStr,
      createdAt: data.createdAt || dateStr,
      author: data.author || (requestingUser && requestingUser.name) || 'Institutional Administration',
      content: bodyText,
      message: bodyText
    };
    this.announcements.unshift(newAnn);

    // Also broadcast to notifications so Student & Staff portals see the circular immediately
    this.notifications.unshift({
      id: `notif-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
      institutionId,
      title: newAnn.title,
      message: bodyText,
      type: newAnn.category,
      category: newAnn.category,
      targetRole: newAnn.target,
      createdAt: dateStr,
      time: dateStr,
      read: false
    });

    this.saveToDisk();
    return newAnn;
  }
  updateAnnouncement(id, data, requestingUser = null) {
    const idx = this.announcements.findIndex(a => a.id === id);
    if (idx === -1) return null;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.announcements[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot modify announcement of another institution.');
      }
    }
    const cur = this.announcements[idx];
    const bodyText = data.content !== undefined ? data.content : (data.message !== undefined ? data.message : (cur.content || cur.message));
    this.announcements[idx] = {
      ...cur,
      ...data,
      id: cur.id,
      institutionId: cur.institutionId,
      content: bodyText,
      message: bodyText
    };
    this.saveToDisk();
    return this.announcements[idx];
  }
  deleteAnnouncement(id, requestingUser = null) {
    const idx = this.announcements.findIndex(a => a.id === id);
    if (idx === -1) return false;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.announcements[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot delete announcement of another institution.');
      }
    }
    this.announcements.splice(idx, 1);
    this.saveToDisk();
    return true;
  }

  // Analytics
  getAnalytics(requestingUser = null) {
    let stdList = this.students;
    let tchList = this.teachers;
    let clsList = this.classes;
    let feeList = this.feeInvoices;
    let attList = this.attendanceRecords;
    let annList = this.announcements;

    const tenantId = (requestingUser && requestingUser.role !== 'SUPER_ADMIN') 
      ? (requestingUser.institutionId || 'inst-001') 
      : 'inst-001';

    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      stdList = stdList.filter(s => (s.institutionId || 'inst-001') === tenantId);
      tchList = tchList.filter(t => (t.institutionId || 'inst-001') === tenantId);
      clsList = clsList.filter(c => (c.institutionId || 'inst-001') === tenantId);
      feeList = feeList.filter(f => (f.institutionId || 'inst-001') === tenantId);
      attList = attList.filter(a => (a.institutionId || 'inst-001') === tenantId);
      annList = annList.filter(a => (a.institutionId || 'inst-001') === tenantId);
    }

    const activeStudents = stdList.filter(s => s.status !== 'INACTIVE');
    const totalStudents = activeStudents.length;
    const totalTeachers = tchList.filter(t => t.status !== 'INACTIVE').length;
    const totalClasses = clsList.length;

    const totalFeeAmount = feeList.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    const collectedFeeAmount = feeList.reduce((acc, curr) => acc + (parseFloat(curr.paidAmount) || 0), 0);
    const pendingFeeAmount = Math.max(0, totalFeeAmount - collectedFeeAmount);

    const avgAttendance = totalStudents > 0
      ? (activeStudents.reduce((acc, curr) => acc + (parseFloat(curr.attendancePercentage) || 0), 0) / totalStudents).toFixed(1)
      : '0.0';

    const paidStudents = activeStudents.filter(s => s.feeStatus === 'PAID').length;
    const pendingStudents = activeStudents.filter(s => s.feeStatus === 'PENDING').length;
    const overdueStudents = activeStudents.filter(s => s.feeStatus === 'OVERDUE').length;

    const eligibleCount = activeStudents.filter(s => s.examEligibility === 'ELIGIBLE').length;
    const condonationCount = activeStudents.filter(s => s.examEligibility === 'CONDONATION').length;
    const detainedCount = activeStudents.filter(s => s.examEligibility === 'DETAINED').length;

    const inst = this.institutions.find(i => i.id === tenantId) || this.institution;

    // Compute real attendance trends from recorded attendance sessions
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const attendanceTrends = days.map((dayName, idx) => {
      const dayNum = idx + 1; // 1=Mon .. 5=Fri
      const dayRecords = attList.filter(a => {
        if (!a.date) return false;
        const d = new Date(a.date);
        return !isNaN(d.getTime()) && d.getDay() === dayNum;
      });
      if (dayRecords.length === 0) {
        return { day: dayName, rate: 0 };
      }
      const present = dayRecords.filter(a => a.status === 'PRESENT').length;
      return {
        day: dayName,
        rate: parseFloat(((present / dayRecords.length) * 100).toFixed(1))
      };
    });

    return {
      institution: inst,
      metrics: {
        totalStudents,
        totalTeachers,
        totalClasses,
        avgAttendance: parseFloat(avgAttendance),
        totalRevenue: totalFeeAmount,
        collectedRevenue: collectedFeeAmount,
        pendingRevenue: pendingFeeAmount,
        collectionRate: totalFeeAmount > 0 ? parseFloat(((collectedFeeAmount / totalFeeAmount) * 100).toFixed(1)) : 0,
        examEligibleCount: eligibleCount,
        condonationCount: condonationCount,
        detainedCount: detainedCount
      },
      feeBreakdown: {
        paid: paidStudents,
        pending: pendingStudents,
        overdue: overdueStudents
      },
      recentAnnouncements: annList,
      attendanceTrends
    };
  }

  // ==========================================
  // SAAS MULTI-TENANT MANAGEMENT METHODS
  // ==========================================
  logAudit(logData) {
    const newLog = {
      id: `log-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
      institutionId: logData.institutionId || 'system',
      userId: logData.userId || 'anonymous',
      userEmail: logData.userEmail || 'system',
      userName: logData.userName || 'System',
      role: logData.role || 'GUEST',
      action: logData.action || 'UNKNOWN_ACTION',
      resource: logData.resource || 'GENERAL',
      resourceId: logData.resourceId || '',
      details: logData.details || '',
      ipAddress: logData.ipAddress || '127.0.0.1',
      timestamp: new Date().toISOString()
    };
    this.auditLogs.unshift(newLog);
    this.saveToDisk();
    return newLog;
  }

  getAuditLogs(requestingUser = null) {
    if (!requestingUser) return [];
    if (requestingUser.role === 'SUPER_ADMIN') {
      return this.auditLogs;
    }
    const tenantId = requestingUser.institutionId || 'inst-001';
    return this.auditLogs.filter(l => l.institutionId === tenantId);
  }

  getInstitutions(requestingUser = null) {
    if (requestingUser && requestingUser.role === 'SUPER_ADMIN') {
      return this.institutions.map(inst => {
        const studentCount = this.students.filter(s => s.institutionId === inst.id && s.status !== 'INACTIVE').length;
        const facultyCount = this.teachers.filter(t => t.institutionId === inst.id && t.status !== 'INACTIVE').length;
        return {
          ...inst,
          stats: { students: studentCount, faculty: facultyCount }
        };
      });
    }
    // Non-super admin can only see their own institution details
    const tenantId = requestingUser ? (requestingUser.institutionId || 'inst-001') : 'inst-001';
    return this.institutions.filter(i => i.id === tenantId);
  }

  getInstitutionById(id) {
    return this.institutions.find(i => i.id === id || i.code?.toLowerCase() === (id || '').toLowerCase() || i.slug === id);
  }

  getPublicInstitutions() {
    return this.institutions
      .filter(i => i.status === 'ACTIVE')
      .map(inst => ({
        id: inst.id,
        name: inst.name,
        campusName: inst.campusName || 'Main Campus',
        code: inst.code,
        slug: inst.slug,
        institutionType: inst.institutionType || 'COLLEGE',
        status: inst.status,
        logoUrl: inst.logoUrl || null,
        tagline: inst.tagline,
        accreditation: inst.accreditation,
        primaryColor: inst.primaryColor || '#7C3AED',
        secondaryColor: inst.secondaryColor || '#06B6D4',
        contactEmail: inst.contactEmail,
        contactPhone: inst.contactPhone,
        address: inst.address,
        academicYear: inst.academicYear,
        currentTerm: inst.currentTerm
      }));
  }

  verifyInstitution({ institutionId, institutionName, campusName } = {}) {
    const rawName = (institutionName || institutionId || '').trim();
    const rawCampus = (campusName || '').trim();

    if (!rawName || !rawCampus) {
      return {
        success: false,
        statusCode: 400,
        code: 'MISSING_FIELDS',
        message: 'Both Institution/College Name and Campus Name are required to access an institution portal.'
      };
    }

    const nameLower = rawName.toLowerCase();
    const inst = this.institutions.find(i =>
      i.id.toLowerCase() === nameLower ||
      (i.name && i.name.toLowerCase() === nameLower) ||
      (i.code && i.code.toLowerCase() === nameLower) ||
      (i.slug && i.slug.toLowerCase() === nameLower)
    );

    if (!inst) {
      return {
        success: false,
        statusCode: 404,
        code: 'INSTITUTION_NOT_FOUND',
        message: `Institution '${rawName}' is not registered on ACADIVEX. Please select a registered institution or register your institution first.`
      };
    }

    if (inst.status !== 'ACTIVE') {
      return {
        success: false,
        statusCode: 403,
        code: 'INSTITUTION_NOT_APPROVED',
        message: `Institution '${inst.name}' is currently ${inst.status} and not approved for active portal access.`
      };
    }

    const savedCampus = (inst.campusName || 'Main Campus').toLowerCase();
    const savedAddress = (inst.address || '').toLowerCase();
    const reqCampus = rawCampus.toLowerCase();

    const campusMatches =
      savedCampus === reqCampus ||
      (reqCampus.length >= 3 && (savedCampus.includes(reqCampus) || reqCampus.includes(savedCampus))) ||
      (reqCampus.length >= 4 && savedAddress && savedAddress.includes(reqCampus));

    if (!campusMatches) {
      return {
        success: false,
        statusCode: 404,
        code: 'CAMPUS_MISMATCH',
        message: `Campus '${rawCampus}' does not match registered records for ${inst.name} (Registered Campus: ${inst.campusName || 'Main Campus'}).`
      };
    }

    return {
      success: true,
      institution: {
        id: inst.id,
        name: inst.name,
        campusName: inst.campusName || 'Main Campus',
        code: inst.code,
        slug: inst.slug,
        institutionType: inst.institutionType || 'COLLEGE',
        status: inst.status,
        logoUrl: inst.logoUrl || null,
        tagline: inst.tagline,
        accreditation: inst.accreditation,
        primaryColor: inst.primaryColor || '#7C3AED',
        secondaryColor: inst.secondaryColor || '#06B6D4',
        contactEmail: inst.contactEmail,
        contactPhone: inst.contactPhone,
        address: inst.address,
        academicYear: inst.academicYear,
        currentTerm: inst.currentTerm
      }
    };
  }

  saveInstitutionLogoData(instId, logoData) {
    if (!logoData || typeof logoData !== 'string') return null;

    const trimmed = logoData.trim();
    if (/^(blob:|file:|filesystem:|[a-zA-Z]:\\|\\\\)/i.test(trimmed) || trimmed.includes('fakepath')) {
      throw new Error('INVALID_LOGO_URL: Temporary local browser paths cannot be saved as permanent logo URLs.');
    }

    // If it's already a server-relative /uploads/... path or valid https URL (not DiceBear default)
    if (trimmed.startsWith('/uploads/') || /^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    const matches = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('INVALID_LOGO_FORMAT: Logo must be a valid image file (PNG, JPG, JPEG, or WebP).');
    }

    const mimeType = matches[1].toLowerCase();
    const base64Payload = matches[2];
    const allowedMimes = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp'
    };

    if (!allowedMimes[mimeType]) {
      throw new Error('INVALID_LOGO_TYPE: Only PNG, JPG, JPEG, and WebP image files are allowed.');
    }

    const buffer = Buffer.from(base64Payload, 'base64');
    const maxBytes = 2 * 1024 * 1024; // 2 MB
    if (buffer.length === 0) {
      throw new Error('INVALID_LOGO_EMPTY: Uploaded logo file is empty.');
    }
    if (buffer.length > maxBytes) {
      throw new Error('LOGO_TOO_LARGE: Institution logo file size must not exceed 2 MB.');
    }

    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = allowedMimes[mimeType];
    const fileName = `logo-${instId}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    return `/uploads/avatars/${fileName}`;
  }

  registerInstitution(data) {
    const { name, campusName, code, contactEmail, adminName, adminPassword, plan, phone, address, institutionType, logoData, logoUrl, primaryColor, secondaryColor, tagline } = data;

    if (!name || !contactEmail || !adminPassword) {
      throw new Error('Institution name, contact email, and admin password are required.');
    }

    if (!campusName || !String(campusName).trim()) {
      throw new Error('Campus name is required.');
    }

    const emailLower = contactEmail.trim().toLowerCase();
    if (this.users.some(u => u.email?.toLowerCase() === emailLower)) {
      throw new Error('This contact email is already registered to an existing account.');
    }

    const instCode = (code || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6)).toUpperCase();
    if (this.institutions.some(i => i.code === instCode)) {
      throw new Error(`An institution with code '${instCode}' already exists.`);
    }

    const newInstId = `inst-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;

    // Validate and persist uploaded logo if provided; otherwise null (neutral placeholder)
    let persistedLogoUrl = null;
    const rawLogoInput = logoData || logoUrl || null;
    if (rawLogoInput) {
      persistedLogoUrl = this.saveInstitutionLogoData(newInstId, rawLogoInput);
    }

    const newInst = {
      id: newInstId,
      name: name.trim(),
      campusName: String(campusName).trim(),
      institutionType: institutionType || 'COLLEGE',
      code: instCode,
      slug: instCode.toLowerCase(),
      status: 'ACTIVE',
      plan: plan || 'PRO',
      portalName: `${name.trim()} Academic Portal`,
      tagline: tagline || "Smarter Campus. Stronger Futures.",
      accreditation: data.accreditation || "Autonomous Institution",
      logoUrl: persistedLogoUrl,
      primaryColor: primaryColor || "#7C3AED",
      secondaryColor: secondaryColor || "#06B6D4",
      contactEmail: emailLower,
      contactPhone: phone || '',
      address: address || String(campusName).trim(),
      academicYear: "2026 - 2027",
      currentTerm: "Semester 1 (2026)",
      createdAt: new Date().toISOString(),
      features: ["DEPARTMENTS", "COURSES", "CLASSES", "STUDENTS", "FACULTY", "ATTENDANCE", "EXAMS", "FEES", "ANALYTICS"]
    };
    this.institutions.push(newInst);

    // Create the initial Dean/Admin account for this new institution
    const adminHash = bcrypt.hashSync(adminPassword, 10);
    const adminUser = {
      id: `usr-admin-${newInstId}`,
      institutionId: newInstId,
      username: emailLower.split('@')[0],
      email: emailLower,
      password: adminHash,
      passwordHash: adminHash,
      role: 'ADMIN',
      name: (adminName || `Administrator (${name.trim()})`).trim(),
      title: 'Dean of Academic Operations & Institutional Admin',
      designation: 'Dean of Academic Operations & Institutional Admin',
      department: 'Institutional Administration',
      departmentId: '',
      employeeId: 'ADM-HQ-001',
      phone: phone || '',
      address: address || String(campusName).trim(),
      status: 'ACTIVE',
      avatar: null,
      profileImageUrl: null
    };
    this.users.push(adminUser);

    this.logAudit({
      institutionId: newInstId,
      userId: adminUser.id,
      userEmail: emailLower,
      userName: adminUser.name,
      role: 'ADMIN',
      action: 'INSTITUTION_REGISTERED',
      resource: 'INSTITUTION',
      resourceId: newInstId,
      details: `Institution ${name.trim()} (${instCode}) registered with Admin ${adminUser.name}`
    });

    this.saveToDisk();

    return {
      institution: newInst,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        institutionId: newInstId
      }
    };
  }

  updateInstitutionBranding(id, data, requestingUser = null) {
    if (!requestingUser) {
      throw new Error('Authentication required.');
    }

    // Must be either SUPER_ADMIN or ADMIN of this specific institution
    if (requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if (tenantId !== id) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: You do not have permission to customize another institution.');
      }
    }

    const inst = this.institutions.find(i => i.id === id);
    if (!inst) {
      throw new Error('Institution record not found.');
    }

    // Permitted branding & configuration updates
    if (data.name) inst.name = data.name.trim();
    if (data.campusName) inst.campusName = data.campusName.trim();
    if (data.code && data.code.trim()) {
      const nextCode = data.code.trim().toUpperCase();
      if (nextCode !== inst.code) {
        const codeExists = this.institutions.some(i => i.id !== inst.id && i.code === nextCode);
        if (codeExists) {
          throw new Error(`An institution with code '${nextCode}' already exists.`);
        }
        inst.code = nextCode;
        inst.slug = nextCode.toLowerCase();
      }
    }
    if (data.portalName) inst.portalName = data.portalName.trim();
    if (data.tagline !== undefined) inst.tagline = String(data.tagline).trim();
    if (data.accreditation !== undefined) inst.accreditation = String(data.accreditation).trim();
    if (data.logoData) {
      inst.logoUrl = this.saveInstitutionLogoData(inst.id, data.logoData);
    } else if (data.logoUrl !== undefined) {
      if (data.logoUrl === null || data.logoUrl === '') {
        inst.logoUrl = null;
      } else {
        inst.logoUrl = this.saveInstitutionLogoData(inst.id, String(data.logoUrl));
      }
    }
    if (data.primaryColor) inst.primaryColor = data.primaryColor.trim();
    if (data.secondaryColor) inst.secondaryColor = data.secondaryColor.trim();
    if (data.contactEmail) inst.contactEmail = data.contactEmail.trim().toLowerCase();
    if (data.contactPhone !== undefined) inst.contactPhone = String(data.contactPhone).trim();
    if (data.address !== undefined) inst.address = String(data.address).trim();
    if (data.academicYear) inst.academicYear = data.academicYear.trim();
    if (data.currentTerm) inst.currentTerm = data.currentTerm.trim();
    if (data.institutionType) inst.institutionType = data.institutionType.trim();
    if (data.minAttendancePercent !== undefined) inst.minAttendancePercent = parseInt(data.minAttendancePercent) || 75;
    if (data.gradingSystem !== undefined) inst.gradingSystem = String(data.gradingSystem).trim();
    if (data.website !== undefined) inst.website = String(data.website).trim();

    this.logAudit({
      institutionId: inst.id,
      userId: requestingUser.id,
      userEmail: requestingUser.email,
      userName: requestingUser.name,
      role: requestingUser.role,
      action: 'UPDATE_INSTITUTION_BRANDING',
      resource: 'INSTITUTION',
      resourceId: inst.id,
      details: `Institution branding customized: ${inst.name}`
    });

    this.saveToDisk();
    return inst;
  }

  updateInstitutionStatus(id, status, requestingUser = null) {
    if (!requestingUser || requestingUser.role !== 'SUPER_ADMIN') {
      throw new Error('FORBIDDEN_SUPER_ADMIN_ONLY: Only platform super administrators can modify institution status.');
    }

    const inst = this.institutions.find(i => i.id === id);
    if (!inst) {
      throw new Error('Institution record not found.');
    }

    if (!['ACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
      throw new Error('Invalid status. Allowed values: ACTIVE, SUSPENDED, PENDING.');
    }

    inst.status = status;

    this.logAudit({
      institutionId: inst.id,
      userId: requestingUser.id,
      userEmail: requestingUser.email,
      userName: requestingUser.name,
      role: 'SUPER_ADMIN',
      action: 'UPDATE_INSTITUTION_STATUS',
      resource: 'INSTITUTION',
      resourceId: inst.id,
      details: `Institution status updated to ${status} by Super Admin`
    });

    this.saveToDisk();
    return inst;
  }

  // Assignments & Submissions
  getAssignments(filter = {}, requestingUser = null) {
    let list = this.assignments;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      list = list.filter(a => (a.institutionId || 'inst-001') === tenantId);
    }
    return list.filter(a => {
      let match = true;
      if (filter.className) match = match && a.className === filter.className;
      if (filter.teacherId) match = match && a.teacherId === filter.teacherId;
      return match;
    });
  }
  createAssignment(data, requestingUser = null) {
    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (data.institutionId || 'inst-001');
    const classStudentsCount = this.students.filter(s =>
      (s.institutionId || 'inst-001') === institutionId &&
      (!data.className || s.className === data.className) &&
      s.status !== 'INACTIVE'
    ).length;
    const newAsg = {
      id: `asg-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
      institutionId,
      title: data.title,
      subject: data.subject,
      subjectCode: data.subjectCode || "SUB101",
      className: data.className || "",
      teacherId: data.teacherId || (requestingUser && requestingUser.teacherId) || "",
      teacherName: data.teacherName || (requestingUser && requestingUser.name) || "Course Faculty",
      assignedDate: new Date().toISOString().split('T')[0],
      dueDate: data.dueDate,
      maxMarks: parseInt(data.maxMarks) || 25,
      submissionsCount: 0,
      totalStudents: classStudentsCount,
      status: "ACTIVE",
      description: data.description || "Complete assignment tasks as specified.",
      attachments: data.attachments || []
    };
    this.assignments.unshift(newAsg);
    this.saveToDisk();
    return newAsg;
  }
  updateAssignment(id, data, requestingUser = null) {
    const idx = this.assignments.findIndex(a => a.id === id);
    if (idx === -1) return null;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.assignments[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot modify assignment of another institution.');
      }
    }
    this.assignments[idx] = { ...this.assignments[idx], ...data };
    this.saveToDisk();
    return this.assignments[idx];
  }
  deleteAssignment(id, requestingUser = null) {
    const idx = this.assignments.findIndex(a => a.id === id);
    if (idx === -1) return false;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((this.assignments[idx].institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot delete assignment of another institution.');
      }
    }
    this.assignments.splice(idx, 1);
    this.saveToDisk();
    return true;
  }

  getSubmissions(filter = {}, requestingUser = null) {
    let list = this.submissions;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      list = list.filter(s => (s.institutionId || 'inst-001') === tenantId);
    }
    return list.filter(s => {
      let match = true;
      if (filter.assignmentId) match = match && s.assignmentId === filter.assignmentId;
      if (filter.studentId) match = match && s.studentId === filter.studentId;
      return match;
    });
  }
  submitAssignment(data, requestingUser = null) {
    const existing = this.submissions.find(s => s.assignmentId === data.assignmentId && s.studentId === data.studentId);
    if (existing) {
      existing.submissionText = data.submissionText;
      existing.fileUrl = data.fileUrl || existing.fileUrl;
      existing.submittedDate = new Date().toISOString().split('T')[0];
      existing.status = "SUBMITTED";
      this.saveToDisk();
      return existing;
    }
    const student = this.getStudentById(data.studentId, requestingUser);
    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (student ? (student.institutionId || 'inst-001') : 'inst-001');
    const newSubm = {
      id: `subm-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
      institutionId,
      assignmentId: data.assignmentId,
      studentId: data.studentId,
      studentName: student ? `${student.firstName} ${student.lastName || ''}`.trim() : "Student",
      rollNumber: student ? student.rollNumber : "",
      submittedDate: new Date().toISOString().split('T')[0],
      status: "SUBMITTED",
      marksAwarded: null,
      maxMarks: data.maxMarks || 25,
      feedback: "Submitted on time. Awaiting evaluation.",
      submissionText: data.submissionText || "",
      fileUrl: data.fileUrl || ""
    };
    this.submissions.unshift(newSubm);
    const asg = this.assignments.find(a => a.id === data.assignmentId);
    if (asg) asg.submissionsCount = (asg.submissionsCount || 0) + 1;
    this.saveToDisk();
    return newSubm;
  }
  gradeSubmission(id, data, requestingUser = null) {
    const subm = this.submissions.find(s => s.id === id);
    if (!subm) return null;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      if ((subm.institutionId || 'inst-001') !== tenantId) {
        throw new Error('FORBIDDEN_CROSS_TENANT_ACCESS: Cannot grade submission of another institution.');
      }
    }
    subm.marksAwarded = parseFloat(data.marksAwarded);
    subm.feedback = data.feedback || "Evaluated by course faculty.";
    subm.status = "GRADED";
    this.saveToDisk();
    return subm;
  }

  // Timetable & Notifications
  getTimetable(filter = {}, requestingUser = null) {
    let list = this.timetable;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      list = list.filter(t => (t.institutionId || 'inst-001') === tenantId);
    }
    return list.filter(t => {
      let match = true;
      if (filter.className) match = match && t.className === filter.className;
      if (filter.day) match = match && t.day === filter.day;
      return match;
    });
  }

  createTimetableSlot(data, requestingUser = null) {
    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (data.institutionId || 'inst-001');
    const slot = {
      id: `tt-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
      institutionId,
      className: data.className || '',
      day: data.day || 'Monday',
      period: parseInt(data.period) || 1,
      time: data.time || '09:00 AM - 10:00 AM',
      subject: data.subject || '',
      subjectCode: data.subjectCode || '',
      teacher: data.teacher || (requestingUser && requestingUser.name) || '',
      room: data.room || 'Room 101'
    };
    this.timetable.push(slot);
    this.saveToDisk();
    return slot;
  }

  getNotifications(role, requestingUser = null) {
    let list = this.notifications;
    if (requestingUser && requestingUser.role !== 'SUPER_ADMIN') {
      const tenantId = requestingUser.institutionId || 'inst-001';
      list = list.filter(n => n.institutionId === tenantId);
    }
    if (!role) return list;
    return list.filter(n => n.role && (n.role.toUpperCase() === role.toUpperCase() || n.role === "ALL"));
  }

  createNotification(data, requestingUser = null) {
    const institutionId = (requestingUser && requestingUser.institutionId && requestingUser.role !== 'SUPER_ADMIN')
      ? requestingUser.institutionId
      : (data.institutionId || 'inst-001');
    const notif = {
      id: `notif-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
      institutionId,
      role: data.role || 'ALL',
      title: data.title,
      message: data.message || '',
      type: data.type || 'INFO',
      time: data.time || 'Just now',
      read: false
    };
    this.notifications.unshift(notif);
    this.saveToDisk();
    return notif;
  }

  // Academic Marks Auto-Grading Engine
  enterStudentMarks(studentIdOrData, marksDataOrUser, requestingUser = null) {
    let studentId = studentIdOrData;
    let marksData = marksDataOrUser || {};
    let reqUser = requestingUser;

    if (studentIdOrData && typeof studentIdOrData === 'object') {
      marksData = studentIdOrData;
      studentId = marksData.studentId;
      reqUser = marksDataOrUser || requestingUser;
    }

    const student = this.getStudentById(studentId, reqUser);
    if (!student) return null;
    const internal = parseFloat(marksData.internalMarks) || 0;
    const external = parseFloat(marksData.externalMarks !== undefined ? marksData.externalMarks : marksData.examMarks) || 0;
    const assignment = parseFloat(marksData.assignmentMarks) || 0;
    const practical = parseFloat(marksData.practicalMarks) || 0;

    let total = 0;
    const rawTotal = marksData.totalMarks !== undefined ? marksData.totalMarks : marksData.marksObtained;
    if (rawTotal !== undefined && marksData.internalMarks === undefined && marksData.externalMarks === undefined && marksData.examMarks === undefined) {
      total = Math.min(100, Math.max(0, Math.round(parseFloat(rawTotal) || 0)));
    } else if (marksData.externalMarks !== undefined && marksData.assignmentMarks === undefined && marksData.practicalMarks === undefined) {
      total = Math.min(100, Math.max(0, Math.round(internal + external)));
    } else {
      total = Math.min(100, Math.round(internal + external * 0.5 + assignment + practical * 0.2));
    }

    let grade = "RA";
    let gradePoint = 0;
    if (total >= 90) { grade = "O"; gradePoint = 10; }
    else if (total >= 80) { grade = "A+"; gradePoint = 9; }
    else if (total >= 70) { grade = "A"; gradePoint = 8; }
    else if (total >= 60) { grade = "B+"; gradePoint = 7; }
    else if (total >= 50) { grade = "B"; gradePoint = 6; }
    else if (total >= 40) { grade = "C"; gradePoint = 5; }
    else { grade = "RA"; gradePoint = 0; }

    let transcriptObj = this.academicTranscripts.find(t => t.studentId === student.id);
    if (!transcriptObj) {
      transcriptObj = {
        studentId: student.id,
        institutionId: student.institutionId,
        rollNumber: student.rollNumber,
        registerNumber: student.registerNumber,
        studentName: `${student.firstName} ${student.lastName || ''}`.trim(),
        degree: `${student.degree || 'Program'} in ${student.departmentName || student.branch || 'General Studies'}`,
        semester: `Semester ${student.semester || 1}`,
        courses: [],
        registeredCredits: 0,
        earnedCredits: 0,
        sgpa: 0,
        cgpa: 0,
        standing: 'Pass'
      };
      this.academicTranscripts.push(transcriptObj);
    }

    const subCode = (marksData.subjectCode || 'SUB101').trim().toUpperCase();
    const tenantSub = this.subjects.find(s =>
      (s.institutionId || 'inst-001') === (student.institutionId || 'inst-001') &&
      (s.code === subCode || s.name === marksData.subject || s.name === marksData.subjectTitle)
    );
    const subTitle = marksData.subjectTitle || marksData.subjectName || marksData.subject || (tenantSub ? tenantSub.name : subCode);
    const subCredits = parseInt(marksData.credits) || (tenantSub ? tenantSub.credits : 4);
    const semNum = parseInt(marksData.semester) || (tenantSub ? tenantSub.semester : (student.semester || 1));

    let course = transcriptObj.courses.find(c => c.code === subCode);
    if (course) {
      course.internalMarks = internal;
      course.externalMarks = external;
      course.marks = total;
      course.grade = grade;
      course.gradePoint = gradePoint;
      course.credits = subCredits;
      course.semester = semNum;
      if (marksData.subjectTitle || marksData.subjectName || marksData.subject) course.title = subTitle;
    } else {
      course = {
        code: subCode,
        title: subTitle,
        credits: subCredits,
        semester: semNum,
        internalMarks: internal,
        externalMarks: external,
        grade: grade,
        gradePoint: gradePoint,
        marks: total,
        category: marksData.category || 'PC'
      };
      transcriptObj.courses.push(course);
    }

    // Recompute SGPA / CGPA from courses
    const totalRegCredits = transcriptObj.courses.reduce((sum, c) => sum + (c.credits || 4), 0);
    const earnedCredits = transcriptObj.courses.filter(c => c.grade !== 'RA').reduce((sum, c) => sum + (c.credits || 4), 0);
    const weightedPoints = transcriptObj.courses.reduce((sum, c) => sum + ((c.gradePoint || 0) * (c.credits || 4)), 0);
    const computedGpa = totalRegCredits > 0 ? parseFloat((weightedPoints / totalRegCredits).toFixed(2)) : 0;

    transcriptObj.registeredCredits = totalRegCredits;
    transcriptObj.earnedCredits = earnedCredits;
    transcriptObj.sgpa = computedGpa;
    transcriptObj.cgpa = computedGpa;
    transcriptObj.standing = computedGpa >= 8.5 ? 'First Class with Distinction' : computedGpa >= 6.5 ? 'First Class' : computedGpa >= 5.0 ? 'Second Class' : 'Re-Appear (Arrear)';

    const rawStd = this.students.find(s => s.id === student.id);
    if (rawStd) {
      rawStd.sgpa = computedGpa;
      rawStd.cgpa = computedGpa;
      rawStd.creditsEarned = earnedCredits;
    }

    this.saveToDisk();
    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName || ''}`.trim(),
      rollNumber: student.rollNumber,
      subjectCode: subCode,
      subjectTitle: subTitle,
      subjectName: subTitle,
      internalMarks: internal,
      externalMarks: external,
      totalMarks: total,
      grade,
      gradePoint,
      sgpa: computedGpa,
      cgpa: computedGpa,
      newCgpa: computedGpa,
      courseResult: course
    };
  }
}

const db = new DataStore();
module.exports = db;
