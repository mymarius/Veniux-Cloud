// Pazaryeri sağlayıcıları. Ortak çekirdek (marketplaceService.js) şifreli anahtar saklama, zamanlayıcı, stok düşme ve
// hata beklemesini yapar; her sağlayıcı yalnız kendi adreslerini, başlıklarını ve veri biçimini bilir.
//
// Her sağlayıcı şu biçimde veri döndürür:
//   orders(...)  -> [{ id, orderNumber, status, cancelled, lines: [{ barcode, quantity }] }]
//   claims(...)  -> [{ id, orderNumber, barcode, status, ref }]   (yalnız stoğa geri eklenecek iade kalemleri)
//   pushStock()  -> batchId | null
// `experimental: true` olan sağlayıcılar gerçek mağazada denenmemiştir; bağlantı kapalı (enabled=0) kaydedilir.

const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const basic = (user, pass) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const encode = value => encodeURIComponent(String(value));

// ---------- Trendyol (gerçek mağazada denendi) ----------
// Belgeler: stok isteği en çok 1000 ürün, ürün başına en çok 20000 adet; sipariş sayfası en çok 200, tarih aralığı en çok 2 hafta.
const TRENDYOL_HOSTS = { live: 'https://apigw.trendyol.com', test: 'https://stageapigw.trendyol.com' };
const trendyol = {
  id: 'trendyol', label: 'Trendyol', experimental: false, environments: ['live', 'test'],
  stockBatch: 1000, maxUnits: 20000, pageSize: 200, windowMs: 14 * 86400000,
  authError: 'Trendyol API bilgileri reddedildi. Satıcı ID, API anahtarı ve parolayı kontrol edin.',
  validate(body) {
    const sellerId = String(body.seller_id ?? '').trim();
    if (!/^\d{1,20}$/.test(sellerId)) fail('Satıcı ID yalnız rakamlardan oluşmalıdır.');
    if (!['live', 'test'].includes(body.environment)) fail('Ortam canlı veya test olmalıdır.');
    return { sellerId, environment: body.environment };
  },
  request(connection, secret, path) {
    const host = process.env.TRENDYOL_TEST_BASE_URL || TRENDYOL_HOSTS[connection.environment];
    return { url: `${host}/integration${path}`, headers: { Authorization: basic(secret.apiKey, secret.apiSecret), 'User-Agent': `${connection.seller_id} - SelfIntegration` } };
  },
  hint503: connection => connection.environment === 'test' ? 'Trendyol test ortamı isteği reddetti. Sunucu IP adresinin Trendyol tarafından tanımlanması gerekir.' : null,
  async test(connection, api) {
    const data = await api('GET', `/product/sellers/${connection.seller_id}/products/approved/inventory-and-price?page=0&size=1`);
    return { ok: true, approved_products: Number(data.totalElements || 0) };
  },
  async checkBatch(connection, api) {
    const batch = await api('GET', `/product/sellers/${connection.seller_id}/products/batch-requests/${encode(connection.last_batch_id)}`);
    if (batch.status !== 'COMPLETED') return { done: false };
    if (!Number(batch.failedItemCount)) return { done: true, problem: null };
    const reason = (batch.items || []).find(item => item.status === 'FAILED')?.failureReasons?.[0];
    return { done: true, problem: `Son stok gönderiminde ${batch.failedItemCount} ürün reddedildi${reason ? ': ' + reason : ''}.` };
  },
  async orders(connection, api, start, end) {
    const out = [];
    // Trendyol belgesi (25 Kas 2026) yolu /orders olarak verir; eskiden kullanılan /v2/orders yedek olarak denenir (yalnız 404'te).
    let path = connection.ordersPath || 'orders';
    for (let page = 0; page < 50; page++) {
      const query = `?startDate=${start}&endDate=${end}&orderByField=PackageLastModifiedDate&orderByDirection=ASC&page=${page}&size=${this.pageSize}`;
      let data;
      try { data = await api('GET', `/order/sellers/${connection.seller_id}/${path}${query}`); }
      catch (error) {
        if (page !== 0 || error.upstream !== 404) throw error;
        path = path === 'orders' ? 'v2/orders' : 'orders';
        data = await api('GET', `/order/sellers/${connection.seller_id}/${path}${query}`);
      }
      for (const pack of data.content || []) {
        const status = String(pack.shipmentPackageStatus || pack.status || '');
        out.push({ id: String(pack.shipmentPackageId ?? pack.id ?? ''), orderNumber: pack.orderNumber == null ? null : String(pack.orderNumber), status, cancelled: ['Cancelled', 'UnSupplied'].includes(status), lines: Array.isArray(pack.lines) ? pack.lines : [] });
      }
      if (page + 1 >= Number(data.totalPages || 0)) break;
    }
    return out;
  },
  // İade: yalnız "Accepted" (ürün satıcıya ulaşıp iade onaylandı) kalemler stoğa geri eklenir.
  async claims(connection, api, start, end) {
    const out = [];
    for (let page = 0; page < 50; page++) {
      const data = await api('GET', `/order/sellers/${connection.seller_id}/claims?startDate=${start}&endDate=${end}&page=${page}&size=${this.pageSize}`);
      for (const claim of data.content || []) for (const item of claim.items || []) for (const line of item.claimItems || []) {
        const status = line.claimItemStatus?.name;
        if (status !== 'Accepted' || !line.id) continue;
        out.push({ id: String(line.id), orderNumber: claim.orderNumber || null, barcode: item.orderLine?.barcode || null, status, ref: claim.orderNumber || claim.id });
      }
      if (page + 1 >= Number(data.totalPages || 0)) break;
    }
    return out;
  },
  async pushStock(connection, api, part) {
    const result = await api('POST', `/inventory/sellers/${connection.seller_id}/products/price-and-inventory`, { items: part.map(row => ({ barcode: row.barcode, quantity: row.units, ...(row.sendPrice ? { salePrice: row.cents / 100, listPrice: row.cents / 100 } : {}) })) });
    return result.batchRequestId || null;
  }
};

