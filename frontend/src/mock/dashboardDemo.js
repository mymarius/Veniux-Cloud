// Presentation-only data; never persisted to an operational database.
export function dashboardDemo() {
  const warehouses = [{id: 'demo-1', name: 'Merkez Depo'}, {id:'demo-2',name:'Medikal Depo'}, {id:'demo-3',name:'Dağıtım Merkezi'}];
  const specs = [['Endüstriyel eldiven','İş güvenliği',420,45,100],['Koruyucu maske','Medikal',1250,12,300],['Dijital termometre','Medikal',85,320,100],['Ambalaj kolisi','Ambalaj',760,28,200],['Barkod etiketi','Sarf malzeme',2400,3,500],['Steril gazlı bez','Medikal',64,42,120],['Paketleme bandı','Ambalaj',350,24,80],['İş güvenliği gözlüğü','İş güvenliği',32,185,50]];
  const products=specs.map(([name,category,_quantity,price,min],i)=>({id:'demo-p'+i,name,category,sku:'VNX-'+String(i+1).padStart(4,'0'),purchase_price:price,min_stock_level:min}));
  const records=products.map((p,i)=>({...p,product_id:p.id,product_name:p.name,warehouse_id:warehouses[i%3].id,warehouse_name:warehouses[i%3].name,quantity:specs[i][2]}));
  const movements=Array.from({length:60},(_,i)=>{const d=new Date();d.setDate(d.getDate()-Math.floor(i/2));d.setHours(i%2?10:15,20,0,0);const p=products[i%products.length];const w=warehouses[i%3];return {id:'demo-m'+i,product_id:p.id,product_name:p.name,warehouse_name:w.name,change_amount:(i%2?-1:1)*(25+(i*17)%135),created_at:d.toISOString()};});
  return {products,records,warehouses,movements};
}
