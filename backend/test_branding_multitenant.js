/**
 * Comprehensive Multi-Tenant Institution Branding Test Suite
 * Validates dynamic branding, logo isolation, cross-tenant protection, and custom branding settings
 */

const http = require('http');

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🏛️  ACADIVEX MULTI-TENANT BRANDING TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // 1. Institution inst-001 Admin Login (Apex Institute)
  console.log('--- Test 1: inst-001 Admin Login & Dynamic Branding Resolution ---');
  const login1 = await makeRequest('POST', '/api/auth/login', {
    email: 'admin@acadivex.edu',
    password: 'EduManage@2026',
    role: 'ADMIN'
  });
  assert('inst-001 Login returns success', login1.status === 200 && login1.data.success);
  assert('inst-001 institutionId is inst-001', login1.data.user?.institutionId === 'inst-001');
  assert('inst-001 institutionName contains Apex Institute', login1.data.user?.institutionName?.includes('Apex Institute'));
  assert('inst-001 institutionType is COLLEGE', login1.data.user?.institutionType === 'COLLEGE');
  assert('inst-001 primary color is resolved', !!login1.data.user?.institutionPrimaryColor);
  const tokenInst1 = login1.data.token;

  // 2. Institution inst-002 Admin Login (St. Xavier Institute)
  console.log('\n--- Test 2: inst-002 Admin Login & Independent Branding Resolution ---');
  const login2 = await makeRequest('POST', '/api/auth/login', {
    email: 'admin@sxist.edu.in',
    password: 'Admin@123',
    role: 'ADMIN'
  });
  assert('inst-002 Login returns success', login2.status === 200 && login2.data.success);
  assert('inst-002 institutionId is inst-002', login2.data.user?.institutionId === 'inst-002');
  assert('inst-002 institutionName contains St. Xavier', login2.data.user?.institutionName?.includes('St. Xavier'));
  assert('inst-002 brand colors are distinct', login2.data.user?.institutionPrimaryColor === '#1E3A8A');
  const tokenInst2 = login2.data.token;

  // 3. Institution inst-001 Logo Upload (Isolated storage)
  console.log('\n--- Test 3: Upload Custom Institution Crest Logo (inst-001) ---');
  // Sample 1x1 transparent PNG data URI
  const samplePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const uploadRes = await makeRequest('POST', '/api/upload/institution-logo', {
    image: samplePng,
    institutionId: 'inst-001'
  }, { 'Authorization': `Bearer ${tokenInst1}` });
  assert('Upload returns success', uploadRes.status === 200 && uploadRes.data.success);
  assert('Logo URL starts with /uploads/avatars/logo-inst-001', uploadRes.data.url?.startsWith('/uploads/avatars/logo-inst-001'));

  // 4. Update Institution Branding for inst-001
  console.log('\n--- Test 4: Update Institution Branding (inst-001 Admin) ---');
  const updateRes = await makeRequest('PUT', '/api/saas/institutions/inst-001/branding', {
    name: 'Apex Institute of Technology & Sciences (Deemed)',
    tagline: 'Leading Academic Innovation',
    accreditation: 'NAAC A++ • Tier-1 Accredited',
    primaryColor: '#6366F1',
    secondaryColor: '#14B8A6',
    contactEmail: 'admissions@apexuniv.edu',
    contactPhone: '+91 (080) 4125-9999',
    address: 'Apex Tech City, Bengaluru'
  }, { 'Authorization': `Bearer ${tokenInst1}` });
  assert('Branding update returns success', updateRes.status === 200 && updateRes.data.success);
  assert('Updated institution name matches', updateRes.data.data?.name === 'Apex Institute of Technology & Sciences (Deemed)');
  assert('Updated colors persisted', updateRes.data.data?.primaryColor === '#6366F1');

  // Restore original inst-001 name for subsequent test suites
  await makeRequest('PUT', '/api/saas/institutions/inst-001/branding', {
    name: 'Apex Institute of Technology & Science',
    tagline: 'Smarter Campus. Stronger Futures.',
    primaryColor: '#7C3AED',
    secondaryColor: '#06B6D4'
  }, { 'Authorization': `Bearer ${tokenInst1}` });

  // 5. Cross-Tenant Protection: inst-002 Admin trying to modify inst-001 branding MUST BE FORBIDDEN (403)
  console.log('\n--- Test 5: Cross-Tenant Protection (inst-002 Admin cannot modify inst-001) ---');
  const crossMod = await makeRequest('PUT', '/api/saas/institutions/inst-001/branding', {
    name: 'Hacked Campus Name'
  }, { 'Authorization': `Bearer ${tokenInst2}` });
  assert('Cross-tenant branding modification is rejected with 403', crossMod.status === 403);
  assert('inst-001 branding remained unmodified', crossMod.data.message?.includes('FORBIDDEN'));

  // Cross-tenant logo upload attempt
  const crossLogo = await makeRequest('POST', '/api/upload/institution-logo', {
    image: samplePng,
    institutionId: 'inst-001'
  }, { 'Authorization': `Bearer ${tokenInst2}` });
  assert('Cross-tenant logo upload rejected with 403', crossLogo.status === 403);

  // 6. Verify inst-002 Branding Remained Completely Untouched
  console.log('\n--- Test 6: Verify inst-002 Branding Untouched by inst-001 modifications ---');
  const inst2Profile = await makeRequest('GET', '/api/saas/my-institution', null, {
    'Authorization': `Bearer ${tokenInst2}`
  });
  assert('inst-002 profile fetched successfully', inst2Profile.status === 200 && inst2Profile.data.success);
  assert('inst-002 name still St. Xavier Institute of Science & Technology', inst2Profile.data.data?.name === 'St. Xavier Institute of Science & Technology');
  assert('inst-002 primary color still #1E3A8A', inst2Profile.data.data?.primaryColor === '#1E3A8A');

  // 7. Register a New Autonomous University Institution with Custom Branding
  console.log('\n--- Test 7: Register New Third Institution with Custom Type & Tagline ---');
  const newInstCode = `TEST${Date.now().toString().slice(-4)}`;
  const regRes = await makeRequest('POST', '/api/saas/register-institution', {
    institutionName: 'Cambridge Institute of Technology',
    institutionCode: newInstCode,
    institutionType: 'UNIVERSITY',
    tagline: 'Engineering the Future with Integrity',
    subscriptionPlan: 'ENTERPRISE',
    adminName: 'Dr. Alistair Finch',
    adminEmail: `admin@${newInstCode.toLowerCase()}.edu`,
    adminPassword: 'Password@2026',
    phone: '+91 (080) 555-0199',
    address: 'University Campus, Electronic City, Bengaluru'
  });
  assert('New institution registration returns 201 success', regRes.status === 201 && regRes.data.success);
  assert('New institution has custom institutionType UNIVERSITY', regRes.data.institution?.institutionType === 'UNIVERSITY');
  assert('New institution has tagline saved', regRes.data.institution?.tagline === 'Engineering the Future with Integrity');

  // 8. Sign into New Institution Admin and verify isolated branding returned in session
  console.log('\n--- Test 8: Login into New Institution and Verify Resolved Session Branding ---');
  const login3 = await makeRequest('POST', '/api/auth/login', {
    email: `admin@${newInstCode.toLowerCase()}.edu`,
    password: 'Password@2026',
    role: 'ADMIN'
  });
  assert('New Institution Admin login succeeds', login3.status === 200 && login3.data.success);
  assert('Session has custom institutionName', login3.data.user?.institutionName === 'Cambridge Institute of Technology');
  assert('Session has custom institutionType UNIVERSITY', login3.data.user?.institutionType === 'UNIVERSITY');
  assert('Session has custom tagline', login3.data.user?.institutionTagline === 'Engineering the Future with Integrity');

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});