// ---------- Hepsiburada (DENENMEDİ: yalnız genel belge bilgisine göre; adresler tek yerde, gerçek mağazada doğrulanmalı) ----------
const HB_HOSTS = {
  live: { oms: 'https://oms-external.hepsiburada.com', lst: 'https://listing-external.hepsiburada.com' },
  test: { oms: 'https://oms-external-sit.hepsiburada.com', lst: 'https://listing-external-sit.hepsiburada.com' }
};
const hbDate = ms => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const hepsiburada = {
  id: 'hepsiburada', label: 'Hepsiburada', experimental: true, environments: ['live', 'test'],
  stockBatch: 100, maxUnits: 20000, pageSize: 100, windowMs: 7 * 86400000,
  authError: 'Hepsiburada bilgileri reddedildi. Mağaza (merchant) kimliği, servis anahtarı ve geliştirici adını kontrol edin.',
  validate(body) {
    const sellerId = String(body.seller_id ?? '').trim();
    if (!/^[A-Za-z0-9-]{8,64}$/.test(sellerId)) fail('Hepsiburada mağaza (merchant) kimliği geçersiz.');
    if (!['live', 'test'].includes(body.environment)) fail('Ortam canlı veya test olmalıdır.');
    return { sellerId, environment: body.environment };
  },
  // api_key: Hepsiburada'ya kayıtlı geliştirici adı (User-Agent), api_secret: servis anahtarı.
  request(connection, secret, path) {
    const base = process.env.HEPSIBURADA_TEST_BASE_URL;
    const cut = path.indexOf(':'), kind = path.slice(0, cut), rest = path.slice(cut + 1);
    const host = base || HB_HOSTS[connection.environment][kind];
    return { url: host + rest, headers: { Authorization: basic(connection.seller_id, secret.apiSecret), 'User-Agent': secret.apiKey } };
  },
  hint503: () => null,
  async test(connection, api) {
    const data = await api('GET', `oms:/orders/merchantid/${encode(connection.seller_id)}?offset=0&limit=1`);
    return { ok: true, orders_visible: Number(data.totalCount ?? (data.items || []).length ?? 0) };
  },
  async checkBatch() { return { done: true, problem: null }; },
  async orders(connection, api, start, end) {
    const out = [];
    for (let offset = 0; offset < 50 * this.pageSize; offset += this.pageSize) {
      const data = await api('GET', `oms:/orders/merchantid/${encode(connection.seller_id)}?offset=${offset}&limit=${this.pageSize}&begindate=${encode(hbDate(start))}&enddate=${encode(hbDate(end))}`);
      const list = data.items || data.content || [];
      for (const order of list) {
        const status = String(order.status || 'Open');
        const lines = (order.items || order.lines || []).map(line => ({ barcode: line.merchantSku || line.hepsiburadaSku || line.sku, quantity: line.quantity }));
        out.push({ id: String(order.orderNumber ?? order.id ?? ''), orderNumber: order.orderNumber == null ? null : String(order.orderNumber), status, cancelled: /cancel/i.test(status), lines });
      }
      if (list.length < this.pageSize) break;
    }
    return out;
  },
  async claims() { return []; },
  async pushStock(connection, api, part) {
    const data = await api('POST', `lst:/listings/merchantid/${encode(connection.seller_id)}/inventory-uploads`, part.map(row => ({ merchantSku: row.barcode, availableStock: row.units, ...(row.sendPrice ? { price: row.cents / 100 } : {}) })));
    return data && data.id ? String(data.id) : null;
  }
};

