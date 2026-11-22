#!/usr/bin/env node
// Open Food Facts kapsam ölçümü. Kullanım:
//   node tools/barkod-olcum/kapsam-olc.mjs barkodlar.txt [cikti-klasoru]
// barkodlar.txt: her satırda bir GERÇEK ürün barkodu (rafta okuttuğunuz); isteğe bağlı ";ürün adı" (karşılaştırma için).
// '#' ile başlayan satırlar yok sayılır. 30-50 barkod önerilir; azsa rapor "yetersiz örnek" der.
// Dakikada en fazla 15 istek (OFF sınırının çok altında); 50 barkod ≈ 4 dakika. Hiçbir sonuç uydurulmaz.
import fs from 'node:fs';
import path from 'node:path';

const [, , file, outDir = 'tools/barkod-olcum/sonuc'] = process.argv;
if (!file) { console.error('Kullanım: node kapsam-olc.mjs barkodlar.txt [cikti-klasoru]'); process.exit(2); }
const URL_BASE = process.env.VENIUX_OFF_URL || 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS = 'code,product_name,product_name_tr,brands,quantity,image_front_small_url,countries_tags';
const GAP = 4100; // ms → ≤15/dk
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const items = [...new Map(lines.map(l => { const [code, ...rest] = l.split(';'); return [code.trim(), { code: code.trim(), mine: rest.join(';').trim() }]; })).values()];
if (!items.length) { console.error('Dosyada barkod yok.'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rows = [];
for (const [i, it] of items.entries()) {
  const row = { ...it, state: 'error', name: '', brand: '', quantity: '', image: false, turkey: false };
  if (!/^\d{8}$|^\d{12,14}$/.test(it.code)) row.state = 'gecersiz';
  else {
    try {
      const r = await fetch(URL_BASE + it.code + '.json?fields=' + FIELDS, { headers: { 'User-Agent': 'Veniux-Barkod-Olcum/1.0 (stok programi)' }, signal: AbortSignal.timeout(10000) });
      if (r.status === 404) row.state = 'yok';
      else if (!r.ok) row.state = 'hata:' + r.status;
      else {
        const b = await r.json(), p = b.product;
        if (b.status === 1 && p) {
          row.state = 'var'; row.name = (p.product_name_tr || p.product_name || '').trim(); row.brand = String(p.brands || '').split(',')[0].trim();
          row.quantity = (p.quantity || '').trim(); row.image = !!(p.image_front_small_url); row.turkey = (p.countries_tags || []).includes('en:turkey');
        } else row.state = 'yok';
      }
    } catch (e) { row.state = 'hata:' + (e.name || 'ag'); }
    if (i < items.length - 1) await sleep(GAP);
  }
  rows.push(row); console.log(`${i + 1}/${items.length} ${it.code} → ${row.state}${row.name ? ' · ' + row.name : ''}`);
}
const n = rows.filter(r => r.state !== 'gecersiz' && !r.state.startsWith('hata')).length;
const c = f => rows.filter(f).length, pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
const found = c(r => r.state === 'var'), usable = c(r => r.state === 'var' && r.name);
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
fs.writeFileSync(path.join(outDir, `kapsam-${stamp}.csv`), '﻿' + 'barkod;durum;ad;marka;gramaj;gorsel;turkiye_etiketli;benim_adim\n' + rows.map(r => [r.code, r.state, esc(r.name), esc(r.brand), esc(r.quantity), r.image ? 1 : 0, r.turkey ? 1 : 0, esc(r.mine)].join(';')).join('\n'));
const md = `# Open Food Facts kapsam ölçümü — ${stamp}

Örnek: ${rows.length} barkod (${n} değerlendirilebilir; ${c(r => r.state === 'gecersiz')} geçersiz biçim, ${c(r => r.state.startsWith('hata'))} ağ/sunucu hatası — bunlar oranlara girmez).${rows.length < 30 ? '\n\n**Uyarı: 30\'dan az barkod — sonuç yetersiz örnekle, genelleme yapmayın.**' : ''}

| Ölçüt | Adet | Oran (değerlendirilebilir içinde) |
|---|---|---|
| Kayıt bulundu | ${found} | ${pct(found, n)} |
| Kullanılabilir ad var | ${usable} | ${pct(usable, n)} |
| Marka var | ${c(r => r.brand)} | ${pct(c(r => r.brand), n)} |
| Gramaj var | ${c(r => r.quantity)} | ${pct(c(r => r.quantity), n)} |
| Ön görsel var | ${c(r => r.image)} | ${pct(c(r => r.image), n)} |
| Türkiye etiketli | ${c(r => r.turkey)} | ${pct(c(r => r.turkey), n)} |

Bulunamayan barkodlar: ${rows.filter(r => r.state === 'yok').map(r => r.code).join(', ') || 'yok'}

Ayrıntı: kapsam-${stamp}.csv. Veri: Open Food Facts (ODbL).
`;
fs.writeFileSync(path.join(outDir, `kapsam-${stamp}.md`), md);
console.log('\n' + md);
