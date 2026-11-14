export const PROFILES=[
 {id:'market',name:'Market',description:'Ürün, kasa ve günlük stok işleri',modules:['stock','pos','warehouse']},
 {id:'warehouse',name:'Depo',description:'Mal kabul, raf, transfer ve sayım',modules:['warehouse','stock']},
 {id:'medical',name:'Medikal · genel stok',description:'Ürün partileri ve depo kayıtları; ÜTS veya tıbbi mevzuat entegrasyonu içermez',modules:['stock','warehouse','crm']},
 {id:'retail',name:'Genel perakende',description:'Ürünler, satış ve müşteri ilişkileri',modules:['stock','pos','crm','warehouse']},
];
export const MODULE_LABELS={stock:'Ürün ve stok',warehouse:'Depo operasyonları',pos:'Market kasası ve etiketler',crm:'Müşteriler ve ekip'};
export const STEPS=['İşletme bilgileri','İşletme türü','Çalışma alanları','Satış ve vergi','Kullanıcılar','Ürün aktarımı','Cihazlar ve bağlantı','Yedek ve güvenlik','Kurulum özeti','Başlamaya hazır'];
export function profileActions(setup){
 const tasks={stock:[['Ürünler','/normal-depo/products']],warehouse:[['Mal kabul','/normal-depo/inbound'],['Depo sayımı','/normal-depo/counting']],pos:[['Market kasası','/magaza/kasa']],crm:[['Müşteri ilişkileri','/crm/dashboard']]};
 if(!setup)return [];
 const order=setup.profile==='market'?['pos','stock','warehouse','crm']:setup.profile==='warehouse'?['warehouse','stock','pos','crm']:['stock','warehouse','pos','crm'];
 return order.filter(id=>setup.modules.includes(id)).flatMap(id=>tasks[id]).slice(0,4);
}
const normalizeColumn=s=>String(s).toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]/g,'');
// Müşteri dosyalarında sık görülen başlıklar da tanınır (stok programlarının dışa aktarımları: "Stok Adı", "Grubu", "Birimi"...).
const aliases={name:['ürünadı','urunadi','name','ürün','productname','stokadı','stokadi','ürünismi','malzemeadı','malzemeadi','açıklama','aciklama','ürünaçıklaması','mal','malınadı'],barcode:['barkod','barcode','ean','ean13','gtin','barkodu','barkodno','barkodnumarası','barkodnumarasi'],category:['kategori','category','grubu','grup','ürüngrubu','urungrubu','anagrup','kategorisi','cinsi','tür'],unit:['birim','unit','birimi','ölçübirimi','olcubirimi','ölçü'],purchase_price:['alışfiyatı','alisfiyati','purchaseprice','alış','alis','alışfiyat','alisfiyat','maliyet','maliyetfiyatı','alışbedeli'],sale_price:['satışfiyatı','satisfiyati','saleprice','satış','satis','satışfiyat','satisfiyat','fiyat','listefiyatı','perakendefiyat','perakendesatışfiyatı'],kdv_orani:['kdvoranı','kdvorani','kdv','vat','vatrate','kdv%','kdvyüzde','kdvyuzde'],stock:['stok','stokmiktarı','stokmiktari','mevcutstok','mevcut','miktar','quantity','stock','eldekistok','bakiye']};
export function mapImportColumns(headers,fields){
 // Stok sütunu isteğe bağlıdır; bulunursa önerilir.
 return Object.fromEntries([...Object.keys(fields),'stock'].map(key=>{const matches=headers.map((h,i)=>aliases[key]?.includes(normalizeColumn(h))?i:-1).filter(i=>i>=0);return [key,matches.length===1?matches[0]:-1];}));
}
export function intakeOnlyColumns(headers){return headers.filter(h=>['lot','lotno','lotnumarası','lotnumarasi','skt','sonkullanmatarihi','expiry','expirydate'].includes(normalizeColumn(h)));}
export function errorMessage(error,fallback='İşlem tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.'){
 const status=error?.response?.status;
 return ({401:'Oturumunuz sona ermiş olabilir. Yeniden giriş yapın.',403:'Bu işlem için yönetici yetkisi gerekiyor.',409:'Kayıt başka bir ekranda değişti. Son durumu yükleyip tekrar deneyin.',413:'Dosya çok büyük. Daha küçük bir dosya seçin.',429:'Çok sık deneme yapıldı. Biraz bekleyip tekrar deneyin.',503:'Sistem bakımda veya bağlantı hazır değil. Biraz sonra tekrar deneyin.'})[status]||fallback;
}
export function moduleForPath(path){
 if(path.startsWith('/magaza/'))return 'pos';
 if(path.startsWith('/crm'))return 'crm';
 if(['/normal-depo/products','/normal-depo/movements','/normal-depo/analytics','/inventory','/suppliers','/purchase-orders'].some(p=>path===p))return 'stock';
 if(path.startsWith('/normal-depo/'))return 'warehouse';
 return null;
}
export function personalizeNavigation(groups,setup,activePath){
 if(!setup||setup.revision===0)return groups;
 const allowed=new Set(setup.modules);
 const visible=item=>!moduleForPath(item.path)||allowed.has(moduleForPath(item.path))||activePath===item.path;
 const transformed=groups.map(group=>({...group,items:group.items.filter(visible),more:(group.more||[]).filter(visible)}));
 // Market owners see checkout among primary links; warehouse workflows keep their order.
 if(setup.profile==='market'||setup.profile==='retail')for(const group of transformed){
  const pos=group.more.filter(item=>item.path==='/magaza/kasa');
  group.items=[...pos,...group.items];group.more=group.more.filter(item=>item.path!=='/magaza/kasa');
 }
 return transformed.filter(group=>group.items.length||group.more.length).sort((a,b)=>{
  if(a.id==='general'||b.id==='tools')return -1;if(b.id==='general'||a.id==='tools')return 1;
  return setup.profile==='warehouse'?(a.id==='normal-depo'?-1:b.id==='normal-depo'?1:0):0;
 });
}
