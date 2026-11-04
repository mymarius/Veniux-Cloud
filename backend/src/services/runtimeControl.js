const crypto=require('crypto');let token=null,closing=false;
function configure(value){token=value;}
function install(app,database){
 app.use((req,res,next)=>closing?res.status(503).json({error:'Uygulama bakım için kapanıyor. Mevcut işlem sonucunu yeniden açıldıktan sonra kontrol edin.'}):next());
 app.post('/api/local-runtime/shutdown',(req,res)=>{
  const provided=req.get('x-runtime-token')||'';if(!token||!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress)||provided.length!==token.length||!crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(token)))return res.sendStatus(403);
  closing=true;res.json({status:'stopping'});setImmediate(()=>{const server=app.locals.server;if(!server)return process.exit(1);server.close(async()=>{try{await database.exclusiveMaintenance(async()=>{if(database.getEngine()==='sqlite')database.getDb().pragma('wal_checkpoint(TRUNCATE)');});await database.close();process.exit(0);}catch{process.exit(1);}});server.closeIdleConnections();});
 });
}
function assertManagedStart(){if(process.env.NODE_ENV==='production'&&!token)throw Error('Üretim API için Start-Production.ps1 başlatıcısını kullanın.');}
module.exports={assertManagedStart,configure,install};
