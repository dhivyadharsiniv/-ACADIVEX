/**
 * End-to-End Verification Suite: Institution-Based Login Workflow & Role-Based Access
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

function request(method, urlPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => (raw += chunk));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (e) {}
        resolve({ status: res.statusCode, body: json, raw });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label} ${detail ? '— ' + detail : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n====================================================================');
  console.log('🧪 ACADIVEX INSTITUTION-BASED LOGIN WORKFLOW E2E TEST SUITE');
  console.log('====================================================================\n');

  // -------------------------------------------------------------------------
  // 1. FRONTEND DOM & LOGIN WORKFLOW STRUCTURE CHECKS
  // -------------------------------------------------------------------------
  console.log('👉 [Step 1] Inspecting Public Website & Institution Login Page HTML...');
  const htmlPath = path.join(__dirname, '..', 'frontend', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert(html.includes('id="modal-institution-entry"'), 'Public website includes Institution Entry verification modal (#modal-institution-entry)');
  assert(html.includes('id="entry-inst-name"') && html.includes('id="entry-campus-name"'), 'Institution Entry modal asks for Institution/College Name and Campus Name');
  assert(html.includes('openInstitutionEntryModal('), 'Public homepage buttons trigger openInstitutionEntryModal()');

  // Extract #view-login section
  const viewLoginStart = html.indexOf('id="view-login"');
  const viewStudentStart = html.indexOf('id="view-student"');
  const viewLoginHtml = html.slice(viewLoginStart, viewStudentStart);

  assert(viewLoginHtml.includes('id="login-inst-logo"'), 'Institution Login page displays verified Institution Logo (#login-inst-logo)');
  assert(viewLoginHtml.includes('id="login-inst-name"'), 'Institution Login page displays verified Institution Name (#login-inst-name)');
  assert(viewLoginHtml.includes('id="login-inst-campus"'), 'Institution Login page displays verified Campus Name (#login-inst-campus)');
  assert((viewLoginHtml.includes('id="login-tab-ADMIN"') || viewLoginHtml.includes('data-role-id="role-tab-admin"')) && viewLoginHtml.includes('Admin Login'), 'Institution Login page displays Option 1: Admin Login');
  assert((viewLoginHtml.includes('id="login-tab-TEACHER"') || viewLoginHtml.includes('data-role-id="role-tab-teacher"')) && viewLoginHtml.includes('Staff Login'), 'Institution Login page displays Option 2: Staff Login');
  assert((viewLoginHtml.includes('id="login-tab-STUDENT"') || viewLoginHtml.includes('data-role-id="role-tab-student"')) && viewLoginHtml.includes('Student Login'), 'Institution Login page displays Option 3: Student Login');
  assert(!viewLoginHtml.includes('Parent Login') && !viewLoginHtml.includes('role-tab-parent'), 'Parent Login is NOT displayed on the Institution Login page');
  assert(!viewLoginHtml.includes('Super Admin Login') && !viewLoginHtml.includes('openSuperAdminLoginModal'), 'Super Admin Login is NOT displayed on the Institution Login page');

  // Verify no duplicate Sign Out buttons in sidebars
  const stdSidebarEnd = html.indexOf('</aside>', html.indexOf('id="std-sidebar"'));
  const stdSidebarHtml = html.slice(html.indexOf('id="std-sidebar"'), stdSidebarEnd);
  assert(!stdSidebarHtml.includes('handleLogout()'), 'Student sidebar has no duplicate Sign Out button (only single header Log Out button)');

  const tchSidebarEnd = html.indexOf('</aside>', html.indexOf('id="tch-sidebar"'));
  const tchSidebarHtml = html.slice(html.indexOf('id="tch-sidebar"'), tchSidebarEnd);
  assert(!tchSidebarHtml.includes('handleLogout()'), 'Staff sidebar has no duplicate Sign Out button (only single header Log Out button)');

  const admSidebarEnd = html.indexOf('</aside>', html.indexOf('id="adm-sidebar"'));
  const admSidebarHtml = html.slice(html.indexOf('id="adm-sidebar"'), admSidebarEnd);
  assert(!admSidebarHtml.includes('handleLogout()'), 'Admin sidebar has no duplicate Sign Out button (only single header Log Out button)');

  // -------------------------------------------------------------------------
  // 2. INSTITUTION & CAMPUS VERIFICATION API
  // -------------------------------------------------------------------------
  console.log('\n👉 [Step 2] Testing Public Institutions Directory & Institution/Campus Verification...');
  const dirRes = await request('GET', '/api/saas/public-institutions');
  assert(dirRes.status === 200 && dirRes.body?.success && Array.isArray(dirRes.body.data), 'GET /api/saas/public-institutions returns active registered institutions');
  assert(dirRes.body.data.length >= 2 && dirRes.body.data[0].campusName, 'Public institutions include campusName and branding');

  const inst1Name = dirRes.body.data.find(i => i.id === 'inst-001')?.name || 'Apex Institute of Technology & Science';

  // Valid verification for Institution 1
  const verifyApex = await request('POST', '/api/saas/verify-institution', {
    institutionName: inst1Name,
    campusName: 'Bengaluru Main Campus'
  });
  assert(verifyApex.status === 200 && verifyApex.body?.success && verifyApex.body.institution?.id === 'inst-001', `Valid Institution & Campus ("${inst1Name}" + "Bengaluru Main Campus") verified`);

  // Valid verification for Institution 2
  const verifyXavier = await request('POST', '/api/saas/verify-institution', {
    institutionName: 'St. Xavier Institute of Science & Technology',
    campusName: 'Mumbai Mahapalika Campus'
  });
  assert(verifyXavier.status === 200 && verifyXavier.body?.success && verifyXavier.body.institution?.id === 'inst-002', 'Valid Institution & Campus ("St. Xavier Institute of Science & Technology" + "Mumbai Mahapalika Campus") verified');

  // Invalid / arbitrary institution name rejected
  const verifyFake = await request('POST', '/api/saas/verify-institution', {
    institutionName: 'Arbitrary Unregistered University',
    campusName: 'Random Campus'
  });
  assert(verifyFake.status === 404 && verifyFake.body?.canRegister === true, 'Unregistered institution name is rejected with 404 and canRegister=true');

  // Mismatched campus name rejected
  const verifyWrongCampus = await request('POST', '/api/saas/verify-institution', {
    institutionName: inst1Name,
    campusName: 'Mumbai Mahapalika Campus'
  });
  assert(verifyWrongCampus.status === 404 && verifyWrongCampus.body?.success === false, 'Mismatched campus name for a valid institution is rejected with 404');

  // -------------------------------------------------------------------------
  // 3. ADMIN LOGIN ON VERIFIED INSTITUTION PORTAL
  // -------------------------------------------------------------------------
  console.log('\n👉 [Step 3] Testing Admin Login on Verified Institution Portal (inst-001)...');
  const adminLoginRes = await request('POST', '/api/auth/login', {
    email: 'admin@acadivex.edu',
    password: 'Admin@123',
    role: 'ADMIN',
    institutionId: 'inst-001'
  });
  assert(adminLoginRes.status === 200 && adminLoginRes.body?.success, 'Admin logs in successfully on verified inst-001 portal');
  assert(adminLoginRes.body.user?.institutionId === 'inst-001' && adminLoginRes.body.user?.institutionCampusName === 'Bengaluru Main Campus', 'Admin login response includes institutionId and institutionCampusName');
  const adminToken = adminLoginRes.body.token;

  // -------------------------------------------------------------------------
  // 4. ADMIN CREATES A NEW STAFF ACCOUNT
  // -------------------------------------------------------------------------
  console.log('\n👉 [Step 4] Testing Admin Creating a Staff Account with Assigned Credentials...');
  const uniqueSuffix = Date.now().toString().slice(-5);
  const newStaffEmail = `dr.kavita.${uniqueSuffix}@edumanage.edu`;
  const newStaffPassword = `StaffPass#${uniqueSuffix}`;

  const createStaffRes = await request('POST', '/api/teachers', {
    firstName: 'Kavita',
    lastName: 'Krishnamurthy',
    departmentId: 'dept-01',
    department: 'Computer Science & Engineering',
    designation: 'Associate Professor',
    qualification: 'Ph.D. in Distributed Systems',
    assignedClasses: ['B.Tech CSE - 4A'],
    subjects: 'Cloud Computing, Distributed Systems',
    phone: '+91 98450 11223',
    email: newStaffEmail,
    password: newStaffPassword
  }, adminToken);

  assert(createStaffRes.status === 201 && createStaffRes.body?.success, 'Admin creates new Staff member via POST /api/teachers');
  const createdStaff = createStaffRes.body?.data;
  assert(createdStaff && createdStaff.employeeId && createdStaff.institutionId === 'inst-001', `System assigns unique Staff ID (${createdStaff?.employeeId}) scoped to inst-001`);

  // -------------------------------------------------------------------------
  // 5. ADMIN CREATES A NEW STUDENT ACCOUNT
  // -------------------------------------------------------------------------
  console.log('\n👉 [Step 5] Testing Admin Creating a Student Account with Assigned Credentials...');
  const newStudentEmail = `rohan.verma.${uniqueSuffix}@edumanage.edu`;
  const newStudentPassword = `StudentPass#${uniqueSuffix}`;

  const createStudentRes = await request('POST', '/api/students', {
    firstName: 'Rohan',
    lastName: 'Verma',
    departmentId: 'dept-01',
    courseId: 'crs-01',
    classId: 'cls-01',
    teacherId: createdStaff?.id || 'tch-01',
    year: 2,
    semester: 4,
    phone: '+91 98450 99887',
    email: newStudentEmail,
    password: newStudentPassword
  }, adminToken);

  assert(createStudentRes.status === 201 && createStudentRes.body?.success, 'Admin creates new Student via POST /api/students');
  const createdStudent = createStudentRes.body?.data;
  assert(createdStudent && createdStudent.registerNumber && createdStudent.institutionId === 'inst-001', `System assigns unique Student ID (${createdStudent?.registerNumber}) scoped to inst-001`);

  // -------------------------------------------------------------------------
  // 6. STAFF LOGS IN USING ADMIN-CREATED CREDENTIALS (EMAIL & STAFF ID)
  // -------------------------------------------------------------------------
  console.log('\n👉 [Step 6] Testing Staff Login with Admin-Assigned Credentials...');
  const staffLoginByEmail = await request('POST', '/api/auth/login', {
    email: newStaffEmail,
    password: newStaffPassword,
    role: 'TEACHER',
    institutionId: 'inst-001'
  });
  assert(staffLoginByEmail.status === 200 && staffLoginByEmail.body?.success && staffLoginByEmail.body.user?.role === 'TEACHER', 'Created Staff logs in via Staff Login using assigned Email & Password');

  const staffLoginById = await request('POST', '/api/auth/login', {
    email: createdStaff.employeeId,
    password: newStaffPassword,
    role: 'TEACHER',
    institutionId: 'inst-001'
  });
  assert(staffLoginById.status === 200 && staffLoginById.body?.success && staffLoginById.body.user?.employeeId === createdStaff.employeeId, `Created Staff also logs in using assigned Staff ID (${createdStaff.employeeId})`);

  const staffToken = staffLoginByEmail.body.token;

  // Verify Staff can access Staff dashboard data & cannot access Admin account creation
  const staffStudentsView = await request('GET', '/api/students', null, staffToken);
  assert(staffStudentsView.status === 200 && staffStudentsView.body?.data?.every(s => s.institutionId === 'inst-001'), 'Staff dashboard loads only inst-001 students');

  const staffCannotAddTeacher = await request('POST', '/api/teachers', {
    firstName: 'Unauthorized',
    lastName: 'Staff',
    email: `unauth.${uniqueSuffix}@edumanage.edu`
  }, staffToken);
  assert(staffCannotAddTeacher.status === 403, 'Staff role is forbidden (403) from Admin-only Staff creation endpoint');

  // -------------------------------------------------------------------------
  // 7. STUDENT LOGS IN USING ADMIN-CREATED CREDENTIALS (EMAIL & REGISTER NO)
  // -------------------------------------------------------------------------
  console.log('\n👉 [Step 7] Testing Student Login with Admin-Assigned Credentials...');
  const studentLoginByEmail = await request('POST', '/api/auth/login', {
    email: newStudentEmail,
    password: newStudentPassword,
    role: 'STUDENT',
    institutionId: 'inst-001'
  });
  assert(studentLoginByEmail.status === 200 && studentLoginByEmail.body?.success && studentLoginByEmail.body.user?.role === 'STUDENT', 'Created Student logs in via Student Login using assigned Email & Password');

  const studentLoginByRegNo = await request('POST', '/api/auth/login', {
    email: createdStudent.registerNumber,
    password: newStudentPassword,
    role: 'STUDENT',
    institutionId: 'inst-001'
  });
  assert(studentLoginByRegNo.status === 200 && studentLoginByRegNo.body?.success && studentLoginByRegNo.body.user?.registerNumber === createdStudent.registerNumber, `Created Student also logs in using assigned Register Number (${createdStudent.registerNumber})`);

  const studentToken = studentLoginByEmail.body.token;

  // Verify Student can view Student dashboard data & cannot access Staff/Admin endpoints
  const studentAssignmentsRes = await request('GET', '/api/assignments', null, studentToken);
  assert(studentAssignmentsRes.status === 200 && studentAssignmentsRes.body?.success, 'Student accesses Student dashboard assignments');

  const studentCannotCreateStudent = await request('POST', '/api/students', {
    firstName: 'Hacker',
    lastName: 'Student',
    email: `hacker.${uniqueSuffix}@edumanage.edu`
  }, studentToken);
  assert(studentCannotCreateStudent.status === 403, 'Student role is forbidden (403) from Admin student creation endpoint');

  // -------------------------------------------------------------------------
  // 8. CROSS-INSTITUTION PORTAL & DATA ISOLATION
  // -------------------------------------------------------------------------
  console.log('\n👉 [Step 8] Testing Cross-Institution Login Blocking & Data Isolation...');
  // Try logging into Institution 2 (inst-002) portal with Institution 1's newly created Staff & Student
  const crossPortalStaff = await request('POST', '/api/auth/login', {
    email: newStaffEmail,
    password: newStaffPassword,
    role: 'TEACHER',
    institutionId: 'inst-002'
  });
  assert(crossPortalStaff.status === 403 && crossPortalStaff.body?.success === false, 'Staff from Institution 1 is blocked (403) from logging in through Institution 2 portal');

  const crossPortalStudent = await request('POST', '/api/auth/login', {
    email: newStudentEmail,
    password: newStudentPassword,
    role: 'STUDENT',
    institutionId: 'inst-002'
  });
  assert(crossPortalStudent.status === 403 && crossPortalStudent.body?.success === false, 'Student from Institution 1 is blocked (403) from logging in through Institution 2 portal');

  // Register a brand-new 3rd institution with a custom Campus Name and test full isolation
  const regInstRes = await request('POST', '/api/saas/register-institution', {
    institutionName: `National Institute of Science ${uniqueSuffix}`,
    campusName: `Hyderabad Cyberabad Campus ${uniqueSuffix}`,
    institutionCode: `NIS-${uniqueSuffix}`,
    institutionType: 'UNIVERSITY',
    subscriptionPlan: 'ENTERPRISE',
    adminName: 'Dr. Vikram Sethi',
    adminEmail: `dean.nis.${uniqueSuffix}@nis.edu.in`,
    adminPassword: 'DeanPassword#123',
    phone: '+91 40 2300 5000',
    address: 'Gachibowli, Hyderabad'
  });
  assert(regInstRes.status === 201 && regInstRes.body?.success, 'New institution registers with custom campusName');
  const newInst = regInstRes.body.institution;

  // Verify the newly registered institution & campus via /api/saas/verify-institution
  const verifyNewInst = await request('POST', '/api/saas/verify-institution', {
    institutionName: `National Institute of Science ${uniqueSuffix}`,
    campusName: `Hyderabad Cyberabad Campus ${uniqueSuffix}`
  });
  assert(verifyNewInst.status === 200 && verifyNewInst.body?.institution?.id === newInst.id, 'Newly registered institution and campus verify via POST /api/saas/verify-institution');

  // Log in as the new institution's Admin
  const newInstAdminLogin = await request('POST', '/api/auth/login', {
    email: `dean.nis.${uniqueSuffix}@nis.edu.in`,
    password: 'DeanPassword#123',
    role: 'ADMIN',
    institutionId: newInst.id
  });
  assert(newInstAdminLogin.status === 200 && newInstAdminLogin.body?.success, 'New institution Admin logs in on their verified institution portal');
  const newInstAdminToken = newInstAdminLogin.body.token;

  // Check that new institution Admin sees 0 students and 0 teachers from inst-001
  const newInstStudents = await request('GET', '/api/students', null, newInstAdminToken);
  const newInstTeachers = await request('GET', '/api/teachers', null, newInstAdminToken);
  assert(newInstStudents.status === 200 && newInstStudents.body?.data?.length === 0, 'New institution has 0 students leaked from other institutions');
  assert(newInstTeachers.status === 200 && newInstTeachers.body?.data?.length === 0, 'New institution has 0 staff leaked from other institutions');

  console.log('\n====================================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('====================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
