const crypto = require('crypto');
const db = require('../config/database');
const ledger = require('./inventoryTransactionService');

// Trendyol belgeleri: stok isteği en çok 1000 ürün, ürün başına en çok 20000 adet; sipariş sayfası en çok 200, tarih aralığı en çok 2 hafta.
const PROVIDER = 'trendyol', HOSTS = { live: 'https://apigw.trendyol.com', test: 'https://stageapigw.trendyol.com' };
const STOCK_BATCH = 1000, MAX_UNITS = 20000, PAGE_SIZE = 200, MAX_PAGES = 50, WINDOW_MS = 14 * 86400000, OVERLAP_MS = 3600000;
const CANCELLED = new Set(['Cancelled', 'UnSupplied']);
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const backoff = new Map();
const CLAIM_RESTOCK = new Set(['Accepted']);
const stamp = date => date.toISOString().slice(0, 19).replace('T', ' ');
const millis = value => Date.parse(String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z');

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
  const secret = unseal(connection.credentials_enc, connection.tenant_id);
  const host = process.env.TRENDYOL_TEST_BASE_URL || HOSTS[connection.environment];
  let response;
  try {
    response = await fetch(`${host}/integration${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: { Authorization: 'Basic ' + Buffer.from(`${secret.apiKey}:${secret.apiSecret}`).toString('base64'), 'User-Agent': `${connection.seller_id} - SelfIntegration`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch { fail('Trendyol sunucusuna ulaşılamadı.', 502); }
  if (response.status === 401) fail('Trendyol API bilgileri reddedildi. Satıcı ID, API anahtarı ve parolayı kontrol edin.', 502);
  if (response.status === 503 && connection.environment === 'test') fail('Trendyol test ortamı isteği reddetti. Sunucu IP adresinin Trendyol tarafından tanımlanması gerekir.', 502);
  if (response.status === 429) {
    const wait = Math.min(15 * 60, Math.max(60, Number(response.headers?.get?.('retry-after')) || 0, (backoff.get(connection.tenant_id)?.seconds || 30) * 2));
    backoff.set(connection.tenant_id, { until: Date.now() + wait * 1000, seconds: wait });
    fail(`Trendyol istek sınırı aşıldı; ${Math.ceil(wait / 60)} dakika sonra yeniden denenecek.`, 502);
  }
  if (!response.ok) fail(`Trendyol isteği başarısız oldu (${response.status}).`, 502);
  return response.json();
}

const read = async tenant => (await db.query('SELECT * FROM marketplace_connections WHERE tenant_id=$1 AND provider=$2', [tenant, PROVIDER])).rows[0];
async function settings(tenant) {
  const row = (await db.query('SELECT stock_buffer,price_sync FROM marketplace_settings WHERE tenant_id=$1 AND provider=$2', [tenant, PROVIDER])).rows[0];
  return { stock_buffer: Number(row?.stock_buffer || 0), price_sync: Boolean(Number(row?.price_sync || 0)) };
}
function view(row) {
  if (!row) return { connected: false };
  return { connected: true, seller_id: row.seller_id, environment: row.environment, warehouse_id: row.warehouse_id, enabled: Boolean(Number(row.enabled)), last_sync_at: row.last_sync_at, last_error: row.last_error, orders_since: row.orders_since };
}

async function status(user) {
  const orders = (await db.query('SELECT status,stock_state,package_id,order_number,detail,created_at FROM marketplace_orders WHERE tenant_id=$1 AND provider=$2 ORDER BY id DESC LIMIT 20', [user.tenantId, PROVIDER])).rows;
  const claims = (await db.query('SELECT status,stock_state,order_number,barcode,created_at FROM marketplace_claims WHERE tenant_id=$1 AND provider=$2 ORDER BY id DESC LIMIT 20', [user.tenantId, PROVIDER])).rows;
  return { ...view(await read(user.tenantId)), ...(await settings(user.tenantId)), orders, claims };
}

async function save(user, body) {
  const sellerId = String(body.seller_id ?? '').trim();
  if (!/^\d{1,20}$/.test(sellerId)) fail('Satıcı ID yalnız rakamlardan oluşmalıdır.');
  if (!['live', 'test'].includes(body.environment)) fail('Ortam canlı veya test olmalıdır.');
  const warehouse = (await db.query('SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2', [body.warehouse_id, user.tenantId])).rows[0];
  if (!warehouse) fail('Depo bulunamadı.', 404);
  const current = await read(user.tenantId);
  const hasKeys = String(body.api_key ?? '').trim() && String(body.api_secret ?? '').trim();
  if (!current && !hasKeys) fail('API anahtarı ve parola gereklidir.');
  const sealed = hasKeys ? seal({ apiKey: String(body.api_key).trim(), apiSecret: String(body.api_secret).trim() }, user.tenantId) : current.credentials_enc;
  const enabled = body.enabled === false ? 0 : 1;
  if (current) await db.query('UPDATE marketplace_connections SET seller_id=$1,credentials_enc=$2,environment=$3,warehouse_id=$4,enabled=$5,last_error=NULL WHERE id=$6 AND tenant_id=$7', [sellerId, sealed, body.environment, warehouse.id, enabled, current.id, user.tenantId]);
  // Bağlantıdan önceki siparişler stoğa zaten yansımış kabul edilir; yalnız bundan sonrakiler işlenir.
  else await db.query('INSERT INTO marketplace_connections (tenant_id,provider,seller_id,credentials_enc,environment,warehouse_id,enabled,orders_since) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [user.tenantId, PROVIDER, sellerId, sealed, body.environment, warehouse.id, enabled, stamp(new Date())]);
  const buffer = body.stock_buffer === undefined ? null : Number(body.stock_buffer);
  if (buffer !== null && (!Number.isInteger(buffer) || buffer < 0 || buffer > 1000)) fail('Güvenlik payı 0-1000 arasında tam sayı olmalıdır.');
  if (buffer !== null || body.price_sync !== undefined) {
    const current = await settings(user.tenantId), next = { stock_buffer: buffer ?? current.stock_buffer, price_sync: body.price_sync === undefined ? current.price_sync : body.price_sync === true };
    const updated = await db.query('UPDATE marketplace_settings SET stock_buffer=$1,price_sync=$2 WHERE tenant_id=$3 AND provider=$4', [next.stock_buffer, next.price_sync ? 1 : 0, user.tenantId, PROVIDER]);
    if (!updated.rowCount) await db.query('INSERT INTO marketplace_settings (tenant_id,provider,stock_buffer,price_sync) VALUES ($1,$2,$3,$4)', [user.tenantId, PROVIDER, next.stock_buffer, next.price_sync ? 1 : 0]);
  }
  return { ...view(await read(user.tenantId)), ...(await settings(user.tenantId)) };
}

async function test(user) {
  const connection = await read(user.tenantId);
  if (!connection) fail('Önce bağlantı bilgilerini kaydedin.');
  const data = await call(connection, 'GET', `/product/sellers/${connection.seller_id}/products/approved/inventory-and-price?page=0&size=1`);
  return { ok: true, approved_products: Number(data.totalElements || 0) };
}

async function checkLastBatch(connection) {
  if (!connection.last_batch_id) return null;
  const batch = await call(connection, 'GET', `/product/sellers/${connection.seller_id}/products/batch-requests/${encodeURIComponent(connection.last_batch_id)}`);
  if (batch.status !== 'COMPLETED') return null;
  await db.query('UPDATE marketplace_connections SET last_batch_id=NULL WHERE id=$1 AND tenant_id=$2', [connection.id, connection.tenant_id]);
  if (!Number(batch.failedItemCount)) return null;
  const reason = (batch.items || []).find(item => item.status === 'FAILED')?.failureReasons?.[0];
  return `Son stok gönderiminde ${batch.failedItemCount} ürün reddedildi${reason ? ': ' + reason : ''}.`;
}

async function pushStock(connection) {
  // Aşırı satışa karşı pazaryerine "stok − güvenlik payı" gönderilir. Fiyat gönderimi açıksa satış fiyatı da gider.
  const { stock_buffer: buffer, price_sync: withPrice } = await settings(connection.tenant_id);
  const rows = (await db.query(`SELECT p.id,p.barcode,p.sale_price,COALESCE(s.quantity,0) AS quantity,m.quantity AS sent,ps.price_cents AS sent_price FROM products p
    LEFT JOIN stock_records s ON s.product_id=p.id AND s.tenant_id=p.tenant_id AND s.warehouse_id=$2
    LEFT JOIN marketplace_stock_sent m ON m.product_id=p.id AND m.tenant_id=p.tenant_id AND m.provider=$3
    LEFT JOIN marketplace_price_sent ps ON ps.product_id=p.id AND ps.tenant_id=p.tenant_id AND ps.provider=$3
    WHERE p.tenant_id=$1 AND p.barcode IS NOT NULL AND p.barcode<>''`, [connection.tenant_id, connection.warehouse_id, PROVIDER])).rows;
  const changed = rows.map(row => ({ ...row, units: Math.min(MAX_UNITS, Math.max(0, Math.floor(Number(row.quantity)) - buffer)), cents: Math.round(Number(row.sale_price) * 100) }))
    .map(row => ({ ...row, sendPrice: withPrice && row.cents > 0 && (row.sent_price === null || row.sent_price === undefined || Number(row.sent_price) !== row.cents) }))
    .filter(row => row.sendPrice || row.sent === null || row.sent === undefined || Number(row.sent) !== row.units);
  let batchId = null;
  for (let i = 0; i < changed.length; i += STOCK_BATCH) {
    const part = changed.slice(i, i + STOCK_BATCH);
    const result = await call(connection, 'POST', `/inventory/sellers/${connection.seller_id}/products/price-and-inventory`, { items: part.map(row => ({ barcode: row.barcode, quantity: row.units, ...(row.sendPrice ? { salePrice: row.cents / 100, listPrice: row.cents / 100 } : {}) })) });
    batchId = result.batchRequestId || batchId;
    for (const row of part) {
      const updated = await db.query('UPDATE marketplace_stock_sent SET quantity=$1,sent_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND provider=$3 AND product_id=$4', [row.units, connection.tenant_id, PROVIDER, row.id]);
      if (!updated.rowCount) await db.query('INSERT INTO marketplace_stock_sent (tenant_id,provider,product_id,quantity) VALUES ($1,$2,$3,$4)', [connection.tenant_id, PROVIDER, row.id, row.units]);
      if (row.sendPrice) {
        const priced = await db.query('UPDATE marketplace_price_sent SET price_cents=$1,sent_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND provider=$3 AND product_id=$4', [row.cents, connection.tenant_id, PROVIDER, row.id]);
        if (!priced.rowCount) await db.query('INSERT INTO marketplace_price_sent (tenant_id,provider,product_id,price_cents) VALUES ($1,$2,$3,$4)', [connection.tenant_id, PROVIDER, row.id, row.cents]);
      }
    }
  }
  if (batchId) await db.query('UPDATE marketplace_connections SET last_batch_id=$1 WHERE id=$2 AND tenant_id=$3', [batchId, connection.id, connection.tenant_id]);
  return changed.length;
}

async function moveStock(tx, connection, product, amount, packageId, note) {
  await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,$5,'trendyol',$6)", [connection.tenant_id, product.id, connection.warehouse_id, amount, amount < 0 ? 'sale' : 'return', note]);
  const record = (await tx.query('SELECT id FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3', [connection.tenant_id, product.id, connection.warehouse_id])).rows[0];
  if (record) await tx.query('UPDATE stock_records SET quantity=quantity+$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3', [amount, record.id, connection.tenant_id]);
  else await tx.query('INSERT INTO stock_records (tenant_id,product_id,warehouse_id,quantity) VALUES ($1,$2,$3,$4)', [connection.tenant_id, product.id, connection.warehouse_id, amount]);
  await ledger.recordProjectedEntry(tx, { tenant_id: connection.tenant_id, warehouse_id: connection.warehouse_id, product_id: product.id, transaction_type: amount < 0 ? 'SHIP' : 'RECEIVE', quantity: amount, reference_type: 'trendyol_package', reference_id: packageId });
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
  const packageId = String(pack.shipmentPackageId ?? pack.id ?? '');
  if (!packageId) return 'skipped';
  const packStatus = String(pack.shipmentPackageStatus || pack.status || '');
  const cancelled = CANCELLED.has(packStatus);
  return db.transaction(async tx => {
    const seen = (await tx.query('SELECT * FROM marketplace_orders WHERE tenant_id=$1 AND provider=$2 AND package_id=$3', [connection.tenant_id, PROVIDER, packageId])).rows[0];
    const lines = Array.isArray(pack.lines) ? pack.lines : [];
    if (seen) {
      if (seen.status !== packStatus) await tx.query('UPDATE marketplace_orders SET status=$1 WHERE id=$2 AND tenant_id=$3', [packStatus, seen.id, connection.tenant_id]);
      if (!cancelled || seen.stock_state !== 'deducted') return 'seen';
      const applied = JSON.parse(seen.detail || '[]');
      for (const item of applied) await moveStock(tx, connection, { id: item.product_id }, item.quantity, packageId, `Trendyol iptali ${packageId}`);
      await tx.query("UPDATE marketplace_orders SET stock_state='restored' WHERE id=$1 AND tenant_id=$2", [seen.id, connection.tenant_id]);
      return 'restored';
    }
    const insert = (state, detail) => tx.query('INSERT INTO marketplace_orders (tenant_id,provider,package_id,order_number,status,stock_state,detail) VALUES ($1,$2,$3,$4,$5,$6,$7)', [connection.tenant_id, PROVIDER, packageId, pack.orderNumber == null ? null : String(pack.orderNumber), packStatus, state, detail]);
    if (cancelled) { await insert('ignored', '[]'); return 'ignored'; }
    const { plan, problems } = await planPackage(tx, connection, lines);
    if (problems.length) {
      await insert('needs_review', JSON.stringify(problems));
      await tx.query("INSERT INTO alerts (tenant_id,warehouse_id,alert_type,severity,message,status) VALUES ($1,$2,'marketplace_order','warning',$3,'unread')", [connection.tenant_id, connection.warehouse_id, `Trendyol paketi ${packageId} stoktan düşülemedi: ${problems.join('; ')}.`]);
      return 'needs_review';
    }
    for (const item of plan) await moveStock(tx, connection, item.product, -item.quantity, packageId, `Trendyol paketi ${packageId}`);
    await insert('deducted', JSON.stringify(plan.map(item => ({ product_id: item.product.id, quantity: item.quantity }))));
    return 'deducted';
  });
}

async function pullOrders(connection, now) {
  const floor = millis(connection.orders_since), last = connection.last_sync_at ? millis(connection.last_sync_at) - OVERLAP_MS : floor;
  const start = Math.max(floor, last, now.getTime() - WINDOW_MS);
  const counts = {};
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await call(connection, 'GET', `/order/sellers/${connection.seller_id}/v2/orders?startDate=${start}&endDate=${now.getTime()}&orderByField=PackageLastModifiedDate&orderByDirection=ASC&page=${page}&size=${PAGE_SIZE}`);
    for (const pack of data.content || []) {
      const result = await applyPackage(connection, pack);
      counts[result] = (counts[result] || 0) + 1;
    }
    if (page + 1 >= Number(data.totalPages || 0)) break;
  }
  return counts;
}

// İade: yalnız "Accepted" (ürün satıcıya ulaşıp iade onaylandı) kalemler stoğa geri eklenir; her iade kalemi bir kez işlenir.
async function pullClaims(connection, now) {
  const floor = millis(connection.orders_since), last = connection.last_sync_at ? millis(connection.last_sync_at) - OVERLAP_MS : floor;
  const start = Math.max(floor, last, now.getTime() - WINDOW_MS);
  const counts = {};
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await call(connection, 'GET', `/order/sellers/${connection.seller_id}/claims?startDate=${start}&endDate=${now.getTime()}&page=${page}&size=${PAGE_SIZE}`);
    for (const claim of data.content || []) for (const item of claim.items || []) for (const line of item.claimItems || []) {
      const status = line.claimItemStatus?.name;
      if (!CLAIM_RESTOCK.has(status) || !line.id) continue;
      const result = await db.transaction(async tx => {
        if ((await tx.query('SELECT id FROM marketplace_claims WHERE tenant_id=$1 AND provider=$2 AND claim_item_id=$3', [connection.tenant_id, PROVIDER, String(line.id)])).rows.length) return 'seen';
        const barcode = item.orderLine?.barcode || null;
        const product = barcode ? (await tx.query('SELECT id,name FROM products WHERE tenant_id=$1 AND barcode=$2', [connection.tenant_id, barcode])).rows[0] : null;
        if (product) await moveStock(tx, connection, product, 1, claim.orderNumber || claim.id, 'Trendyol iadesi kabul edildi');
        await tx.query('INSERT INTO marketplace_claims (tenant_id,provider,claim_item_id,order_number,barcode,status,stock_state) VALUES ($1,$2,$3,$4,$5,$6,$7)', [connection.tenant_id, PROVIDER, String(line.id), claim.orderNumber || null, barcode, status, product ? 'restored' : 'needs_review']);
        return product ? 'restored' : 'needs_review';
      });
      counts[result] = (counts[result] || 0) + 1;
    }
    if (page + 1 >= Number(data.totalPages || 0)) break;
  }
  return counts;
}

async function syncConnection(connection, now = new Date()) {
  const wait = backoff.get(connection.tenant_id);
  if (wait && wait.until > Date.now()) return { skipped: true, retry_after_seconds: Math.ceil((wait.until - Date.now()) / 1000) };
  try {
    const batchProblem = await checkLastBatch(connection);
    const orders = await pullOrders(connection, now);
    const claims = await pullClaims(connection, now);
    const stock = await pushStock(connection);
    backoff.delete(connection.tenant_id);
    await db.query('UPDATE marketplace_connections SET last_sync_at=$1,last_error=$2 WHERE id=$3 AND tenant_id=$4', [stamp(now), batchProblem, connection.id, connection.tenant_id]);
    return { orders, claims, stock_sent: stock, warning: batchProblem };
  } catch (error) {
    await db.query('UPDATE marketplace_connections SET last_error=$1 WHERE id=$2 AND tenant_id=$3', [String(error.message).slice(0, 500), connection.id, connection.tenant_id]);
    throw error;
  }
}

async function sync(user) {
  const connection = await read(user.tenantId);
  if (!connection) fail('Önce bağlantı bilgilerini kaydedin.');
  return syncConnection(connection);
}

async function syncAll() {
  const rows = (await db.transaction(tx => tx.query('SELECT * FROM marketplace_connections WHERE enabled=1'))).rows;
  for (const connection of rows) await syncConnection(connection).catch(error => console.error('[Trendyol] Eşitleme başarısız:', connection.tenant_id, error.message));
}

let timer, stockTimer;
async function pushAllStock() {
  const rows = (await db.transaction(tx => tx.query('SELECT * FROM marketplace_connections WHERE enabled=1'))).rows;
  for (const connection of rows) {
    const wait = backoff.get(connection.tenant_id);
    if (wait && wait.until > Date.now()) continue;
    await pushStock(connection).catch(error => console.error('[Trendyol] Stok gönderilemedi:', connection.tenant_id, error.message));
  }
}
function startScheduler(intervalMs = 5 * 60000, stockMs = 60000) {
  if (timer) return;
  const tick = () => syncAll().catch(error => console.error('[Trendyol] Eşitleme çalışmadı:', error.message));
  timer = setInterval(tick, intervalMs);
  timer.unref();
  // Kasada satılan ürün en geç bir dakika içinde pazaryerinde düşer (yalnız değişen satırlar gönderilir).
  stockTimer = setInterval(() => pushAllStock().catch(() => {}), stockMs);
  stockTimer.unref();
}

module.exports = { status, save, test, sync, syncAll, pushAllStock, startScheduler, _backoff: backoff };
