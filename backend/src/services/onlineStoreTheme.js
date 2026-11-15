// Online mağaza vitrin teması: ana renk, ürün düzeni, yazı tipi, üst alan stili ve duyuru şeridi.
// Düğme yazı rengi, seçilen ana renge göre okunabilirlik (kontrast) hesabıyla otomatik belirlenir.
const db = require('../config/database');
const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const LAYOUTS = ['grid', 'list', 'compact'], FONTS = ['modern', 'classic', 'rounded'], HEROS = ['plain', 'soft', 'bold'];
const DEFAULT = { color: '#b23f04', layout: 'grid', font: 'modern', hero: 'plain', banner: '' };
const PRESETS = ['#b23f04', '#0f766e', '#1d4ed8', '#7c3aed', '#be123c', '#15803d', '#b45309', '#334155'];
const HEX = /^#[0-9a-f]{6}$/;
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
// Düğme metni: beyaz ya da koyu, hangisi daha okunaklıysa.
const inkFor = hex => (ratio(hex, '#ffffff') >= ratio(hex, '#17202b') ? '#ffffff' : '#17202b');
const shape = r => {
  const t = { ...DEFAULT, ...(r ? { color: r.color, layout: r.layout, font: r.font, hero: r.hero, banner: r.banner || '' } : {}) };
  return { ...t, ink: inkFor(t.color) };
};
async function get(user) {
  const row = (await db.query('SELECT * FROM online_store_theme WHERE tenant_id=$1', [user.tenantId])).rows[0];
  return { theme: shape(row), presets: PRESETS, layouts: LAYOUTS, fonts: FONTS, heros: HEROS };
}
async function save(user, body = {}) {
  const current = (await db.query('SELECT * FROM online_store_theme WHERE tenant_id=$1', [user.tenantId])).rows[0];
  const base = shape(current);
  const color = body.color === undefined ? base.color : String(body.color).trim().toLowerCase();
  if (!HEX.test(color)) fail('Renk #rrggbb biçiminde olmalı.', 422, 'BAD_COLOR');
  // Çok açık renkte beyaz zemin üstünde düğme ve bağlantılar seçilemez.
  if (ratio(color, '#ffffff') < 3) fail('Bu renk beyaz zeminde yeterince okunmuyor; daha koyu bir renk seçin.', 422, 'LOW_CONTRAST');
  const pick = (v, list, name) => { const x = v === undefined ? null : String(v); if (x !== null && !list.includes(x)) fail(`${name} geçersiz.`, 422, 'BAD_THEME'); return x; };
  const layout = pick(body.layout, LAYOUTS, 'Düzen') || base.layout, font = pick(body.font, FONTS, 'Yazı tipi') || base.font, hero = pick(body.hero, HEROS, 'Üst alan') || base.hero;
  const banner = body.banner === undefined ? base.banner : String(body.banner || '').trim().replace(/\s+/g, ' ').slice(0, 160);
  if (current) await db.query('UPDATE online_store_theme SET color=$2,layout=$3,font=$4,hero=$5,banner=$6,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1', [user.tenantId, color, layout, font, hero, banner || null]);
  else await db.query('INSERT INTO online_store_theme (tenant_id,color,layout,font,hero,banner) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, color, layout, font, hero, banner || null]);
  return get(user);
}
async function forTenant(tenantId) {
  return shape((await db.query('SELECT * FROM online_store_theme WHERE tenant_id=$1', [tenantId])).rows[0]);
}

module.exports = { get, save, forTenant, inkFor, ratio, DEFAULT };
