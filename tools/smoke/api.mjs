// Duman testi ortak yardımcıları. Yalnızca "Veniux Demo" ile başlayan işletmede çalışır; ürün, kullanıcı ve satış kaydı üretir.
const base = process.env.VENIUX_SMOKE_BASE || 'http://127.0.0.1:3000/api';
const pw = process.env.VENIUX_SMOKE_PASSWORD || '';
const email0 = process.env.VENIUX_SMOKE_EMAIL || 'tasarim.deneme@example.com';
let token;
export async function login(email = email0, password = pw) {
  const r = await fetch(base + '/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password})});
  const j = await r.json(); token = j.token;
  if (email === email0) {
    const me = await (await fetch(base + '/auth/me', {headers: {Authorization: 'Bearer ' + j.token}})).json();
    if (!String(me.company_name || '').startsWith('Veniux Demo')) { console.error('DURDU: duman testi yalnızca "Veniux Demo" işletmesinde çalışır.'); process.exitCode = 2; throw new Error('demo olmayan işletme'); }
  }
  return j;
}
export async function call(method, path, body, tok = token) {
  const r = await fetch(base + path, {method, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, ...(method === 'POST' ? {'Idempotency-Key': 'k-' + Math.random().toString(36).slice(2) + Date.now()} : {})}, body: body === undefined ? undefined : JSON.stringify(body)});
  let data; const t = await r.text(); try { data = JSON.parse(t); } catch { data = t; }
  return {status: r.status, data};
}
let pass = 0, fail = 0;
export const check = (name, ok, extra = '') => { if (ok) pass++; else fail++; console.log((ok ? 'TAMAM  ' : 'HATA   ') + name + (ok ? '' : '  → ' + String(extra).slice(0, 220))); };
export const summary = () => console.log(`\nSONUÇ: ${pass} tamam, ${fail} hata`);
