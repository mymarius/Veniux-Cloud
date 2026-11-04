const db=require('../config/database');
const PROFILES=['market','warehouse','medical','retail'];
const MODULES=['stock','warehouse','pos','crm'];
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const initial=()=>({version:1,profile:'retail',modules:[...MODULES],currentStep:1,steps:Array(10).fill('pending'),completed:false});
const validObject=x=>x&&typeof x==='object'&&!Array.isArray(x);
function validate(data){
 if(!validObject(data)||Object.keys(data).some(k=>!['revision','profile','modules','currentStep','steps','completed'].includes(k)))fail('Kurulum alanları geçersiz. Sayfayı yenileyip tekrar deneyin.');
 if(!Number.isSafeInteger(data.revision)||data.revision<0||!PROFILES.includes(data.profile)||!Array.isArray(data.modules)||!data.modules.length||data.modules.length>4||new Set(data.modules).size!==data.modules.length||data.modules.some(k=>!MODULES.includes(k)))fail('İşletme profili ve kullanılacak ekranları kontrol edin.');
 if(!Number.isInteger(data.currentStep)||data.currentStep<1||data.currentStep>10||!Array.isArray(data.steps)||data.steps.length!==10||data.steps.some(s=>!['pending','reviewed','skipped'].includes(s))||typeof data.completed!=='boolean')fail('Kurulum adımları geçersiz.');
 if(data.completed&&data.steps.some(s=>s==='pending'))fail('Önce kalan adımları inceleyin veya daha sonraya bırakın.');
 return {version:1,profile:data.profile,modules:data.modules,currentStep:data.currentStep,steps:data.steps,completed:data.completed};
}
async function read(user,tx=db){
 const row=(await tx.query("SELECT payload,revision FROM workspace_collections WHERE tenant_id=$1 AND scope='settings' AND name='customer_setup'",[user.tenantId])).rows[0];
 const data=row?JSON.parse(row.payload):initial();
 // Retired profile preferences fall back without altering business records.
 if(data.profile==='pharmacy')data.profile='warehouse';
 return {...data,revision:row?Number(row.revision):0};
}
async function get(user){
 const data=await read(user);
 const plan=await planSummary(user);
 if(user.role!=='admin')return {...data,plan,suggestFirstRun:false};
 const count=(await db.query('SELECT COUNT(*) AS count FROM products WHERE tenant_id=$1',[user.tenantId])).rows[0];
 return {...data,plan,suggestFirstRun:data.revision===0&&Number(count.count)===0};
}
async function planSummary(user){
 const central=require('./centralLicense').enabled();
 const license=central?user.centralLicense:(await db.query('SELECT * FROM licenses WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1',[user.tenantId])).rows[0];
 if(!central&&license){const contract=require('./productPackages').parse(JSON.parse(license.enabled_features_json||'{}'));if(contract)return{id:contract.code,name:contract.name,limits:{max_users:contract.limits.users,max_warehouses:contract.limits.warehouses,max_devices:contract.limits.devices,max_pdas:contract.limits.devices},features:contract.modules};}
 const registered=require('./licenseService').getPlans().find(p=>p.id===license?.plan_id);
 if(!registered)return {name:'Paket bilgisi doğrulanamadı',limits:{},features:[]};
 let features=registered.features;
 if(!central&&license.enabled_features_json){try{const parsed=JSON.parse(license.enabled_features_json);if(validObject(parsed))features={...features,...parsed};}catch{/* Invalid overrides do not add features. */}}
 const limits={};
 for(const key of ['max_users','max_warehouses','max_devices','max_pdas']){
  const value=central?registered[key]:license[key]??registered[key];
  if(Number.isSafeInteger(Number(value))&&Number(value)>=0)limits[key]=Number(value);
 }
 // Signed central device caps may be narrower than the registered package.
 if(central&&Number.isSafeInteger(license.max_devices)&&license.max_devices>=0){
  limits.max_devices=Math.min(limits.max_devices??license.max_devices,license.max_devices);
  limits.max_pdas=Math.min(limits.max_pdas??license.max_devices,license.max_devices);
 }
 return {id:registered.id,name:registered.name,limits,features:['cold_chain','expiry_radar','pda'].filter(k=>features[k]===true)};
}
async function save(user,body){
 if(user.role!=='admin')fail('İlk kurulum ayarlarını yalnız işletme yöneticisi değiştirebilir.',403);
 const data=validate(body);
 const plan=await planSummary(user);
 return db.transaction(async tx=>{
  if(db.getEngine()==='mysql')await tx.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[user.tenantId]);
  const before=await read(user,tx);
  if(before.revision!==body.revision)fail('Kurulum başka bir ekranda güncellendi. Son durumu yükleyip tekrar deneyin.',409);
  // Only presentation/progress metadata changes. No role, license, tax, stock or device settings.
  if(before.revision===0)await tx.query("INSERT INTO workspace_collections(tenant_id,scope,name,payload,revision) VALUES($1,'settings','customer_setup',$2,1)",[user.tenantId,JSON.stringify(data)]);
  else await tx.query("UPDATE workspace_collections SET payload=$1,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND scope='settings' AND name='customer_setup' AND revision=$3",[JSON.stringify(data),user.tenantId,before.revision]);
  await tx.query("INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,details) VALUES($1,$2,'customer_setup.saved','settings',$3)",[user.tenantId,user.email,JSON.stringify({profile:data.profile,currentStep:data.currentStep,completed:data.completed})]);
  return {...data,plan,revision:before.revision+1,suggestFirstRun:false};
 });
}
module.exports={get,save,validate,initial,PROFILES,MODULES};
