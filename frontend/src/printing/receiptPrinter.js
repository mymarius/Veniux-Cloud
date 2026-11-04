// Manufacturer adapters implement async print({html,width,saleId}). No device is selected implicitly.
const adapters=new Map();
export function registerPrinterAdapter(name,adapter){if(!name||typeof adapter?.print!=='function')throw Error('Yazıcı adaptörü geçersiz.');adapters.set(name,adapter);}
export function listPrinterAdapters(){return ['browser',...adapters.keys()];}
export async function printReceipt({html,width,saleId,adapter='browser'}){
 if(adapter!=='browser'){const selected=adapters.get(adapter);if(!selected)throw Error('Yazıcı adaptörü kurulu değil.');return selected.print({html,width,saleId});}
 const frame=document.createElement('iframe');frame.title='Termal satış fişi';frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;';frame.setAttribute('sandbox','allow-same-origin allow-modals');
 return new Promise((resolve,reject)=>{let cleanupTimer;const cleanup=()=>{clearTimeout(cleanupTimer);frame.remove();};frame.onload=()=>{try{frame.contentWindow.addEventListener('afterprint',()=>{cleanup();resolve({status:'dialog_closed',delivery_confirmed:false});},{once:true});frame.contentWindow.focus();frame.contentWindow.print();resolve({status:'dialog_opened',delivery_confirmed:false});cleanupTimer=setTimeout(()=>{cleanup();resolve({status:'dialog_opened',delivery_confirmed:false});},120000);}catch{cleanup();reject(Error('Yazdırma penceresi açılamadı.'));}};frame.srcdoc=html;document.body.append(frame);});
}
