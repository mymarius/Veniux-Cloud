jest.mock('../src/config/database', () => ({ query: jest.fn() }));
const db = require('../src/config/database');
const { together } = require('../src/services/retailInsightsService');

const sale = (id, items, status = 'completed') => ({ sale_id: id, warehouse_id: 1, user_id: 1, register_id: 1, snapshot_json: JSON.stringify({ status, items }) });
const line = (product_id, name, quantity, net_cents) => ({ product_id, name, quantity, net_cents });
const admin = { role: 'admin', tenantId: 1, accessScope: { mode: 'company' } };

describe('Birlikte satılan ürünler', () => {
  beforeEach(() => db.query.mockReset());

  it('seçilen ürünle aynı fişte en çok satılanları sıralar', async () => {
    db.query.mockResolvedValue({ rows: [
      sale(1, [line(1, 'Simit', 2, 2000), line(2, 'Çay', 1, 1500)]),
      sale(2, [line(1, 'Simit', 1, 1000), line(2, 'Çay', 2, 3000), line(3, 'Peynir', 1, 9000)]),
      sale(3, [line(1, 'Simit', 1, 1000)]),
      sale(4, [line(2, 'Çay', 1, 1500)]),
      sale(5, [line(1, 'Simit', 1, 1000), line(3, 'Peynir', 1, 9000)], 'cancelled')
    ] });
    const r = await together(admin, { product_id: 1 });
    expect(r.receipts).toBe(3);
    expect(r.items[0]).toMatchObject({ product_id: 2, receipts: 2, quantity: 3, net_cents: 4500, share_percent: 67 });
    expect(r.items[1]).toMatchObject({ product_id: 3, receipts: 1 });
    expect(r.items.find(i => i.product_id === 1)).toBeUndefined();
  });

  it('yönetici olmayan ve ürünsüz isteği reddeder', async () => {
    await expect(together({ ...admin, role: 'cashier' }, { product_id: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(together(admin, {})).rejects.toMatchObject({ status: 400 });
  });
});
