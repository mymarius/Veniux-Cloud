import test from 'node:test';import assert from 'node:assert/strict';
import {parseScaleLine,LineFramer} from './scaleProtocols.mjs';
import {scaleReading} from './retailPro.mjs';
test('CAS: ST kararlı, US kararsız, başlıksız satır yok sayılır',()=>{
 assert.deepEqual(parseScaleLine('cas','ST,GS,  1.245 kg'),{weight:1.245,unit:'kg',stable:true});
 assert.equal(parseScaleLine('cas','US,GS,  1.250 kg').stable,false);
 assert.equal(parseScaleLine('cas','garip satır'),null);
});
test('Mettler Toledo SICS: S S kararlı, S D kararsız, S I meşgul',()=>{
 assert.deepEqual(parseScaleLine('toledo','S S     0.500 kg'),{weight:.5,unit:'kg',stable:true});
 assert.equal(parseScaleLine('toledo','S D     0.512 kg').stable,false);
 assert.equal(parseScaleLine('toledo','S I'),null);
});
test('genel: virgül, gram ve kararsızlık işareti',()=>{
 assert.deepEqual(parseScaleLine('generic','  2,350 kg\r'),{weight:2.35,unit:'kg',stable:true});
 assert.deepEqual(parseScaleLine('generic','750 g'),{weight:750,unit:'g',stable:true});
 assert.equal(parseScaleLine('generic','? 1.200 kg').stable,false);
 assert.equal(parseScaleLine('generic',''),null);
});
test('satır birleştirici parçalı veriyi böler, taşan satırı atar',()=>{
 const lines=[];const f=new LineFramer(l=>lines.push(l));
 f.feed('ST,GS, 1.2');f.feed('45 kg\r\nST,GS, 1.246 kg\r');f.feed('\n');
 assert.deepEqual(lines,['ST,GS, 1.245 kg','ST,GS, 1.246 kg']);
 f.feed('x'.repeat(200));assert.equal(f.buffer,'');
});
test('kararlı çerçeve kasa miktarına dönüşür, kararsız ya da eski reddedilir',()=>{
 const p=parseScaleLine('cas','ST,GS,  1.245 kg');const now=5000;
 assert.equal(scaleReading({...p,timestamp:now-100},{now}).quantity,1.245);
 assert.throws(()=>scaleReading({...parseScaleLine('cas','US,GS, 1.245 kg'),timestamp:now},{now}));
 assert.throws(()=>scaleReading({...p,timestamp:now-5000},{now}));
 const g=parseScaleLine('generic','750 g');assert.equal(scaleReading({...g,timestamp:now},{now}).quantity,.75);
});

// Üretici kılavuzlarındaki gerçek çıktı örnekleri (MT-SICS referans kılavuzları: "S S 100.00 g", SIR yanıtı "S D 129.07 kg";
// ST/US + GS/NT biçimi CAS tipi terazilerde ve benzeri kılavuzlarda). Simülatörün kendi ürettiği satırlara bağlı olmayan karşılaştırma.
test('kılavuz örnekleri: Toledo SICS yanıtları (kararlı, kararsız, hata ve taşma satırları)', () => {
  assert.deepEqual(parseScaleLine('toledo', 'S S      100.00 g'), { weight: 100, unit: 'g', stable: true });
  assert.deepEqual(parseScaleLine('toledo', 'S D     129.07 kg'), { weight: 129.07, unit: 'kg', stable: false });
  for (const line of ['S I', 'S +', 'S -', 'ES', 'ET', 'EL']) assert.equal(parseScaleLine('toledo', line), null, line);
});
test('kılavuz örnekleri: CAS tipi ST/US, GS/NT çıktısı birimin bitişik ya da ayrık yazılması', () => {
  assert.deepEqual(parseScaleLine('cas', 'ST,GS,+  1.245kg'), { weight: 1.245, unit: 'kg', stable: true });
  assert.deepEqual(parseScaleLine('cas', 'US,GS,+  0.500 kg'), { weight: 0.5, unit: 'kg', stable: false });
  assert.deepEqual(parseScaleLine('cas', 'ST,NT,   0.000 kg'), { weight: 0, unit: 'kg', stable: true });
  assert.equal(parseScaleLine('cas', 'OL'), null);
});
