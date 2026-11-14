'use strict';
// Kendi kendine deneme: herkese açık iki uç. Merkezi lisans kapısından muaftır (centralLicense.gate).
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const trial = require('../services/trialSignup');
const router = express.Router();

const requestLimit = rateLimit({ windowMs: 3600000, max: Number(process.env.TRIAL_RATE_LIMIT_MAX) || 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Çok fazla deneme isteği. Bir saat sonra tekrar deneyin.' } });
const confirmLimit = rateLimit({ windowMs: 3600000, max: (Number(process.env.TRIAL_RATE_LIMIT_MAX) || 5) * 2, standardHeaders: true, legacyHeaders: false, message: { error: 'Çok fazla onay denemesi. Bir saat sonra tekrar deneyin.' } });
const send = (res, error, next) => error.status ? res.status(error.status).json({ error: error.message, code: error.code }) : next(error);

router.get('/status', (req, res) => res.json({ enabled: trial.enabled(), days: 14 }));
router.post('/request', requestLimit, async (req, res, next) => {
  try { res.json(await trial.request(db, req.body, { sendEmail: require('../services/notificationService').sendEmail })); }
  catch (error) { send(res, error, next); }
});
router.post('/confirm', confirmLimit, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await trial.confirm(db, req.body && req.body.token, { central: require('../services/centralLicense'), demoAccount: require('../services/demoAccount') }));
  } catch (error) { send(res, error, next); }
});
module.exports = router;
