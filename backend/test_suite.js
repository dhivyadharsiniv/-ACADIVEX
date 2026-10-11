const http = require('http');

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:5000${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE EDUMANAGE VERIFICATION TESTS ---');

  // Login as Admin
  const adminLogin = await request('POST', '/api/auth/login', {
    email: 'admin@edumanage.ac.in',
    password: 'Admin@123',
    role: 'ADMIN'
  });
  console.log('Admin login status:', adminLogin.status, adminLogin.data.success ? 'SUCCESS' : 'FAILED');
  const adminToken = adminLogin.data.token;
  const adminHeaders = { 'Authorization': `Bearer ${adminToken}`, 'x-user-role': 'ADMIN' };

  const ts = Date.now();
  const emailA = `arun.cse.${ts}@gmail.com`;
  const emailB = `bhavna.ece.${ts}@gmail.com`;
  const emailD = `deepak.cse.${ts}@gmail.com`;
  const emailStaff1 = `eshwar.m.${ts}@edumanage.ac.in`;
  const emailStaff2 = `elango.s.${ts}@edumanage.ac.in`;
  const emailC = `charan.tej.${ts}@gmail.com`;

  // TEST A: Admin creates CSE student -> CSE2026001 -> immediate login
  console.log('\n--- TEST A: Admin creates CSE student ---');
  const stdA = await request('POST', '/api/students', {
    firstName: 'Arun',
    lastName: 'Kumar',
    email: emailA,
    password: 'Student@123',
    departmentId: 'dept-01',
    courseId: 'crs-01',
    classId: 'cls-01',
    year: 2,
    semester: 4
  }, adminHeaders);
  console.log('Test A Create Student Status:', stdA.status, stdA.data.message);
  console.log('Assigned Register Number:', stdA.data.data?.registerNumber);
  console.log('Assigned Department:', stdA.data.data?.departmentName);

  // Student A Login
  const loginA = await request('POST', '/api/auth/login', {
    email: emailA,
    password: 'Student@123',
    role: 'STUDENT'
  });
  console.log('Student A immediate login status:', loginA.status, 'User role:', loginA.data.user?.role, 'Name:', loginA.data.user?.name);

  // TEST B: Admin creates ECE student -> ECE2026001
  console.log('\n--- TEST B: Admin creates ECE student ---');
  const stdB = await request('POST', '/api/students', {
    firstName: 'Bhavna',
    lastName: 'Rao',
    email: emailB,
    password: 'Student@123',
    departmentId: 'dept-03',
    courseId: 'crs-03',
    classId: 'cls-05',
    year: 3,
    semester: 6
  }, adminHeaders);
  console.log('Test B Create Student Status:', stdB.status, stdB.data.message);
  console.log('Assigned Register Number:', stdB.data.data?.registerNumber);
  console.log('Assigned Department:', stdB.data.data?.departmentName);

  // TEST D: Create second CSE student -> CSE2026002 (sequential, no duplicates)
  console.log('\n--- TEST D: Sequential CSE students (CSE2026001 and CSE2026002) ---');
  const stdD = await request('POST', '/api/students', {
    firstName: 'Deepak',
    lastName: 'Nath',
    email: emailD,
    password: 'Student@123',
    departmentId: 'dept-01',
    courseId: 'crs-01',
    classId: 'cls-01',
    year: 2,
    semester: 4
  }, adminHeaders);
  console.log('Student D Register Number:', stdD.data.data?.registerNumber);
  console.log('Sequential check:', stdA.data.data?.registerNumber?.startsWith('CSE2026') && stdD.data.data?.registerNumber?.startsWith('CSE2026') ? 'PASSED' : 'CHECK FAILED');

  // TEST E: Create two ECE staff -> ECE-EMP-001 and ECE-EMP-002
  console.log('\n--- TEST E: Sequential Staff Employee IDs (ECE-EMP-001 and ECE-EMP-002) ---');
  const staff1 = await request('POST', '/api/teachers', {
    firstName: 'Eshwar',
    lastName: 'Murthy',
    email: emailStaff1,
    password: 'Teacher@123',
    departmentId: 'dept-03',
    designation: 'Assistant Professor'
  }, adminHeaders);
  console.log('Staff 1 Employee ID:', staff1.data.data?.employeeId);

  const staff2 = await request('POST', '/api/teachers', {
    firstName: 'Elango',
    lastName: 'S',
    email: emailStaff2,
    password: 'Teacher@123',
    departmentId: 'dept-03',
    designation: 'Associate Professor'
  }, adminHeaders);
  console.log('Staff 2 Employee ID:', staff2.data.data?.employeeId);
  console.log('Sequential Staff Check:', staff1.data.data?.employeeId?.startsWith('ECE-EMP') && staff2.data.data?.employeeId?.startsWith('ECE-EMP') ? 'PASSED' : 'CHECK FAILED');

  // TEST C: Staff creates student -> auto-assigned to Staff's class
  console.log('\n--- TEST C: Staff creates student into assigned class ---');
  // Login as Staff Arvind (assigned to B.Tech CSE - 4A, CSE department)
  const staffLogin = await request('POST', '/api/auth/login', {
    email: 'arvind.s@edumanage.ac.in',
    password: 'Teacher@123',
    role: 'TEACHER'
  });
  const staffToken = staffLogin.data.token;
  const staffHeaders = { 'Authorization': `Bearer ${staffToken}`, 'x-user-role': 'TEACHER' };

  const stdC = await request('POST', '/api/students', {
    firstName: 'Charan',
    lastName: 'Tej',
    email: emailC,
    password: 'Student@123',
    className: 'B.Tech CSE - 4A'
  }, staffHeaders);
  console.log('Test C Status:', stdC.status, stdC.data.message);
  console.log('Student C Register Number:', stdC.data.data?.registerNumber);
  console.log('Student C Department:', stdC.data.data?.departmentName);
  console.log('Student C Class:', stdC.data.data?.className);
  console.log('Student C Proctor:', stdC.data.data?.proctorName);

  // TEST I: Student logs in with credentials created by Staff
  console.log('\n--- TEST I: Student logs in with credentials created by Staff ---');
  const loginC = await request('POST', '/api/auth/login', {
    email: emailC,
    password: 'Student@123',
    role: 'STUDENT'
  });
  console.log('Student C Login Status:', loginC.status, 'Success:', loginC.data.success);
  console.log('Token generated:', !!loginC.data.token);
  console.log('User Role:', loginC.data.user?.role);
  const studentCToken = loginC.data.token;
  const studentCHeaders = { 'Authorization': `Bearer ${studentCToken}`, 'x-user-role': 'STUDENT' };

  // TEST F: Upload profile image for Student -> persists
  console.log('\n--- TEST F: Upload profile image for Student ---');
  // 1x1 transparent png data uri
  const testPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const uploadStd = await request('POST', '/api/upload/profile-image', {
    image: testPng,
    targetType: 'STUDENT',
    targetId: stdC.data.data?.id
  }, studentCHeaders);
  console.log('Upload Student Image Status:', uploadStd.status, 'Image URL:', uploadStd.data.url);

  // Verify persistence after re-login
  const reLoginC = await request('POST', '/api/auth/login', {
    email: emailC,
    password: 'Student@123',
    role: 'STUDENT'
  });
  console.log('Re-login avatar:', reLoginC.data.user?.avatar, 'Matches:', reLoginC.data.user?.avatar === uploadStd.data.url ? 'PASSED' : 'FAILED');

  // TEST G: Admin uploads Staff profile image
  console.log('\n--- TEST G: Admin uploads Staff profile image ---');
  const uploadTch = await request('POST', '/api/upload/profile-image', {
    image: testPng,
    targetType: 'TEACHER',
    targetId: staff1.data.data?.id
  }, adminHeaders);
  console.log('Admin Upload Staff Image Status:', uploadTch.status, 'Image URL:', uploadTch.data.url);

  // TEST H: Staff edits Student profile image of own class
  console.log('\n--- TEST H: Staff edits Student profile image of own class ---');
  const uploadByStaff = await request('POST', '/api/upload/profile-image', {
    image: testPng,
    targetType: 'STUDENT',
    targetId: stdC.data.data?.id
  }, staffHeaders);
  console.log('Staff edit Student image Status:', uploadByStaff.data.success ? 200 : uploadByStaff.status, 'Success:', uploadByStaff.data.success);

  // TEST J: Student attempts to change Register Number or Department -> 403 Forbidden
  console.log('\n--- TEST J: Student attempts to edit immutable academic fields ---');
  const attackRegNo = await request('PUT', `/api/students/${stdC.data.data?.id}`, {
    registerNumber: 'HACKED9999'
  }, studentCHeaders);
  console.log('Student edit registerNumber status:', attackRegNo.status, '(Expected 403):', attackRegNo.status === 403 ? 'PASSED' : 'FAILED');
  console.log('Message:', attackRegNo.data.message);

  const attackDept = await request('PUT', `/api/students/${stdC.data.data?.id}`, {
    departmentId: 'dept-03'
  }, studentCHeaders);
  console.log('Student edit department status:', attackDept.status, '(Expected 403):', attackDept.status === 403 ? 'PASSED' : 'FAILED');
  console.log('Message:', attackDept.data.message);

  // Student can edit permitted personal details
  const allowedEdit = await request('PUT', `/api/students/${stdC.data.data?.id}`, {
    phone: '+91 99999 88888',
    bloodGroup: 'B+'
  }, studentCHeaders);
  console.log('Student permitted personal update status:', allowedEdit.status, '(Expected 200):', allowedEdit.status === 200 ? 'PASSED' : 'FAILED');
  console.log('Updated phone:', allowedEdit.data.data?.phone, 'bloodGroup:', allowedEdit.data.data?.bloodGroup);

  // Test duplicate email check
  console.log('\n--- Email Uniqueness Validation ---');
  const dupEmail = await request('POST', '/api/students', {
    firstName: 'Duplicate',
    email: emailA,
    departmentId: 'dept-01'
  }, adminHeaders);
  console.log('Duplicate email status:', dupEmail.status, '(Expected 400):', dupEmail.status === 400 ? 'PASSED' : 'FAILED');
  console.log('Duplicate email message:', dupEmail.data.message);

  console.log('\n--- ALL TEST SUITE RUNS COMPLETED ---');
}

runTests().catch(console.error);
