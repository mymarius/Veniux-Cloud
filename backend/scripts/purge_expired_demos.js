#!/usr/bin/env node
'use strict';
// Süresi dolmuş demo işletmelerini listeler (varsayılan) veya siler.
//   node scripts/purge_expired_demos.js [--days 30] [--apply]
// --apply olmadan hiçbir şey silinmez. Yalnız "Veniux Demo – " ile başlayan, tüm lisansları bitiş+bekleme süresini aşmış işletmeler.
const args = process.argv.slice(2);
const get = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const days = get('--days') === undefined ? 30 : Number(get('--days'));
const apply = args.includes('--apply');
(async () => {
  const database = require('../src/config/database');
  await database.ready;
  const result = await require('../src/services/demoPurge').purge(database, { graceDays: days, dryRun: !apply });
  console.log(JSON.stringify({ mod: apply ? 'sil' : 'deneme (silinmez)', gun: days, aday: result.candidates.length, silinen: result.removed.length, hata: result.failed, isletmeler: result.candidates.map(item => item.id + ' ' + item.name) }, null, 2));
  await database.close();
  if (result.failed.length) process.exitCode = 2;
})().catch(error => { console.error('HATA:', error.message); process.exit(1); });
