const db=require('../../config/database');
const {fetchSafely}=require('./safeDownload');
const repo=require('./medicineRepository');
const HOST='webcrm.polifarma.com.tr';
const base=`https://${HOST}/products/`;
function productName(value){
 return String(value).replace(/(\d),(\d)/g,'$1.$2').split(',')[0].toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i')
  .replace(/\bpolifleks\b/g,'').replace(/\bi\s*\.\s*v\s*\.?/g,'iv').replace(/\bi\s*\.\s*m\s*\.?/g,'im')
  .replace(/[^a-z0-9%./]+/g,' ').replace(/%\s+/g,'%').replace(/\s+/g,' ').trim();
}
function matchProduct(medicine,products){
 if(!productName(medicine.company||medicine.manufacturer||'').includes('polifarma'))return null;
 const name=productName(medicine.name);
 const matches=products.filter(p=>productName(p.name)===name);
 return matches.length===1?matches[0]:null;
}
async function getProducts(){
 const products=[];
 for(let offset=0;offset<1000;offset+=100){
  const {buffer}=await fetchSafely(`${base}api/products.php?limit=100&offset=${offset}`,{allowedHosts:[HOST],maxBytes:8*1024*1024,timeoutMs:20000});
  const response=JSON.parse(buffer.toString('utf8'));
  if(!response.success||!Array.isArray(response.data))throw new Error('Üretici ürün listesi alınamadı.');
  products.push(...response.data);
  if(!response.pagination?.has_more)break;
 }
 return products;
}
async function sync({dryRun=false}={}){
 const products=await getProducts();
 const medicines=(await db.query("SELECT * FROM medicines WHERE image_url IS NULL AND image_local_path IS NULL")).rows;
 const changes=[];
 for(const medicine of medicines){
  const product=matchProduct(medicine,products);
  const image=product?.custom_fields?.['Ürün Görseli']?.value?.find(v=>v.language_code==='tr'&&!v.is_fallback);
  if(!image||!/^images\/[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp)$/i.test(image.file_path))continue;
  changes.push({id:medicine.id,barcode:medicine.barcode,name:medicine.name,product:product.name,url:base+'uploads/'+image.file_path});
 }
 // Probe every distinct image before assigning it. No invented URLs or placeholder photos.
 const accessible=new Set();
 const urls=[...new Set(changes.map(c=>c.url))];
 for(let index=0;index<urls.length;index+=3)await Promise.all(urls.slice(index,index+3).map(async url=>{
  try{
   const {buffer}=await fetchSafely(url,{allowedHosts:[HOST,'www.polifarma.com.tr'],maxBytes:2*1024*1024,timeoutMs:10000,accept:'image/*'});
   if(require('./medicineImageService').detectType(buffer))accessible.add(url);
  }catch{}
 }));
 const matched=changes.filter(c=>accessible.has(c.url));
 if(!dryRun)await db.transaction(async client=>{
  for(const change of matched){
   const current=await repo.findById(change.id,client);
   if(current.image_url||current.image_local_path)continue;
   await repo.update(change.id,{image_url:change.url,image_source:'manufacturer',image_verified:0},client);
  }
 });
 return {provider:'Polifarma resmi ürün kataloğu',updated:dryRun?0:matched.length,matched:matched.length,remaining:medicines.length-matched.length,sample:matched.slice(0,10)};
}
let running=false,lastResult=null,lastError=null;
async function run(){
 if(running)throw Object.assign(new Error('Görsel eşleştirme zaten çalışıyor.'),{status:409});
 running=true;lastError=null;
 try{lastResult=await sync();return lastResult;}catch(e){lastError=e.message;throw e;}finally{running=false;}
}
module.exports={sync,run,productName,matchProduct,status:()=>({running,lastResult,lastError})};
