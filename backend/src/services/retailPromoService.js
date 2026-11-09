// Kasa kampanyaları ve basit puan sadakati.
// Kampanya: "X al Y öde" (ürüne özel, tam adetli) veya yüzde indirim (ürüne özel ya da tüm sepet), başlangıç–bitiş günü dahil.
// Her kaleme en çok indirim veren tek kampanya uygulanır; elle fiyat değiştirilen kaleme kampanya uygulanmaz.
// "Onay gerekir" işaretli kampanya yalnız yönetici, müdür veya kasa indirim yetkisi verilmiş kasiyerin satışında uygulanır.
// Sadakat: net tutarın her 10 TL'si 1 puan; 1 puan 10 kuruş indirim olarak harcanır. İade kazanılan puanı orantılı geri alır.
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const day = /^\d{4}-\d{2}-\d{2}$/;
const EARN_PER_CENTS = 1000, POINT_CENTS = 10;

function manager(user) {
  if (!['admin', 'manager'].includes(user.role)) fail('Kampanya ve sadakat ayarları için yönetici yetkisi gerekli.', 403);
  if (user.accessScope?.mode && user.accessScope.mode !== 'company') fail('Kampanyalar firma genelinde erişim gerektirir.', 403);
}

function validate(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) fail('Kampanya adı gerekli.');
  if (!['buy_x_pay_y', 'percent'].includes(body.kind)) fail('Kampanya türü "X al Y öde" veya "yüzde indirim" olmalı.');
  if (!day.test(body.starts_on || '') || !day.test(body.ends_on || '') || body.starts_on > body.ends_on) fail('Başlangıç ve bitiş günü gerekli; bitiş başlangıçtan önce olamaz.');
  const product = body.product_id === undefined || body.product_id === null || body.product_id === '' ? null : Number(body.product_id);
  if (product !== null && !Number.isSafeInteger(product)) fail('Ürün geçersiz.');
  const out = { name, kind: body.kind, product_id: product, buy_qty: null, pay_qty: null, percent: null, starts_on: body.starts_on, ends_on: body.ends_on, requires_approval: body.requires_approval ? 1 : 0 };
  if (body.kind === 'buy_x_pay_y') {
    const buy = Number(body.buy_qty), pay = Number(body.pay_qty);
    if (product === null) fail('"X al Y öde" kampanyası için ürün seçin.');
    if (!Number.isInteger(buy) || !Number.isInteger(pay) || pay < 1 || buy <= pay || buy > 100) fail('Alınan adet ödenen adetten büyük olmalı (örnek: 3 al 2 öde).');
    Object.assign(out, { buy_qty: buy, pay_qty: pay });
  } else {
    const percent = Number(body.percent);
    if (!Number.isInteger(percent) || percent < 1 || percent > 90) fail('İndirim yüzdesi 1 ile 90 arasında tam sayı olmalı.');
    out.percent = percent;
  }
  return out;
}

async function list(user) {
  manager(user);
  return (await db.query('SELECT c.*, p.name AS product_name FROM retail_campaigns c LEFT JOIN products p ON p.id=c.product_id AND p.tenant_id=c.tenant_id WHERE c.tenant_id=$1 ORDER BY c.id DESC LIMIT 200', [user.tenantId])).rows;
}
async function create(user, body) {
  manager(user);
  body = { ...(body || {}) };
  // Kullanıcı ürünü barkodla seçer; iç ürün numarası gerekmez.
  if (typeof body.barcode === 'string' && body.barcode.trim()) {
    const p = (await db.query('SELECT id FROM products WHERE tenant_id=$1 AND barcode=$2', [user.tenantId, body.barcode.trim()])).rows[0];
    if (!p) fail('Bu barkodla ürün bulunamadı.', 404);
    body.product_id = p.id;
  }
  const c = validate(body);
  if (c.product_id !== null && !(await db.query('SELECT id FROM products WHERE id=$1 AND tenant_id=$2', [c.product_id, user.tenantId])).rows.length) fail('Ürün bulunamadı.', 404);
  return (await db.query('INSERT INTO retail_campaigns (tenant_id,name,kind,product_id,buy_qty,pay_qty,percent,starts_on,ends_on,requires_approval,active,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,$11) RETURNING *',
    [user.tenantId, c.name, c.kind, c.product_id, c.buy_qty, c.pay_qty, c.percent, c.starts_on, c.ends_on, c.requires_approval, user.userId])).rows[0];
}
async function setActive(user, id, active) {
  manager(user);
  const r = await db.query('UPDATE retail_campaigns SET active=$1 WHERE id=$2 AND tenant_id=$3', [active ? 1 : 0, id, user.tenantId]);
  if (!r.rowCount) fail('Kampanya bulunamadı.', 404);
  return { id: Number(id), active: Boolean(active) };
}

