const { normalise, RETIRED } = require('../src/services/packageMerge');
const packages = require('../src/services/productPackages');

const base = () => ({ ...structuredClone(packages.seed), revision: 0 });
const byCode = (c, code) => c.plans.find(p => p.code === code);

describe('Paket birleştirme', () => {
  it('perakende, depo ve işletme paketleri hırdavat ve züccaciyeyi içerir', () => {
    const c = normalise(base());
    for (const code of ['RETAIL_PRO', 'WAREHOUSE_PRO', 'UNIFIED_BUSINESS']) {
      expect(byCode(c, code).modules).toEqual(expect.arrayContaining(['hardware', 'tableware']));
    }
    expect(byCode(c, 'UNIFIED_BUSINESS').modules).toContain('online_store');
    expect(byCode(c, 'RETAIL_START').modules).not.toContain('hardware');
  });

  it('ayrı sektör paketleri yeni satışta gizlenir, restoran eklentisi kalır', () => {
    const c = normalise(base());
    for (const code of RETIRED) expect(byCode(c, code).available).toBe(false);
    expect(byCode(c, 'RETAIL_PIDE').available).toBe(true);
  });

  it('platform sahibi kaydettiyse satış durumu onun kararıdır', () => {
    const c = base(); c.revision = 4;
    expect(byCode(normalise(c), 'RETAIL_HIRDAVAT').available).toBe(true);
  });

  it('önerilen fiyat yalnız fiyat girilmemişse görünür; sahibin fiyatı korunur', () => {
    const c = base();
    expect(normalise(c) && byCode(normalise(c), 'RETAIL_PRO').annual_cents).toBe(649000);
    byCode(c, 'RETAIL_PRO').annual_cents = 400000;
    byCode(c, 'RETAIL_PRO').monthly_cents = 40000;
    const n = normalise(c);
    expect(byCode(n, 'RETAIL_PRO').annual_cents).toBe(400000);
    expect(byCode(n, 'RETAIL_PRO').monthly_cents).toBe(40000);
  });

  it('idempotent ve her plan doğrulamadan geçer', () => {
    const once = normalise(base()), twice = normalise(once);
    expect(twice).toEqual(once);
    for (const plan of once.plans) expect(() => packages.validatePlan(plan)).not.toThrow();
  });

  it('yeni sözleşme birleşik modülleri taşır, eski kodlar hakkını korur', () => {
    const plan = byCode(normalise(base()), 'UNIFIED_BUSINESS');
    const contract = packages.contract(plan, 1);
    expect(packages.hasModule(contract, 'hardware')).toBe(true);
    expect(packages.hasModule(contract, 'tableware')).toBe(true);
    expect(packages.hasModule(contract, 'restaurant')).toBe(false);
  });
});
