const crypto = require('crypto');
const db = require('../config/database');
const ledger = require('./inventoryTransactionService');
const { providers } = require('./marketplaceProviders');

// Ortak pazaryeri çekirdeği. Sağlayıcıya özgü adres ve veri biçimi marketplaceProviders.js içindedir.
const DEFAULT_PROVIDER = 'trendyol';
const MAX_PAGES = 50, OVERLAP_MS = 3600000;
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
// Beklemeler firma + sağlayıcı bazındadır: bir pazaryerinin sınırı diğerini durdurmaz.
const backoff = new Map();
const waitKey = connection => `${connection.tenant_id}:${connection.provider}`;
const stamp = date => date.toISOString().slice(0, 19).replace('T', ' ');
const millis = value => Date.parse(String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z');

function adapterOf(provider) {
  // Yalnız kayıtlı sağlayıcı adları geçerlidir; 'constructor' gibi nesne özellikleri sağlayıcı sayılmaz.
  const adapter = Object.hasOwn(providers, provider) ? providers[provider] : null;
  if (!adapter) fail('Desteklenmeyen pazaryeri.', 404);
  return adapter;
}
const providerList = () => Object.values(providers).map(p => ({ id: p.id, label: p.label, experimental: p.experimental, environments: p.environments }));

function key() {
  const { JWT_SECRET } = require('../middlewares/authMiddleware');
  return crypto.createHash('sha256').update('veniux-marketplace-v1\0' + JWT_SECRET).digest();
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

async function call(connection, method, path, body) {
  const adapter = adapterOf(connection.provider);
  const secret = unseal(connection.credentials_enc, connection.tenant_id);
  const { url, headers } = adapter.request(connection, secret, path);
  let response;
  try {
    response = await fetch(url, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch { fail(`${adapter.label} sunucusuna ulaşılamadı.`, 502); }
  if (response.status === 401 || (response.status === 403 && adapter.experimental)) fail(adapter.authError, 502);
  const hint = response.status === 503 ? adapter.hint503(connection) : null;
  if (hint) fail(hint, 502);
  if (response.status === 429) {
    const wait = Math.min(15 * 60, Math.max(60, Number(response.headers?.get?.('retry-after')) || 0, (backoff.get(waitKey(connection))?.seconds || 30) * 2));
    backoff.set(waitKey(connection), { until: Date.now() + wait * 1000, seconds: wait });
    fail(`${adapter.label} istek sınırı aşıldı; ${Math.ceil(wait / 60)} dakika sonra yeniden denenecek.`, 502);
  }
  if (!response.ok) fail(`${adapter.label} isteği başarısız oldu (${response.status}).`, 502);
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}
const apiFor = connection => (method, path, body) => call(connection, method, path, body);

const read = async (tenant, provider) => (await db.query('SELECT * FROM marketplace_connections WHERE tenant_id=$1 AND provider=$2', [tenant, provider])).rows[0];
async function settings(tenant, provider) {
  const row = (await db.query('SELECT stock_buffer,price_sync FROM marketplace_settings WHERE tenant_id=$1 AND provider=$2', [tenant, provider])).rows[0];
  return { stock_buffer: Number(row?.stock_buffer || 0), price_sync: Boolean(Number(row?.price_sync || 0)) };
}
function view(row, adapter) {
  const meta = { provider: adapter.id, label: adapter.label, experimental: adapter.experimental, environments: adapter.environments };
  if (!row) return { ...meta, connected: false };
  return { ...meta, connected: true, seller_id: row.seller_id, environment: row.environment, warehouse_id: row.warehouse_id, enabled: Boolean(Number(row.enabled)), last_sync_at: row.last_sync_at, last_error: row.last_error, orders_since: row.orders_since };
}

async function status(user, provider = DEFAULT_PROVIDER) {
  const adapter = adapterOf(provider);
  const orders = (await db.query('SELECT status,stock_state,package_id,order_number,detail,created_at FROM marketplace_orders WHERE tenant_id=$1 AND provider=$2 ORDER BY id DESC LIMIT 20', [user.tenantId, provider])).rows;
  const claims = (await db.query('SELECT status,stock_state,order_number,barcode,created_at FROM marketplace_claims WHERE tenant_id=$1 AND provider=$2 ORDER BY id DESC LIMIT 20', [user.tenantId, provider])).rows;
  return { ...view(await read(user.tenantId, provider), adapter), ...(await settings(user.tenantId, provider)), orders, claims };
}

async function save(user, body, provider = DEFAULT_PROVIDER) {
  const adapter = adapterOf(provider);
  const { sellerId, environment } = adapter.validate(body);
  const warehouse = (await db.query('SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2', [body.warehouse_id, user.tenantId])).rows[0];
  if (!warehouse) fail('Depo bulunamadı.', 404);
  const current = await read(user.tenantId, provider);
  const hasKeys = String(body.api_key ?? '').trim() && String(body.api_secret ?? '').trim();
  if (!current && !hasKeys) fail('API anahtarı ve parola gereklidir.');
  const sealed = hasKeys ? seal({ apiKey: String(body.api_key).trim(), apiSecret: String(body.api_secret).trim() }, user.tenantId) : current.credentials_enc;
  // Denenmemiş sağlayıcılar yöneticinin açık onayı olmadan kapalı kaydedilir; kapalıyken eşitleme ve stok gönderimi çalışmaz.
  const enabled = adapter.experimental ? (body.enabled === true ? 1 : 0) : (body.enabled === false ? 0 : 1);
  if (current) await db.query('UPDATE marketplace_connections SET seller_id=$1,credentials_enc=$2,environment=$3,warehouse_id=$4,enabled=$5,last_error=NULL WHERE id=$6 AND tenant_id=$7', [sellerId, sealed, environment, warehouse.id, adapter.experimental && body.enabled === undefined ? current.enabled : enabled, current.id, user.tenantId]);
  // Bağlantıdan önceki siparişler stoğa zaten yansımış kabul edilir; yalnız bundan sonrakiler işlenir.
  else await db.query('INSERT INTO marketplace_connections (tenant_id,provider,seller_id,credentials_enc,environment,warehouse_id,enabled,orders_since) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [user.tenantId, provider, sellerId, sealed, environment, warehouse.id, enabled, stamp(new Date())]);
  const buffer = body.stock_buffer === undefined ? null : Number(body.stock_buffer);
  if (buffer !== null && (!Number.isInteger(buffer) || buffer < 0 || buffer > 1000)) fail('Güvenlik payı 0-1000 arasında tam sayı olmalıdır.');
  if (buffer !== null || body.price_sync !== undefined) {
    const now = await settings(user.tenantId, provider), next = { stock_buffer: buffer ?? now.stock_buffer, price_sync: body.price_sync === undefined ? now.price_sync : body.price_sync === true };
    const updated = await db.query('UPDATE marketplace_settings SET stock_buffer=$1,price_sync=$2 WHERE tenant_id=$3 AND provider=$4', [next.stock_buffer, next.price_sync ? 1 : 0, user.tenantId, provider]);
    if (!updated.rowCount) await db.query('INSERT INTO marketplace_settings (tenant_id,provider,stock_buffer,price_sync) VALUES ($1,$2,$3,$4)', [user.tenantId, provider, next.stock_buffer, next.price_sync ? 1 : 0]);
  }
  return { ...view(await read(user.tenantId, provider), adapter), ...(await settings(user.tenantId, provider)) };
}

async function test(user, provider = DEFAULT_PROVIDER) {
  const adapter = adapterOf(provider);
  const connection = await read(user.tenantId, provider);
  if (!connection) fail('Önce bağlantı bilgilerini kaydedin.');
  return adapter.test(connection, apiFor(connection));
}

async function checkLastBatch(connection) {
  if (!connection.last_batch_id) return null;
  const result = await adapterOf(connection.provider).checkBatch(connection, apiFor(connection));
  if (!result.done) return null;
  await db.query('UPDATE marketplace_connections SET last_batch_id=NULL WHERE id=$1 AND tenant_id=$2', [connection.id, connection.tenant_id]);
  return result.problem || null;
}

async function pushStock(connection) {
  // Aşırı satışa karşı pazaryerine "stok − güvenlik payı" gönderilir. Fiyat gönderimi açıksa satış fiyatı da gider.
  const adapter = adapterOf(connection.provider), provider = connection.provider;
  const { stock_buffer: buffer, price_sync: withPrice } = await settings(connection.tenant_id, provider);
  const rows = (await db.query(`SELECT p.id,p.barcode,p.sale_price,COALESCE(s.quantity,0) AS quantity,m.quantity AS sent,ps.price_cents AS sent_price FROM products p
    LEFT JOIN stock_records s ON s.product_id=p.id AND s.tenant_id=p.tenant_id AND s.warehouse_id=$2
    LEFT JOIN marketplace_stock_sent m ON m.product_id=p.id AND m.tenant_id=p.tenant_id AND m.provider=$3
    LEFT JOIN marketplace_price_sent ps ON ps.product_id=p.id AND ps.tenant_id=p.tenant_id AND ps.provider=$3
    WHERE p.tenant_id=$1 AND p.barcode IS NOT NULL AND p.barcode<>''`, [connection.tenant_id, connection.warehouse_id, provider])).rows;
  const changed = rows.map(row => ({ ...row, units: Math.min(adapter.maxUnits, Math.max(0, Math.floor(Number(row.quantity)) - buffer)), cents: Math.round(Number(row.sale_price) * 100) }))
    .map(row => ({ ...row, sendPrice: withPrice && row.cents > 0 && (row.sent_price === null || row.sent_price === undefined || Number(row.sent_price) !== row.cents) }))
    .filter(row => row.sendPrice || row.sent === null || row.sent === undefined || Number(row.sent) !== row.units);
  let batchId = null;
  for (let i = 0; i < changed.length; i += adapter.stockBatch) {
    const part = changed.slice(i, i + adapter.stockBatch);
    batchId = (await adapter.pushStock(connection, apiFor(connection), part)) || batchId;
    for (const row of part) {
      const updated = await db.query('UPDATE marketplace_stock_sent SET quantity=$1,sent_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND provider=$3 AND product_id=$4', [row.units, connection.tenant_id, provider, row.id]);
      if (!updated.rowCount) await db.query('INSERT INTO marketplace_stock_sent (tenant_id,provider,product_id,quantity) VALUES ($1,$2,$3,$4)', [connection.tenant_id, provider, row.id, row.units]);
      if (row.sendPrice) {
        const priced = await db.query('UPDATE marketplace_price_sent SET price_cents=$1,sent_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND provider=$3 AND product_id=$4', [row.cents, connection.tenant_id, provider, row.id]);
        if (!priced.rowCount) await db.query('INSERT INTO marketplace_price_sent (tenant_id,provider,product_id,price_cents) VALUES ($1,$2,$3,$4)', [connection.tenant_id, provider, row.id, row.cents]);
      }
    }
  }
  if (batchId) await db.query('UPDATE marketplace_connections SET last_batch_id=$1 WHERE id=$2 AND tenant_id=$3', [batchId, connection.id, connection.tenant_id]);
  return changed.length;
}

async function moveStock(tx, connection, product, amount, packageId, note) {
  await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,$5,$6,$7)", [connection.tenant_id, product.id, connection.warehouse_id, amount, amount < 0 ? 'sale' : 'return', connection.provider, note]);
  const record = (await tx.query('SELECT id FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3', [connection.tenant_id, product.id, connection.warehouse_id])).rows[0];
  if (record) await tx.query('UPDATE stock_records SET quantity=quantity+$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3', [amount, record.id, connection.tenant_id]);
  else await tx.query('INSERT INTO stock_records (tenant_id,product_id,warehouse_id,quantity) VALUES ($1,$2,$3,$4)', [connection.tenant_id, product.id, connection.warehouse_id, amount]);
  await ledger.recordProjectedEntry(tx, { tenant_id: connection.tenant_id, warehouse_id: connection.warehouse_id, product_id: product.id, transaction_type: amount < 0 ? 'SHIP' : 'RECEIVE', quantity: amount, reference_type: `${connection.provider}_package`, reference_id: packageId });
}

// Paket tek işlemde ya tamamen düşülür ya da hiç düşülmez; düşülemeyen paket yönetici incelemesine kalır.
async function planPackage(tx, connection, lines) {
  const plan = [], problems = [];
  for (const line of lines) {
    const quantity = Number(line.quantity);
    const product = (await tx.query('SELECT id,name FROM products WHERE tenant_id=$1 AND barcode=$2', [connection.tenant_id, String(line.barcode ?? '')])).rows[0];
    if (!product) { problems.push(`${line.barcode}: Veniux'ta bu barkodlu ürün yok`); continue; }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) { problems.push(`${product.name}: geçersiz miktar`); continue; }
    const lots = await require('./stockHealthService').lotAvailability(connection.tenant_id, product.id, connection.warehouse_id, tx);
    if (lots.length) { problems.push(`${product.name}: lotlu ürün, elle düşülmeli`); continue; }
    const same = plan.find(item => item.product.id === product.id);
    if (same) same.quantity += quantity; else plan.push({ product, quantity });
  }
  for (const item of plan) {
    const stock = Number((await tx.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3', [connection.tenant_id, item.product.id, connection.warehouse_id])).rows[0].q);
    if (stock < item.quantity) problems.push(`${item.product.name}: stok ${stock}, sipariş ${item.quantity}`);
  }
  return { plan, problems };
}

async function applyPackage(connection, pack) {
  const provider = connection.provider, label = adapterOf(provider).label;
  const packageId = String(pack.id ?? '');
  if (!packageId) return 'skipped';
  const packStatus = String(pack.status || ''), cancelled = Boolean(pack.cancelled);
  return db.transaction(async tx => {
    const seen = (await tx.query('SELECT * FROM marketplace_orders WHERE tenant_id=$1 AND provider=$2 AND package_id=$3', [connection.tenant_id, provider, packageId])).rows[0];
    const lines = Array.isArray(pack.lines) ? pack.lines : [];
    if (seen) {
      if (seen.status !== packStatus) await tx.query('UPDATE marketplace_orders SET status=$1 WHERE id=$2 AND tenant_id=$3', [packStatus, seen.id, connection.tenant_id]);
      if (!cancelled || seen.stock_state !== 'deducted') return 'seen';
      const applied = JSON.parse(seen.detail || '[]');
      for (const item of applied) await moveStock(tx, connection, { id: item.product_id }, item.quantity, packageId, `${label} iptali ${packageId}`);
      await tx.query("UPDATE marketplace_orders SET stock_state='restored' WHERE id=$1 AND tenant_id=$2", [seen.id, connection.tenant_id]);
      return 'restored';
    }
    const insert = (state, detail) => tx.query('INSERT INTO marketplace_orders (tenant_id,provider,package_id,order_number,status,stock_state,detail) VALUES ($1,$2,$3,$4,$5,$6,$7)', [connection.tenant_id, provider, packageId, pack.orderNumber == null ? null : String(pack.orderNumber), packStatus, state, detail]);
    if (cancelled) { await insert('ignored', '[]'); return 'ignored'; }
    const { plan, problems } = await planPackage(tx, connection, lines);
    if (problems.length) {
      await insert('needs_review', JSON.stringify(problems));
      await tx.query("INSERT INTO alerts (tenant_id,warehouse_id,alert_type,severity,message,status) VALUES ($1,$2,'marketplace_order','warning',$3,'unread')", [connection.tenant_id, connection.warehouse_id, `${label} paketi ${packageId} stoktan düşülemedi: ${problems.join('; ')}.`]);
      return 'needs_review';
    }
    for (const item of plan) await moveStock(tx, connection, item.product, -item.quantity, packageId, `${label} paketi ${packageId}`);
    await insert('deducted', JSON.stringify(plan.map(item => ({ product_id: item.product.id, quantity: item.quantity }))));
    return 'deducted';
  });
}

function windowFor(connection, adapter, now) {
  const floor = millis(connection.orders_since), last = connection.last_sync_at ? millis(connection.last_sync_at) - OVERLAP_MS : floor;
  return Math.max(floor, last, now.getTime() - adapter.windowMs);
}

async function pullOrders(connection, now) {
  const adapter = adapterOf(connection.provider), counts = {};
  for (const pack of await adapter.orders(connection, apiFor(connection), windowFor(connection, adapter, now), now.getTime())) {
    const result = await applyPackage(connection, pack);
    counts[result] = (counts[result] || 0) + 1;
  }
  return counts;
}

// İade: yalnız sağlayıcının "stoğa dön" saydığı kalemler eklenir; her iade kalemi bir kez işlenir.
async function pullClaims(connection, now) {
  const adapter = adapterOf(connection.provider), provider = connection.provider, label = adapter.label, counts = {};
  for (const claim of await adapter.claims(connection, apiFor(connection), windowFor(connection, adapter, now), now.getTime())) {
    const result = await db.transaction(async tx => {
      if ((await tx.query('SELECT id FROM marketplace_claims WHERE tenant_id=$1 AND provider=$2 AND claim_item_id=$3', [connection.tenant_id, provider, claim.id])).rows.length) return 'seen';
      const product = claim.barcode ? (await tx.query('SELECT id,name FROM products WHERE tenant_id=$1 AND barcode=$2', [connection.tenant_id, claim.barcode])).rows[0] : null;
      if (product) await moveStock(tx, connection, product, 1, claim.ref, `${label} iadesi kabul edildi`);
      await tx.query('INSERT INTO marketplace_claims (tenant_id,provider,claim_item_id,order_number,barcode,status,stock_state) VALUES ($1,$2,$3,$4,$5,$6,$7)', [connection.tenant_id, provider, claim.id, claim.orderNumber, claim.barcode, claim.status, product ? 'restored' : 'needs_review']);
      return product ? 'restored' : 'needs_review';
    });
    counts[result] = (counts[result] || 0) + 1;
  }
  return counts;
}

// Cari hesap ekstresi (yalnız Trendyol; developers.trendyol.com "Cari Hesap Ekstresi Entegrasyonu"): tarih aralığı en çok 15 gün, size 500/1000.
// Satıcıya göre işaret: Satış ve İndirim İptali hakediş +, İade ve İndirim hakediş -. Komisyon aynı işaretle gider sayılır
// (iadede ve indirimde komisyon satıcıya geri döner). Kayıtlar kimliğiyle tekildir; Trendyol sonradan düzeltirse yeniden yazılır.
const SETTLEMENT_SIGN = { Sale: 1, Return: -1, Discount: -1, DiscountCancel: 1 };
const SETTLEMENT_TYPE_TR = { 'Satış': 'Sale', 'İade': 'Return', 'İndirim': 'Discount', 'İndirim İptal': 'DiscountCancel' };
const SETTLEMENT_WINDOW = 15 * 86400000 - 1000, SETTLEMENT_LOOKBACK = 30 * 86400000, SETTLEMENT_EVERY = 3600000;
const settlementPulled = new Map();
const cents = value => Math.round(Math.abs(Number(value) || 0) * 100);
async function pullSettlements(connection, now, force = false) {
  if (connection.provider !== 'trendyol') return null;
  const PROVIDER = connection.provider;
  const last = settlementPulled.get(connection.tenant_id);
  if (!force && last && now.getTime() - last < SETTLEMENT_EVERY) return null;
  // Ekstre stoğu değiştirmez: bağlantı anından önceki son 30 gün de rapora alınır.
  const counts = { saved: 0 };
  for (let start = now.getTime() - SETTLEMENT_LOOKBACK; start < now.getTime(); start += SETTLEMENT_WINDOW + 1000) {
    const end = Math.min(now.getTime(), start + SETTLEMENT_WINDOW);
    for (const type of Object.keys(SETTLEMENT_SIGN)) for (let page = 0; page < MAX_PAGES; page++) {
      const data = await call(connection, 'GET', `/finance/che/sellers/${connection.seller_id}/settlements?transactionType=${type}&startDate=${start}&endDate=${end}&page=${page}&size=500`);
      for (const row of data.content || []) {
        const kind = SETTLEMENT_SIGN[row.transactionType] ? row.transactionType : SETTLEMENT_TYPE_TR[row.transactionType] || type;
        const sign = SETTLEMENT_SIGN[kind];
        if (!row.id || !sign || !Number.isFinite(Number(row.transactionDate))) continue;
        const values = [kind, row.orderNumber ? String(row.orderNumber) : null, row.barcode ? String(row.barcode) : null, stamp(new Date(Number(row.transactionDate))), sign * cents(row.credit || row.debt), sign * cents(row.commissionAmount), sign * cents(row.sellerRevenue), row.paymentDate ? stamp(new Date(Number(row.paymentDate))) : null];
        await db.transaction(async tx => {
          const seen = (await tx.query('SELECT id FROM marketplace_settlements WHERE tenant_id=$1 AND provider=$2 AND entry_id=$3', [connection.tenant_id, PROVIDER, String(row.id)])).rows[0];
          if (seen) await tx.query('UPDATE marketplace_settlements SET transaction_type=$1,order_number=$2,barcode=$3,transaction_at=$4,amount_cents=$5,commission_cents=$6,revenue_cents=$7,payment_at=$8 WHERE id=$9 AND tenant_id=$10', [...values, seen.id, connection.tenant_id]);
          else await tx.query('INSERT INTO marketplace_settlements (tenant_id,provider,entry_id,transaction_type,order_number,barcode,transaction_at,amount_cents,commission_cents,revenue_cents,payment_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [connection.tenant_id, PROVIDER, String(row.id), ...values]);
        });
        counts.saved++;
      }
      if (page + 1 >= Number(data.totalPages || 0)) break;
    }
  }
  settlementPulled.set(connection.tenant_id, now.getTime());
  return counts;
}

// Kâr raporu: satış tutarı, komisyon ve hakediş Trendyol ekstresinden; maliyet ürün kartındaki alış fiyatından (tahmini).
// Ekstreye henüz yansımamış paketler ayrıca sayılır; onların tutarı rapora katılmaz.
async function report(user, query = {}, provider = DEFAULT_PROVIDER) {
  if (provider !== 'trendyol') fail('Bu pazaryeri için hakediş raporu henüz yok.', 404);
  const PROVIDER = provider;
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const to = day.test(query.to || '') ? query.to : new Date().toISOString().slice(0, 10);
  const from = day.test(query.from || '') ? query.from : new Date(Date.parse(to) - 29 * 86400000).toISOString().slice(0, 10);
  if (from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) fail('Tarih aralığı geçersiz (en çok bir yıl).');
  const range = [user.tenantId, PROVIDER, from + ' 00:00:00', to + ' 23:59:59'];
  const rows = (await db.query(`SELECT s.barcode, MAX(p.name) AS name, MAX(p.purchase_price) AS purchase_price, COUNT(p.id) AS known,
      SUM(CASE WHEN s.transaction_type='Sale' THEN 1 WHEN s.transaction_type='Return' THEN -1 ELSE 0 END) AS units,
      SUM(s.amount_cents) AS amount, SUM(s.commission_cents) AS commission, SUM(s.revenue_cents) AS revenue
    FROM marketplace_settlements s LEFT JOIN products p ON p.tenant_id=s.tenant_id AND p.barcode=s.barcode
    WHERE s.tenant_id=$1 AND s.provider=$2 AND s.transaction_at>=$3 AND s.transaction_at<=$4
    GROUP BY s.barcode ORDER BY SUM(s.revenue_cents) DESC`, range)).rows;
  const products = rows.map(r => {
    const units = Number(r.units || 0), revenue = Number(r.revenue || 0);
    const cost = Number(r.known) ? Math.round(Number(r.purchase_price || 0) * 100) * units : null;
    return { barcode: r.barcode, name: r.name || null, units, sales_cents: Number(r.amount || 0), commission_cents: Number(r.commission || 0), revenue_cents: revenue, cost_cents: cost, profit_cents: cost === null ? null : revenue - cost };
  });
  const sum = k => products.reduce((t, p) => t + (p[k] || 0), 0);
  const unsettled = Number((await db.query(`SELECT COUNT(*) AS n FROM marketplace_orders o WHERE o.tenant_id=$1 AND o.provider=$2 AND o.stock_state='deducted' AND o.created_at>=$3 AND o.created_at<=$4
    AND NOT EXISTS (SELECT 1 FROM marketplace_settlements s WHERE s.tenant_id=o.tenant_id AND s.provider=o.provider AND s.order_number=o.order_number)`, range)).rows[0].n);
  const unknown = products.filter(p => p.cost_cents === null).length;
  return { from, to, estimated: true, note: 'Maliyet ürün kartındaki alış fiyatıyla hesaplanır; kargo ve diğer kesintiler dahil değildir.', totals: { sales_cents: sum('sales_cents'), commission_cents: sum('commission_cents'), revenue_cents: sum('revenue_cents'), cost_cents: sum('cost_cents'), profit_cents: unknown ? null : sum('profit_cents') }, unknown_products: unknown, unsettled_packages: unsettled, products };
}

async function syncSettlements(user, provider = DEFAULT_PROVIDER) {
  const connection = await read(user.tenantId, provider);
  if (!connection) fail('Önce bağlantı bilgilerini kaydedin.');
  if (provider !== 'trendyol') fail('Bu pazaryeri için hakediş eşitlemesi henüz yok.', 404);
  return pullSettlements(connection, new Date(), true);
}

async function syncConnection(connection, now = new Date()) {
  const wait = backoff.get(waitKey(connection)), label = adapterOf(connection.provider).label;
  if (wait && wait.until > Date.now()) return { skipped: true, retry_after_seconds: Math.ceil((wait.until - Date.now()) / 1000) };
  try {
    const batchProblem = await checkLastBatch(connection);
    const orders = await pullOrders(connection, now);
    const claims = await pullClaims(connection, now);
    const stock = await pushStock(connection);
    const settlements = await pullSettlements(connection, now).catch(error => { console.error(`[${label}] Ekstre alınamadı:`, connection.tenant_id, error.message); return null; });
    backoff.delete(waitKey(connection));
    await db.query('UPDATE marketplace_connections SET last_sync_at=$1,last_error=$2 WHERE id=$3 AND tenant_id=$4', [stamp(now), batchProblem, connection.id, connection.tenant_id]);
    return { orders, claims, stock_sent: stock, settlements, warning: batchProblem };
  } catch (error) {
    await db.query('UPDATE marketplace_connections SET last_error=$1 WHERE id=$2 AND tenant_id=$3', [String(error.message).slice(0, 500), connection.id, connection.tenant_id]);
    throw error;
  }
}

async function sync(user, provider = DEFAULT_PROVIDER) {
  adapterOf(provider);
  const connection = await read(user.tenantId, provider);
  if (!connection) fail('Önce bağlantı bilgilerini kaydedin.');
  return syncConnection(connection);
}

const enabledConnections = async () => (await db.transaction(tx => tx.query('SELECT * FROM marketplace_connections WHERE enabled=1'))).rows.filter(row => providers[row.provider]);
async function syncAll() {
  for (const connection of await enabledConnections()) await syncConnection(connection).catch(error => console.error(`[${adapterOf(connection.provider).label}] Eşitleme başarısız:`, connection.tenant_id, error.message));
}

let timer, stockTimer;
async function pushAllStock() {
  for (const connection of await enabledConnections()) {
    const wait = backoff.get(waitKey(connection));
    if (wait && wait.until > Date.now()) continue;
    await pushStock(connection).catch(error => console.error(`[${adapterOf(connection.provider).label}] Stok gönderilemedi:`, connection.tenant_id, error.message));
  }
}
function startScheduler(intervalMs = 5 * 60000, stockMs = 60000) {
  if (timer) return;
  const tick = () => syncAll().catch(error => console.error('[Pazaryeri] Eşitleme çalışmadı:', error.message));
  timer = setInterval(tick, intervalMs);
  timer.unref();
  // Kasada satılan ürün en geç bir dakika içinde pazaryerinde düşer (yalnız değişen satırlar gönderilir).
  stockTimer = setInterval(() => pushAllStock().catch(() => {}), stockMs);
  stockTimer.unref();
}

module.exports = { status, save, test, sync, syncAll, pushAllStock, startScheduler, report, syncSettlements, providerList, _backoff: backoff, _settlementPulled: settlementPulled };
