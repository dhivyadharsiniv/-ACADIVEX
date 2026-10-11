const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireRoles } = require('../middleware/authMiddleware');

/**
 * Public Endpoint: Get active registered institutions & campuses for Institution Portal Entry
 */
router.get('/public-institutions', (req, res) => {
  try {
    const list = db.getPublicInstitutions();
    return res.status(200).json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Public Endpoint: Get single active registered institution non-sensitive context by ID, code, or slug
 */
router.get('/public-institutions/:id', (req, res) => {
  try {
    const rawId = (req.params.id || '').trim().toLowerCase();
    const list = db.getPublicInstitutions();
    const match = list.find(i =>
      i.id.toLowerCase() === rawId ||
      (i.code && i.code.toLowerCase() === rawId) ||
      (i.slug && i.slug.toLowerCase() === rawId)
    );
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Institution context is missing, unregistered, or inactive.'
      });
    }
    return res.status(200).json({
      success: true,
      institution: match
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Public Endpoint: Verify Institution/College Name and Campus Name before opening Institution Login Page
 */
router.post('/verify-institution', (req, res) => {
  try {
    const institutionId = req.body.institutionId;
    const institutionName = req.body.institutionName || req.body.name;
    const campusName = req.body.campusName || req.body.campus;

    const result = db.verifyInstitution({ institutionId, institutionName, campusName });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        code: result.code,
        canRegister: result.code === 'INSTITUTION_NOT_FOUND',
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: `Verified ${result.institution.name} (${result.institution.campusName}).`,
      institution: result.institution
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * Public Endpoint: Register a new institution (School / College onboarding)
 * Creates isolated tenant, default Dean/Admin account, and initial academic structure.
 */
router.post('/register-institution', (req, res) => {
  try {
    const name = req.body.institutionName || req.body.name;
    const campusName = req.body.campusName || req.body.campus;
    const code = req.body.institutionCode || req.body.code;
    const contactEmail = req.body.adminEmail || req.body.contactEmail || req.body.email;
    const adminName = req.body.adminName || req.body.name;
    const adminPassword = req.body.adminPassword || req.body.password;
    const plan = req.body.subscriptionPlan || req.body.plan || 'PRO';
    const phone = req.body.phone;
    const address = req.body.address;
    const institutionType = req.body.institutionType || 'COLLEGE';
    const tagline = req.body.tagline;
    const logoData = req.body.logoData || req.body.logo || req.body.image;
    const logoUrl = req.body.logoUrl;
    const primaryColor = req.body.primaryColor;
    const secondaryColor = req.body.secondaryColor;
    
    if (!name || !campusName || !contactEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: 'Institution name, campus name, contact email, and admin password are required.'
      });
    }

    const result = db.registerInstitution({
      name,
      campusName,
      code,
      contactEmail,
      adminName,
      adminPassword,
      plan,
      phone,
      address,
      institutionType,
      tagline,
      logoData,
      logoUrl,
      primaryColor,
      secondaryColor
    });

    return res.status(201).json({
      success: true,
      message: `Institution '${result.institution.name}' (${result.institution.campusName}) registered successfully. Administrator account initialized.`,
      institution: result.institution,
      admin: result.admin
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

/**
 * Super Admin Endpoint: Get list of all registered institutions with usage stats
 */
router.get('/institutions', requireAuth, requireRoles('SUPER_ADMIN'), (req, res) => {
  try {
    const institutions = db.getInstitutions(req.user);
    return res.status(200).json({
      success: true,
      count: institutions.length,
      data: institutions
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Super Admin Endpoint: Update institution status (ACTIVE | SUSPENDED | PENDING)
 * Supports both PUT and PATCH
 */
const handleStatusUpdate = (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const updated = db.updateInstitutionStatus(req.params.id, status, req.user);
    return res.status(200).json({
      success: true,
      message: `Institution status updated to ${status}.`,
      institution: updated
    });
  } catch (err) {
    const code = err.message && err.message.startsWith('FORBIDDEN') ? 403 : 400;
    return res.status(code).json({ success: false, message: err.message });
  }
};

router.put('/institutions/:id/status', requireAuth, requireRoles('SUPER_ADMIN'), handleStatusUpdate);
router.patch('/institutions/:id/status', requireAuth, requireRoles('SUPER_ADMIN'), handleStatusUpdate);

/**
 * Institution / Super Admin Endpoint: View audit logs
 * Super Admin sees global logs; Institution Admin sees strictly their own institution logs
 */
router.get('/audit-logs', requireAuth, requireRoles('SUPER_ADMIN', 'ADMIN'), (req, res) => {
  try {
    const logs = db.getAuditLogs(req.user);
    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Current Institution Details Endpoint
 */
router.get('/my-institution', requireAuth, (req, res) => {
  try {
    const instId = req.user.institutionId || 'inst-001';
    const institution = db.getInstitutionById(instId);
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution profile not found.' });
    }
    return res.status(200).json({
      success: true,
      data: institution
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Institution Admin / Super Admin Endpoint: Update institution branding & settings
 */
router.put('/institutions/:id/branding', requireAuth, requireRoles('SUPER_ADMIN', 'ADMIN'), (req, res) => {
  try {
    const updated = db.updateInstitutionBranding(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: 'Institution branding & profile successfully updated.',
      data: updated
    });
  } catch (err) {
    const code = err.message && err.message.startsWith('FORBIDDEN') ? 403 : 400;
    return res.status(code).json({ success: false, message: err.message });
  }
});

module.exports = router;
