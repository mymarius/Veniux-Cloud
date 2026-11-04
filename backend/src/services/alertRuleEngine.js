const pool = require('../config/database');
const policies = require('./settingsPolicyService');
// A tenant-scoped manual invocation and a system-wide scheduled invocation share the same atomic path.
const runAlertRuleEngine = async (tenantId = null) => pool.transaction(async client => {
  const items=(await client.query(`SELECT sr.tenant_id,sr.product_id,sr.warehouse_id,SUM(sr.quantity) AS quantity,p.min_stock_level,p.name AS product_name,w.name AS warehouse_name FROM stock_records sr JOIN products p ON p.id=sr.product_id AND p.tenant_id=sr.tenant_id JOIN warehouses w ON w.id=sr.warehouse_id AND w.tenant_id=sr.tenant_id WHERE 1=1 ${tenantId==null?'':'AND sr.tenant_id=$1'} GROUP BY sr.tenant_id,sr.product_id,sr.warehouse_id,p.min_stock_level,p.name,w.name`,tenantId==null?[]:[tenantId])).rows;
  let created=0;
  const settings=new Map();
  const preferences=async id=>{if(!settings.has(id))settings.set(id,await policies.read(id,'notifications',client));return settings.get(id);};
  for(const item of items)if((await preferences(item.tenant_id)).minStockAlert)created+=await require('./stockAlertSync').syncStockAlert(client,item);
  const lots=(await client.query(`SELECT l.*,b.warehouse_id,b.quantity FROM inventory_lots l JOIN pharmacy_depot_balances b ON b.lot_id=l.id AND b.tenant_id=l.tenant_id WHERE b.quantity>0 ${tenantId == null?'':'AND l.tenant_id=$1'}`,tenantId==null?[]:[tenantId])).rows;
  const normalLots=(await client.query(`SELECT l.*,t.warehouse_id,SUM(t.quantity) AS quantity FROM inventory_lots l JOIN products p ON p.id=l.product_id AND p.tenant_id=l.tenant_id JOIN inventory_transactions t ON t.lot_id=l.id AND t.tenant_id=l.tenant_id WHERE p.module_type='NORMAL' ${tenantId==null?'':'AND l.tenant_id=$1'} GROUP BY l.id,t.warehouse_id HAVING SUM(t.quantity)>0`,tenantId==null?[]:[tenantId])).rows;
  lots.push(...normalLots);
  const seen=new Set();
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());
  for(const lot of lots) {
    const config=await preferences(lot.tenant_id);
    const days=require('./stockHealthService').daysUntil(lot.expiry_date,today);
    if(!config.expiryRadarAlert || days===null || !Number.isFinite(days) || days>config.expiryDays) continue;
    const prefix='[lot:'+lot.id+':'+lot.warehouse_id+']';seen.add(lot.tenant_id+'|'+prefix);
    const message=prefix+' Lot '+lot.lot_number+': son kullanma tarihi '+lot.expiry_date+'. Miktar: '+lot.quantity+'.';
    const matches=(await client.query("SELECT * FROM alerts WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3 AND alert_type='expiry' AND (message LIKE $4 OR message=$5) ORDER BY id",[lot.tenant_id,lot.product_id,lot.warehouse_id,prefix+'%','Lot '+lot.lot_number+': son kullanma tarihi '+lot.expiry_date+'.'])).rows;
    const severity=days<0?'critical':'warning';
    if(matches.length){const row=matches[0];await client.query('UPDATE alerts SET severity=$1,message=$2,status=$3 WHERE id=$4',[severity,message,row.status==='resolved'||row.severity!==severity||row.message!==message?'unread':row.status,row.id]);for(const extra of matches.slice(1))await client.query("UPDATE alerts SET status='resolved' WHERE id=$1",[extra.id]);}
    else{await client.query("INSERT INTO alerts(tenant_id,product_id,warehouse_id,alert_type,severity,message,status) VALUES ($1,$2,$3,'expiry',$4,$5,'unread')",[lot.tenant_id,lot.product_id,lot.warehouse_id,severity,message]);created++;}
  }
  const old=(await client.query(`SELECT id,tenant_id,message FROM alerts WHERE alert_type='expiry' AND message LIKE '[lot:%' AND status<>'resolved' ${tenantId==null?'':'AND tenant_id=$1'}`,tenantId==null?[]:[tenantId])).rows;
  for(const row of old){const prefix=row.message.match(/^\[lot:\d+:\d+\]/)?.[0];if(!seen.has(row.tenant_id+'|'+prefix))await client.query("UPDATE alerts SET status='resolved' WHERE id=$1",[row.id]);}
  return {created,items};
});
module.exports={runAlertRuleEngine};
