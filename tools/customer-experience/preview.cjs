// Local UI acceptance fixture. Never reads an installed database or production credentials.
if(process.env.NODE_ENV!=='test')throw Error('Test only');
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'.local/customer-experience');
const build=JSON.parse(fs.readFileSync(path.join(base,'latest.json'),'utf8')).run;
if(path.dirname(build)!==base)throw Error('Unexpected build path');
const data=path.join(base,'preview-'+crypto.randomBytes(8).toString('hex'));fs.mkdirSync(data,{recursive:true});
for(const key of Object.keys(process.env))if(/^(DB_(HOST|PORT|NAME|USER|PASSWORD)|VENIUX_LICENSE_AUTHORITY_|SMTP_|NVIDIA_|GEMINI_|OPENAI_|ANTHROPIC_)/.test(key))delete process.env[key];
const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});fs.writeFileSync(path.join(data,'private.pem'),keys.privateKey);fs.writeFileSync(path.join(data,'public.pem'),keys.publicKey);
Object.assign(process.env,{VENIUX_DATA_DIR:data,TEST_SQLITE_PATH:path.join(data,'preview.sqlite'),DB_ENGINE:'sqlite',VENIUX_MYSQL_TEST:'0',VENIUX_CLOUD_SERVICE:'0',VENIUX_DISABLE_BACKGROUND_JOBS:'1',VENIUX_HARDWARE_LAB:'1',LICENSE_PRIVATE_KEY_PATH:path.join(data,'private.pem'),LICENSE_PUBLIC_KEY_PATH:path.join(data,'public.pem'),JWT_SECRET:crypto.randomBytes(48).toString('hex'),CORS_ORIGIN:'http://127.0.0.1:39766,http://127.0.0.1:39767'});
require('../hardware-lab/network-guard.cjs');
const express=require(path.join(root,'backend/node_modules/express')),app=require('../../backend/src/index'),db=require('../../backend/src/config/database');
const servers=[];
(async()=>{
 await db.ready;const factories=require('../../backend/tests/factories'),fixture=await factories.createTenant();let cashier=null;if(process.argv.includes('--packages'))await db.query('INSERT INTO platform_admins(user_id) VALUES($1)',[fixture.userId]);
 if(process.argv.includes('--retail-pro'))cashier=await factories.createUser(fixture.tenantId,'cashier');
 await db.query("UPDATE tenants SET company_name='Veniux Deneme İşletmesi' WHERE id=$1",[fixture.tenantId]);
 await db.query("UPDATE users SET full_name='Ayşe Demir' WHERE id=$1 AND tenant_id=$2",[fixture.userId,fixture.tenantId]);
 if(process.argv.includes('--retail-pro')){
  const warehouse=(await db.query('SELECT id FROM warehouses WHERE tenant_id=$1 ORDER BY id LIMIT 1',[fixture.tenantId])).rows[0];
  for(const [i,name,unit,category,price] of [[1,'Deneme · Süt 1 L','adet','İçecek',35],[2,'Deneme · Özenle Kavrulmuş Filtre Kahve 250 g','adet','Gıda',179.9],[3,'Deneme · Elma','kg','Manav',45],[4,'Deneme · Ekmek','adet','Fırın',15]]){
   const p=(await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,category,sale_price,kdv_orani,module_type) VALUES($1,$2,$2,$3,$4,$5,$6,10,'NORMAL') RETURNING id",[fixture.tenantId,'PRO-PREVIEW-'+i,name,unit,category,price])).rows[0];
   await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)',[fixture.tenantId,warehouse.id,p.id]);
  }
 }
 if(process.argv.includes('--ux2')){
  const warehouse=(await db.query('SELECT id FROM warehouses WHERE tenant_id=$1 ORDER BY id LIMIT 1',[fixture.tenantId])).rows[0];
  await db.transaction(async tx=>{for(let i=1;i<=(process.argv.includes('--rc1')?100:24);i++){const p=(await tx.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,category,sale_price,kdv_orani,module_type) VALUES($1,$2,$2,$3,'adet','Gıda',12,10,'NORMAL') RETURNING id",[fixture.tenantId,'UX-PREVIEW-'+i,i===24?'Deneme · Fotoğraf aktarım kontrolü':'Deneme · Sayım ürünü '+String(i).padStart(2,'0')])).rows[0];await tx.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)',[fixture.tenantId,warehouse.id,p.id]);}});
 }
 fs.writeFileSync(path.join(base,'preview.json'),JSON.stringify({data,email:fixture.email,cashier_email:cashier?.email,tenant:fixture.tenantId,build},null,2));
 for(const [port,mobile] of [[39766,false],[39767,true]]){
  const web=express();web.use((req,res,next)=>req.path.startsWith('/api/')||req.path==='/health'?app(req,res,next):next());
  web.use(express.static(path.join(build,'frontend'),{index:false}));
  web.get(/.*/,(req,res)=>{let html=fs.readFileSync(path.join(build,'frontend/index.html'),'utf8').replace('<head>','<head><base href="/">');if(mobile)html=html.replace('<head>','<head><script>window.veniuxMobile=true;</script>');res.type('html').send(html);});
  servers.push(web.listen(port,'127.0.0.1'));
 }
 console.log('Local fixture ready: desktop 39766, responsive mobile shell 39767. Account reference in .local/customer-experience/preview.json.');
})();
process.on('SIGINT',()=>{for(const server of servers)server.close();db.close().finally(()=>process.exit(0));});
