// Internal service fixtures exercise license signing/device limits. Public purchase is disabled.
const licenseFixture=()=>({send:async data=>{try{return {status:201,body:await require('../src/services/licenseService').purchaseAnnualLicense(data)};}catch(e){return {status:400,body:{error:e.message}};}}});
const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const crypto = require('crypto');

describe('🔑 Veniux Enterprise WMS — Yıllık Lisanslama & Masaüstü Aktivasyon Test Paketi', () => {
  let publicKeyPem;
  let purchasedLicenseKey;
  let purchasedTenantId;
  const testHardware1 = 'HW-TEST-WORKSTATION-A1';
  const testHardware2 = 'HW-TEST-WORKSTATION-B2';

  describe('1. Genel Lisans Planları & Açık Anahtar (Public Endpoints)', () => {
    it('Yıllık planları listelemeli (Starter, Business, Enterprise)', async () => {
      const res = await request(app).get('/api/license/plans');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      expect(res.body.some(p => p.id === 'BUSINESS_ANNUAL')).toBe(true);
    });

    it('RSA-2048 genel doğrulama anahtarını (Public Key) döndürmeli', async () => {
      const res = await request(app).get('/api/license/public-key');
      expect(res.status).toBe(200);
      expect(res.text).toContain('-----BEGIN PUBLIC KEY-----');
      publicKeyPem = res.text;
    });
  });

  describe('2. Tanıtım Portalı — Yıllık Lisans Satın Alma (Annual Purchase Flow)', () => {
    it('Firma bilgileriyle yeni yıllık lisans ve fatura oluşturabilmeli', async () => {
      const res = await licenseFixture()
        .send({
          company_name: 'Mega Lojistik Depoculuk A.Ş.',
          email: `test-corp-${Date.now()}@megalogistics.com`,
          phone: '+90 532 999 8877',
          tax_number: '9876543210',
          tax_office: 'Marmara Kurumlar',
          plan_id: 'STARTER_ANNUAL', // Starter plan has max_devices = 5
          payment_method: 'CREDIT_CARD'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('license_key');
      expect(res.body.license_key).toMatch(/^VNX-\d{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
      expect(res.body).toHaveProperty('invoice_no');
      expect(res.body.tenant.company_name).toBe('Mega Lojistik Depoculuk A.Ş.');

      // Expiration must be ~1 year in future
      const expDate = new Date(res.body.expires_at);
      const now = new Date();
      const diffDays = Math.round((expDate - now) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(364);

      purchasedLicenseKey = res.body.license_key;
      purchasedTenantId = res.body.tenant.id;
    });

    it('Eksik firma bilgileriyle satın alma reddedilmeli (400 Bad Request)', async () => {
      const res = await licenseFixture()
        .send({ plan_id: 'BUSINESS_ANNUAL' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('zorunludur');
    });
  });

  describe('3. Masaüstü Uygulaması — Donanım Bağlama & Kriptografik Aktivasyon', () => {
    it('Geçerli lisans anahtarı ve donanım kimliğiyle RSA imzalı token üretmeli', async () => {
      const res = await request(app)
        .post('/api/license/activate')
        .send({
          license_key: purchasedLicenseKey,
          device_fingerprint: testHardware1,
          device_name: 'Fulfillment-Terminal-01',
          os_info: 'Windows 11 Enterprise x64',
          app_version: '2.4.0'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toHaveProperty('payload');
      expect(res.body.token).toHaveProperty('signature');

      const payload = res.body.token.payload;
      expect(payload.status).toBe('ACTIVE');
      expect(payload.device_fingerprint).toBe(testHardware1);
      expect(payload.plan_id).toBe('STARTER_ANNUAL');

      // Cryptographic Verification: Verify signature with Public Key
      const verifier = crypto.createVerify('SHA256');
      verifier.update(JSON.stringify(payload));
      verifier.end();
      const isValidSig = verifier.verify(publicKeyPem, res.body.token.signature, 'base64');
      expect(isValidSig).toBe(true);
    });

    it('Geçersiz / sahte lisans anahtarı ile aktivasyon reddedilmeli', async () => {
      const res = await request(app)
        .post('/api/license/activate')
        .send({
          license_key: 'VNX-0000-FAKE-KEY0-XXXX',
          device_fingerprint: testHardware1
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Geçersiz lisans');
    });

    it('Aynı cihazla tekrar aktivasyon yapıldığında hata vermeden oturumu yenilemeli', async () => {
      const res = await request(app)
        .post('/api/license/activate')
        .send({
          license_key: purchasedLicenseKey,
          device_fingerprint: testHardware1,
          device_name: 'Fulfillment-Terminal-01-Renamed'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('4. Cihaz Limiti & Donanım Transferi (Device Limit & Deactivation)', () => {
    let singleDeviceLicenseKey;

    beforeAll(async () => {
      // Create a license with max_devices = 1 for strict testing
      const purchaseRes = await licenseFixture()
        .send({
          company_name: 'Single Node Logistics Ltd',
          email: `single-node-${Date.now()}@test.com`,
          plan_id: 'STARTER_ANNUAL'
        });

      singleDeviceLicenseKey = purchaseRes.body.license_key;

      // Update max_devices to 1 in DB
      await pool.query('UPDATE licenses SET max_devices = 1 WHERE license_key = $1', [singleDeviceLicenseKey]);
    });

    it('İlk cihaz aktivasyonu başarılı olmalı', async () => {
      const res = await request(app)
        .post('/api/license/activate')
        .send({
          license_key: singleDeviceLicenseKey,
          device_fingerprint: testHardware1,
          device_name: 'PC-1'
        });

      expect(res.status).toBe(200);
    });

    it('Limit aşıldığında ikinci cihazın aktivasyonu engellenmeli (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/license/activate')
        .send({
          license_key: singleDeviceLicenseKey,
          device_fingerprint: testHardware2,
          device_name: 'PC-2'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('aktivasyon limiti dolmuştur');
    });

    it('İlk cihaz deaktive edildikten sonra ikinci cihaz aktive olabilmeli', async () => {
      // 1. Deactivate PC-1
      const deactRes = await request(app)
        .post('/api/license/deactivate')
        .send({
          license_key: singleDeviceLicenseKey,
          device_fingerprint: testHardware1
        });

      expect(deactRes.status).toBe(200);
      expect(deactRes.body.success).toBe(true);

      // 2. Now activate PC-2 -> MUST SUCCEED
      const act2Res = await request(app)
        .post('/api/license/activate')
        .send({
          license_key: singleDeviceLicenseKey,
          device_fingerprint: testHardware2,
          device_name: 'PC-2'
        });

      expect(act2Res.status).toBe(200);
      expect(act2Res.body.success).toBe(true);
    });
  });

  describe('5. Periyodik Doğrulama & Heartbeat (Validation & Grace Period)', () => {
    it('Sunucu doğrulama çağrısında geçerli cihaz için onay vermeli', async () => {
      const res = await request(app)
        .post('/api/license/validate')
        .send({
          license_key: purchasedLicenseKey,
          device_fingerprint: testHardware1
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('Heartbeat çağrısı başarılı yanıt dönmeli', async () => {
      const res = await request(app)
        .post('/api/license/heartbeat')
        .send({
          license_key: purchasedLicenseKey,
          device_fingerprint: testHardware1
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
