// e-Belge kayıtları. Gerçek gönderim, VENIUX_EDOCUMENT_LIVE açık ve sağlayıcı send işlemini sunuyorsa çalışır.
// UUID gönderimden önce kaydedilir; sonucu belirsiz belge sorgulanmadan yeniden gönderilmez.
const crypto = require('crypto');
const db = require('../config/database');
const uyumsoft = require('../integrations/uyumsoft');

const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const TYPES = new Set(['E_FATURA', 'E_ARSIV']);
const uyumsoftProvider = {
  name: 'uyumsoft',
  test: credentials => uyumsoft.invoke('connection', {}, credentials),
  taxpayer: (vkn, credentials) => uyumsoft.invoke('taxpayer', { vknTckn: vkn }, credentials),
};
let provider = uyumsoftProvider;
const setProvider = next => { provider = next || uyumsoftProvider; };

function key() {
  const { JWT_SECRET } = require('../middlewares/authMiddleware');
  return crypto.createHash('sha256').update('veniux-edocument-v1\0' + JWT_SECRET).digest();
}
function seal(data, tenant) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(String(tenant)));
  const value = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  return JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), value: value.toString('base64') });
}
function unseal(payload, tenant) {
  const box = JSON.parse(payload), decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(box.iv, 'base64'));
  decipher.setAAD(Buffer.from(String(tenant)));
  decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(box.value, 'base64')), decipher.final()]).toString());
}

function guard(user, roles = ['admin', 'manager']) {
  if (!roles.includes(user.role) || (user.accessScope?.mode && user.accessScope.mode !== 'company')) fail('e-Belge işlemi için firma genelinde yönetici yetkisi gerekir.', 403);
}
const connectionRow = async tenant => (await db.query('SELECT * FROM edocument_connections WHERE tenant_id=$1', [tenant])).rows[0];
async function credentials(tenant) {
  const row = await connectionRow(tenant);
  if (!row) fail('Önce entegratör hesabınızı bağlayın.', 409);
  return unseal(row.credentials_enc, tenant);
}
const liveEnabled = () => process.env.VENIUX_EDOCUMENT_LIVE === '1' && typeof provider.send === 'function';

async function status(user) {
  guard(user);
  const row = await connectionRow(user.tenantId);
  return { provider: provider.name, connected: Boolean(row), last_test_at: row?.last_test_at || null, last_test_ok: row ? row.last_test_ok === null ? null : Boolean(row.last_test_ok) : null, live_sending: liveEnabled() };
}
async function saveConnection(user, body) {
  guard(user, ['admin']);
  const { username, password } = body || {};
  if (typeof username !== 'string' || !username.trim() || username.length > 190 || typeof password !== 'string' || !password || password.length > 500) fail('Kullanıcı adı ve parola gerekli.');
  const sealed = seal({ username: username.trim(), password }, user.tenantId);
  const updated = await db.query('UPDATE edocument_connections SET credentials_enc=$1,provider=$2,last_test_at=NULL,last_test_ok=NULL WHERE tenant_id=$3', [sealed, provider.name, user.tenantId]);
  if (!updated.rowCount) await db.query('INSERT INTO edocument_connections (tenant_id,provider,credentials_enc) VALUES ($1,$2,$3)', [user.tenantId, provider.name, sealed]);
  return status(user);
}
async function removeConnection(user) {
  guard(user, ['admin']);
  await db.query('DELETE FROM edocument_connections WHERE tenant_id=$1', [user.tenantId]);
  return status(user);
}
async function testConnection(user) {
  guard(user, ['admin']);
  const secret = await credentials(user.tenantId);
  let ok = false;
  try { await provider.test(secret); ok = true; } finally {
    await db.query('UPDATE edocument_connections SET last_test_at=CURRENT_TIMESTAMP,last_test_ok=$1 WHERE tenant_id=$2', [ok ? 1 : 0, user.tenantId]);
  }
  return status(user);
}
// Yanıt biçimi canlı hesapla doğrulanmadı: açık bir evet/hayır yoksa tahmin yürütülmez.
function readTaxpayer(result) {
  const value = result?.Value ?? result?.value ?? result?.attributes?.Value ?? result?.IsEInvoiceUser;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}
