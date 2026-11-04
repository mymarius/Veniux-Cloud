const request=require('supertest'),fs=require('fs'),path=require('path'),{performance}=require('perf_hooks');
const app=require('../src/index'),db=require('../src/config/database'),f=require('./factories');
let owner,foreign;
const get=(suffix,actor=owner)=>request(app).get('/api/scanner/pro/'+suffix).set('Authorization','Bearer '+actor.token);
beforeAll(async()=>{
 owner=await f.createTenant();foreign=await f.createTenant();
 await db.transaction(async tx=>{for(let start=0;start<5000;start+=250){const params=[],values=[];for(let i=start;i<start+250;i++){const n=String(i).padStart(5,'0'),offset=params.length;params.push(owner.tenantId,'UX-'+n,'00090000'+n,'Performans Ürünü '+n,i%2?'İçecek':'Gıda');values.push(`($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},'adet',12,10,'NORMAL')`);}await tx.query('INSERT INTO products(tenant_id,sku,barcode,name,category,unit,sale_price,kdv_orani,module_type) VALUES '+values.join(','),params);}});
},30000);
test('catalog categories and filters cover the full owned catalog rather than the first page',async()=>{
 const r=await get('categories');expect(r.status).toBe(200);expect(r.body.items).toContain('İçecek');expect(r.body.items).toContain('Gıda');
 const page=await get('catalog?category='+encodeURIComponent('İçecek')+'&limit=40');expect(page.status).toBe(200);expect(page.body.items).toHaveLength(40);expect(page.body.items.every(p=>p.category==='İçecek')).toBe(true);expect((await get('categories',foreign)).body.items).not.toContain('İçecek');
});
test('literal wildcard searches remain bounded and do not become full-catalog patterns',async()=>{
 const r=await get('catalog?q='+encodeURIComponent('Performans%'));expect(r.status).toBe(200);expect(r.body.items).toHaveLength(0);
 expect((await get('catalog?q='+encodeURIComponent('Performans_'))).body.items).toHaveLength(0);
 expect((await get('catalog?q=0009000004999')).body.items[0].barcode).toBe('0009000004999');
});
test('5000 owned products support bounded prefix queries with recorded real local API timings',async()=>{
 const timings=[];for(let i=0;i<25;i++){const start=performance.now(),r=await get('catalog?q='+encodeURIComponent('Performans Ürünü 0499'));timings.push(Number((performance.now()-start).toFixed(3)));expect(r.status).toBe(200);expect(r.body.items).toHaveLength(10);expect(r.body.next).toBeNull();}
 const sorted=[...timings].sort((a,b)=>a-b),result={dataset_products:5000,requests:25,method:'Supertest loopback API, isolated SQLite, no device throttling',p50_ms:sorted[12],p95_ms:sorted[23],max_ms:sorted[24],samples_ms:timings};
 if(process.env.VENIUX_HARDWARE_LAB_DIR)fs.writeFileSync(path.join(process.env.VENIUX_HARDWARE_LAB_DIR,'catalog-performance.json'),JSON.stringify(result,null,2));
 expect((await get('catalog?limit=100')).body.items.length).toBeLessThanOrEqual(100);
},30000);
