// Ölçüm: perf-seed.js ile hazırlanan TEST veritabanında uç noktaların gecikmesi (süreç içi, supertest).
process.env.NODE_ENV='test';
if(!process.env.TEST_SQLITE_PATH){console.error('TEST_SQLITE_PATH zorunlu.');process.exit(1);}
const request=require('supertest'),app=require('../src/index'),db=require('../src/config/database');
const jwt=require('jsonwebtoken');
(async()=>{
 await db.ready;
 const U=(await db.query('SELECT id,email,role,tenant_id FROM users ORDER BY id LIMIT 1')).rows[0];
 const wh=(await db.query('SELECT id FROM warehouses WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1',[U.tenant_id])).rows[0].id;
 const token=process.env.PERF_TOKEN;if(!token)throw Error('PERF_TOKEN');
 const A=r=>r.set('Authorization','Bearer '+token);
 const date=(await db.query("SELECT business_date d FROM retail_sales WHERE tenant_id=$1 ORDER BY sale_id DESC LIMIT 1 OFFSET 700",[U.tenant_id])).rows[0].d;
 const mid=(await db.query("SELECT barcode FROM products WHERE tenant_id=$1 AND id=(SELECT max(id)-12345 FROM products)",[U.tenant_id])).rows[0].barcode;
 const midPrice=Number((await db.query('SELECT sale_price FROM products WHERE tenant_id=$1 AND barcode=$2',[U.tenant_id,mid])).rows[0].sale_price),total=Math.round((midPrice+10)*100)/100;
 const midId=(await db.query('SELECT id FROM products WHERE tenant_id=$1 AND barcode=$2',[U.tenant_id,mid])).rows[0].id;
 let n=0;
 const cases={
  'katalog ilk sayfa (limit 100)':()=>A(request(app).get('/api/scanner/pro/catalog?limit=100')),
  'katalog derin sayfa (after=45000)':()=>A(request(app).get('/api/scanner/pro/catalog?limit=100&after=45000')),
  'katalog arama "Urun 4999" (önek)':()=>A(request(app).get('/api/scanner/pro/catalog?limit=40&q=Urun%204999')),
  'katalog arama "Makas" (ortada kalan)':()=>A(request(app).get('/api/scanner/pro/catalog?limit=40&q=Makas')),
  'katalog kategori':()=>A(request(app).get('/api/scanner/pro/catalog?limit=100&category='+encodeURIComponent('Hırdavat'))),
  'barkod okutma (POST /scanner/lookup)':()=>A(request(app).post('/api/scanner/lookup').send({barcode:mid,warehouse_id:wh})),
  'barkod okutma (GET /retail/lookup)':()=>A(request(app).get('/api/retail/lookup?barcode='+mid)),
  'satış tamamlama (POST /scanner/sale)':()=>A(request(app).post('/api/scanner/sale').set('Idempotency-Key','b-'+Date.now()+'-'+(n++)).send({warehouse_id:wh,items:[{barcode:mid,count:1},{barcode:'8690000000000',count:1}],payments:[{method:'cash',amount:total}],cash_received:total})),
  'gün raporu (bugün)':()=>A(request(app).get('/api/scanner/day-report?warehouse_id='+wh)),
  'gün raporu (eski gün)':()=>A(request(app).get('/api/scanner/day-report?warehouse_id='+wh+'&date='+date)),
  'satış geçmişi (100)':()=>A(request(app).get('/api/scanner/sales?warehouse_id='+wh+'&date='+date)),
  'ürün listesi (tümü) GET /products':()=>A(request(app).get('/api/products')),
  'ürün listesi sayfa (limit 50)':()=>A(request(app).get('/api/products?limit=50')),
  'ürün listesi derin sayfa (offset 40000)':()=>A(request(app).get('/api/products?limit=50&offset=40000')),
  'stok kayıtları sayfa (limit 50)':()=>A(request(app).get('/api/stock/records?limit=50')),
  'ürün listesi arama':()=>A(request(app).get('/api/products?search=Urun%2012')),
  'stok kayıtları /stock/records':()=>A(request(app).get('/api/stock/records')),
  'stok hareketleri /stock/movements':()=>A(request(app).get('/api/stock/movements')),
  'denetim günlüğü':()=>A(request(app).get('/api/audit-logs')),
  'pano metrikleri':()=>A(request(app).get('/api/stock/dashboard-metrics')),
  'stok analizi':()=>A(request(app).get('/api/stock/analytics')),
  'pano özeti /stock/dashboard-summary':()=>A(request(app).get('/api/stock/dashboard-summary')),
  'pano özeti depo filtreli':()=>A(request(app).get('/api/stock/dashboard-summary?warehouse_id='+wh)),
  'stok hareketleri limit=5000':()=>A(request(app).get('/api/stock/movements?limit=5000')),
  'ürün stok kaydı (product_id)':()=>A(request(app).get('/api/stock/records?product_id='+(midId))),
  'kasa içgörü /pro/insights':()=>A(request(app).get('/api/scanner/pro/insights')),
  'en çok satanlar':()=>A(request(app).get('/api/scanner/pro/top-products')),
 };
 const only=process.env.ONLY;const out=[];
 for(const [name,fn] of Object.entries(cases)){
  if(only&&!name.includes(only))continue;
  const t=[];let status,size;
  for(let i=0;i<(name.includes('satış tamamlama')?15:5);i++){const s=process.hrtime.bigint();const r=await fn();t.push(Number(process.hrtime.bigint()-s)/1e6);status=r.status;size=(r.text||'').length;}
  t.sort((a,b)=>a-b);out.push({name,status,ms_min:+t[0].toFixed(1),ms_med:+t[t.length>>1].toFixed(1),ms_max:+t[t.length-1].toFixed(1),bytes:size});
  console.log(JSON.stringify(out[out.length-1]));
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
