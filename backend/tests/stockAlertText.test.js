const { syncStockAlert } = require('../src/services/stockAlertSync');

// MySQL DECIMAL "0.000000" metni olarak gelir; uyarı okunur sayı ve birim yazmalı.
test('stok uyarısı MySQL ondalık metnini okunur sayıya ve birime çevirir', async () => {
  const written = [];
  const tx = { query: jest.fn(async (sql, params) => { if (/^INSERT INTO alerts/.test(sql)) written.push(params[4]); return { rows: [] }; }) };
  await syncStockAlert(tx, { tenant_id: 1, product_id: 2, warehouse_id: 3, product_name: 'Tuzlu kraker', warehouse_name: 'Ana Depo', quantity: '0.000000', min_stock_level: '40.000000', unit: 'adet' });
  await syncStockAlert(tx, { tenant_id: 1, product_id: 4, warehouse_id: 3, product_name: 'NYA kablo', warehouse_name: 'Ana Depo', quantity: '12.500000', min_stock_level: '50', unit: 'metre' });
  await syncStockAlert(tx, { tenant_id: 1, product_id: 5, warehouse_id: 3, product_name: 'Eski kayıt', warehouse_name: 'Ana Depo', quantity: 3, min_stock_level: 5 });
  expect(written).toEqual([
    'Tuzlu kraker: Ana Depo deposunda 0 adet kaldı. Minimum: 40 adet.',
    'NYA kablo: Ana Depo deposunda 12,5 metre kaldı. Minimum: 50 metre.',
    'Eski kayıt: Ana Depo deposunda 3 kaldı. Minimum: 5.'
  ]);
});
