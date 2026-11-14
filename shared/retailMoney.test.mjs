import {test} from 'node:test';import assert from 'node:assert/strict';import {lineCents,cartLineCents} from './retailMoney.mjs';
test('yarım kuruş yukarı yuvarlanır; sepet kalemleri server ile aynı kuruş hesabını kullanır',()=>{assert.equal(lineCents(2.01,.5),101);assert.equal(lineCents(.29,3),87);assert.equal(cartLineCents({unit_price:2.01,quantity:.5,count:1,line_total:1.005}),101);assert.equal(cartLineCents({unit_price:3,quantity:.333333,count:1,line_total:1,weighted:true}),100);assert.equal(cartLineCents({override:'2.01',quantity:.5,count:2}),201);});

test('koli satırı: özel koli fiyatı satır tutarıdır, özel fiyat yoksa birim fiyat x çarpan', () => {
  assert.equal(cartLineCents({ unit_price: 2, quantity: 200, count: 2, pack: { unit: 'koli', factor: 200, price: 360 } }), 72000);
  assert.equal(cartLineCents({ unit_price: 2, quantity: 200, count: 1, pack: { unit: 'koli', factor: 200, price: null } }), 40000);
  assert.equal(cartLineCents({ unit_price: 2, quantity: 200, count: 1, pack: { unit: 'koli', factor: 200, price: 360 }, override: 1.5 }), 30000);
});
