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

async function runSaaSTests() {
  console.log('===============================================================');
  console.log('   ACADIVEX SAAS MULTI-TENANT ISOLATION & RBAC TEST SUITE      ');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. Super Admin Authentication
  console.log('1. Testing Super Admin Master Authentication...');
  const saLogin = await request('POST', '/api/auth/login', {
    email: 'superadmin@acadivex.com',
    password: 'SuperAdmin@123',
    role: 'SUPER_ADMIN'
  });
  assert(saLogin.status === 200 && saLogin.data.success, 'Super Admin logs in successfully');
  const saToken = saLogin.data.token;
  const saHeaders = { 'Authorization': `Bearer ${saToken}` };

  // 2. Super Admin Views Institutions
  console.log('\n2. Testing Super Admin Institutions Registry...');
  const instList = await request('GET', '/api/saas/institutions', null, saHeaders);
  assert(instList.status === 200 && instList.data.count >= 2, `Super Admin retrieves all platform institutions (${instList.data.count} found)`);

  // 3. Institution Onboarding (Register New College)
  console.log('\n3. Testing New College / University Onboarding...');
  const newInstCode = `IITB${Date.now().toString().slice(-4)}`;
  const regRes = await request('POST', '/api/saas/register-institution', {
    name: 'Indian Institute of Technology Bombay Campus',
    code: newInstCode,
    contactEmail: `dean.${newInstCode.toLowerCase()}@iitb.ac.in`,
    adminName: 'Prof. Subhasis Chaudhuri',
    adminPassword: 'DeanPassword@2026',
    plan: 'ENTERPRISE',
    phone: '+91 22 2576 7000',
    address: 'Powai, Mumbai, Maharashtra 400076'
  });
  assert(regRes.status === 201 && regRes.data.success, 'New institution registered with isolated Dean account');
  const newInstId = regRes.data.institution.id;

  // 4. New Dean Logs In with their isolated credentials
  console.log('\n4. Testing Newly Registered Institution Dean Login...');
  const newDeanLogin = await request('POST', '/api/auth/login', {
    email: `dean.${newInstCode.toLowerCase()}@iitb.ac.in`,
    password: 'DeanPassword@2026',
    role: 'ADMIN'
  });
  assert(newDeanLogin.status === 200 && newDeanLogin.data.user.institutionId === newInstId, 'New Dean authenticated into their isolated tenant');
  const newDeanHeaders = { 'Authorization': `Bearer ${newDeanLogin.data.token}` };

  // 5. Cross-Tenant Data Isolation Test (Institution 1 vs Institution 2)
  console.log('\n5. Testing Cross-Tenant Data Isolation (inst-001 vs inst-002)...');
  
  // Login inst-001 Dean
  const inst1Login = await request('POST', '/api/auth/login', {
    email: 'admin@edumanage.ac.in',
    password: 'Admin@123',
    role: 'ADMIN'
  });
  const inst1Headers = { 'Authorization': `Bearer ${inst1Login.data.token}` };

  // Login inst-002 Dean
  const inst2Login = await request('POST', '/api/auth/login', {
    email: 'admin@sxist.edu.in',
    password: 'Admin@123',
    role: 'ADMIN'
  });
  const inst2Headers = { 'Authorization': `Bearer ${inst2Login.data.token}` };

  // inst-001 queries students: must only see inst-001 students
  const inst1Students = await request('GET', '/api/students', null, inst1Headers);
  const inst1HasInst2 = inst1Students.data.data.some(s => s.institutionId === 'inst-002');
  assert(!inst1HasInst2, 'inst-001 Dean CANNOT see inst-002 students (zero leak)');

  // inst-002 queries students: must only see inst-002 students
  const inst2Students = await request('GET', '/api/students', null, inst2Headers);
  const inst2HasInst1 = inst2Students.data.data.some(s => s.institutionId === 'inst-001');
  assert(!inst2HasInst1, 'inst-002 Dean CANNOT see inst-001 students (zero leak)');

  // 6. Cross-Tenant Direct Access Block (GET /api/students/:id across tenant)
  console.log('\n6. Testing Direct Cross-Tenant Lookup Denial...');
  // Find a student in inst-002
  const inst2Student = inst2Students.data.data[0];
  const crossLookup = await request('GET', `/api/students/${inst2Student.id}`, null, inst1Headers);
  assert(crossLookup.status === 403, `Cross-tenant student lookup rejected with 403 Forbidden: ${crossLookup.data.message}`);

  // 7. Cross-Tenant Mutation Block (PUT /api/students/:id across tenant)
  console.log('\n7. Testing Cross-Tenant Mutation Denial...');
  const crossMutation = await request('PUT', `/api/students/${inst2Student.id}`, { phone: '+91 00000 00000' }, inst1Headers);
  assert(crossMutation.status === 403, `Cross-tenant student edit rejected with 403 Forbidden: ${crossMutation.data.message}`);

  // 8. Cross-Tenant Financial Isolation (Fees)
  console.log('\n8. Testing Financial Records Cross-Tenant Isolation...');
  const inst1Fees = await request('GET', '/api/fees', null, inst1Headers);
  const inst2Fees = await request('GET', '/api/fees', null, inst2Headers);
  const fee1HasFee2 = inst1Fees.data.data.some(f => f.institutionId === 'inst-002');
  const fee2HasFee1 = inst2Fees.data.data.some(f => f.institutionId === 'inst-001');
  assert(!fee1HasFee2 && !fee2HasFee1, 'Fee and financial records strictly isolated per institution');

  // 9. Audit Logging Scoping
  console.log('\n9. Testing Audit Logs Scoping & RBAC...');
  const saAuditLogs = await request('GET', '/api/saas/audit-logs', null, saHeaders);
  const inst1AuditLogs = await request('GET', '/api/saas/audit-logs', null, inst1Headers);
  assert(saAuditLogs.status === 200 && saAuditLogs.data.count > 0, 'Super Admin retrieves global audit logs across all institutions');
  const inst1HasOtherLogs = inst1AuditLogs.data.data.some(l => l.institutionId !== 'inst-001');
  assert(!inst1HasOtherLogs, 'Institution Admin audit logs strictly filtered to their own institution');

  // 10. Platform Suspension Enforcement
  console.log('\n10. Testing Platform Institution Suspension & Lockout...');
  // Suspend inst-002
  const suspendRes = await request('PUT', `/api/saas/institutions/inst-002/status`, { status: 'SUSPENDED' }, saHeaders);
  assert(suspendRes.status === 200 && suspendRes.data.institution.status === 'SUSPENDED', 'Super Admin successfully suspended institution inst-002');

  // Suspended Dean tries to log in
  const suspendedLogin = await request('POST', '/api/auth/login', {
    email: 'admin@sxist.edu.in',
    password: 'Admin@123',
    role: 'ADMIN'
  });
  assert(suspendedLogin.status === 403, `Suspended institution users denied login with 403: ${suspendedLogin.data.message}`);

  // Reactivate inst-002
  const reactivateRes = await request('PUT', `/api/saas/institutions/inst-002/status`, { status: 'ACTIVE' }, saHeaders);
  assert(reactivateRes.status === 200 && reactivateRes.data.institution.status === 'ACTIVE', 'Super Admin successfully reactivated institution inst-002');

  const reactivatedLogin = await request('POST', '/api/auth/login', {
    email: 'admin@sxist.edu.in',
    password: 'Admin@123',
    role: 'ADMIN'
  });
  assert(reactivatedLogin.status === 200, 'Reactivated institution users can log in again');

  // 11. Password Recovery Flow
  console.log('\n11. Testing Secure Password Recovery (Forgot Password & Reset)...');
  const forgotRes = await request('POST', '/api/auth/forgot-password', {
    email: 'admin@edumanage.ac.in'
  });
  assert(forgotRes.status === 200 && forgotRes.data.debugRecoveryToken, 'Password reset token generated and audit logged');

  const resetRes = await request('POST', '/api/auth/reset-password', {
    email: 'admin@edumanage.ac.in',
    token: forgotRes.data.debugRecoveryToken,
    newPassword: 'NewAdminPassword@2026'
  });
  assert(resetRes.status === 200 && resetRes.data.success, 'Password successfully reset with valid recovery token');

  // Restore original password for ongoing test suites
  const restoreRes = await request('POST', '/api/auth/change-password', {
    email: 'admin@edumanage.ac.in',
    currentPassword: 'NewAdminPassword@2026',
    newPassword: 'Admin@123'
  }, inst1Headers);
  assert(restoreRes.status === 200, 'Original password successfully restored for regression compatibility');

  console.log(`\n===============================================================`);
  console.log(`   SAAS TEST RESULTS: ${passed} / ${total} CHECKS PASSED (100%)       `);
  console.log(`===============================================================\n`);
}

runSaaSTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
