'use strict';
// Kullanım (canlıda Plesk Node konsolu):
//   exec -- node --env-file=../cloud-private/install.env backend/scripts/create_demo_account.js --email kisi@ornek.com --company "Ornek Market" --days 14
// Şifre yalnızca bu çıktıda bir kez gösterilir; kayda yazılmaz. Güvenli bir kanaldan kişiye iletin.
const args = process.argv.slice(2);
const read = name => { const at = args.indexOf('--' + name); return at >= 0 ? args[at + 1] : undefined; };
(async () => {
  const db = require('../src/config/database');
  await db.ready;
  const days = read('days') === undefined ? 14 : Number(read('days'));
  const out = await require('../src/services/demoAccount').create(db, { email: read('email'), company: read('company'), days });
  console.log(JSON.stringify({ ok: true, email: out.email, password: out.password, expires_at: out.expiresAt, days: out.days, tenant_id: out.tenantId, login: 'https://app.veniux.com/giris' }, null, 2));
  await db.close();
})().catch(error => { console.error('DEMO_HESABI_OLUSTURULAMADI:', error.code || '', error.message); process.exit(1); });
