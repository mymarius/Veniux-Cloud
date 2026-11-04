const assertRetired=require('./helpers/assertRetired');
const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories/index');
const pool = require('../src/config/database');

describe('🏥 Veniux Eczane Mega Altyapı Test Paketi', () => {
  let authToken;

  beforeAll(async () => {
    const { createTenant, createWarehouse, createProduct } = require('./factories/index');
    const tenant = await createTenant();
    authToken = tenant.token;
    expect(authToken).toBeDefined();

    const wh = await createWarehouse(tenant.tenantId);
    await createProduct(tenant.tenantId);

    await pool.query("INSERT INTO drug_interactions (tenant_id, atc_code_1, drug_name_1, atc_code_2, drug_name_2, interaction_level, description, clinical_effect, recommendation) VALUES ($1, 'B01AC06', 'Paracetamol', 'M01AE17', 'Ibuprofen', 'major', 'Increased risk', 'Effect', 'Monitor patient')", [tenant.tenantId]);
  });

  describe('1. İlaç Etkileşim Motoru (Drug Interactions)', () => {
    it("retired contract / active guard: Etkileşim kurallarını listelemeli", async()=>{await assertRetired(["/api/pharmacy/interaction-rules"]);});

    it("retired contract / active guard: Verilen ATC kodları için etkileşim tespit etmeli", async()=>{await assertRetired(["/api/pharmacy/check-interactions"]);});
  });

  describe('2. SGK Medula Provizyon Simülasyonu', () => {
    it("retired contract / active guard: SUT fiyat listesini getirmeli", async()=>{await assertRetired(["/api/pharmacy/medula/sut-prices"]);});

    it("retired contract / active guard: Reçete provizyonu hesaplayıp kaydetmeli", async()=>{await assertRetired(["/api/pharmacy/medicines","/api/pharmacy/medula/provision"]);});
  });

  describe('3. Nöbetçi Eczane & Personel Yönetimi', () => {
    it("retired contract / active guard: Personel listesini getirmeli", async()=>{await assertRetired(["/api/pharmacy/staff"]);});

    it("retired contract / active guard: Nöbet çizelgesi kaydı oluşturmalı ve listelemeli", async()=>{await assertRetired(["/api/pharmacy/staff","/api/pharmacy/duty-schedule","/api/pharmacy/duty-schedule?month=1&year=1"]);});
  });

  describe('4. İlaç İade Yönetimi', () => {
    it("retired contract / active guard: İade özeti ve listesini getirmeli", async()=>{await assertRetired(["/api/pharmacy/returns/summary","/api/pharmacy/returns"]);});
  });

  describe('5. Soğuk Zincir Sıcaklık Takibi', () => {
    it("retired contract / active guard: Soğuk zincir cihazlarını listelemeli", async()=>{await assertRetired(["/api/pharmacy/cold-chain/devices"]);});

    it("retired contract / active guard: Sıcaklık logu kaydetmeli ve alarm kontrolü yapmalı", async()=>{await assertRetired(["/api/pharmacy/cold-chain/devices","/api/pharmacy/cold-chain/log-temperature"]);});
  });

  describe('6. Eczane Analitik & Raporlama', () => {
    it("retired contract / active guard: Ciro analitiği, kâr marjı ve en çok satanları getirmeli", async()=>{await assertRetired(["/api/pharmacy/analytics/revenue","/api/pharmacy/analytics/profit-margin","/api/pharmacy/analytics/top-selling"]);});
  });

  describe('7. E-Fatura & E-İrsaliye', () => {
    it("retired contract / active guard: Yeni E-Fatura oluşturup dökümünü getirmeli", async()=>{await assertRetired(["/api/pharmacy/invoices","/api/pharmacy/invoices/1/html"]);});
  });
});
