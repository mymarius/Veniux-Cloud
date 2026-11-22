const net = require('net'), request = require('supertest'), crypto = require('crypto'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
const ecr = require('../src/services/ecrService');
const frames = require('../src/services/ecr/frames');
const { EcrError } = require('../src/services/ecr/errors');
const { RecordedTransport, TcpTransport, createTransport } = require('../src/services/ecr/transport');
const { createFramedDriver } = require('../src/services/ecr/framedDriver');

const hex = b => Buffer.from(b).toString('hex');
// Oyuncak protokol: gerçek bir markanın protokolü DEĞİLDİR; yalnız iskeletin davranışını sınamak içindir.
const toy = {
  name: 'oyuncak',
  encodeSale: sale => Buffer.from('SALE|' + sale.total_cents),
  decodeSaleResponse: p => { const [st, a, b] = p.toString().split('|'); return st === 'OK' ? { ok: true, fiscal_receipt_no: a, z_no: b } : { ok: false, message: 'Hata ' + a, retryable: a !== 'MALI' }; },
  encodeStatusQuery: () => Buffer.from('QRY'),
  decodeStatusResponse: p => { const [st, a, b] = p.toString().split('|'); return st === 'FOUND' ? { found: true, fiscal_receipt_no: a, z_no: b } : { found: false }; }
};
const sale = { receipt_no: 'R1', total_cents: 1000, payments: [], lines: [] };
const ACK = '06';
const happy = () => [{ write: hex(frames.encode('SALE|1000')), read: ACK + hex(frames.encode('OK|F123|Z9')) }, { write: ACK, read: null }];
const driverWith = (script, opts = {}) => { const t = new RecordedTransport(script, opts.transport); return { t, driver: createFramedDriver(toy, { transportFactory: () => t, ackTimeoutMs: 40, responseTimeoutMs: 60, ...opts.driver }) }; };

describe('çerçeve zarfı (STX/ETX/LRC)', () => {
  test('kodlama/ayıklama gidiş-dönüş, ACK/NAK, bölünmüş ve bozuk çerçeve', () => {
    const frame = frames.encode('MERHABA');
    expect(frames.extract(frame)).toMatchObject({ kind: 'frame', consumed: frame.length });
    expect(frames.extract(frame).payload.toString()).toBe('MERHABA');
    expect(frames.extract(Buffer.from([0x06]))).toEqual({ kind: 'ack', consumed: 1 });
    expect(frames.extract(Buffer.from([0x15]))).toEqual({ kind: 'nak', consumed: 1 });
    expect(frames.extract(frame.subarray(0, 4))).toBeNull();
    const bad = Buffer.from(frame); bad[bad.length - 1] ^= 0xff;
    expect(frames.extract(bad).kind).toBe('invalid');
    expect(frames.extract(Buffer.concat([Buffer.from([0x00, 0x01]), frame])).kind).toBe('invalid');
  });
});

describe('kayıtlı çerçeve sürücüsü', () => {
  test('mutlu yol: kayıtla birebir çerçeve gönderilir, mali fiş no ve Z no okunur, kayıt tamamen tüketilir', async () => {
    const { t, driver } = driverWith(happy());
    expect(await driver.openSale({}, sale)).toEqual({ fiscal_receipt_no: 'F123', z_no: 'Z9' });
    expect(t.remaining()).toBe(0);
    expect(t.closedByDriver).toBe(true);
  });
  test('NAK gelince çerçeve yeniden gönderilir; sürekli NAK PROTOCOL hatası verir ve belirsiz değildir', async () => {
    const frame = hex(frames.encode('SALE|1000'));
    const ok = driverWith([{ write: frame, read: '15' }, ...happy()]);
    expect((await ok.driver.openSale({}, sale)).fiscal_receipt_no).toBe('F123');
    const bad = driverWith([{ write: frame, read: '15' }, { write: frame, read: '15' }, { write: frame, read: '15' }]);
    await expect(bad.driver.openSale({}, sale)).rejects.toMatchObject({ code: 'PROTOCOL', uncertain: false });
  });
  test('ACK gelmezse ya da yanıt gelmezse TIMEOUT ve BELİRSİZ; bağlantı kurulamazsa OFFLINE ve belirsiz değil', async () => {
    const frame = hex(frames.encode('SALE|1000'));
    await expect(driverWith([{ write: frame, read: null }]).driver.openSale({}, sale)).rejects.toMatchObject({ code: 'TIMEOUT', uncertain: true });
    await expect(driverWith([{ write: frame, read: ACK }]).driver.openSale({}, sale)).rejects.toMatchObject({ code: 'TIMEOUT', uncertain: true });
    await expect(driverWith([], { transport: { connectError: 'COM3 açılamadı' } }).driver.openSale({}, sale)).rejects.toMatchObject({ code: 'OFFLINE', uncertain: false });
  });
  test('protokol kayıttan saparsa PROTOCOL hatası (kayda karşı doğrulama)', async () => {
    const { driver } = driverWith([{ write: hex(frames.encode('SALE|9999')), read: null }]);
    await expect(driver.openSale({}, sale)).rejects.toMatchObject({ code: 'PROTOCOL' });
  });
  test('cihaz hata kodu REJECTED olur; bozuk LRC yanıtı yok sayılıp zaman aşımına düşer', async () => {
    const reject = driverWith([{ write: hex(frames.encode('SALE|1000')), read: ACK + hex(frames.encode('ERR|MALI')) }, { write: ACK, read: null }]);
    await expect(reject.driver.openSale({}, sale)).rejects.toMatchObject({ code: 'REJECTED', retryable: false, uncertain: false });
    const corrupt = Buffer.from(frames.encode('OK|F1|Z1')); corrupt[corrupt.length - 1] ^= 1;
    await expect(driverWith([{ write: hex(frames.encode('SALE|1000')), read: ACK + hex(corrupt) }]).driver.openSale({}, sale)).rejects.toMatchObject({ code: 'TIMEOUT', uncertain: true });
  });
  test('findSale: protokol durum sorgusu destekliyorsa belirsiz satış cihazdan sorulur', async () => {
    const q = [{ write: hex(frames.encode('QRY')), read: ACK + hex(frames.encode('FOUND|F77|Z3')) }, { write: ACK, read: null }];
    expect(await driverWith(q).driver.findSale({}, sale)).toEqual({ fiscal_receipt_no: 'F77', z_no: 'Z3' });
    const none = [{ write: hex(frames.encode('QRY')), read: ACK + hex(frames.encode('NONE')) }, { write: ACK, read: null }];
    expect(await driverWith(none).driver.findSale({}, sale)).toBeNull();
    expect(createFramedDriver({ ...toy, encodeStatusQuery: undefined }, { transportFactory: () => null }).findSale).toBeUndefined();
  });
  test('gerçek TCP taşıyıcısı: yerel sahte cihazla çerçeve alışverişi, bağlantı reddi OFFLINE', async () => {
    const server = net.createServer(socket => {
      let got = Buffer.alloc(0);
      socket.on('data', chunk => {
        got = Buffer.concat([got, chunk]);
        const hit = frames.extract(got);
        if (hit?.kind === 'frame') { got = got.subarray(hit.consumed); socket.write(Buffer.concat([Buffer.from([0x06]), frames.encode('OK|TCP-1|Z5')])); }
      });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const driver = createFramedDriver(toy, { transportFactory: d => createTransport(d), ackTimeoutMs: 1000, responseTimeoutMs: 1000 });
    try {
      expect(await driver.openSale({ connection: 'network', config: { host: '127.0.0.1', port } }, sale)).toEqual({ fiscal_receipt_no: 'TCP-1', z_no: 'Z5' });
    } finally { await new Promise(r => server.close(r)); }
    const closed = new TcpTransport({ host: '127.0.0.1', port, connectTimeoutMs: 500 });
    await expect(closed.connect()).rejects.toMatchObject({ code: 'OFFLINE', uncertain: false });
    expect(() => createTransport({ connection: 'usb' })).toThrow(EcrError);
  });
});

describe('sürücü kayıt defteri ve iş akışı sağlamlığı', () => {
  let owner, wh, fake;
  const auth = r => r.set('Authorization', 'Bearer ' + owner.token);
  async function newJob() {
    const code = 'ECRD-' + crypto.randomUUID();
    const p = (await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$3,$4,'adet',25,10,'NORMAL') RETURNING id,barcode", [owner.tenantId, code, code, 'Ürün ' + code])).rows[0];
    await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,50)', [owner.tenantId, wh.id, p.id]);
    const s = await auth(request(app).post('/api/scanner/sale')).set('Idempotency-Key', crypto.randomUUID()).send({ warehouse_id: wh.id, payment_method: 'cash', items: [{ barcode: p.barcode, count: 1 }] });
    expect(s.status).toBe(201);
    return (await db.query('SELECT id FROM ecr_jobs WHERE tenant_id=$1 AND sale_id=$2', [owner.tenantId, Number(s.body.sale_id)])).rows[0].id;
  }
  const user = () => ({ tenantId: owner.tenantId, role: 'admin' });
  beforeAll(async () => {
    process.env.VENIUX_ECR_TIMEOUT_MS = '1000';
    owner = await f.createTenant(); wh = await f.createWarehouse(owner.tenantId); await f.openTestShift(owner, wh.id);
    expect((await auth(request(app).post('/api/ecr/devices')).send({ brand: 'hugin', connection: 'serial', name: 'Sınama cihazı' })).status).toBe(201);
  });
  afterAll(() => { delete process.env.VENIUX_ECR_TIMEOUT_MS; });

  test('sürücü durumları: hiçbir marka "doğrulanmış" değildir; takılan sürücü yalnız "doğrulanmamış" olur', async () => {
    expect(ecr.VERIFIED_BRANDS).toEqual([]);
    expect(ecr.driverStatus('simulator')).toBe('simulator');
    expect(ecr.driverStatus('ingenico')).toBe('not_installed');
    expect((await auth(request(app).get('/api/ecr/devices'))).body.items[0].driver_status).toBe('not_installed');
    fake = { calls: 0, found: null, async openSale() { fake.calls++; await new Promise(r => setTimeout(r, 120)); return { fiscal_receipt_no: 'F-' + fake.calls, z_no: 'Z1' }; } };
    ecr.registerDriver('hugin', fake);
    expect(ecr.driverStatus('hugin')).toBe('unverified');
    expect((await auth(request(app).get('/api/ecr/devices'))).body.items[0].driver_status).toBe('unverified');
    expect(() => ecr.registerDriver('simulator', fake)).toThrow();
    expect(() => ecr.registerDriver('bilinmeyen', fake)).toThrow();
  });

  test('aynı iş aynı anda iki kez işlenirse cihaza yalnız bir kez yazılır (çift mali fiş yok)', async () => {
    const id = await newJob(); fake.calls = 0;
    const [a, b] = await Promise.all([ecr.processJob(user(), id), ecr.processJob(user(), id)]);
    expect([a.status, b.status].sort()).toEqual(['busy', 'done']);
    expect(fake.calls).toBe(1);
    expect((await ecr.processJob(user(), id)).status).toBe('done');
    expect(fake.calls).toBe(1);
  });

  test('zaman aşımı BELİRSİZ kalır: otomatik yeniden denenmez, onaysız elle 409, onayla yeniden yazılır; kimlik anahtarı sabit', async () => {
    const seen = [];
    fake.openSale = async (device, payload, ctx) => { seen.push(ctx); if (seen.length === 1) await new Promise(r => setTimeout(r, 1500)); return { fiscal_receipt_no: 'F-OK', z_no: 'Z2' }; };
    const id = await newJob();
    const first = await ecr.processJob(user(), id);
    expect(first).toMatchObject({ status: 'failed', uncertain: true, code: 'TIMEOUT' });
    expect(first.error).toMatch(/^BELİRSİZ: /);
    const list = (await auth(request(app).get('/api/ecr/jobs'))).body;
    expect(list.items.find(j => j.id === Number(id)).uncertain).toBe(true);
    const pending = await ecr.processPending(user());
    expect(pending.results.find(r => r.id === Number(id))).toBeUndefined();
    const denied = await auth(request(app).post(`/api/ecr/jobs/${id}/process`));
    expect(denied.status).toBe(409);
    expect(denied.body.error).toMatch(/belirsiz/i);
    const again = await auth(request(app).post(`/api/ecr/jobs/${id}/process`)).send({ confirm_reprint: true });
    expect(again.body).toMatchObject({ status: 'done', fiscal_receipt_no: 'F-OK' });
    expect(seen.map(c => c.idempotency_key)).toEqual([seen[0].idempotency_key, seen[0].idempotency_key]);
    expect(seen[0].idempotency_key).toMatch(/^veniux-sale-\d+$/);
    expect(seen.map(c => c.attempt)).toEqual([1, 2]);
  });

  test('cihaz bağlantı hatası (gönderilmedi) belirsiz değildir; sonraki denemede kendiliğinden yeniden denenir', async () => {
    let n = 0;
    fake.openSale = async () => { n++; if (n === 1) throw new EcrError('OFFLINE', 'COM3 açılamadı', { uncertain: false }); return { fiscal_receipt_no: 'F-2', z_no: 'Z3' }; };
    const id = await newJob();
    const first = await ecr.processJob(user(), id);
    expect(first).toMatchObject({ status: 'failed', uncertain: false, code: 'OFFLINE' });
    expect(first.error).not.toMatch(/BELİRSİZ/);
    const run = await ecr.processPending(user());
    expect(run.results.find(r => r.id === Number(id)).status).toBe('done');
  });

  test('findSale destekleyen sürücüde belirsiz iş önce cihaza sorulur; cihaz yazmışsa tekrar yazdırılmaz', async () => {
    let opened = 0;
    fake.openSale = async () => { opened++; throw new EcrError('TIMEOUT', 'yanıt yok', { uncertain: true }); };
    fake.findSale = async () => ({ fiscal_receipt_no: 'F-FOUND', z_no: 'Z4' });
    const id = await newJob();
    expect((await ecr.processJob(user(), id)).uncertain).toBe(true);
    expect(opened).toBe(1);
    const resolved = await ecr.processJob(user(), id);
    expect(resolved).toMatchObject({ status: 'done', fiscal_receipt_no: 'F-FOUND' });
    expect(opened).toBe(1);
    delete fake.findSale;
  });
});
