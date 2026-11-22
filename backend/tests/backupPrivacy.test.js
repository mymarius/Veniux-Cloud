const { portable } = require('../src/services/backupPrivacy');

test('taşınabilir yedekte gizli sütun benzersiz indeksteyse satırlar çakışmaz (geri yükleme ER_DUP_ENTRY vermez)', () => {
  const snapshot = { tables: [
    { name: 'business_invitations', columns: ['id', 'email', 'token_hash'], rows: [[1, 'a@x.com', 'h1h1h1h1h1'], [2, 'b@x.com', 'h2h2h2h2h2'], [3, 'c@x.com', 'h3h3h3h3h3']] },
    { name: 'products', columns: ['id', 'name', 'api_key'], rows: [[1, 'Ayran', 'secret-key-111'], [2, 'Çay', 'secret-key-222']] }
  ] };
  const out = portable(snapshot);
  const tokens = out.tables[0].rows.map(r => r[2]);
  expect(new Set(tokens).size).toBe(3);
  expect(tokens.every(t => t.startsWith('[REDACTED]'))).toBe(true);
  expect(JSON.stringify(out)).not.toMatch(/h1h1h1h1h1|secret-key/);
  // benzersiz olmayan gizli sütun eskisi gibi sabit maskelenir
  expect(out.tables[1].rows.map(r => r[2])).toEqual(['[REDACTED]', '[REDACTED]']);
  expect(out.credentials_excluded).toBe(true);
});

test('id sütunu olmayan tabloda da satır sırasıyla benzersiz maskelenir', () => {
  const out = portable({ tables: [{ name: 'business_invitations', columns: ['token_hash'], rows: [['aaaaaaaa'], ['bbbbbbbb']] }] });
  expect(new Set(out.tables[0].rows.map(r => r[0])).size).toBe(2);
});
