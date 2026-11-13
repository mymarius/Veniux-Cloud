const http=require('http');
const net=require('net');
const crypto=require('crypto');
const db=require('../config/database');
const probe=Symbol('assistant-authorization-probe');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const mounts={products:'productRoutes',warehouses:'warehouseRoutes',suppliers:'supplierRoutes',stock:'stockRoutes','purchase-orders':'purchaseOrderRoutes','stock-counts':'stockCountRoutes',alerts:'alertRoutes',wms:'wmsRoutes','normal-depo':'normalDepo',terminal:'terminalRoutes',settings:'settingsRoutes',workspaces:'workspaceRoutes',retail:'retailRoutes',platform:'platformRoutes','audit-logs':'auditRoutes',notifications:'notificationRoutes'};
const operations=new Map();
const uploads=new Map();
const downloads=new Map();
const uploadDirectory=require('path').join(require('../config/runtimeConfig').paths().storage,'assistant-uploads');
const scopeNames={products:'Ürünler',warehouses:'Depolar',suppliers:'Tedarikçiler',stock:'Stok','purchase-orders':'Satın alma','stock-counts':'Sayım',alerts:'Uyarılar',wms:'Depo operasyonları','normal-depo':'Normal depo',terminal:'Terminal',settings:'Ayarlar',workspaces:'CRM / Personel',retail:'Mağaza',platform:'API yönetimi','audit-logs':'İşlem geçmişi',notifications:'Bildirimler'};
const words={company:'Şirket profili',account:'Hesap',password:'Şifre',users:'Kullanıcılar',security:'Güvenlik',notifications:'Bildirimler',automation:'Asistan otomasyonu',run:'Çalıştır',whatsapp:'WhatsApp',connect:'Bağlan',disconnect:'Bağlantıyı kaldır',test:'Test mesajı',vacuum:'Veritabanını düzenle',backup:'Yedekle','system-engine':'Sistem bakımı',receive:'Mal kabul',finalize:'Tamamla',movement:'Hareket',transfer:'Transfer',adjust:'Stok düzeltme',import:'İçe aktar',locations:'Lokasyonlar',reservations:'Rezervasyonlar',inbound:'Mal kabul',receipts:'Kabul fişleri',picking:'Toplama',waves:'Toplama dalgaları',packing:'Paketleme',dispatch:'Sevkiyat',staff:'Personel','duty-schedule':'Nöbet çizelgesi',returns:'İadeler',devices:'Cihazlar','cold-chain':'Soğuk zincir',invoices:'Faturalar',formulas:'Formüller',pos:'Satış',sales:'Satışlar',settings:'Ayarlar',tenants:'İşletmeler',license:'Lisans',licenses:'Lisanslar',updates:'Güncellemeler',images:'Görseller',image:'Görsel',sync:'Eşitle',status:'Durum'};
const fieldNames={id:'Kayıt kimliği',name:'Ad',fullName:'Ad soyad',title:'Başlık',type:'Tür',role:'Yetki',status:'Durum',email:'E-posta',phone:'Telefon',ownerPhone:'Firma sahibi telefonu',address:'Adres',quantity:'Miktar',amount:'Tutar',price:'Fiyat',sale_price:'Satış fiyatı',purchase_price:'Alış fiyatı',warehouse_id:'Depo',product_id:'Ürün',supplier_id:'Tedarikçi',unit:'Birim',note:'Açıklama',items:'Kalemler',data:'Kayıtlar',filename:'Dosya adı',days:'Gün',plan_id:'Paket',revision:'Kayıt sürümü',enabled:'Etkin',intervalMinutes:'Kontrol aralığı (dakika)',sku:'Ürün kodu',barcode:'Barkod',device_name:'Cihaz adı',warehouseId:'Depo',device_type:'Cihaz türü',min_temp:'En düşük sıcaklık',max_temp:'En yüksek sıcaklık',location:'Konum',dueDate:'Bitiş tarihi',priority:'Öncelik'};
// Onay kartında gösterilen ile çalıştırılan aynı olmalı: kartın kısalttığı veya gizlediği bir değer varsa işlem hazırlanmaz.
function fullyShown(value,depth=0){if(depth>3)return false;if(Array.isArray(value))return value.length<=100&&value.every(v=>fullyShown(v,depth+1));if(value&&typeof value==='object')return Object.values(value).every(v=>fullyShown(v,depth+1));return typeof value!=='string'||value.length<=4000;}
function display(value,depth=0){
 if(depth>3)return 'Ayrıntılı kayıt';
 if(Array.isArray(value))return value.map((v,i)=>`${i+1}. ${display(v,depth+1)}`).join('\n');
 if(value&&typeof value==='object')return Object.entries(value).map(([k,v])=>`${fieldNames[k]||k}: ${display(v,depth+1)}`).join('\n');
 return typeof value==='boolean'?(value?'Evet':'Hayır'):value===null?'Boş':String(value);
}
function label(op){const parts=op.path.split('/').filter(p=>words[p]).map(p=>words[p]);return `${scopeNames[op.scope]||op.scope} — ${parts.join(' / ')||'Kayıt'}: ${op.read?'Bilgi getir':op.deletion?'Sil / kaldır':op.method==='POST'?'Oluştur / çalıştır':'Güncelle'}`;}
async function upload(user,buffer,name,type){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>500*1024*1024)throw fail('Dosya 1 bayt–500 MB arasında olmalı.');
 if(typeof name!=='string'||!name.trim()||name.length>255)throw fail('Dosya adı gerekli.');
 if(uploads.size>=20||[...uploads.values()].filter(r=>r.userId===user.userId).length>=2||[...uploads.values()].reduce((n,r)=>n+r.size,0)+buffer.length>1024*1024*1024)throw fail('Dosya kuyruğu dolu. Biraz sonra deneyin.',429);
 const fs=require('fs/promises'),id=crypto.randomUUID(),path=require('path').join(uploadDirectory,id+'.bin');
 await fs.mkdir(uploadDirectory,{recursive:true});await fs.writeFile(path,buffer,{flag:'wx'});
 const record={path,name:require('path').basename(name),type:type||'application/octet-stream',size:buffer.length,hash:crypto.createHash('sha256').update(buffer).digest('hex'),userId:user.userId,tenantId:user.tenantId};
 uploads.set(id,record);
 const timer=setTimeout(()=>{uploads.delete(id);fs.rm(path,{force:true}).catch(()=>{});},5*60000);timer.unref?.();
 return {id,name:record.name,size:record.size};
}
function initialize(){
 if(operations.size)return;
 for(const [scope,file] of Object.entries(mounts)){
  const router=require('../routes/'+file);
  for(const layer of router.stack){
   const route=layer.route;if(!route||typeof route.path!=='string')continue;
   for(const method of Object.keys(route.methods)){
    const last=route.stack.at(-1);let source=last.handle.toString();
    // Include the specific delegated service method, rather than guessing its input fields.
    const names=[...new Set([...source.matchAll(/\.([a-zA-Z_]\w*)\s*\(/g)].map(m=>m[1]))].filter(n=>!['json','status','query','log','error','send','set','map','filter','includes'].includes(n));
    for(const name of names)for(const module of Object.values(require.cache))if(/[\\/]services[\\/]/.test(module.filename||'')&&module.exports&&typeof module.exports[name]==='function')source+='\n'+module.exports[name].toString();
    const fields=new Set([...source.matchAll(/req\.body\.([a-zA-Z_]\w*)/g)].map(m=>m[1]));
    const plainSource=source.replace(/\/\/[^\n]*/g,'');
    for(const m of plainSource.matchAll(/(?:const|let)\s*\{([^{}]+)\}\s*=\s*(?:req\.body|data|payload|input)/g))for(const part of m[1].split(',')){const key=part.trim().split(/[:=]/)[0].trim();if(/^[a-zA-Z_]\w*$/.test(key)&&!['tenant_id','tenantId','userId'].includes(key))fields.add(key);}
    const id=`${scope}:${method.toUpperCase()}:${route.path}`;
    const raw=route.stack.some(s=>s.handle.name==='rawParser');
    const tables=[...new Set([...source.matchAll(/\b(?:FROM|UPDATE|INTO|JOIN)\s+["`]?([a-z_]\w*)/gi)].map(m=>m[1]))];
    const required=[...new Set([...source.matchAll(/if\s*\(([^)]+)\)\s*\{?\s*(?:return\s+)?res\.status\(400\)/g)].flatMap(m=>[...m[1].matchAll(/!\s*([a-zA-Z_]\w*)\b/g)].map(x=>x[1])).filter(k=>fields.has(k)))];
    const fileMode=scope==='pharmacy'&&route.path==='/import-file'?'text':null;
    operations.set(id,{id,scope,method:method.toUpperCase(),path:'/api/'+scope+route.path.replace(/\/$/,''),fields:[...fields],required,tables,raw,fileMode,scopedRead:/(?:WHERE|AND)[^;]*tenant_id\s*=/i.test(source),read:method==='get',deletion:method==='delete'||/\/disconnect$/.test(route.path),handler:last.handle});
    // The probe traverses the exact same authentication, role and entitlement middleware,
    // but stops before entering the controller. A network client cannot set this symbol.
    const original=last.handle;
    last.handle=function(req,res,next){if(req[probe])return res.json({authorized:true,user_id:req.user?.userId,tenant_id:req.user?.tenantId});return original(req,res,next);};
   }
  }
 }
}
function list(user){initialize();return [...operations.values()].filter(o=>(user.isPlatformAdmin||!['platform','admin/medicines'].includes(o.scope))&&(user.moduleType==='BOTH'||!(['pharmacy','eczane-depo','medicines'].includes(o.scope)&&user.moduleType!=='PHARMACY'))&&(user.moduleType==='BOTH'||!(['normal-depo','retail','wms'].includes(o.scope)&&user.moduleType!=='NORMAL'))).map(({handler,tables,...o})=>({...o,label:label(o)}));}
function plain(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function resolve(user,args){
 initialize();if(!plain(args))throw fail('İşlem bilgileri gerekli.');
 const op=operations.get(args.operation);if(!op||!list(user).some(o=>o.id===op.id))throw fail('Bu işlem için erişiminiz yok.',403);
 const params=args.params||{},body=args.body||{},query=args.query||{};
 if(!plain(params)||!plain(body)||!plain(query))throw fail('Geçersiz işlem alanları.');
 function safeKeys(value){if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw fail('Geçersiz veri alanı.');safeKeys(v);}}
 safeKeys(body);safeKeys(params);safeKeys(query);
 if(JSON.stringify(body).length>2*1024*1024)throw fail('İşlem verisi çok büyük.');
 const keys=[...op.path.matchAll(/:([a-zA-Z_]\w*)/g)].map(m=>m[1]);
 if(Object.keys(params).some(k=>!keys.includes(k)))throw fail('Geçersiz hedef alanı.');
 const path=op.path.replace(/:([a-zA-Z_]\w*)/g,(_,key)=>{
  const value=params[key];if(!['string','number'].includes(typeof value)||!String(value).trim()||String(value).length>128||/[\/\\?#\x00-\x1f]/.test(String(value))||['.','..'].includes(String(value)))throw fail(`İşlemin hedefi eksik veya geçersiz: ${key}`);
  return encodeURIComponent(String(value));
 });
 if(Object.values(query).some(v=>!['string','number','boolean'].includes(typeof v)))throw fail('Geçersiz sorgu.');
 // These fields never come from a model; identity stays exclusively in middleware.
 if(['tenant_id','tenantId','userId','isPlatformAdmin','authorization','session_version'].some(k=>Object.hasOwn(body,k)||Object.hasOwn(query,k)))throw fail('İşletme veya kimlik alanları asistan tarafından değiştirilemez.',403);
 const module=body.module_type||(op.scope==='products'&&op.method==='POST'?(body.is_medicine?'PHARMACY':'NORMAL'):null);
 if(['NORMAL','PHARMACY'].includes(module)&&user.moduleType!=='BOTH'&&user.moduleType!==module)throw fail('Bu ürün modülüne erişiminiz yok.',403);
 return {op,params,body,query,url:path+(Object.keys(query).length?'?'+new URLSearchParams(query):'')};
}
function hasSecretField(value){if(Array.isArray(value))return value.some(hasSecretField);if(value&&typeof value==='object')return Object.entries(value).some(([k,v])=>/(password|secret|token|private.?key|api.?key|session_version|license.?key|credential|ticket|codes)/i.test(k)||hasSecretField(v));return false;}
function sanitize(value){
 if(Array.isArray(value))return value.slice(0,100).map(sanitize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!/(password|secret|token|private.?key|api.?key|session_version|license.?key|credential|ticket|codes)/i.test(k)).map(([k,v])=>[k,sanitize(v)]));
 return typeof value==='string'?value.slice(0,4000):value;
}
async function invoke(user,resolved,context={},preflight=false,file){
 const headers=context.headers||{};
 if(typeof headers.authorization!=='string')throw fail('Oturum doğrulaması gerekli.',401);
 const app=require('../index');
 return new Promise((resolve,reject)=>{
  const socket=new net.Socket();Object.defineProperty(socket,'remoteAddress',{value:'127.0.0.1'});
  const req=new http.IncomingMessage(socket);
  req.method=resolved.op.method;req.url=resolved.url;req.headers={authorization:headers.authorization,'idempotency-key':'assistant-'+crypto.randomUUID()};
  if(user.isPlatformAdmin)req.headers['x-tenant-id']=String(user.tenantId);
  // Bulutta merkezi lisans kapısı iç isteği de denetler: kullanıcının cihaz lisans başlıkları (biçimi doğrulanarak) aktarılır.
  if(/^[a-f0-9]{64}$/.test(headers['x-veniux-device-token']||''))req.headers['x-veniux-device-token']=headers['x-veniux-device-token'];
  if(/^HW-[A-F0-9]{32}$/.test(headers['x-device-id']||''))req.headers['x-device-id']=headers['x-device-id'];
  req.body=file?(resolved.op.fileMode==='text'?{...resolved.body,content:file.buffer.toString('utf8'),fileName:file.name,fileType:require('path').extname(file.name).slice(1)||'xml'}:file.buffer):resolved.body;req[probe]=preflight;
  if(file){req.headers['content-type']=file.type;req.headers['x-file-name']=encodeURIComponent(file.name);}
  const res=new http.ServerResponse(req);let settled=false;
  const timer=setTimeout(()=>finish(fail('İşlem sonucu doğrulanamadı. Yeniden denemeden ilgili kayıtları kontrol edin.',504)),65000);timer.unref?.();
  function finish(error,data){if(settled)return;settled=true;clearTimeout(timer);res.emit('finish');if(error)reject(error);else resolve(data);}
  res.json=data=>{if(res.statusCode>=400)finish(fail(data?.error||data?.message||'İşlem reddedildi.',res.statusCode));else if(preflight&&(data?.user_id!==user.userId||data?.tenant_id!==user.tenantId))finish(fail('Oturum ile onay verilen işletme eşleşmiyor.',403));else finish(null,{status:res.statusCode,data});return res;};
  res.send=data=>{if(typeof data==='object'&&!Buffer.isBuffer(data))return res.json(data);finish(res.statusCode>=400?fail('İşlem reddedildi.',res.statusCode):null,{status:res.statusCode,data:typeof data==='string'?data.slice(0,4000):{download:true}});return res;};
  res.end=()=>{finish(res.statusCode>=400?fail('İşlem reddedildi.',res.statusCode):null,{status:res.statusCode,data:{}});return res;};
  res.download=(path,...rest)=>{finish(null,{status:res.statusCode,data:{download:true,name:require('path').basename(path)}});return res;};
  res.sendFile=(path,...rest)=>{finish(null,{status:res.statusCode,data:{download:true,name:require('path').basename(path)}});return res;};
  app.handle(req,res,error=>finish(error||fail('İşlem bulunamadı.',404)));
 });
}
async function revision(){
 // Every local SQLite write invalidates the preview, including controllers without audits.
 if(db.getEngine()==='sqlite')return JSON.stringify([(await db.query('SELECT total_changes() AS value')).rows[0].value,(await db.query('PRAGMA data_version')).rows[0]]);
 return JSON.stringify((await db.query('SELECT COALESCE(MAX(id),0) AS value FROM audit_logs')).rows[0]);
}
async function fileFrom(user,input){
 if(!input)return null;
 if(input.upload_id){const record=uploads.get(input.upload_id);if(!record||record.userId!==user.userId||record.tenantId!==user.tenantId)throw fail('Dosya bulunamadı veya süresi doldu.',409);return {upload_id:input.upload_id,...record};}
 if(!plain(input)||typeof input.name!=='string'||typeof input.base64!=='string'||input.base64.length>8400000||typeof input.type!=='string')throw fail('Geçersiz dosya.');
 const buffer=Buffer.from(input.base64,'base64');if(!buffer.length||buffer.length>6*1024*1024)throw fail('Asistan dosyası en fazla 6 MB olmalı.');
 return {buffer,name:require('path').basename(input.name),type:input.type,hash:crypto.createHash('sha256').update(buffer).digest('hex')};
}
const collections={crm:['companies','contacts','leads','deals','tasks','activities','automations','notifications'],hr:['employees','schedule','attendance','leaveRequests','balances','goals','reviews']};
async function workspaceArgs(user,args,context){
 if(!plain(args)||!collections[args.scope]?.includes(args.collection)||!['create','update','delete'].includes(args.mode))throw fail('Geçerli çalışma alanı, kayıt türü ve işlem seçin.');
 const read=resolve(user,{operation:'workspaces:GET:/:scope',params:{scope:args.scope}});
 const current=(await invoke(user,read,context)).data;
 const data=current.data,rows=data[args.collection];let target;
 if(args.mode!=='create'){
  if(typeof args.target!=='string'||!args.target.trim())throw fail('Hedef kaydın tam adını veya kimliğini belirtin.');
  const matches=rows.filter(r=>[r.id,r.name,r.fullName,r.title].some(v=>v!==undefined&&String(v)===args.target));
  if(matches.length!==1)throw fail('Tek bir hedef kayıt bulunamadı. Tam adı veya kimliği gerekli.',409);target=matches[0];
 }
 const values=args.values||{};
 if(!plain(values)||Object.keys(values).some(k=>['id','tenant_id','tenantId','__proto__','constructor','prototype'].includes(k))||args.mode!=='delete'&&!Object.keys(values).length)throw fail('Geçerli kayıt alanları gerekli.');
 if(args.mode==='create')rows.push({...values,id:crypto.randomUUID()});
 else if(args.mode==='update')Object.assign(target,values);
 else data[args.collection]=rows.filter(r=>r.id!==target.id);
 return {operation:'workspaces:PUT:/:scope',params:{scope:args.scope},body:{data,revision:current.revision},description:`${args.scope==='crm'?'CRM':'Personel'} / ${args.collection}: ${args.mode==='delete'?'Kalıcı silme':args.mode==='update'?'Güncelleme':'Yeni kayıt'}\nHedef: ${args.target||values.name||values.fullName||values.title||'Yeni kayıt'}\nDeğişiklik: ${JSON.stringify(sanitize(values))}`,deletion:args.mode==='delete'};
}
async function prepare(user,args,context,kind='system_operation'){
 let workspace;
 if(kind==='workspace_record'){workspace=await workspaceArgs(user,args,context);args=workspace;}
 const r=resolve(user,args);await invoke(user,r,context,true);
 const targetNames=await guardTargets(user,r);
 if(r.op.method==='PUT'&&!r.op.raw&&!r.op.fileMode&&!workspace){
  // Existing forms use PUT with complete records. Retain unspecified values so
  // a rename does not silently reset prices, contact details or policy switches.
  let current;
  const exact=operations.get(`${r.op.scope}:GET:${r.op.path.slice(('/api/'+r.op.scope).length)||'/'}`);
  const parent=operations.get(`${r.op.scope}:GET:/`);
  if(exact)current=await read(user,{operation:exact.id,params:r.params},context);
  else if(parent&&r.params.id!==undefined){const list=await read(user,{operation:parent.id},context);const rows=Array.isArray(list)?list:list.items||list.data||[];current=rows.find(row=>String(row.id)===String(r.params.id));}
  if(current&&plain(current)){
   const retain=Object.fromEntries(r.op.fields.filter(k=>Object.hasOwn(current,k)&&!/(password|secret|token|private.?key|api.?key)/i.test(k)).map(k=>[k,current[k]]));
   r.body={...retain,...r.body};
  }
 }
 for(const key of r.op.required)if(!(key==='content'&&r.op.fileMode)&&(r.body[key]===undefined||r.body[key]===null||r.body[key]===''))throw fail(`İşlem için zorunlu bilgi eksik: ${key}`);
 if(r.op.scope==='workspaces'&&r.op.method==='PUT'&&!workspace)throw fail('Çalışma alanında yalnızca hedef kaydı değiştiren workspace_record işlemini kullanın.');
 const file=await fileFrom(user,args.file);
 if((r.op.raw||r.op.fileMode&&!r.body.content)&&!file)return {kind:'system_operation',params:args,title:'Dosya seçimi gerekli',impact:'Bu işlem için önce dosyanızı seçin.',requires_file:true,operation:r.op.id};
 if(file){const size=file.size||file.buffer.length;const limit=r.op.scope==='admin/medicines'?(r.op.path.endsWith('/image')?2:40):r.op.fileMode?6:500;if(size>limit*1024*1024)throw fail(`Bu işlem için dosya en fazla ${limit} MB olabilir.`);}
 // The approval card hides secret fields, so an action carrying one could not be knowingly approved.
  if(hasSecretField(r.body))throw fail('Parola veya gizli anahtar içeren işlemler asistanla yapılamaz. Bunu Ayarlar ekranından yapın.');
  if(!workspace&&!fullyShown(r.body))throw fail('Bu işlem onay kartında eksiksiz gösterilemeyecek kadar büyük. Daha küçük parçalara bölün veya ilgili ekrandan yapın.');
 const version=await revision();
 const deletion=r.op.deletion||workspace?.deletion;
 const cascade=deletion&&['products','warehouses'].includes(r.op.scope)?'\nBu kayıtla birlikte ilişkili stok, hareket ve işlem kayıtları da silinebilir.':'';
 const impact=(workspace?.description||`Hedef: ${display(r.params)||'Yeni işlem'}${targetNames?.length?'\nKayıtlar: '+targetNames.join('; '):''}${Object.keys(r.body).length?'\n'+display(sanitize(r.body)):''}${Object.keys(r.query).length?'\nFiltre: '+display(r.query):''}`)+`${file?`\nDosya: ${file.name}, ${(file.size||file.buffer.length)/1024/1024 < 1?'1 MB altında':Math.ceil((file.size||file.buffer.length)/1024/1024)+' MB'}`:''}${cascade}${deletion?'\nKalıcı silme veya bağlantı kaldırma için ayrıca açık onay gerekli.':''}`;
 return {kind:'system_operation',params:{operation:args.operation,params:r.params,body:r.body,query:r.query},file,expected:version,title:label(r.op),impact,deletion,read:r.op.read};
}
async function execute(user,plan,context){
 const r=resolve(user,plan.params);await invoke(user,r,context,true);
 await guardTargets(user,r);
 if(!r.op.read&&await revision()!==plan.expected)throw fail('Onay beklerken sistem kayıtları değişti. İşlemi güncel bilgilerle yeniden hazırlayın.',409);
 if(!r.op.read)await db.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,$3,$4,$5)',[user.tenantId,user.email,'assistant_system_operation_approved',r.op.scope,JSON.stringify({actor:user.userId,operation:r.op.id,params:r.params,fileHash:plan.file?.hash})]);
 let file=plan.file;
 if(file?.upload_id){await fileFrom(user,{upload_id:file.upload_id});file={...file,buffer:await require('fs/promises').readFile(file.path)};uploads.delete(file.upload_id);}
 let result;try{result=await invoke(user,r,context,false,file);}finally{if(file?.path)await require('fs/promises').rm(file.path,{force:true}).catch(()=>{});}
 if(r.op.read)result.data=await restrictResult(user,r,result.data);
 const uncertain=['unknown','not_connected','not_registered','not_configured','invalid_phone','rejected'].includes(result.data?.status)||result.data?.success===false;
 return {reply:uncertain?'İşlem tamamlanamadı veya sonucu doğrulanamadı. Ayrıntıları kontrol edin; otomatik tekrar yapılmadı.':result.status===202?'İşlem başlatıldı. Tamamlanma durumu ilgili ekrandan takip edilebilir.':result.data?.status==='accepted'?'Gönderim isteği kabul edildi. Teslim durumu ayrıca kontrol edilmelidir.':r.op.read?'İstediğiniz kayıtlar getirildi.':'Onayladığınız işlem uygulandı.',result:sanitize(result.data),source_operation:r.op.id};
}
let tableInfo;
async function schema(){
 if(tableInfo)return tableInfo;
 tableInfo={};
 if(db.getEngine()==='mysql'){
  const columns=(await db.query('SELECT TABLE_NAME AS table_name,COLUMN_NAME AS column_name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()')).rows;
  for(const row of columns){const name=row.table_name;if(!/^[a-z_]\w*$/.test(name))continue;if(!tableInfo[name])tableInfo[name]={columns:[],foreign:[]};tableInfo[name].columns.push(row.column_name);}
  const foreign=(await db.query('SELECT TABLE_NAME AS table_name,COLUMN_NAME AS column_name,REFERENCED_TABLE_NAME AS referenced_table,REFERENCED_COLUMN_NAME AS referenced_column FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL')).rows;
  for(const row of foreign)if(tableInfo[row.table_name])tableInfo[row.table_name].foreign.push({from:row.column_name,table:row.referenced_table,to:row.referenced_column});
  return tableInfo;
 }
 const tables=(await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows;
 for(const {name} of tables)if(/^[a-z_]\w*$/.test(name))tableInfo[name]={columns:(await db.query(`PRAGMA table_info("${name}")`)).rows.map(r=>r.name),foreign:(await db.query(`PRAGMA foreign_key_list("${name}")`)).rows};
 return tableInfo;
}
async function guardTargets(user,r){
 if(['platform','admin/medicines','medicines'].includes(r.op.scope))return [];
 const info=await schema();
 const tenantTables=r.op.tables.filter(t=>info[t]?.columns.includes('tenant_id'));
 const primary=tenantTables.find(t=>info[t].columns.includes('id'));
 const targets=[];
 if(r.params.id!==undefined&&primary)targets.push([primary,r.params.id]);
 const common={product_id:'products',productId:'products',warehouse_id:'warehouses',warehouseId:'warehouses',source_warehouse_id:'warehouses',target_warehouse_id:'warehouses',from_warehouse_id:'warehouses',to_warehouse_id:'warehouses',supplier_id:'suppliers',patient_id:'patient_accounts',patientId:'patient_accounts',staff_id:'pharmacy_staff',lot_id:'inventory_lots',location_id:'warehouse_locations',source_location_id:'warehouse_locations',target_location_id:'warehouse_locations',receipt_id:'wms_inbound_receipts',wave_id:'wms_pick_waves',task_id:'wms_pick_tasks',reservation_id:'inventory_reservations',handling_unit_id:'handling_units',target_handling_unit_id:'handling_units',device_id:'cold_chain_devices',deviceId:'cold_chain_devices',count_id:'stock_counts',item_id:'stock_count_items',assigned_user_id:'users'};
 for(const [key,value] of Object.entries(r.params))if(common[key]&&info[common[key]]?.columns.includes('tenant_id'))targets.push([common[key],value]);
 function walk(value){if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){const fk=tenantTables.flatMap(t=>info[t].foreign).find(f=>f.from===key&&info[f.table]?.columns.includes('tenant_id'));const table=fk?.table||common[key];if(table&&info[table]?.columns.includes('tenant_id')&&v!==null&&v!==undefined&&v!=='')targets.push([table,v]);if(typeof v==='object')walk(v);}}
 if(r.op.scope!=='workspaces')walk(r.body);
 const names=[];
 for(const [table,id] of targets){
  const cols=['id','name','full_name','title','email','sku','device_name','order_no','count_no','module_type','is_medicine','warehouse_type'].filter(c=>info[table].columns.includes(c));
  const row=(await db.query(`SELECT ${cols.join(',')} FROM \`${table}\` WHERE id=$1 AND tenant_id=$2`,[id,user.tenantId])).rows[0];
  if(!row)throw fail('Hedef veya ilişkili kayıt bu işletmede bulunamadı.',404);
  const required=row.module_type||row.warehouse_type;
  if(['NORMAL','PHARMACY'].includes(required)&&user.moduleType!=='BOTH'&&user.moduleType!==required)throw fail('Hedef kaydın modülüne erişiminiz yok.',403);
  if(!r.op.read&&r.op.scope==='stock'&&(row.module_type==='PHARMACY'||row.is_medicine))throw fail('İlaç stokları için parti/seri kontrollü eczane depo işlemini kullanın.',400);
  const name=row.name||row.full_name||row.title||row.device_name||row.order_no||row.count_no||row.email||row.sku;
  if(name&&!names.includes(name)&&names.length<30)names.push(name);
 }
 return names;
}
async function restrictResult(user,r,data){
 if(['platform','admin/medicines','medicines'].includes(r.op.scope))return data;
 const info=await schema();const primary=r.op.tables.find(t=>info[t]?.columns.includes('tenant_id')&&info[t].columns.includes('id'));
 async function filter(value,root=false){
  if(Array.isArray(value)){const filtered=await Promise.all(value.map(v=>filter(v)));return filtered.filter(v=>v!==undefined);}
  if(!value||typeof value!=='object')return value;
  if(value.tenant_id!==undefined&&Number(value.tenant_id)!==user.tenantId)return undefined;
  if(value.id!==undefined&&value.tenant_id===undefined&&primary&&!(await db.query(`SELECT id FROM \`${primary}\` WHERE id=$1 AND tenant_id=$2`,[value.id,user.tenantId])).rows.length)return undefined;
  if(root&&!r.op.scopedRead&&!Object.keys(r.params).length&&!['settings','notifications'].includes(r.op.scope)&&!Object.values(value).some(v=>typeof v==='object')&&value.id===undefined&&value.tenant_id===undefined)return {notice:'Bu raporun işletme filtresi doğrulanamadığı için genel toplamlar paylaşılmadı.'};
  const result={};for(const [key,v] of Object.entries(value)){const clean=await filter(v);if(clean!==undefined)result[key]=clean;}return result;
 }
 return await filter(data,true)||{notice:'Bu işletme için erişilebilir kayıt bulunamadı.'};
}
async function read(user,args,context){const r=resolve(user,args);if(!r.op.read)throw fail('Bilgi sorgusu yalnızca kayıt okumak için kullanılabilir.');await invoke(user,r,context,true);await guardTargets(user,r);return sanitize(await restrictResult(user,r,(await invoke(user,r,context)).data));}
async function exportFile(user,args,context){
 const r=resolve(user,args);if(!r.op.read||!['csv','json'].includes(args.format))throw fail('Dışa aktarma için bir bilgi sorgusu ve CSV veya JSON seçin.');
 await invoke(user,r,context,true);await guardTargets(user,r);
 const data=await restrictResult(user,r,(await invoke(user,r,context)).data);
 function withoutSecrets(value){if(Array.isArray(value))return value.map(withoutSecrets);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!/(password|secret|token|private.?key|api.?key|session_version|license.?key|credential|ticket|codes)/i.test(k)).map(([k,v])=>[k,withoutSecrets(v)]));return value;}
 const clean=withoutSecrets(data);let content;
 if(args.format==='json')content=JSON.stringify(clean,null,2);
 else{
  const rows=Array.isArray(clean)?clean:Array.isArray(clean?.data)?clean.data:Array.isArray(clean?.items)?clean.items:[clean];
  const keys=[...new Set(rows.flatMap(row=>row&&typeof row==='object'?Object.keys(row):['value']))];
  const cell=value=>{let s=value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value):String(value);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  content='\uFEFF'+[keys.map(k=>cell(fieldNames[k]||k)).join(';'),...rows.map(row=>keys.map(k=>cell(typeof row==='object'?row[k]:row)).join(';'))].join('\r\n');
 }
 const fs=require('fs/promises'),path=require('path'),directory=path.join(require('../config/runtimeConfig').paths().storage,'assistant-results'),id=crypto.randomUUID(),filename=`veniux-${r.op.scope.replace(/\//g,'-')}.${args.format}`,location=path.join(directory,id+'.'+args.format);
 if(downloads.size>=20)throw fail('Rapor kuyruğu dolu. Biraz sonra deneyin.',429);
 await fs.mkdir(directory,{recursive:true});await fs.writeFile(location,content,{flag:'wx'});
 downloads.set(id,{userId:user.userId,tenantId:user.tenantId,path:location,filename});
 const timer=setTimeout(()=>{downloads.delete(id);fs.rm(location,{force:true}).catch(()=>{});},5*60000);timer.unref?.();
 return {download:{url:'/ai/actions/result-files/'+id,filename},message:'Rapor hazır. Dosyayı aşağıdaki düğmeden indirebilirsiniz; bağlantı 5 dakika geçerlidir.'};
}
function download(user,id){const file=downloads.get(id);if(!file||file.userId!==user.userId||file.tenantId!==user.tenantId)throw fail('Rapor bulunamadı veya süresi doldu.',404);return file;}
module.exports={fullyShown,list,prepare,execute,read,sanitize,resolve,upload,exportFile,download};
