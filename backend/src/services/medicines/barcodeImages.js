const {fetchSafely}=require('./safeDownload');
const repo=require('./medicineRepository');
const {detectType}=require('./medicineImageService');
const HOST='www.ilacdepo.com.tr';
const missing=new Map(),pending=new Map();
let active=0;const queue=[];
async function slot(){if(active>=4){await new Promise(resolve=>queue.push(resolve));return;}active++;}
function release(){const next=queue.shift();if(next)next();else active--;}
async function lookup(medicine){
 if(process.env.NODE_ENV==='test'&&process.env.TEST_MEDICINE_IMAGE_LOOKUP!=='1')return null;
 if(!/^\d{13}$/.test(medicine.barcode))return null;
 if(missing.get(medicine.barcode)>Date.now())return null;
 if(pending.has(medicine.barcode))return pending.get(medicine.barcode);
 const promise=(async()=>{
  await slot();
  try{
   for(const ext of ['jpg','png','webp']){
    const url=`https://${HOST}/assets/urun/${medicine.barcode}.${ext}`;
    try{
     const {buffer}=await fetchSafely(url,{allowedHosts:[HOST],maxBytes:2*1024*1024,timeoutMs:4000,accept:'image/*',retries:0});
     if(!detectType(buffer))continue;
     // The URL names the exact barcode. Keep it unverified until the package is reviewed.
     const db=require('../../config/database');
     await db.query("UPDATE medicines SET image_url=$1,image_source='provider',image_verified=0,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND image_url IS NULL AND image_local_path IS NULL",[url,medicine.id]);
     const current=await repo.findById(medicine.id);
     return current?.image_url||url;
    }catch{}
   }
   if(missing.size>30000)missing.clear();
   missing.set(medicine.barcode,Date.now()+86400000);return null;
  }finally{release();}
 })();
 pending.set(medicine.barcode,promise);
 try{return await promise;}finally{pending.delete(medicine.barcode);}
}
module.exports={lookup};
