/**
 * ACADIVEX Explicit Demo Data Cleanup Utility
 * Run with: npm run db:clean
 *
 * Safely removes demo institutions (inst-001, inst-002), demo accounts,
 * sample academic records, and demo uploaded logos/avatars while preserving
 * real user-registered institutions and records.
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');

function runCleanup() {
  console.log('🧹 Starting explicit ACADIVEX demo data cleanup...');

  // 1. Clean demo records from the DataStore & persist to disk
  db.cleanDemoData();
  console.log(`✓ Cleaned demo institutions & sample records. Active institutions remaining: ${db.institutions.length}`);

  // 2. Clean demo logo/avatar files in uploads/avatars that belong to inst-001, inst-002, or unreferenced demo avatars
  const uploadDir = path.join(__dirname, '../../uploads/avatars');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Ensure .gitkeep exists so the directory structure is tracked in Git without tracking private uploads
  const gitkeepPath = path.join(uploadDir, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '', 'utf8');
  }

  // Collect all legitimate referenced upload URLs from real institutions & users
  const referencedFiles = new Set(['.gitkeep']);
  db.institutions.forEach(inst => {
    if (inst.logoUrl && inst.logoUrl.startsWith('/uploads/avatars/')) {
      referencedFiles.add(path.basename(inst.logoUrl));
    }
  });
  db.users.forEach(u => {
    if (u.avatar && u.avatar.startsWith('/uploads/avatars/')) {
      referencedFiles.add(path.basename(u.avatar));
    }
  });
  db.students.forEach(s => {
    if (s.avatar && s.avatar.startsWith('/uploads/avatars/')) {
      referencedFiles.add(path.basename(s.avatar));
    }
  });
  db.teachers.forEach(t => {
    if (t.avatar && t.avatar.startsWith('/uploads/avatars/')) {
      referencedFiles.add(path.basename(t.avatar));
    }
  });

  const files = fs.readdirSync(uploadDir);
  let removedCount = 0;
  for (const file of files) {
    if (!referencedFiles.has(file)) {
      try {
        fs.unlinkSync(path.join(uploadDir, file));
        removedCount++;
      } catch (e) {
        console.warn(`  ! Could not remove ${file}: ${e.message}`);
      }
    }
  }

  console.log(`✓ Removed ${removedCount} unreferenced/demo uploaded image file(s) from uploads/avatars.`);
  console.log('✅ ACADIVEX database & storage are clean and ready for real institution registration.');
}

if (require.main === module) {
  runCleanup();
}

module.exports = runCleanup;
