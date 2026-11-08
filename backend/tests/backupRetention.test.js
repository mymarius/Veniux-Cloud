const { tieredKeep } = require('../src/services/mysqlBackupService');

const now = Date.parse('2026-11-08T12:00:00Z');
const daily = days => Array.from({ length: days }, (_, i) => ({ id: 'd' + i, created_at: new Date(now - i * 86400000).toISOString() }));

test('400 günlük günlük yedekten katmanlar korunur, gerisi silinir', () => {
  const keep = tieredKeep(daily(400), now);
  expect(keep.has('d0')).toBe(true);
  for (let i = 0; i < 7; i++) expect(keep.has('d' + i)).toBe(true);
  expect(keep.size).toBeLessThanOrEqual(1 + 7 + 4 + 12 + 2);
  expect(keep.size).toBeGreaterThanOrEqual(7 + 3 + 11);
  const oldest = Math.max(...[...keep].map(id => Number(id.slice(1))));
  expect(oldest).toBeGreaterThan(300);
  expect(oldest).toBeLessThan(400);
});

test('aynı günde birden çok yedekte günün en yenisi kalır', () => {
  const rows = [0, 1, 5].map(h => ({ id: 'h' + h, created_at: new Date(Date.parse('2026-11-05T20:00:00Z') - h * 3600000).toISOString() }));
  const keep = tieredKeep(rows, now);
  expect(keep.has('h0')).toBe(true);
  expect(keep.has('h1')).toBe(false);
});

test('çok eski tek yedek bile en yeni olduğu için silinmez', () => {
  expect([...tieredKeep([{ id: 'eski', created_at: '2020-01-01T00:00:00Z' }], now)]).toEqual(['eski']);
});
