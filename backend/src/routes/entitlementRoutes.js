const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const svc = require('../services/entitlementService');

// Arayüz kilitli özelliği gizlemek yerine "Pro ile açılır" göstermek için paket hakkını okur.
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const e = await svc.forTenant(req.user, req.centralLicense);
    res.json({ plan: e.plan, plan_name: e.plan_name, trial: e.trial, trial_ends_at: e.trial ? e.expires_at : null, limits: e.limits, features: e.features, enforced: e.enforced, source: e.source });
  } catch (err) { next(err); }
});
module.exports = router;