async function checkTaxpayer(user, vkn) {
  guard(user);
  if (typeof vkn !== 'string' || !/^\d{10,11}$/.test(vkn)) fail('10 veya 11 haneli vergi/kimlik numarası gerekli.');
  const registered = readTaxpayer(await provider.taxpayer(vkn, await credentials(user.tenantId)));
  if (registered === null) fail('Mükellef sonucu doğrulanamadı. Belge türünü seçmeden önce entegratör portalından kontrol edin.', 502);
  return { vkn, registered, suggested_type: registered ? 'E_FATURA' : 'E_ARSIV', checked_at: new Date().toISOString() };
}
async function event(tx, tenant, id, name, detail, userId) {
  await tx.query('INSERT INTO edocument_events (tenant_id,document_id,event,detail,user_id) VALUES ($1,$2,$3,$4,$5)', [tenant, id, name, detail ? JSON.stringify(detail) : null, userId || null]);
}
const view = row => ({ id: row.id, sale_id: row.sale_id, document_type: row.document_type, status: row.status, created_at: row.created_at, updated_at: row.updated_at, payload: JSON.parse(row.payload) });
async function find(user, id) {
  const row = (await db.query('SELECT * FROM edocuments WHERE id=$1 AND tenant_id=$2', [id, user.tenantId])).rows[0];
  if (!row) fail('Belge bulunamadı.', 404);
  return row;
}
async function createDraft(user, { sale_id, document_type, draft, receiver }) {
  guard(user);
  if (!TYPES.has(document_type)) fail('Belge türü seçin.');
  const id = crypto.randomUUID(), saleId = String(sale_id);
  return db.transaction(async tx => {
    if ((await tx.query('SELECT id FROM edocuments WHERE tenant_id=$1 AND active_key=$2', [user.tenantId, saleId])).rows.length) fail('Bu satış için geçerli bir belge zaten var.', 409);
    await tx.query("INSERT INTO edocuments (id,tenant_id,sale_id,active_key,document_type,status,payload,created_by) VALUES ($1,$2,$3,$4,$5,'draft',$6,$7)", [id, user.tenantId, saleId, saleId, document_type, JSON.stringify({ draft, receiver: receiver || null }), user.userId]);
    await event(tx, user.tenantId, id, 'created', { document_type }, user.userId);
    return view((await tx.query('SELECT * FROM edocuments WHERE id=$1', [id])).rows[0]);
  });
}
async function draftFromSale(user, saleId, body = {}) {
  guard(user);
  const draft = await require('./retailExternalService').invoiceDraft(user, saleId);
  return createDraft(user, { sale_id: saleId, document_type: body.document_type, draft, receiver: body.receiver });
}
async function list(user) {
  guard(user);
  const rows = (await db.query('SELECT * FROM edocuments WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100', [user.tenantId])).rows;
  return rows.map(view);
}
async function setState(user, id, status, detail, release) {
  await db.transaction(async tx => {
    await tx.query(`UPDATE edocuments SET status=$1,provider_detail=$2,updated_at=CURRENT_TIMESTAMP${release ? ',active_key=NULL' : ''} WHERE id=$3 AND tenant_id=$4`, [status, detail ? JSON.stringify(detail) : null, id, user.tenantId]);
    await event(tx, user.tenantId, id, status, detail, user.userId);
  });
}
function applyOutcome(outcome) {
  if (outcome?.state === 'accepted') return ['sent', false];
  if (outcome?.state === 'rejected') return ['rejected', true];
  return ['unknown', false];
}
async function send(user, id) {
  guard(user);
  if (!liveEnabled()) fail('Gerçek belge gönderimi henüz açık değil.', 503);
  const row = await find(user, id);
  const claim = await db.query("UPDATE edocuments SET status='sending',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2 AND status IN ('draft','retry')", [id, user.tenantId]);
  if (claim.rowCount !== 1) fail('Bu belge şu durumda gönderilemez. Sonucu belirsizse önce durumunu sorgulayın.', 409);
  const secret = await credentials(user.tenantId);
  let outcome = null;
  try { outcome = await provider.send({ uuid: row.id, document_type: row.document_type, ...JSON.parse(row.payload) }, secret); } catch { outcome = null; }
  const [state, release] = applyOutcome(outcome);
  await setState(user, id, state, outcome?.detail ? { detail: String(outcome.detail).slice(0, 500) } : null, release);
  return view(await find(user, id));
}
// Yalnız entegratör belgeyi almadığını açıkça söylerse aynı UUID ile yeniden gönderime açılır.
async function refresh(user, id) {
  guard(user);
  const row = await find(user, id);
  if (!['unknown', 'sent'].includes(row.status)) return view(row);
  if (typeof provider.status !== 'function') fail('Durum sorgusu bu sağlayıcıda henüz bağlı değil.', 503);
  const outcome = await provider.status(row.id, await credentials(user.tenantId));
  if (outcome?.state === 'not_found' && row.status === 'unknown') await setState(user, id, 'retry', null, false);
  else if (outcome?.state === 'rejected') await setState(user, id, 'rejected', outcome.detail ? { detail: String(outcome.detail).slice(0, 500) } : null, true);
  else if (outcome?.state === 'accepted' && row.status === 'unknown') await setState(user, id, 'sent', null, false);
  return view(await find(user, id));
}
module.exports = { status, saveConnection, removeConnection, testConnection, checkTaxpayer, createDraft, draftFromSale, list, send, refresh, setProvider, readTaxpayer };
