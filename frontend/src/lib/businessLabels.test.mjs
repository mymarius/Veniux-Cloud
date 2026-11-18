import test from 'node:test';
import assert from 'node:assert/strict';
import { roleLabel, sectorOptions, SECTORS } from './businessLabels.mjs';

test('roller Türkçe gösterilir; büyük harf ve bilinmeyen roller bozulmaz', () => {
  assert.equal(roleLabel('admin'), 'Yönetici');
  assert.equal(roleLabel('ADMIN'), 'Yönetici');
  assert.equal(roleLabel('cashier'), 'Kasiyer');
  assert.equal(roleLabel('pharmacist'), 'Kayıt görevlisi');
  assert.equal(roleLabel('ozel_rol'), 'ozel_rol');
  assert.equal(roleLabel(''), '—');
  assert.equal(roleLabel(undefined), '—');
});

test('sektör seçenekleri: ilk seçenek boş, kayıtlı eski değer korunur', () => {
  const plain = sectorOptions('');
  assert.deepEqual(plain[0], { value: '', label: 'Seçin' });
  assert.equal(plain.length, SECTORS.length + 1);
  const known = sectorOptions('Kırtasiye');
  assert.equal(known.filter(o => o.value === 'Kırtasiye').length, 1);
  const legacy = sectorOptions('Depolama ve Lojistik');
  assert.equal(legacy[1].value, 'Depolama ve Lojistik');
  assert.equal(legacy.length, SECTORS.length + 2);
});
