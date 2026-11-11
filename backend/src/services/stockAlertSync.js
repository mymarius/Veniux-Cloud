async function syncStockAlert(tx,item){
 const rows=(await tx.query("SELECT * FROM alerts WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3 AND alert_type='low_stock' ORDER BY id",[item.tenant_id,item.product_id,item.warehouse_id])).rows;
 const active=Number(item.quantity)<=0||Number(item.min_stock_level)>0&&Number(item.quantity)<=Number(item.min_stock_level);
 if(active){try{require('./pushNotifier').lowStockChanged(item.tenant_id);}catch{}}
 if(!active){await tx.query("UPDATE alerts SET status='resolved' WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3 AND alert_type='low_stock' AND status<>'resolved'",[item.tenant_id,item.product_id,item.warehouse_id]);return 0;}
 const message=`${item.product_name}: ${item.warehouse_name} deposunda ${item.quantity} kaldı. Minimum: ${item.min_stock_level}.`,severity=Number(item.quantity)<=0?'critical':'warning';
 if(rows.length){const row=rows[0];await tx.query('UPDATE alerts SET message=$1,severity=$2,status=$3 WHERE id=$4',[message,severity,row.status==='resolved'||row.message!==message?'unread':row.status,row.id]);for(const extra of rows.slice(1))await tx.query("UPDATE alerts SET status='resolved' WHERE id=$1",[extra.id]);return 0;}
 await tx.query("INSERT INTO alerts (tenant_id,product_id,warehouse_id,alert_type,severity,message,status) VALUES ($1,$2,$3,'low_stock',$4,$5,'unread')",[item.tenant_id,item.product_id,item.warehouse_id,severity,message]);return 1;
}
async function syncWarehouseStockAlert(tx,tenant,product,warehouse){
 const preferences=await require('./settingsPolicyService').read(tenant,'notifications',tx);
 if(!preferences.minStockAlert)return 0;
 const rows=(await tx.query(`SELECT p.id AS product_id,p.tenant_id,p.name AS product_name,p.min_stock_level,w.id AS warehouse_id,w.name AS warehouse_name,COALESCE(SUM(s.quantity),0) AS quantity FROM products p JOIN warehouses w ON w.tenant_id=p.tenant_id LEFT JOIN stock_records s ON s.product_id=p.id AND s.warehouse_id=w.id AND s.tenant_id=p.tenant_id WHERE p.tenant_id=$1 AND p.id=$2 ${warehouse?'AND w.id=$3':''} GROUP BY p.id,w.id`,warehouse?[tenant,product,warehouse]:[tenant,product])).rows;
 let created=0;for(const item of rows)created+=await syncStockAlert(tx,item);return created;
}
module.exports={syncStockAlert,syncWarehouseStockAlert};