// Satış içinde çağrılır: kalemlere göre kampanya indirimini hesaplar.
async function campaignDiscount(tx, tenant, date, lines, canApprove) {
  const campaigns = (await tx.query('SELECT * FROM retail_campaigns WHERE tenant_id=$1 AND active=1 AND starts_on<=$2 AND ends_on>=$2', [tenant, date])).rows;
  const applied = [], skipped = [];
  let total = 0;
  for (const line of lines) {
    if (line.manual_price) continue;
    let best = null;
    for (const c of campaigns) {
      if (c.product_id !== null && Number(c.product_id) !== Number(line.product_id)) continue;
      let cut = 0;
      if (c.kind === 'buy_x_pay_y') {
        if (!Number.isInteger(line.quantity) || line.weighted) continue;
        const free = Math.floor(line.quantity / Number(c.buy_qty)) * (Number(c.buy_qty) - Number(c.pay_qty));
        cut = Math.floor(line.gross_cents * free / line.quantity);
      } else cut = Math.floor(line.gross_cents * Number(c.percent) / 100);
      if (cut <= 0) continue;
      if (Number(c.requires_approval) && !canApprove) { skipped.push({ campaign_id: Number(c.id), name: c.name, line_id: line.id, reason: 'Yönetici onayı gerekli' }); continue; }
      if (!best || cut > best.cut) best = { c, cut };
    }
    if (best) { total += best.cut; applied.push({ campaign_id: Number(best.c.id), name: best.c.name, line_id: line.id, discount_cents: best.cut }); }
  }
  return { total, applied, skipped };
}

