const {calculate}=require('../src/services/invoiceTotals');
describe('Fatura tutarları',()=>{
 test('sıfır KDV ve küsuratlı miktarı korur',()=>{const r=calculate([{quantity:1.5,unit_price:12.34,kdv_rate:0}]);expect(r.subtotal).toBe(18.51);expect(r.kdv_total).toBe(0);expect(r.grand_total).toBe(18.51);});
 test('satır yuvarlamaları toplamla tutarlıdır',()=>{const r=calculate([{quantity:1,unit_price:0.05,kdv_rate:10},{quantity:1,unit_price:0.05,kdv_rate:10}]);expect(r.kdv_total).toBe(0.02);expect(r.grand_total).toBe(0.12);expect(r.kdvBreakdown[10]).toBe(0.02);});
 test.each([-1,0,NaN,Infinity])('geçersiz miktarı reddeder: %s',q=>{expect(()=>calculate([{quantity:q,unit_price:10,kdv_rate:20}])).toThrow();});
 test('eksik KDV ve negatif fiyatı reddeder',()=>{expect(()=>calculate([{quantity:1,unit_price:10}])).toThrow();expect(()=>calculate([{quantity:1,unit_price:-10,kdv_rate:20}])).toThrow();});
});
