const db = require('../config/database');
const entitlements = require('./entitlementService');

// Yapay zekâ kotası: pakete göre aylık sorgu sayısı sunucuda uygulanır (maliyet kontrolü). Sayaç denetim günlüğündeki 'ai.query' kayıtlarıdır.
// Sınırsız paketlerde bile adil kullanım tavanı vardır; platform yöneticisi sınırsızdır.
const FAIR_USE = Number(process.env.VENIUX_AI_FAIR_USE || 3000);
const monthStart = (now = Date.now()) => { const d = new Date(now); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().replace('T', ' ').slice(0, 19); };
const nextReset = (now = Date.now()) => { const d = new Date(now); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10); };

async function status(user, central, now = Date.now()) {
  if (user.isPlatformAdmin) return { limit: null, used: 0, remaining: null, resets_on: nextReset(now), plan: 'platform' };
  const e = await entitlements.forTenant(user, central, now);
  const planLimit = e.limits?.ai_monthly;
  const limit = planLimit === null || planLimit === undefined ? FAIR_USE : planLimit;
  const used = Number((await db.query("SELECT COUNT(*) AS n FROM audit_logs WHERE tenant_id=$1 AND action='ai.query' AND created_at>=$2", [user.tenantId, monthStart(now)])).rows[0].n);
  return { limit, used, remaining: Math.max(0, limit - used), resets_on: nextReset(now), plan: e.plan, fair_use: planLimit === null || planLimit === undefined };
}

// Faturalanabilir yapay zekâ uçlarında kullanılır: kota doluysa 402, değilse bir sorgu sayılır.
const guard = async (req, res, next) => {
  try {
    if (req.user.isPlatformAdmin) return next();
    const s = await status(req.user, req.centralLicense);
    if (s.remaining <= 0) {
      const msg = s.limit === 0 ? 'Yapay zekâ bu pakette yok. Paketi yükselterek açabilirsiniz.' : s.fair_use ? 'Bu ay için adil kullanım sınırına ulaşıldı. Sınır ' + s.resets_on + ' tarihinde yenilenir.' : `Aylık yapay zekâ kotanız (${s.limit} sorgu) doldu. Kota ${s.resets_on} tarihinde yenilenir; üst pakete geçerek artırabilirsiniz.`;
      return res.status(402).json({ error: msg, code: 'AI_QUOTA', limit: s.limit, used: s.used, resets_on: s.resets_on });
    }
    await db.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,$3,$4,$5)', [req.user.tenantId, req.user.email, 'ai.query', 'ai', JSON.stringify({ path: req.path })]);
    next();
  } catch (e) { next(e); }
};

module.exports = { status, guard, FAIR_USE, monthStart };
