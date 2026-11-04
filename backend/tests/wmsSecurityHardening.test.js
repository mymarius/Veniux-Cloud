const crypto = require('crypto');
async function review(token, body) { const request=require('supertest'),app=require('../src/index'); const baseline=await request(app).post('/api/wms/cycle-count/baseline').set('Authorization','Bearer '+token).send(body); expect(baseline.status).toBe(200); const preview=await request(app).post('/api/wms/cycle-count/preview').set('Authorization','Bearer '+token).send({baseline_token:baseline.body.baseline_token,counted_qty:body.counted_qty}); expect(preview.status).toBe(200); return {review_id:preview.body.id,reason:'Test sayım mutabakatı'}; }
const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories/index');
const pool = require('../src/config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');

describe('🛡️ Veniux Enterprise WMS — Güvenlik Hardening & Sızma Koruması Test Paketi', () => {
  let adminToken;
  let viewerToken;
  let warehouseId;
  let supplierId;
  let testProductId;
  let sourceLocId;
  let targetLocId;
  let lockedLocId;
  let tenantId;

  beforeAll(async () => {
    // 1. Generate Admin Token
    const tenant = await createTenant();
    tenantId = tenant.tenantId;
    adminToken = tenant.token;
    expect(adminToken).toBeDefined();

    // 2. Generate Viewer Token (Unprivileged Role)
    const viewerRes = await pool.query(
      'INSERT INTO users (tenant_id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [tenant.tenantId, 'viewer@example.com', 'dummy_hash', 'viewer']
    );
    // Isolate role denial from the new unassigned-user scope denial.
    await pool.query("UPDATE user_access_scopes SET mode='company' WHERE user_id=$1",[viewerRes.rows[0].id]);
    viewerToken = jwt.sign(
      { userId: viewerRes.rows[0].id, tenantId: tenant.tenantId, email: 'viewer@example.com', role: 'viewer' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 3. Dynamic setup of valid warehouse and supplier
    const whRes = await pool.query('SELECT id FROM warehouses WHERE tenant_id = $1 LIMIT 1', [tenant.tenantId]);
    warehouseId = whRes.rows[0]?.id || 1;

    const supRes = await pool.query('SELECT id FROM suppliers WHERE tenant_id = $1 LIMIT 1', [tenant.tenantId]);
    supplierId = supRes.rows[0]?.id || 1;

    const prods = await pool.query('SELECT id FROM products WHERE tenant_id = $1 LIMIT 1', [tenant.tenantId]);
    testProductId = prods.rows[0]?.id;

    const suffix = Math.random();
    // Create unique test locations
    await pool.query(`
      INSERT INTO warehouse_locations (
        tenant_id, warehouse_id, location_code, zone_name, aisle_code, rack_number,
        shelf_tier, bin_position, location_type, is_locked
      ) VALUES ($1, $2, $3, 'GENERAL', 'S', 1, 1, 1, 'storage', 0)
    `, [tenant.tenantId, warehouseId, 'SEC-SRC-01-' + suffix]);
    const srcRow = await pool.query("SELECT id FROM warehouse_locations WHERE location_code = $1 AND tenant_id = $2", ['SEC-SRC-01-' + suffix, tenant.tenantId]);
    sourceLocId = srcRow.rows[0].id;

    await pool.query(
      'INSERT INTO warehouse_locations (tenant_id, warehouse_id, location_code, zone_name, aisle_code, rack_number, shelf_tier, bin_position) VALUES ($1, $2, $3, $4, $5, 1, 1, 2)',
      [tenant.tenantId, warehouseId, 'SEC-TGT-01-' + suffix, 'SEC', 'S1']
    );
    const tgtRow = await pool.query("SELECT id FROM warehouse_locations WHERE location_code = $1 AND tenant_id = $2", ['SEC-TGT-01-' + suffix, tenant.tenantId]);
    targetLocId = tgtRow.rows[0].id;

    // Kilitli Lokasyon
    await pool.query(
      'INSERT INTO warehouse_locations (tenant_id, warehouse_id, location_code, zone_name, aisle_code, rack_number, shelf_tier, bin_position, is_locked, lock_reason) VALUES ($1, $2, $3, $4, $5, 2, 1, 1, 1, $6)',
      [tenant.tenantId, warehouseId, 'LOCK-TEST-99-' + suffix, 'SEC', 'L1', 'Sayım Nedeniyle Kilitli']
    );
    const lockRow = await pool.query("SELECT id FROM warehouse_locations WHERE location_code = $1 AND tenant_id = $2", ['LOCK-TEST-99-' + suffix, tenant.tenantId]);
    lockedLocId = lockRow.rows[0]?.id;

    // Ensure source location has stock for testProductId
    if (sourceLocId && testProductId) {
      await pool.query(`
        INSERT INTO product_bin_records (tenant_id, location_id, product_id, quantity, reserved_qty)
        VALUES (${tenantId}, $1, $2, 50, 0)
        ON CONFLICT(location_id, product_id, lot_id) DO UPDATE SET quantity = 50
      `, [sourceLocId, testProductId]);
    }
  });

  describe('1. Döngüsel Sayım Parametre Tahrifatı Koruması (Cycle Count Parameter Tampering)', () => {
    it('İstemci sahte system_qty gönderse bile sunucu gerçek veritabanı stoğunu esas almalı', async () => {
      // Explicitly reset stock in DB to 50
      await pool.query('DELETE FROM product_bin_records WHERE location_id = $1 AND product_id = $2', [sourceLocId, testProductId]);
      await pool.query(`INSERT INTO product_bin_records (tenant_id, location_id, product_id, quantity, reserved_qty) VALUES (${tenantId}, $1, $2, 50, 0)`, [sourceLocId, testProductId]);

      // Source loc has 50 items in DB.
      // Attacker attempts to send system_qty: 0 and counted_qty: 60 to fake a +60 overage
      const body = await review(adminToken,{warehouse_id:warehouseId,location_id:sourceLocId,product_id:testProductId,counted_qty:60});
      const res = await request(app)
        .post('/api/wms/cycle-count/adjust').set('Idempotency-Key',crypto.randomUUID())
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          warehouse_id: warehouseId,
          location_id: sourceLocId,
          product_id: testProductId,
          ...body, counted_qty: 60,
          system_qty: 0 // TAMPERED VALUE! Server MUST IGNORE this and use actual DB stock (50)
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('difference');
      // Real DB quantity is 50, counted is 60 -> true difference must be +10 (NOT +60!)
      expect(res.body.difference).toBe(10);
      expect(res.body.system_qty).toBe(50);
    });

    it('Sayılan miktar ile sistem stoğu eşitse fark 0 olmalı ve transaction açılmamalı', async () => {
      // Current stock is now 60
      const body = await review(adminToken,{warehouse_id:warehouseId,location_id:sourceLocId,product_id:testProductId,counted_qty:60});
      const res = await request(app)
        .post('/api/wms/cycle-count/adjust').set('Idempotency-Key',crypto.randomUUID())
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          warehouse_id: warehouseId,
          location_id: sourceLocId,
          product_id: testProductId,
          ...body, counted_qty: 60
        });

      expect(res.status).toBe(201);
      expect(res.body.difference).toBe(0);
      expect(res.body.transaction).toBeNull();
    });
  });

  describe('2. Rol Tabanlı Yetkilendirme (RBAC) Koruması', () => {
    it('Viewer rolündeki kullanıcı stok mutabakatı yapamamalı (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/wms/cycle-count/adjust').set('Idempotency-Key',crypto.randomUUID())
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          warehouse_id: warehouseId,
          location_id: sourceLocId,
          product_id: testProductId,
          counted_qty: 100
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Insufficient permissions');
    });

    it('Viewer rolündeki kullanıcı raf transferi yapamamalı (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/wms/locations/relocate').set('Idempotency-Key',crypto.randomUUID())
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          warehouse_id: warehouseId,
          source_location_id: sourceLocId,
          target_location_id: targetLocId,
          product_id: testProductId,
          quantity: 5
        });

      expect(res.status).toBe(403);
    });

    it('Viewer rolündeki kullanıcı doğrudan stok defterine işlem yazamamalı (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/wms/ledger/transaction')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          warehouse_id: warehouseId,
          location_id: sourceLocId,
          product_id: testProductId,
          transaction_type: 'COUNT_ADJUSTMENT',
          quantity: 500
        });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Kilitli Raflara Yetkisiz Stok Aktarımı Koruması', () => {
    it('Kilitli bir lokasyona stok transferi engellenmeli (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/wms/locations/relocate').set('Idempotency-Key',crypto.randomUUID())
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          warehouse_id: warehouseId,
          source_location_id: sourceLocId,
          target_location_id: lockedLocId,
          product_id: testProductId,
          quantity: 5
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('kilitlidir');
    });

    it('Kaynak ve hedef raf aynı seçildiğinde transfer reddedilmeli', async () => {
      const res = await request(app)
        .post('/api/wms/locations/relocate').set('Idempotency-Key',crypto.randomUUID())
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          warehouse_id: warehouseId,
          source_location_id: sourceLocId,
          target_location_id: sourceLocId,
          product_id: testProductId,
          quantity: 5
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('aynı olamaz');
    });
  });

  describe('4. Mal Kabul ve Satınalma Concurrency / Race Condition Koruması', () => {
    it('Aynı satınalma teslimatı tekrar gönderildiğinde aynı kabul kaydı dönmeli', async () => {
      // 1. Create a PO
      const createRes = await request(app)
        .post('/api/purchase-orders').set('Idempotency-Key',crypto.randomUUID())
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplier_id: supplierId,
          target_warehouse_id: warehouseId,
          items: [{ product_id: testProductId, quantity: 10, unit_price: 15 }]
        });

      expect(createRes.status).toBe(201);
      const poId = createRes.body.order.id;

      for(const action of ['submit','approve'])expect((await request(app).post(`/api/purchase-orders/${poId}/status`).set('Authorization',`Bearer ${adminToken}`).send({action})).status).toBe(200);
      const line=(await request(app).get(`/api/purchase-orders/${poId}`).set('Authorization',`Bearer ${adminToken}`)).body.items[0];
      const delivery={delivery_reference:'WMS-SECURITY',items:[{order_item_id:line.id,quantity:10,location_id:sourceLocId}]};
      const key=crypto.randomUUID();
      // 2. First receive -> MUST SUCCEED
      const receive1 = await request(app)
        .post(`/api/purchase-orders/${poId}/receive`).set('Idempotency-Key',key).send(delivery)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(receive1.status).toBe(200);

      // 3. Second concurrent / duplicate receive -> MUST FAIL (400 Bad Request)
      const receive2 = await request(app)
        .post(`/api/purchase-orders/${poId}/receive`).set('Idempotency-Key',key).send(delivery)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(receive2.status).toBe(200);
      expect(receive2.body.receipt_id).toBe(receive1.body.receipt_id);
      const ledger=await pool.query("SELECT COUNT(*) n FROM inventory_transactions WHERE reference_type='INBOUND_RECEIPT' AND product_id=$1 AND tenant_id=$2",[testProductId,tenantId]);
      expect(ledger.rows[0].n).toBe(1);
    });
  });
});
