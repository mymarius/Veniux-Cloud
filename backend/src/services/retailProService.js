const db=require('../config/database'),daily=require('./retailDailyService');
const fail=require('./scannerService').fail;
const modes=['standard','classic','visual'];
const initial=()=>({mode:'standard',favorites:[],categoryStyles:{}});
function validate(value){
 if(!value||Object.keys(value).some(k=>!['mode','favorites','categoryStyles','quickActions'].includes(k))||!modes.includes(value.mode)||!Array.isArray(value.favorites)||value.favorites.length>100||value.favorites.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(value.favorites).size!==value.favorites.length)fail('Kasa görünüm tercihleri geçersiz.');
 if(!value.categoryStyles||Array.isArray(value.categoryStyles)||typeof value.categoryStyles!=='object'||Object.keys(value.categoryStyles).length>50)fail('Kategori tercihleri geçersiz.');
 for(const [name,style] of Object.entries(value.categoryStyles))if(name.length>80||!style||Object.keys(style).some(k=>!['color','icon'].includes(k))||!/^#[0-9a-f]{6}$/i.test(style.color)||!['box','leaf','cup','basket','tag'].includes(style.icon))fail('Kategori renk veya simgesi geçersiz.');
 if(value.quickActions!==undefined&&(!Array.isArray(value.quickActions)||value.quickActions.length>5||new Set(value.quickActions).size!==value.quickActions.length||value.quickActions.some(k=>!['price','hold','hardware','smartcount','accounts'].includes(k))))fail('Hızlı işlem tercihleri geçersiz.');
 return {mode:value.mode,favorites:value.favorites,categoryStyles:value.categoryStyles,...(value.quickActions!==undefined?{quickActions:value.quickActions}:{})};
}
async function preferences(user){const row=(await db.query("SELECT payload FROM workspace_collections WHERE tenant_id=$1 AND scope='retail_pro' AND name=$2",[user.tenantId,String(user.userId)])).rows[0];return row?JSON.parse(row.payload):initial();}
async function save(user,input){const value=validate(input);return db.transaction(async tx=>{
 await daily.lock(tx,user.tenantId);
 for(const id of value.favorites)if(!(await tx.query("SELECT id FROM products WHERE tenant_id=$1 AND id=$2 AND module_type='NORMAL'",[user.tenantId,id])).rows.length)fail('Favori ürün bulunamadı.',404);
 await tx.query("INSERT INTO workspace_collections(tenant_id,scope,name,payload,revision) VALUES($1,'retail_pro',$2,$3,1) ON CONFLICT(tenant_id,scope,name) DO UPDATE SET payload=excluded.payload,revision=workspace_collections.revision+1",[user.tenantId,String(user.userId),JSON.stringify(value)]);
 return value;
});}
async function catalog(user,query){
 const limit=Number(query.limit??40),after=Number(query.after??0),q=String(query.q||'').trim(),category=String(query.category||'');
 if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(after)||after<0||q.length>100||category.length>80)fail('Katalog sayfa sınırları geçersiz.');
 const params=[user.tenantId,after];let where="p.tenant_id=$1 AND p.module_type='NORMAL' AND p.id>$2";
 if(q){params.push(q.replace(/[!%_]/g,'!$&')+'%');where+=" AND (p.name LIKE $"+params.length+" ESCAPE '!' OR p.barcode LIKE $"+params.length+" ESCAPE '!' OR p.sku LIKE $"+params.length+" ESCAPE '!')";}
 if(query.favorites==='1'){
  const favorite=(await preferences(user)).favorites;if(!favorite.length)return {items:[],next:null,source:'tenant_catalog',global_catalog_available:false};
  const placeholders=favorite.map(id=>{params.push(id);return '$'+params.length;});where+=' AND p.id IN ('+placeholders.join(',')+')';
 }
 if(category){params.push(category);where+=' AND p.category=$'+params.length;}
 const rows=(await db.query('SELECT p.id,p.name,p.barcode,p.sku,p.category,p.unit,p.sale_price,p.kdv_orani,CASE WHEN m.image_path IS NOT NULL THEN 1 ELSE 0 END AS image_available,m.brand FROM products p LEFT JOIN retail_product_media m ON m.product_id=p.id AND m.tenant_id=p.tenant_id WHERE '+where+' ORDER BY p.id LIMIT '+(limit+1),params)).rows;
 return {items:rows.slice(0,limit),next:rows.length>limit?Number(rows[limit-1].id):null,source:'tenant_catalog',global_catalog_available:false};
}
// Çok satanlar: son N günde net adedi en yüksek ürünler. Kasiyerin "sık kullanılanlar" şeridi için; kısıtlı kullanıcı yalnız atanmış depoların satışını görür.
async function topProducts(user,query={}){
 const days=Math.min(90,Math.max(1,Number.parseInt(query.days,10)||30)),limit=Math.min(24,Math.max(1,Number.parseInt(query.limit,10)||12));
 const from=new Date(Date.now()+3*3600000-(days-1)*86400000).toISOString().slice(0,10);
 const allowed=user.accessScope&&user.accessScope.mode!=='company'?new Set((user.accessScope.warehouse_ids||[]).map(Number)):null;
 const rows=(await db.query('SELECT warehouse_id,snapshot_json FROM retail_sales WHERE tenant_id=$1 AND business_date>=$2',[user.tenantId,from])).rows;
 const counts=new Map();
 for(const r of rows){
  if(allowed&&!allowed.has(Number(r.warehouse_id)))continue;
  const s=JSON.parse(r.snapshot_json);if(s.status==='cancelled')continue;
  for(const line of s.items||[]){const id=Number(line.product_id),q=Number(line.quantity||0)-Number(line.returned_quantity||0);if(q>0)counts.set(id,(counts.get(id)||0)+q);}
 }
 const ids=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([id])=>id);
 if(!ids.length)return {items:[],days};
 const params=[user.tenantId],placeholders=ids.map(id=>{params.push(id);return '$'+params.length;});
 const found=(await db.query("SELECT p.id,p.name,p.barcode,p.sku,p.category,p.unit,p.sale_price,p.kdv_orani FROM products p WHERE p.tenant_id=$1 AND p.module_type='NORMAL' AND p.id IN ("+placeholders.join(',')+')',params)).rows;
 const order=new Map(ids.map((id,i)=>[id,i]));
 return {items:found.sort((a,b)=>order.get(Number(a.id))-order.get(Number(b.id))),days};
}
async function media(user,id,body){
 if(!['admin','manager'].includes(user.role)||user.accessScope?.mode&&user.accessScope.mode!=='company')fail('Ürün görseli için firma genelinde yönetici yetkisi gerekli.',403);
 if(!body||Object.keys(body).some(k=>!['image_data','brand'].includes(k))||typeof body.brand!=='string'||body.brand.length>100)fail('Ürün görseli ve marka bilgisi geçersiz.');
 const image=body.image_data;
 if(image!==null){
  if(typeof image!=='string'||image.length>400000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))fail('En fazla 300 KB PNG ürün görseli seçin.');
  const data=Buffer.from(image.split(',')[1],'base64');
  if(data.length<33||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||data.toString('ascii',12,16)!=='IHDR'||data.readUInt32BE(16)<1||data.readUInt32BE(20)<1||data.readUInt32BE(16)>512||data.readUInt32BE(20)>512)fail('Görsel ölçüsü en fazla 512 × 512 olmalıdır.');
 }
 return db.transaction(async tx=>{
 if(!(await tx.query('SELECT id FROM products WHERE tenant_id=$1 AND id=$2',[user.tenantId,id])).rows.length)fail('Ürün bulunamadı.',404);
 await tx.query('INSERT INTO retail_product_media(tenant_id,product_id,image_path,brand) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,product_id) DO UPDATE SET image_path=excluded.image_path,brand=excluded.brand',[user.tenantId,id,image,body.brand]);
 await daily.audit(tx,user,'retail.product_media',id,{product_id:id});return {saved:true};
 });
}
async function image(user,id){
 const row=(await db.query('SELECT m.image_path FROM retail_product_media m JOIN products p ON p.id=m.product_id AND p.tenant_id=m.tenant_id WHERE m.tenant_id=$1 AND m.product_id=$2',[user.tenantId,id])).rows[0];
 if(!row?.image_path)fail('Ürün görseli yok.',404);return Buffer.from(row.image_path.split(',')[1],'base64');
}
async function categories(user){const rows=(await db.query("SELECT DISTINCT category FROM products WHERE tenant_id=$1 AND module_type='NORMAL' AND category IS NOT NULL AND category<>'' ORDER BY category LIMIT 201",[user.tenantId])).rows;return {items:rows.slice(0,200).map(r=>r.category),truncated:rows.length>200};}
module.exports={preferences,save,topProducts,catalog,categories,media,image,validate};
