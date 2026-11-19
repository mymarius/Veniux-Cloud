// Paket matrisinden web sitesinin okuyacağı website-php/plans.json dosyasını üretir (tek kaynak: shared/planMatrix.mjs).
// Çalıştırma: node tools/site/export-plans.mjs   (--check: dosya güncel değilse hata verir)
import fs from 'node:fs';
import { PLANS, PLAN_IDS, FEATURE_LABELS, FEATURE_GROUPS, ADDON_LABELS, TAGLINES, RESTAURANT_ADDON, TRIAL, CLOUD_COST_FEATURES } from '../../shared/planMatrix.mjs';

export function build() {
  return {
    trial_days: TRIAL.days,
    cloud_features: CLOUD_COST_FEATURES,
    addon_features: Object.keys(RESTAURANT_ADDON.features),
    plans: PLAN_IDS.map(id => { const p = PLANS[id]; return { id, name: p.name, tagline: TAGLINES[id], price_try: p.price_try, monthly_try: p.monthly_try ?? null, period: p.period, limits: p.limits, bundled_cloud_years: p.bundled_cloud_years ?? 0, features: Object.keys(p.features) }; }),
    addon: { id: RESTAURANT_ADDON.id, name: RESTAURANT_ADDON.name, requires: RESTAURANT_ADDON.requires },
    labels: { ...FEATURE_LABELS, ...ADDON_LABELS },
    groups: FEATURE_GROUPS.map(([name, keys]) => ({ name, keys }))
  };
}
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = new URL('../../website-php/plans.json', import.meta.url);
  const text = JSON.stringify(build(), null, 1) + '\n';
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.error('website-php/plans.json güncel değil: node tools/site/export-plans.mjs'); process.exit(1); }
    console.log('plans.json güncel');
  } else { fs.writeFileSync(file, text); console.log('yazıldı: website-php/plans.json'); }
}