// ---------- N11 (DENENMEDİ: yalnız genel belge bilgisine göre; adresler tek yerde, gerçek mağazada doğrulanmalı) ----------
const n11 = {
  id: 'n11', label: 'N11', experimental: true, environments: ['live'],
  stockBatch: 100, maxUnits: 20000, pageSize: 100, windowMs: 7 * 86400000,
  authError: 'N11 API bilgileri reddedildi. Uygulama anahtarı (appkey) ve gizli anahtarı (appsecret) kontrol edin.',
  validate(body) {
    const sellerId = String(body.seller_id ?? '').trim();
    if (!/^[\w .-]{1,40}$/.test(sellerId)) fail('Mağaza adı 1-40 karakter olmalı (harf, rakam, boşluk, nokta, tire).');
    if (body.environment !== 'live') fail('N11 için yalnız canlı ortam desteklenir.');
    return { sellerId, environment: 'live' };
  },
  request(connection, secret, path) {
    const host = process.env.N11_TEST_BASE_URL || 'https://api.n11.com';
    return { url: host + path, headers: { appkey: secret.apiKey, appsecret: secret.apiSecret } };
  },
  hint503: () => null,
  async test(connection, api) {
    const now = Date.now();
    const data = await api('GET', `/rest/delivery/v1/shipmentPackages?startDate=${now - 86400000}&endDate=${now}&page=0&size=1`);
    return { ok: true, packages_visible: Number(data.totalElements ?? (data.content || []).length ?? 0) };
  },
  async checkBatch() { return { done: true, problem: null }; },
  async orders(connection, api, start, end) {
    const out = [];
    for (let page = 0; page < 50; page++) {
      const data = await api('GET', `/rest/delivery/v1/shipmentPackages?startDate=${start}&endDate=${end}&page=${page}&size=${this.pageSize}`);
      for (const pack of data.content || []) {
        const status = String(pack.shipmentPackageStatus || pack.status || '');
        const lines = (pack.lines || pack.items || []).map(line => ({ barcode: line.stockCode || line.barcode || line.sku, quantity: line.quantity }));
        out.push({ id: String(pack.id ?? pack.packageId ?? ''), orderNumber: pack.orderNumber == null ? null : String(pack.orderNumber), status, cancelled: /cancel|iptal/i.test(status), lines });
      }
      if (page + 1 >= Number(data.totalPages || 0)) break;
    }
    return out;
  },
  async claims() { return []; },
  async pushStock(connection, api, part) {
    const data = await api('POST', '/ms/product/tasks/price-stock-update', { payload: { integrator: 'Veniux', skus: part.map(row => ({ stockCode: row.barcode, quantity: row.units, ...(row.sendPrice ? { salePrice: row.cents / 100, listPrice: row.cents / 100 } : {}) })) } });
    return data && data.id ? String(data.id) : null;
  }
};

module.exports = { providers: { trendyol, hepsiburada, n11 }, fail };
