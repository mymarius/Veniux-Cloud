// Herkese açık, salt okunur fiyat özeti: web sitesi ve lisans merkezi fiyatları buradan okur (tek doğru kaynak: paket kataloğu).
// Yalnız satışa açık planların adı, ailesi, modülleri ve fiyatı döner; işletme verisi veya sınır/lisans ayrıntısı dönmez.
const express = require('express');
const packages = require('../services/productPackages');
const router = express.Router();
const SECTOR = { RETAIL_HIRDAVAT: 'hardware', RETAIL_ZUCCACIYE: 'tableware', RETAIL_PIDE: 'restaurant' };
let cache = { at: 0, body: null };
const TTL_MS = 60 * 1000;

function shape(catalogue) {
  const plans = catalogue.plans.filter(plan => plan.available).map(plan => ({
    code: plan.code, name: plan.name, family: plan.family, modules: plan.modules,
    monthly_cents: plan.monthly_cents, annual_cents: plan.annual_cents, discount_percent: plan.discount_percent
  }));
  const sector = plans.filter(plan => SECTOR[plan.code]).map(plan => ({ pack: SECTOR[plan.code], code: plan.code, name: plan.name, monthly_cents: plan.monthly_cents, annual_cents: plan.annual_cents }));
  return { currency: 'TRY', tax_included: true, revision: catalogue.revision, plans, sector };
}

router.get('/prices', async (req, res) => {
  try {
    if (!cache.body || Date.now() - cache.at > TTL_MS) {
      let catalogue;
      // Katalog kaydı henüz yoksa (ör. platform sahibi tanımlı değil) varsayılan katalog fiyatsız döner.
      try { catalogue = await packages.catalogue(); } catch { catalogue = { ...structuredClone(packages.seed), revision: 0 }; }
      cache = { at: Date.now(), body: shape(catalogue) };
    }
    res.set('Cache-Control', 'public, max-age=60');
    res.json(cache.body);
  } catch (error) {
    res.status(503).json({ error: 'Fiyat bilgisi şu anda alınamıyor.' });
  }
});
router.shape = shape;
module.exports = router;