async function card(tx, tenant, cardNo) {
  const row = (await tx.query('SELECT * FROM retail_loyalty_cards WHERE tenant_id=$1 AND card_no=$2', [tenant, String(cardNo)])).rows[0];
  if (!row) fail('Sadakat kartı bulunamadı.', 404);
  return row;
}
async function balance(tx, tenant, cardId) {
  return Number((await tx.query('SELECT COALESCE(SUM(points),0) AS p FROM retail_loyalty_entries WHERE tenant_id=$1 AND card_id=$2', [tenant, cardId])).rows[0].p);
}
// Puan harcama: satış toplamından düşülecek indirim tutarını döndürür.
async function redeemValue(tx, tenant, body, room) {
  if (body.loyalty_card === undefined || body.loyalty_card === null || body.loyalty_card === '') {
    if (body.loyalty_redeem) fail('Puan harcamak için kart okutun.');
    return { card: null, points: 0, cents: 0 };
  }
  const contract = await require('./productPackages').rights(tenant, tx);
  if (contract && !contract.blocked && !require('./productPackages').hasModule(contract, 'reports_pro')) fail('Sadakat kartı Pro ve üstü paketlerde bulunur.', 403);
  const c = await card(tx, tenant, body.loyalty_card);
  const points = body.loyalty_redeem === undefined ? 0 : Number(body.loyalty_redeem);
  if (!Number.isSafeInteger(points) || points < 0) fail('Harcanacak puan geçersiz.');
  if (points > await balance(tx, tenant, c.id)) fail('Kartta yeterli puan yok.', 409);
  if (points * POINT_CENTS > room) fail('Puan indirimi satış tutarını aşamaz.');
  return { card: c, points, cents: points * POINT_CENTS };
}
async function settle(tx, tenant, redeem, saleId, net) {
  if (!redeem.card) return null;
  const earned = Math.floor(net / EARN_PER_CENTS);
  if (redeem.points) await tx.query("INSERT INTO retail_loyalty_entries (tenant_id,card_id,sale_id,kind,points) VALUES ($1,$2,$3,'redeem',$4)", [tenant, redeem.card.id, saleId, -redeem.points]);
  if (earned) await tx.query("INSERT INTO retail_loyalty_entries (tenant_id,card_id,sale_id,kind,points) VALUES ($1,$2,$3,'earn',$4)", [tenant, redeem.card.id, saleId, earned]);
  return { card_id: Number(redeem.card.id), card_no: redeem.card.card_no, redeemed: redeem.points, earned, earned_now: earned };
}
// İade/iptal: kalan net tutara göre kazanılan puan düşülür; satış tamamen geri alındıysa harcanan puan iade edilir.
async function reverse(tx, tenant, snapshot, saleId) {
  const l = snapshot.loyalty;
  if (!l) return;
  const keep = Math.floor((snapshot.net_cents - snapshot.refunded_cents) / EARN_PER_CENTS), back = l.earned_now - keep;
  if (back > 0) { await tx.query("INSERT INTO retail_loyalty_entries (tenant_id,card_id,sale_id,kind,points) VALUES ($1,$2,$3,'reverse',$4)", [tenant, l.card_id, saleId, -back]); l.earned_now = keep; }
  if (['cancelled', 'returned'].includes(snapshot.status) && l.redeemed && !l.redeem_returned) { await tx.query("INSERT INTO retail_loyalty_entries (tenant_id,card_id,sale_id,kind,points) VALUES ($1,$2,$3,'redeem_return',$4)", [tenant, l.card_id, saleId, l.redeemed]); l.redeem_returned = true; }
}

async function createCard(user, body) {
  manager(user);
  const no = typeof body.card_no === 'string' ? body.card_no.trim() : '', name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!/^[A-Za-z0-9-]{4,40}$/.test(no) || !name || name.length > 120 || (body.phone && !/^[0-9 +()-]{7,20}$/.test(body.phone))) fail('Kart numarası (4-40 harf/rakam) ve müşteri adı gerekli.');
  if ((await db.query('SELECT id FROM retail_loyalty_cards WHERE tenant_id=$1 AND card_no=$2', [user.tenantId, no])).rows.length) fail('Bu kart numarası kullanılıyor.', 409);
  return (await db.query('INSERT INTO retail_loyalty_cards (tenant_id,card_no,name,phone) VALUES ($1,$2,$3,$4) RETURNING *', [user.tenantId, no, name, body.phone || null])).rows[0];
}
// Kasiyer kartı okutunca ad ve puanı görür (telefon gösterilmez).
async function lookup(user, cardNo) {
  if (!['admin', 'manager', 'cashier'].includes(user.role)) fail('Yetkiniz yok.', 403);
  const c = await card(db, user.tenantId, cardNo);
  const points = await balance(db, user.tenantId, c.id);
  return { card_no: c.card_no, name: c.name, points, value_cents: points * POINT_CENTS };
}
async function cards(user) {
  manager(user);
  return (await db.query('SELECT c.id,c.card_no,c.name,c.phone,c.created_at,COALESCE(SUM(e.points),0) AS points FROM retail_loyalty_cards c LEFT JOIN retail_loyalty_entries e ON e.card_id=c.id AND e.tenant_id=c.tenant_id WHERE c.tenant_id=$1 GROUP BY c.id ORDER BY c.id DESC LIMIT 500', [user.tenantId])).rows.map(r => ({ ...r, points: Number(r.points) }));
}

module.exports = { list, create, setActive, campaignDiscount, redeemValue, settle, reverse, createCard, lookup, cards, EARN_PER_CENTS, POINT_CENTS };
