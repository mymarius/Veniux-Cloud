const crypto = require('crypto');
async function review(token, body) { const request=require('supertest'),app=require('../src/index'); const baseline=await request(app).post('/api/wms/cycle-count/baseline').set('Authorization','Bearer '+token).send(body); expect(baseline.status).toBe(200); const preview=await request(app).post('/api/wms/cycle-count/preview').set('Authorization','Bearer '+token).send({baseline_token:baseline.body.baseline_token,counted_qty:body.counted_qty}); expect(preview.status).toBe(200); return {review_id:preview.body.id,reason:'Test sayım mutabakatı'}; }
const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories/index');
const pool = require('../src/config/database');

describe('🏭 Veniux Enterprise WMS (Depo Yönetim Sistemi) Test Paketi', () => {
  let authToken;
  let warehouseId = 1;
  let testProductId;
  let sampleLocationId;

  beforeAll(async () => {
    // Authenticate as admin
    const tenant = await createTenant();
    authToken = tenant.token; tenantId = tenant.tenantId;
    expect(authToken).toBeDefined();

    const { createWarehouse, createProduct } = require('./factories/index');
    const warehouse = await createWarehouse(tenant.tenantId);
    warehouseId = warehouse.id;
    const prod = await createProduct(tenant.tenantId);
    testProductId = prod.id;
    console.log('Inserting A-01-', Date.now()); const locRes = await pool.query('INSERT INTO warehouse_locations (tenant_id, warehouse_id, location_code, zone_name, aisle_code, rack_number, shelf_tier, bin_position) VALUES ($1, $2, $3, $4, $5, 1, 1, 1) RETURNING id', [tenant.tenantId, warehouseId, 'A-01-' + Math.random().toString(), 'Zone A', 'A1']);
    sampleLocationId = locRes.rows[0].id;
    await require('../src/services/inventoryTransactionService').recordTransaction({tenant_id:tenant.tenantId,warehouse_id:warehouseId,location_id:sampleLocationId,product_id:testProductId,transaction_type:'PUTAWAY',quantity:100});
  });

  describe('1. Depo Lokasyon & Raf/Göz Yönetimi (Locations & Bins)', () => {
    it('Depo lokasyonlarını ve doluluk oranlarını listelemeli', async () => {
      const res = await request(app)
        .get(`/api/wms/locations?warehouse_id=${warehouseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      if(res.status !== 200) console.log(res.body); expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('location_code');
      expect(res.body[0]).toHaveProperty('occupancy_rate');
    });

    it('Otomatik koridor ve raf şablonu oluşturabilmeli', async () => {
      const res = await request(app)
        .post('/api/wms/locations/generate-grid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          warehouse_id: warehouseId,
          aisle_code: 'Z',
          zone_name: 'TEST_ZONE',
          rack_count: 2,
          tier_count: 2,
          bin_count: 2
        });

      expect(res.status).toBe(201);
      expect(res.body.locations.length).toBe(8); // 2x2x2 = 8
    });

    it('Raftan rafa (Bin-to-Bin) transfer yapabilmeli', async () => {
      const sourceBin = await pool.query(`
        SELECT pbr.* FROM product_bin_records pbr
        JOIN warehouse_locations wl ON pbr.location_id = wl.id
        WHERE pbr.quantity >= 5 AND pbr.tenant_id = $1 AND wl.warehouse_id = $2
        LIMIT 1
      `, [tenantId, warehouseId]);
      if (sourceBin.rows.length > 0) {
        const targetLoc = await pool.query('SELECT * FROM warehouse_locations WHERE id != $1 AND warehouse_id = $2 LIMIT 1', [sourceBin.rows[0].location_id, warehouseId]);
        if (targetLoc.rows.length > 0) {
          console.log('DEBUG_RELOCATE', {
            sourceBinLoc: sourceBin.rows[0].location_id,
            targetLoc: targetLoc.rows[0].id,
            warehouseId
          });
          const sourceVerify = await pool.query('SELECT * FROM warehouse_locations WHERE id = $1', [sourceBin.rows[0].location_id]);
          console.log('DEBUG_SOURCE_LOC', sourceVerify.rows[0]);
          
          const res = await request(app)
            .post('/api/wms/locations/relocate').set('Idempotency-Key',crypto.randomUUID())
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              warehouse_id: warehouseId,
              source_location_id: sourceBin.rows[0].location_id,
              target_location_id: targetLoc.rows[0].id,
              product_id: sourceBin.rows[0].product_id,
              quantity: 5
            });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
        }
      }
    });
  });

  describe('2. Merkezi Stok Defteri (Inventory Ledger) & Barkod Çözümleyici', () => {
    it('Stok defteri (Double-Entry Ledger) hareketlerini getirmeli', async () => {
      const res = await request(app)
        .get(`/api/wms/ledger?warehouse_id=${warehouseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('transaction_type');
    });

    it('Ürün stok kırılımını (On Hand, Reserved, Available) hesaplamalı', async () => {
      const res = await request(app)
        .get(`/api/wms/ledger/product/${testProductId}?warehouse_id=${warehouseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('on_hand');
      expect(res.body).toHaveProperty('available');
      expect(res.body).toHaveProperty('reserved');
    });

    it('Merkezi barkod çözümleyici lokasyon barkodunu tanımalı', async () => {
      const locRow = await pool.query('SELECT location_code FROM warehouse_locations WHERE id = $1', [sampleLocationId]);
      const res = await request(app)
        .post('/api/wms/barcode/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ barcode: locRow.rows[0].location_code, warehouse_id: warehouseId });

      expect(res.status).toBe(200);
      expect(res.body.matched).toBe(true);
      expect(res.body.type).toBe('LOCATION');
    });
  });

  describe('3. Rezervasyon & FEFO Tahsis (Inventory Reservations)', () => {
    it('FEFO stratejisiyle serbest stoktan rezervasyon yapmalı', async () => {
      const res = await request(app)
        .post('/api/wms/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          warehouse_id: warehouseId,
          product_id: testProductId,
          order_id: 101,
          requested_qty: 2,
          strategy: 'FEFO'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.reserved_total).toBe(2);
    });

    it('Aktif rezervasyonları listelemeli', async () => {
      const res = await request(app)
        .get(`/api/wms/reservations?warehouse_id=${warehouseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('4. İrsaliyeli Mal Kabul & Putaway (Inbound Receiving)', () => {
    let createdReceiptId;

    it('Yeni mal kabul belgesi ve otomatik raf önerisi oluşturmalı', async () => {
      const res = await request(app)
        .post('/api/wms/inbound/receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          warehouse_id: warehouseId,
          waybill_no: 'IRS-2026-9901',
          items: [
            { product_id: testProductId, expected_qty: 50, lot_number: 'LOT-TEST-99', expiry_date: '2028-12-31' }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.receipt_no).toBeDefined();
      expect(res.body.items.length).toBe(1);
      createdReceiptId = res.body.id;
    });

    it('Mal kabul kalemini rafa yerleştirmeli (Putaway)', async () => {
      const receiptRes = await request(app)
        .get(`/api/wms/inbound/receipts/${createdReceiptId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const itemId = receiptRes.body.items[0].id;

      const res = await request(app)
        .post('/api/wms/inbound/putaway')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          receipt_id: createdReceiptId,
          item_id: itemId,
          actual_location_id: sampleLocationId,
          quantity: 50
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('5. Dalga Toplama (Wave Picking & Shortest Route)', () => {
    let createdWaveId;

    it('En kısa rota optimizasyonlu dalga toplama emri oluşturmalı', async () => {
      const res = await request(app)
        .post('/api/wms/picking/waves')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          warehouse_id: warehouseId,
          picking_type: 'WAVE',
          items: [{ product_id: testProductId, requested_qty: 3 }]
        });

      expect(res.status).toBe(201);
      expect(res.body.wave_no).toBeDefined();
      expect(res.body.tasks.length).toBeGreaterThan(0);
      expect(res.body.tasks[0]).toHaveProperty('sequence_number');
      createdWaveId = res.body.id;
    });

    it('Toplanan kalemi onaylayıp stok defterinden düşmeli (Confirm Pick)', async () => {
      const waveRes = await request(app)
        .get(`/api/wms/picking/waves/${createdWaveId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const taskId = waveRes.body.tasks[0].id;

      const res = await request(app)
        .post('/api/wms/picking/confirm-item')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          task_id: taskId,
          picked_qty: 3
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('6. Paketleme, Taşıma Birimleri & Rampa (Packing & Dispatch)', () => {
    it('Yeni koli/palet (Handling Unit) oluşturabilmeli', async () => {
      const res = await request(app)
        .post('/api/wms/packing/handling-units')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          warehouse_id: warehouseId,
          hu_type: 'BOX',
          max_weight_kg: 25
        });

      expect(res.status).toBe(201);
      expect(res.body.hu_code).toBeDefined();
    });

    it('Rampa randevularını listeleyebilmeli', async () => {
      const res = await request(app)
        .get(`/api/wms/packing/dock-appointments?warehouse_id=${warehouseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('7. ABC Hız Analizi & Slotting Önerileri', () => {
    it('Depo ABC hız dağılım analizini hesaplamalı', async () => {
      const res = await request(app)
        .get(`/api/wms/slotting/abc?warehouse_id=${warehouseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('class_a_count');
      expect(res.body).toHaveProperty('products');
    });

    it('İkmal (Replenishment) gereksinimlerini listelemeli', async () => {
      const res = await request(app)
        .get(`/api/wms/slotting/replenishment?warehouse_id=${warehouseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('8. Kör Döngüsel Sayım (Cycle Counting)', () => {
    it('Sayım lokasyonlarını getirmeli', async () => {
      const res = await request(app)
        .get(`/api/wms/cycle-count/locations?warehouse_id=${warehouseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Sayım farkı için mutabakat fişi kesebilmeli', async () => {
      const binCheck = await pool.query('SELECT quantity FROM product_bin_records WHERE location_id = $1 AND product_id = $2', [sampleLocationId, testProductId]);
      const currentQty = binCheck.rows.length > 0 ? (parseFloat(binCheck.rows[0].quantity) || 0) : 0;

      const body=await review(authToken,{warehouse_id:warehouseId,location_id:sampleLocationId,product_id:testProductId,counted_qty:currentQty+10});
      const res = await request(app)
        .post('/api/wms/cycle-count/adjust').set('Idempotency-Key',crypto.randomUUID())
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          warehouse_id: warehouseId,
          location_id: sampleLocationId,
          product_id: testProductId,
          ...body, counted_qty: currentQty + 10
        });

      expect(res.status).toBe(201);
      expect(res.body.difference).toBe(10);
    });
  });
});
