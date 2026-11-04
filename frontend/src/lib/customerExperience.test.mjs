import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personalizeNavigation,errorMessage,PROFILES,STEPS,mapImportColumns,intakeOnlyColumns,profileActions} from './customerExperience.mjs';
const groups=[{id:'general',items:[{path:'/dashboard'}]},{id:'normal-depo',items:[{path:'/normal-depo/products'},{path:'/normal-depo/warehouses'}],more:[{path:'/magaza/kasa'}]},{id:'crm',items:[{path:'/crm/dashboard'}]},{id:'tools',items:[{path:'/settings'},{path:'/setup'}]}];
test('available profiles exclude the retired module and preserve general stock choices',()=>{assert.equal(PROFILES.length,4);assert.equal(STEPS.length,10);assert.equal(PROFILES.some(p=>p.id==='pharmacy'),false);assert.match(PROFILES.find(p=>p.id==='medical').description,/içermez/);});
test('unset preference leaves existing menus untouched',()=>assert.equal(personalizeNavigation(groups,{revision:0},'/dashboard'),groups));
test('hidden modules keep current page/settings accessible and do not mutate navigation definition',()=>{
 const before=JSON.stringify(groups),result=personalizeNavigation(groups,{revision:1,profile:'warehouse',modules:['warehouse']},'/normal-depo/products');
 const paths=result.flatMap(g=>[...g.items,...g.more]).map(i=>i.path);
 assert.ok(paths.includes('/normal-depo/products'));assert.ok(paths.includes('/settings'));assert.ok(paths.includes('/setup'));assert.ok(!paths.includes('/crm/dashboard'));assert.equal(JSON.stringify(groups),before);
});
test('market profile prioritizes checkout; stock-only hides it without deleting data or route',()=>{
 const r=personalizeNavigation(groups,{revision:1,profile:'market',modules:['stock','pos']},'/dashboard');assert.equal(r.find(g=>g.id==='normal-depo').items[0].path,'/magaza/kasa');
 const s=personalizeNavigation(groups,{revision:1,profile:'retail',modules:['stock']},'/dashboard');assert.ok(!s.flatMap(g=>g.items).some(i=>i.path==='/magaza/kasa'));
});
test('customer error messages do not expose SQL, file paths or remote stack traces',()=>{
 assert.ok(!errorMessage({message:'SQL password C:/private',response:{status:500}}).includes('SQL'));
 assert.match(errorMessage({response:{status:409}}),/Son durumu/);assert.match(errorMessage({response:{status:403}}),/yetkisi/);
});
test('automatic column matching uses Turkish aliases and leaves ambiguous/missing choices for user confirmation',()=>{
 assert.deepEqual(mapImportColumns(['Ürün adı','EAN-13','Alış Fiyatı','KDV oranı'],{name:1,barcode:1,purchase_price:1,kdv_orani:1,unit:1}),{name:0,barcode:1,purchase_price:2,kdv_orani:3,unit:-1});
 assert.equal(mapImportColumns(['Barkod','Barcode'],{barcode:1}).barcode,-1);
 assert.deepEqual(intakeOnlyColumns(['Barkod','Stok miktarı','Lot','Son Kullanma Tarihi']),['Stok miktarı','Lot','Son Kullanma Tarihi']);
});
test('profile quick actions favor market checkout and warehouse intake without enabling hidden workflows',()=>{
 assert.equal(profileActions({profile:'market',modules:['stock','pos']})[0][1],'/magaza/kasa');
 assert.equal(profileActions({profile:'warehouse',modules:['warehouse','stock']})[0][1],'/normal-depo/inbound');
 assert.deepEqual(profileActions({profile:'retail',modules:['crm']}),[['Müşteri ilişkileri','/crm/dashboard']]);
});
