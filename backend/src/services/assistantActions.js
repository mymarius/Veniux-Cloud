const db=require('../config/database');
const crypto=require('crypto');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const text=(value,label,max=200)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw fail(`${label} gerekli (en fazla ${max} karakter).`);return value.trim();};
const number=(value,label)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw fail(`${label} sıfır veya pozitif sayı olmalı.`);return value;};
const fields=['name','category','unit','purchase_price','sale_price','min_stock_level','max_stock_level'];
const labels={sku:'Ürün kodu',name:'Ad',category:'Kategori',unit:'Birim',purchase_price:'Alış fiyatı',sale_price:'Satış fiyatı',min_stock_level:'Minimum stok',max_stock_level:'Maksimum stok',title:'Görev',dueDate:'Bitiş tarihi',priority:'Öncelik'};
const describe=params=>Object.entries(params).filter(([k])=>k!=='id').map(([k,v])=>`${labels[k]||k}: ${v}`).join('\n');
const catalog=`Desteklenen işlem türleri ve args alanları:
product_create: sku, name, unit (zorunlu), purchase_price, sale_price, min_stock_level, max_stock_level (isteğe bağlı). Normal depo ürünü oluşturur.
product_update: sku (zorunlu), changes: {name,category,unit,purchase_price,sale_price,min_stock_level,max_stock_level} değiştirilecek alanlar.
stock_adjust: sku, warehouse_name, amount (pozitif giriş, negatif çıkış tam sayısı), note (gerekçe, zorunlu). Yalnızca normal depo ürünleri.
crm_task_create: title, dueDate (YYYY-MM-DD, zorunlu), priority (low,medium,high).
crm_task_complete: title (mevcut görevin tam adı).
crm_task_delete: title (silinecek görevin tam adı). Ayrı silme onayı zorunlu.
supplier_create: name, lead_time_days (pozitif tam sayı, isteğe bağlı).
analysis: args boş. alert_read: args {alert_id}.
Yalnızca kullanıcının açıkça istediği bir işlem için öneri oluştur. Gerekli alanlar eksikse veya hedef belirsizse tek bir net soru sor; action null olsun. SKU, miktar, fiyat, tarih veya isim uydurma. En fazla bir işlem öner. Hiçbir işlemi uygulandığını iddia etme; onay kartı hazırlanacağını söyle. CRM görev silme dışındaki silmeleri, ödeme, dış iletişim, kullanıcı yetkisi, ilaç parti/seri işlemleri ve listede olmayan işlemleri yapabileceğini söyleme.`;
async function product(client,tenant,sku){const row=(await client.query('SELECT * FROM products WHERE tenant_id=$1 AND sku=$2',[tenant,text(sku,'Ürün kodu')])).rows[0];if(!row)throw fail('Ürün kodu bulunamadı. Mevcut SKU kodunu belirtin.',404);return row;}
function patch(changes){
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length||Object.keys(changes).some(k=>!fields.includes(k)))throw fail('Geçersiz ürün değişikliği.');
 const result={};for(const [k,v] of Object.entries(changes)){result[k]=['name','category','unit'].includes(k)?text(v,k):number(v,k);if(k.endsWith('stock_level')&&!Number.isSafeInteger(v))throw fail('Stok seviyesi tam sayı olmalı.');}return result;
}
async function workspace(client,tenant){return (await client.query("SELECT payload,revision FROM workspace_collections WHERE tenant_id=$1 AND scope='crm' AND name='workspace'",[tenant])).rows[0];}
async function prepare(user,kind,args={}){
 if(!['product_create','product_update','stock_adjust','crm_task_create','crm_task_complete','crm_task_delete','supplier_create'].includes(kind))throw fail('Bu işlem henüz asistan tarafından uygulanamıyor.');
 if(!args||typeof args!=='object'||Array.isArray(args))throw fail('Geçersiz işlem bilgileri.');
 if(!['admin','manager'].includes(user.role))throw fail('İşlem yetkiniz yok.',403);
 const tenant=user.tenantId;
 if(kind==='product_create'){
  if(!['NORMAL','BOTH'].includes(user.moduleType))throw fail('Normal depo modülü gerekli.',403);
  const params={sku:text(args.sku,'Ürün kodu'),...patch({name:args.name,unit:args.unit,...Object.fromEntries(fields.filter(k=>!['name','unit'].includes(k)&&args[k]!==undefined).map(k=>[k,args[k]]))})};
  if((params.max_stock_level??1000)<(params.min_stock_level||0))throw fail('Maksimum stok minimumdan küçük olamaz.');
  if((await db.query('SELECT id FROM products WHERE sku=$1',[params.sku])).rows.length)throw fail('Bu ürün kodu zaten kullanılıyor.',409);
  return {kind,params,title:'Yeni ürün oluştur',impact:describe({purchase_price:0,sale_price:0,min_stock_level:0,max_stock_level:1000,...params}),expected:null};
 }
 if(kind==='product_update'){
  const p=await product(db,tenant,args.sku),changes=patch(args.changes);
  if(p.module_type==='PHARMACY'&&!['PHARMACY','BOTH'].includes(user.moduleType)||p.module_type!=='PHARMACY'&&!['NORMAL','BOTH'].includes(user.moduleType))throw fail('Ürün modülüne erişiminiz yok.',403);
  if((changes.max_stock_level??p.max_stock_level)<(changes.min_stock_level??p.min_stock_level))throw fail('Maksimum stok minimumdan küçük olamaz.');
  return {kind,params:{id:p.id,changes},title:`${p.name} ürününü güncelle`,impact:Object.keys(changes).map(k=>`${labels[k]}: ${p[k]} → ${changes[k]}`).join('\n'),expected:Object.fromEntries(Object.keys(changes).map(k=>[k,p[k]]))};
 }
 if(kind==='stock_adjust'){
  const p=await product(db,tenant,args.sku);
  if(!['NORMAL','BOTH'].includes(user.moduleType)||p.module_type==='PHARMACY'||p.is_medicine)throw fail('İlaç hareketleri için parti ve seri ekranını kullanın. Bu işlem yalnızca normal depo içindir.',403);
  if(!Number.isSafeInteger(args.amount)||args.amount===0)throw fail('Stok giriş veya çıkış miktarını sıfırdan farklı tam sayı olarak belirtin.');
  const warehouses=(await db.query('SELECT id,name FROM warehouses WHERE tenant_id=$1 AND name=$2',[tenant,text(args.warehouse_name,'Depo adı')])).rows;
  if(warehouses.length!==1)throw fail('Tek bir depo bulunamadı. Depo adını tam olarak belirtin.');
  const w=warehouses[0];const quantity=Number((await db.query('SELECT quantity FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3',[tenant,p.id,w.id])).rows[0]?.quantity||0);
  if(quantity+args.amount<0||!Number.isSafeInteger(quantity+args.amount))throw fail('Yetersiz stok veya geçersiz toplam miktar.');
  return {kind,params:{product_id:p.id,warehouse_id:w.id,amount:args.amount,note:text(args.note,'Hareket gerekçesi',500)},expected:quantity,title:'Stok hareketi kaydet',impact:`${p.name} / ${w.name}: ${quantity} → ${quantity+args.amount}. Gerekçe: ${args.note}`};
 }
 if(['crm_task_create','crm_task_complete','crm_task_delete'].includes(kind)){
  const row=await workspace(db,tenant),data=row?JSON.parse(row.payload):{companies:[],contacts:[],leads:[],deals:[],tasks:[],activities:[],automations:[],notifications:[]};
  const title=text(args.title,'Görev adı');let params;
  if(kind==='crm_task_create'){
   if(typeof args.dueDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(args.dueDate)||!Number.isFinite(Date.parse(args.dueDate))||new Date(args.dueDate).toISOString().slice(0,10)!==args.dueDate)throw fail('Görevin bitiş tarihini YYYY-MM-DD biçiminde belirtin.');
   if(args.priority!==undefined&&!['low','medium','high'].includes(args.priority))throw fail('Geçersiz öncelik.');
   if((data.tasks||[]).length>=10000)throw fail('Görev kayıt sınırına ulaşıldı.');
   params={title,dueDate:args.dueDate,priority:args.priority||'medium'};
  }else{
   const matches=(data.tasks||[]).filter(t=>t.title===title&&(kind==='crm_task_delete'||t.status!=='completed'));if(matches.length!==1)throw fail('Tek bir görev bulunamadı. Görev adını tam olarak belirtin.');params={id:matches[0].id,title};
  }
  return {kind,params,expected:row?.revision||0,title:kind==='crm_task_delete'?'CRM görevini sil':kind==='crm_task_create'?'CRM görevi oluştur':'CRM görevini tamamla',impact:describe(params)+(kind==='crm_task_delete'?'\nBu görev kalıcı olarak silinecek.':'')};
 }
 if(kind==='supplier_create'){
  const params={name:text(args.name,'Tedarikçi adı'),lead_time_days:args.lead_time_days??3};if(!Number.isSafeInteger(params.lead_time_days)||params.lead_time_days<1||params.lead_time_days>365)throw fail('Teslim süresi 1–365 gün olmalı.');
  return {kind,params,title:'Tedarikçi oluştur',impact:`${params.name}; teslim süresi ${params.lead_time_days} gün.`};
 }
 throw fail('Bu işlem henüz asistan tarafından uygulanamıyor.');
}
async function execute(client,user,plan){
 const tenant=user.tenantId,{kind,params,expected}=plan;
 if(kind==='product_create'){
  if(!['NORMAL','BOTH'].includes(user.moduleType))throw fail('Normal depo modülü gerekli.',403);
  const p=params;await client.query("INSERT INTO products (tenant_id,sku,name,unit,category,purchase_price,sale_price,min_stock_level,max_stock_level,module_type,is_medicine) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'NORMAL',0)",[tenant,p.sku,p.name,p.unit,p.category||'Genel',p.purchase_price||0,p.sale_price||0,p.min_stock_level||0,p.max_stock_level??1000]);
 }else if(kind==='product_update'){
  const p=(await client.query('SELECT * FROM products WHERE tenant_id=$1 AND id=$2',[tenant,params.id])).rows[0];if(!p||Object.entries(expected).some(([k,v])=>p[k]!==v))throw fail('Ürün onay beklerken değişti. Yeniden hazırlayın.',409);
  if((params.changes.max_stock_level??p.max_stock_level)<(params.changes.min_stock_level??p.min_stock_level))throw fail('Stok limitleri değişti. Yeniden hazırlayın.',409);
  if(p.module_type==='PHARMACY'&&!['PHARMACY','BOTH'].includes(user.moduleType)||p.module_type!=='PHARMACY'&&!['NORMAL','BOTH'].includes(user.moduleType))throw fail('Ürün modülüne erişiminiz yok.',403);
  const entries=Object.entries(params.changes);await client.query(`UPDATE products SET ${entries.map(([k],i)=>`${k}=$${i+1}`).join(',')} WHERE tenant_id=$${entries.length+1} AND id=$${entries.length+2}`,[...entries.map(([,v])=>v),tenant,params.id]);
 }else if(kind==='stock_adjust'){
  if(!['NORMAL','BOTH'].includes(user.moduleType))throw fail('Normal depo modülü gerekli.',403);
  const p=(await client.query('SELECT id,min_stock_level,module_type,is_medicine FROM products WHERE tenant_id=$1 AND id=$2',[tenant,params.product_id])).rows[0];const w=(await client.query('SELECT id FROM warehouses WHERE tenant_id=$1 AND id=$2',[tenant,params.warehouse_id])).rows[0];if(!p||!w||p.module_type==='PHARMACY'||p.is_medicine)throw fail('Ürün veya depo değişti.',409);
  const r=(await client.query('SELECT id,quantity FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3',[tenant,p.id,w.id])).rows[0];if(Number(r?.quantity||0)!==expected)throw fail('Stok onay beklerken değişti. Yeniden hazırlayın.',409);
  const total=expected+params.amount;if(total<0)throw fail('Yetersiz stok.');
  if(r)await client.query('UPDATE stock_records SET quantity=$1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND id=$3',[total,tenant,r.id]);else await client.query('INSERT INTO stock_records (tenant_id,product_id,warehouse_id,quantity) VALUES ($1,$2,$3,$4)',[tenant,p.id,w.id,total]);
  await client.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,$5,'ai_approved',$6)",[tenant,p.id,w.id,params.amount,params.amount>0?'inbound':'outbound',params.note]);
  if(total<=p.min_stock_level)await client.query("INSERT INTO alerts (tenant_id,product_id,warehouse_id,alert_type,severity,message,status) VALUES ($1,$2,$3,'low_stock','warning',$4,'unread')",[tenant,p.id,w.id,`Onaylanan stok hareketinden sonra ${total} birim kaldı.`]);
 }else if(['crm_task_create','crm_task_complete','crm_task_delete'].includes(kind)){
  const row=await workspace(client,tenant);if((row?.revision||0)!==expected)throw fail('CRM kayıtları değişti. Yeniden hazırlayın.',409);
  const data=row?JSON.parse(row.payload):{companies:[],contacts:[],leads:[],deals:[],tasks:[],activities:[],automations:[],notifications:[]};
  if(kind==='crm_task_create')data.tasks.push({...params,id:crypto.randomUUID(),status:'todo'});else{const task=data.tasks.find(t=>t.id===params.id);if(!task)throw fail('Görev bulunamadı.',409);if(kind==='crm_task_delete')data.tasks=data.tasks.filter(t=>t.id!==params.id);else task.status='completed';}
  if(Buffer.byteLength(JSON.stringify(data))>2*1024*1024)throw fail('CRM kayıt boyutu sınırı aşıldı.',413);
  if(row)await client.query("UPDATE workspace_collections SET payload=$1,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND scope='crm' AND name='workspace'",[JSON.stringify(data),tenant]);else await client.query("INSERT INTO workspace_collections (tenant_id,scope,name,payload,revision) VALUES ($1,'crm','workspace',$2,1)",[tenant,JSON.stringify(data)]);
 }else if(kind==='supplier_create')await client.query('INSERT INTO suppliers (tenant_id,name,lead_time_days) VALUES ($1,$2,$3)',[tenant,params.name,params.lead_time_days]);
 else throw fail('Desteklenmeyen işlem.');
 await client.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,$3,$4,$5)',[tenant,user.email,'assistant_action_approved',kind,JSON.stringify({actor:user.userId,...params})]);
 return {reply:`Onayladığınız işlem tamamlandı: ${plan.title}.`};
}
module.exports={catalog,prepare,execute};
