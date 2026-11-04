let blocked=false;
const active=new Set();
function barrier(req,res,next){
 if((blocked||require('../config/database').isMaintenance()) && req.path.startsWith('/api/'))return res.status(503).json({error:'Yedekleme/geri yükleme için bakım sürüyor. Biraz sonra tekrar deneyin.'});
 if(req.path.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method)){active.add(req);const done=()=>active.delete(req);res.once('finish',done);res.once('close',done);}
 next();
}
async function withBarrier(req,work){
 if(blocked)throw Object.assign(Error('Başka bir bakım işlemi sürüyor.'),{status:409});blocked=true;
 try{const until=Date.now()+30000;while([...active].some(r=>r!==req)){if(Date.now()>until)throw Object.assign(Error('Devam eden işlemler tamamlanamadı; bakım başlatılmadı.'),{status:409});await new Promise(resolve=>setTimeout(resolve,25));}return await work();}finally{blocked=false;}
}
module.exports={barrier,withBarrier};
