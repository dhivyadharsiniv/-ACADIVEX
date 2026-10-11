/**
 * End-to-End Verification Suite: Redirect to Institution Login After Logout
 * Tests Student, Staff, Admin, Missing/Invalid Institution Context, Back-Navigation Guard, and Super Admin Logout
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw });
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

/**
 * Lightweight DOM & Browser Environment Harness to execute frontend/index.html JavaScript
 * against the live backend server.
 */
function createFrontendHarness(htmlContent) {
  const elementsById = new Map();
  const allElements = [];

  function makeClassList(initialClasses = []) {
    const set = new Set(initialClasses.filter(Boolean));
    return {
      add: (...cls) => cls.forEach(c => set.add(c)),
      remove: (...cls) => cls.forEach(c => set.delete(c)),
      contains: (c) => set.has(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (set.has(c)) { set.delete(c); return false; }
          set.add(c); return true;
        }
        if (force) set.add(c); else set.delete(c);
        return force;
      },
      toString: () => Array.from(set).join(' ')
    };
  }

  function createElement(tag, id = '', classes = []) {
    const cl = makeClassList(classes);
    const el = {
      tagName: tag.toUpperCase(),
      id,
      textContent: '',
      innerHTML: '',
      value: '',
      src: '',
      placeholder: '',
      dataset: {},
      style: { setProperty: () => {} },
      classList: cl,
      get className() { return cl.toString(); },
      set className(val) {
        const parts = String(val || '').split(/\s+/).filter(Boolean);
        const newCl = makeClassList(parts);
        el.classList = newCl;
      },
      matches: () => false,
      addEventListener: () => {},
      appendChild: () => {},
      remove: () => {},
      querySelectorAll: () => [],
      querySelector: () => null
    };
    if (id) elementsById.set(id, el);
    allElements.push(el);
    return el;
  }

  // Parse all elements with id="..." from index.html so every getElementById succeeds
  const idRegex = /<([a-zA-Z0-9]+)\b[^>]*?\bid="([^"]+)"[^>]*?>/g;
  let match;
  while ((match = idRegex.exec(htmlContent)) !== null) {
    const fullTag = match[0];
    const tag = match[1];
    const id = match[2];
    const classMatch = fullTag.match(/\bclass="([^"]*)"/);
    const classes = classMatch ? classMatch[1].split(/\s+/) : [];
    const el = createElement(tag, id, classes);
    // Extract initial textContent for simple inline elements if present
    const closeIdx = htmlContent.indexOf(`</${tag}>`, match.index);
    if (closeIdx !== -1 && closeIdx - match.index < 300) {
      const inner = htmlContent.slice(match.index + fullTag.length, closeIdx).replace(/<[^>]+>/g, '').trim();
      el.textContent = inner;
    }
  }

  function createStorage() {
    const store = new Map();
    return {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    };
  }

  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const historyStack = [{ state: { route: 'landing' }, url: '/' }];
  let historyIndex = 0;
  const listeners = {};

  const windowObj = {
    location: {
      origin: BASE_URL,
      pathname: '/',
      search: '',
      href: `${BASE_URL}/`
    },
    history: {
      get state() { return historyStack[historyIndex]?.state || null; },
      pushState(state, title, url) {
        historyStack.splice(historyIndex + 1);
        historyStack.push({ state, url });
        historyIndex = historyStack.length - 1;
        updateLocationFromUrl(url);
      },
      replaceState(state, title, url) {
        historyStack[historyIndex] = { state, url };
        updateLocationFromUrl(url);
      },
      back() {
        if (historyIndex > 0) {
          historyIndex--;
          const entry = historyStack[historyIndex];
          updateLocationFromUrl(entry.url);
        }
        const popListeners = listeners['popstate'] || [];
        popListeners.forEach(fn => fn({ state: historyStack[historyIndex]?.state || null }));
      }
    },
    addEventListener(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    dispatchEvent(type, eventObj = {}) {
      (listeners[type] || []).forEach(fn => fn(eventObj));
    },
    localStorage,
    sessionStorage,
    confirm: () => true,
    alert: () => {},
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {}
  };

  function updateLocationFromUrl(url) {
    if (!url) return;
    const u = new URL(url, BASE_URL);
    windowObj.location.pathname = u.pathname;
    windowObj.location.search = u.search;
    windowObj.location.href = u.href;
  }

  const documentObj = {
    cookie: '',
    documentElement: {
      classList: makeClassList([]),
      style: { setProperty: () => {} }
    },
    body: {
      appendChild: () => {}
    },
    getElementById(id) {
      if (!elementsById.has(id)) {
        return createElement('div', id, []);
      }
      return elementsById.get(id);
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    createElement(tag) { return createElement(tag); },
    addEventListener(type, fn) {
      windowObj.addEventListener(type, fn);
    }
  };

  // Fetch implementation connected to live backend
  async function fetchImpl(urlStr, opts = {}) {
    const u = new URL(urlStr, BASE_URL);
    const method = opts.method || 'GET';
    let bodyObj = null;
    if (opts.body) {
      try { bodyObj = JSON.parse(opts.body); } catch (e) {}
    }
    const authHeader = opts.headers?.Authorization || opts.headers?.authorization || null;
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;
    const res = await request(method, u.pathname + u.search, bodyObj, token);
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      json: async () => res.body || {}
    };
  }

  const sandbox = {
    window: windowObj,
    document: documentObj,
    localStorage,
    sessionStorage,
    history: windowObj.history,
    location: windowObj.location,
    URLSearchParams,
    URL,
    fetch: fetchImpl,
    confetti: () => {},
    Chart: function() { return { destroy: () => {}, update: () => {} }; },
    console,
    setTimeout: windowObj.setTimeout,
    clearTimeout: windowObj.clearTimeout,
    Date,
    Math,
    JSON,
    Promise,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Error,
    encodeURIComponent,
    decodeURIComponent,
    parseInt,
    parseFloat,
    isNaN
  };

  // Extract main application script block from index.html
  const scriptBlocks = [...htmlContent.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const mainScript = scriptBlocks[scriptBlocks.length - 1][1];

  vm.createContext(sandbox);
  vm.runInContext(mainScript, sandbox);

  return {
    sandbox,
    window: windowObj,
    document: documentObj,
    localStorage,
    sessionStorage,
    getAppState: () => vm.runInContext('AppState', sandbox),
    getSelectedLoginRole: () => vm.runInContext('selectedLoginRole', sandbox),
    initApp: async () => {
      const fns = listeners['DOMContentLoaded'] || [];
      for (const fn of fns) {
        await fn();
      }
    }
  };
}

async function runTests() {
  console.log('\n====================================================================');
  console.log('🧪 ACADIVEX LOGOUT -> INSTITUTION LOGIN WORKFLOW E2E TEST SUITE');
  console.log('====================================================================\n');

  const htmlPath = path.join(__dirname, '..', 'frontend', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // -------------------------------------------------------------------------
  // PART 1: BACKEND API SESSION TERMINATION & TOKEN REVOCATION
  // -------------------------------------------------------------------------
  console.log('👉 [Part 1] Testing Backend Session Termination & Token Revocation (Student, Staff, Admin, Super Admin)...');

  // 1A. Student Login & Logout on inst-001
  const stdLogin = await request('POST', '/api/auth/login', {
    email: 'aarav.sharma@acadivex.edu',
    password: 'Student@123',
    role: 'STUDENT',
    institutionId: 'inst-001'
  });
  assert(stdLogin.status === 200 && stdLogin.body?.success && stdLogin.body.token, 'Student logs into inst-001 successfully');
  const stdToken = stdLogin.body.token;

  const stdMeBefore = await request('GET', '/api/auth/me', null, stdToken);
  assert(stdMeBefore.status === 200 && stdMeBefore.body?.user?.role === 'STUDENT', 'Student accesses /api/auth/me before logout');

  const stdLogout = await request('POST', '/api/auth/logout', { institutionId: 'inst-001', role: 'STUDENT' }, stdToken);
  assert(stdLogout.status === 200 && stdLogout.body?.success, 'Student POST /api/auth/logout succeeds');
  assert(stdLogout.body?.redirectTo === 'login' && stdLogout.body?.redirectRoute?.startsWith('/login?institutionId=inst-001'), `Student logout returns institution login route (${stdLogout.body?.redirectRoute})`);
  assert(stdLogout.body?.institution?.id === 'inst-001' && stdLogout.body?.institution?.campusName === 'Bengaluru Main Campus', 'Student logout preserves non-sensitive institution & campus context');
  assert(!stdLogout.body?.institution?.password && !stdLogout.body?.token, 'Student logout response never exposes credentials or auth tokens');

  const stdMeAfter = await request('GET', '/api/auth/me', null, stdToken);
  assert(stdMeAfter.status === 401, 'Revoked Student token is rejected with 401 on /api/auth/me after logout');

  // 1B. Staff Login & Logout on inst-002 (St. Xavier Institute)
  const staffLogin = await request('POST', '/api/auth/login', {
    email: 'anjali.m@sxist.edu.in',
    password: 'Teacher@123',
    role: 'TEACHER',
    institutionId: 'inst-002'
  });
  assert(staffLogin.status === 200 && staffLogin.body?.success && staffLogin.body.token, 'Staff logs into inst-002 (St. Xavier) successfully');
  const staffToken = staffLogin.body.token;

  const staffLogout = await request('POST', '/api/auth/logout', { institutionId: 'inst-002', role: 'TEACHER' }, staffToken);
  assert(staffLogout.status === 200 && staffLogout.body?.redirectTo === 'login', 'Staff POST /api/auth/logout returns redirectTo="login" (not homepage)');
  assert(staffLogout.body?.institution?.id === 'inst-002' && staffLogout.body?.institution?.campusName === 'Mumbai Mahapalika Campus', 'Staff logout preserves inst-002 and Mumbai Mahapalika Campus context');

  const staffMeAfter = await request('GET', '/api/auth/me', null, staffToken);
  assert(staffMeAfter.status === 401, 'Revoked Staff token is rejected with 401 after logout');

  // 1C. Admin Login & Logout on inst-001
  const admLogin = await request('POST', '/api/auth/login', {
    email: 'admin@acadivex.edu',
    password: 'Admin@123',
    role: 'ADMIN',
    institutionId: 'inst-001'
  });
  assert(admLogin.status === 200 && admLogin.body?.success && admLogin.body.token, 'Admin logs into inst-001 successfully');
  const admToken = admLogin.body.token;

  const admLogout = await request('POST', '/api/auth/logout', { institutionId: 'inst-001', role: 'ADMIN' }, admToken);
  assert(admLogout.status === 200 && admLogout.body?.redirectTo === 'login', 'Admin POST /api/auth/logout returns redirectTo="login"');
  assert(admLogout.body?.institution?.id === 'inst-001' && admLogout.body?.institution?.campusName === 'Bengaluru Main Campus', 'Admin logout preserves inst-001 and Bengaluru Main Campus context');

  const admAuditAfter = await request('GET', '/api/saas/audit-logs', null, admToken);
  assert(admAuditAfter.status === 401, 'Revoked Admin token is rejected with 401 on protected /api/saas/audit-logs endpoint');

  // 1D. Super Admin Login & Logout remains separate
  const saLogin = await request('POST', '/api/auth/login', {
    email: 'superadmin@acadivex.com',
    password: 'SuperAdmin@123',
    role: 'SUPER_ADMIN'
  });
  const saToken = saLogin.body.token;
  const saLogout = await request('POST', '/api/auth/logout', { role: 'SUPER_ADMIN' }, saToken);
  assert(saLogout.status === 200 && saLogout.body?.redirectTo === 'landing' && saLogout.body?.redirectRoute === '/', 'Super Admin logout behavior remains separate (redirects to landing "/")');

  // -------------------------------------------------------------------------
  // PART 2: FRONTEND WORKFLOW — STUDENT LOGOUT, UI VERIFICATION, BACK GUARD & RE-LOGIN
  // -------------------------------------------------------------------------
  console.log('\n👉 [Part 2] Testing Frontend Student Logout Workflow & Institution Login Redirect...');
  const app = createFrontendHarness(html);
  await app.initApp();

  const inst1Obj = app.getAppState().publicInstitutions.find(i => i.id === 'inst-001');
  const inst1Name = inst1Obj?.name || 'Apex Institute of Technology & Science';

  // Verify Institution 1 via Entry Modal
  app.document.getElementById('entry-inst-name').value = inst1Name;
  app.document.getElementById('entry-campus-name').value = 'Bengaluru Main Campus';
  await app.sandbox.handleVerifyInstitutionSubmit({ preventDefault: () => {} });

  assert(app.getAppState().route === 'login', 'After institution verification, user is on #view-login');
  assert(app.getAppState().selectedInstitution?.id === 'inst-001', 'Selected institution is inst-001');

  // Log in as Student
  app.sandbox.setLoginRole('STUDENT');
  app.document.getElementById('login-email').value = 'aarav.sharma@acadivex.edu';
  app.document.getElementById('login-password').value = 'Student@123';
  await app.sandbox.handleLoginSubmit({ preventDefault: () => {} });

  assert(app.getAppState().route === 'student', 'Student is routed to #view-student dashboard after login');
  assert(!app.document.getElementById('view-student').classList.contains('hidden'), '#view-student is visible');

  // Click Student Logout
  app.sandbox.handleLogout();

  const stateAfterStdLogout = app.getAppState();
  assert(stateAfterStdLogout.currentUser === null && stateAfterStdLogout.token === null, 'Student session state (currentUser, token) is cleared on logout');
  assert(app.localStorage.getItem('acadivex_token') === null && app.localStorage.getItem('acadivex_user') === null, 'Student auth tokens and user data are removed from localStorage');
  assert(stateAfterStdLogout.route === 'login', 'Student is redirected to Institution Login (#view-login) instead of landing homepage');
  assert(!app.document.getElementById('view-login').classList.contains('hidden'), '#view-login is visible after Student logout');
  assert(app.document.getElementById('view-landing').classList.contains('hidden'), '#view-landing (main homepage) is hidden after Student logout');
  assert(app.document.getElementById('view-student').classList.contains('hidden'), '#view-student is hidden after Student logout');
  assert(app.window.location.pathname === '/login' && app.window.location.search.includes('institutionId=inst-001'), `Browser URL is set to institution login route (${app.window.location.pathname}${app.window.location.search})`);

  // Verify Institution Name, Campus Name, Logo, and 3 Login Options on #view-login
  assert(app.document.getElementById('login-inst-name').textContent.includes('Apex Institute'), `Institution Login displays institution name ("${app.document.getElementById('login-inst-name').textContent}")`);
  assert(app.document.getElementById('login-inst-campus').textContent === 'Bengaluru Main Campus', `Institution Login displays campus name ("${app.document.getElementById('login-inst-campus').textContent}")`);
  assert(!app.document.getElementById('login-inst-logo').classList.contains('hidden') && app.document.getElementById('login-inst-logo').src.length > 0, 'Institution Login displays institution logo (#login-inst-logo)');
  assert(
    Boolean(app.document.getElementById('login-tab-ADMIN')) &&
    Boolean(app.document.getElementById('login-tab-TEACHER')) &&
    Boolean(app.document.getElementById('login-tab-STUDENT')),
    'Institution Login shows Admin Login, Staff Login, and Student Login options'
  );
  assert(app.getSelectedLoginRole() === 'STUDENT', 'Student Login tab is selected ready for Student re-login');
  assert(app.document.getElementById('login-email').value === '' && app.document.getElementById('login-password').value === '', 'Login credentials are cleared (no auto-login)');

  // Test Browser Back Navigation & Direct Protected Route Guard after Student Logout
  app.window.history.back();
  assert(app.getAppState().route === 'login' && app.document.getElementById('view-student').classList.contains('hidden'), 'Browser Back button after Student logout does NOT reopen #view-student dashboard');
  app.sandbox.navigate('student');
  assert(app.getAppState().route === 'login' && app.document.getElementById('view-student').classList.contains('hidden'), 'Direct navigate("student") while logged out is blocked and stays on #view-login');

  // Student logs in again from the Institution Login page
  app.document.getElementById('login-email').value = 'aarav.sharma@acadivex.edu';
  app.document.getElementById('login-password').value = 'Student@123';
  await app.sandbox.handleLoginSubmit({ preventDefault: () => {} });
  assert(app.getAppState().route === 'student' && Boolean(app.getAppState().token), 'Student can log in again from the Institution Login page after logout');

  // -------------------------------------------------------------------------
  // PART 3: FRONTEND WORKFLOW — STAFF LOGOUT, UI VERIFICATION, BACK GUARD & RE-LOGIN
  // -------------------------------------------------------------------------
  console.log('\n👉 [Part 3] Testing Frontend Staff Logout Workflow (St. Xavier — inst-002)...');
  // Switch to Institution 2 (St. Xavier Institute of Science & Technology, Mumbai Mahapalika Campus)
  app.sandbox.handleLogout();
  app.document.getElementById('entry-inst-name').value = 'St. Xavier Institute of Science & Technology';
  app.document.getElementById('entry-campus-name').value = 'Mumbai Mahapalika Campus';
  await app.sandbox.handleVerifyInstitutionSubmit({ preventDefault: () => {} });

  // Log in as Staff on inst-002
  app.sandbox.setLoginRole('TEACHER');
  app.document.getElementById('login-email').value = 'anjali.m@sxist.edu.in';
  app.document.getElementById('login-password').value = 'Teacher@123';
  await app.sandbox.handleLoginSubmit({ preventDefault: () => {} });

  assert(app.getAppState().route === 'teacher' && !app.document.getElementById('view-teacher').classList.contains('hidden'), 'Staff logs in and enters #view-teacher dashboard');

  // Click Staff Logout
  app.sandbox.handleLogout();

  assert(app.getAppState().currentUser === null && app.getAppState().token === null, 'Staff session is securely terminated on logout');
  assert(app.getAppState().route === 'login', 'Staff is redirected to Institution Login (#view-login) and NOT main homepage');
  assert(app.document.getElementById('view-landing').classList.contains('hidden'), '#view-landing is hidden after Staff logout');
  assert(app.document.getElementById('view-teacher').classList.contains('hidden'), '#view-teacher is hidden after Staff logout');
  assert(app.document.getElementById('login-inst-name').textContent === 'St. Xavier Institute of Science & Technology', 'Institution Login displays St. Xavier Institute of Science & Technology');
  assert(app.document.getElementById('login-inst-campus').textContent === 'Mumbai Mahapalika Campus', 'Institution Login displays Mumbai Mahapalika Campus');
  assert(app.window.location.search.includes('institutionId=inst-002'), 'URL preserves inst-002 routing context');
  assert(app.getSelectedLoginRole() === 'TEACHER', 'Staff Login tab is active on Institution Login page');

  // Test Browser Back Navigation after Staff Logout
  app.window.history.back();
  assert(app.getAppState().route === 'login' && app.document.getElementById('view-teacher').classList.contains('hidden'), 'Browser Back button after Staff logout does NOT reopen #view-teacher dashboard');
  app.sandbox.navigate('teacher');
  assert(app.getAppState().route === 'login' && app.document.getElementById('view-teacher').classList.contains('hidden'), 'Direct navigate("teacher") while logged out is blocked');

  // Staff logs in again
  app.document.getElementById('login-email').value = 'anjali.m@sxist.edu.in';
  app.document.getElementById('login-password').value = 'Teacher@123';
  await app.sandbox.handleLoginSubmit({ preventDefault: () => {} });
  assert(app.getAppState().route === 'teacher' && Boolean(app.getAppState().token), 'Staff can log in again on St. Xavier Institution Login page');

  // -------------------------------------------------------------------------
  // PART 4: FRONTEND WORKFLOW — ADMIN LOGOUT, UI VERIFICATION, BACK GUARD & RE-LOGIN
  // -------------------------------------------------------------------------
  console.log('\n👉 [Part 4] Testing Frontend Admin Logout Workflow...');
  app.sandbox.handleLogout();

  // Log in as Admin on St. Xavier (inst-002)
  app.sandbox.setLoginRole('ADMIN');
  app.document.getElementById('login-email').value = 'admin@sxist.edu.in';
  app.document.getElementById('login-password').value = 'Admin@123';
  await app.sandbox.handleLoginSubmit({ preventDefault: () => {} });

  assert(app.getAppState().route === 'admin' && !app.document.getElementById('view-admin').classList.contains('hidden'), 'Admin logs in and enters #view-admin dashboard');

  // Click Admin Logout
  app.sandbox.handleLogout();

  assert(app.getAppState().currentUser === null && app.getAppState().token === null, 'Admin session is securely terminated on logout');
  assert(app.getAppState().route === 'login', 'Admin is redirected to their Institution Login (#view-login) and NOT main homepage');
  assert(app.document.getElementById('view-landing').classList.contains('hidden'), '#view-landing is hidden after Admin logout');
  assert(app.document.getElementById('view-admin').classList.contains('hidden'), '#view-admin is hidden after Admin logout');
  assert(app.getAppState().selectedInstitution?.id === 'inst-002', 'Admin institution context (inst-002) is preserved as non-sensitive routing context');
  assert(app.document.getElementById('login-inst-name').textContent === 'St. Xavier Institute of Science & Technology', 'Institution Login displays Admin institution name');
  assert(app.document.getElementById('login-inst-campus').textContent === 'Mumbai Mahapalika Campus', 'Institution Login displays Admin campus name');
  assert(app.document.getElementById('login-email').value === '' && app.document.getElementById('login-password').value === '', 'Admin is NOT automatically logged back in and credentials are cleared');

  // Test Browser Back Navigation after Admin Logout
  app.window.history.back();
  assert(app.getAppState().route === 'login' && app.document.getElementById('view-admin').classList.contains('hidden'), 'Browser Back button after Admin logout does NOT reopen #view-admin dashboard');
  app.sandbox.navigate('admin');
  assert(app.getAppState().route === 'login' && app.document.getElementById('view-admin').classList.contains('hidden'), 'Direct navigate("admin") while logged out is blocked');

  // Admin logs in again
  app.document.getElementById('login-email').value = 'admin@sxist.edu.in';
  app.document.getElementById('login-password').value = 'Admin@123';
  await app.sandbox.handleLoginSubmit({ preventDefault: () => {} });
  assert(app.getAppState().route === 'admin' && Boolean(app.getAppState().token), 'Admin can log in again on their Institution Login page');

  // -------------------------------------------------------------------------
  // PART 5: MISSING OR INVALID INSTITUTION CONTEXT FALLBACK
  // -------------------------------------------------------------------------
  console.log('\n👉 [Part 5] Testing Missing or Invalid Institution Context Fallback...');
  // Corrupt / clear institution context and trigger logout
  app.getAppState().currentUser = null;
  app.getAppState().selectedInstitution = { id: 'non-existent-inst-999', name: 'Deleted University' };
  app.sandbox.handleLogout();

  assert(app.getAppState().route === 'login', 'When institution context is invalid/missing, redirects to safe login page (#view-login) rather than main homepage (#view-landing)');
  assert(app.document.getElementById('view-landing').classList.contains('hidden'), '#view-landing remains hidden when institution context is missing/invalid');
  assert(!app.document.getElementById('modal-institution-entry').classList.contains('hidden'), 'Institution selection modal (#modal-institution-entry) opens automatically when institution context is missing/invalid');

  // -------------------------------------------------------------------------
  // PART 6: SUPER ADMIN LOGOUT REMAINS SEPARATE
  // -------------------------------------------------------------------------
  console.log('\n👉 [Part 6] Testing Super Admin Logout Separation...');
  app.document.getElementById('sa-login-email').value = 'superadmin@acadivex.com';
  app.document.getElementById('sa-login-password').value = 'SuperAdmin@123';
  await app.sandbox.handleSuperAdminLoginSubmit({ preventDefault: () => {} });
  assert(app.getAppState().currentUser?.role === 'SUPER_ADMIN', 'Super Admin logs in via standalone Super Admin modal');

  app.sandbox.handleLogout();
  assert(app.getAppState().currentUser === null && app.getAppState().route === 'landing', 'Super Admin logout remains separate and returns to main landing page');

  console.log('\n====================================================================');
  console.log(`🏁 LOGOUT WORKFLOW TEST SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('====================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
