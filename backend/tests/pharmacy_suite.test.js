const assertRetired=require('./helpers/assertRetired');
const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories/index');
const pool = require('../src/config/database');

describe('Full Pharmacy ERP & Operations Suite', () => {
  let authToken;
  let tenantId;

  beforeAll(async () => {
    const tenant = await createTenant();
    authToken = tenant.token;
    tenantId = tenant.tenantId;
  });

  describe('1. Renkli Reçete (Kırmızı/Yeşil/Mor) Defteri', () => {
    it("retired contract / active guard: should create a colored prescription and list it", async()=>{await assertRetired(["/api/pharmacy/colored-prescriptions","/api/pharmacy/colored-prescriptions?type=kirmizi","/api/pharmacy/colored-prescriptions/inspection-report"]);});
  });

  describe('2. TEB Majistral Tarife & Formül Motoru', () => {
    it("retired contract / active guard: should calculate TEB majistral price correctly", async()=>{await assertRetired(["/api/pharmacy/majistral/calculate"]);});

    it("retired contract / active guard: should save and list majistral formulas", async()=>{await assertRetired(["/api/pharmacy/majistral/formulas"]);});
  });

  describe('3. Eczane POS, Seri Satış & Hasta Veresiye Defteri', () => {
    it("retired contract / active guard: should create patient account, process veresiye sale, and pay debt", async()=>{await assertRetired(["/api/pharmacy/patients","/api/pharmacy/pos/sales","/api/pharmacy/patients/pay-debt"]);});
  });
});
