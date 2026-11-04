const assertRetired=require('./helpers/assertRetired');
const request = require('supertest');
const app = require('../src/index');
const { createTenant, createWarehouse } = require('./factories/index');
const pool = require('../src/config/database');
const { parseKarekod, generateKarekodString } = require('../src/services/karekodService');

describe('Pharmacy, Medula & Karekod Integration Endpoints', () => {
  let authToken;

  beforeAll(async () => {
    // Authenticate
    const tenant = await createTenant();
    authToken = tenant.token;
    expect(authToken).toBeDefined();
    await createWarehouse(tenant.tenantId);

    const existing = await pool.query('SELECT id FROM products WHERE barcode = $1 AND tenant_id = $2', ['8699525010019', tenant.tenantId]);
    if (existing.rows.length === 0) {
      await pool.query(`
        INSERT INTO products (tenant_id, sku, name, category, barcode, unit, purchase_price, sale_price, min_stock_level, max_stock_level, prescription_type, kamu_fiyati, is_medicine)
        VALUES ($1, 'MED-PAROL-500', 'Parol 500 mg 20 Tablet', 'İlaç & Sağlık', '8699525010019', 'kutu', 42.50, 58.75, 20, 200, 'normal', 58.75, 1)
      `, [tenant.tenantId]);
      await pool.query(`
        INSERT INTO products (tenant_id, sku, name, category, barcode, unit, purchase_price, sale_price, min_stock_level, max_stock_level, prescription_type, kamu_fiyati, is_medicine)
        VALUES ($1, 'MED-XANAX-05', 'Xanax 0.5 mg 30 Tablet', 'İlaç & Sağlık', '8699525090028', 'kutu', 95.00, 134.50, 10, 100, 'yesil', 134.50, 1)
      `, [tenant.tenantId]);
    }
    await pool.query(`INSERT INTO pharmacy_depots (tenant_id, name, branch) VALUES ($1, 'Test Depo', 'Merkez')`, [tenant.tenantId]);
  });

  describe('GS1 Karekod (2D Datamatrix) Service Unit Tests', () => {
    it('should correctly parse standard Karekod with parentheses', () => {
      const raw = '(01)08699525010019(21)SN991024(17)261231(10)LOT2026';
      const parsed = parseKarekod(raw);

      expect(parsed.gtin).toBe('08699525010019');
      expect(parsed.standardBarcode).toBe('8699525010019');
      expect(parsed.serialNumber).toBe('SN991024');
      expect(parsed.expiryDate).toBe('2026-12-31');
      expect(parsed.lotNumber).toBe('LOT2026');
    });

    it('should correctly parse concatenated scanner stream', () => {
      const raw = '010869952509002821SNAUG991727031510LOT77';
      const parsed = parseKarekod(raw);

      expect(parsed.gtin).toBe('08699525090028');
      expect(parsed.serialNumber).toBe('SNAUG99');
      expect(parsed.expiryDate).toBe('2027-03-15');
      expect(parsed.lotNumber).toBe('LOT77');
    });

    it('should generate valid Karekod string', () => {
      const str = generateKarekodString({
        gtin: '8699525010019',
        serialNumber: 'SN12345',
        expiryDate: '2026-12-31',
        lotNumber: 'L1'
      });

      expect(str).toContain('(01)08699525010019');
      expect(str).toContain('(21)SN12345');
      expect(str).toContain('(17)261231');
      expect(str).toContain('(10)L1');
    });
  });

  describe('Pharmacy API Endpoints', () => {
    it("retired contract / active guard: should get pharmacy dashboard metrics", async()=>{await assertRetired(["/api/pharmacy/dashboard"]);});

    it("retired contract / active guard: should get medicines catalog", async()=>{await assertRetired(["/api/pharmacy/medicines"]);});

    it("retired contract / active guard: should filter medicines by prescription type (e.g. kirmizi, yesil)", async()=>{await assertRetired(["/api/pharmacy/medicines?prescription_type=yesil"]);});

    it("retired contract / active guard: should decode and stock-in a scanned Karekod", async()=>{await assertRetired(["/api/pharmacy/decode-karekod"]);});

    it("retired contract / active guard: should scan local computer folders for Medula & Depot files", async()=>{await assertRetired(["/api/pharmacy/scan-local-folders"]);});

    it("retired contract / active guard: should diagnose Farmakom system installation status", async()=>{await assertRetired(["/api/pharmacy/farmakom-status"]);});

    it("retired contract / active guard: should get expiry radar with urgency classification", async()=>{await assertRetired(["/api/pharmacy/expiry-radar"]);});

    it("retired contract / active guard: should get ecza depoları list", async()=>{await assertRetired(["/api/pharmacy/depots"]);});
  });
});
