const db = require('../config/database');
const { snapshot } = require('./aiSnapshotService');

// Explicit projections keep credentials and personal contact details out of model context.
async function businessContext(tenant) {
  const inventory = await snapshot(tenant);
  const rows = async sql => (await db.query(sql, [tenant])).rows;
  const company = await rows('SELECT company_name FROM tenants WHERE id=$1');
  const totals = await rows(`SELECT COUNT(*) AS product_count,
    COALESCE(SUM(q.quantity),0) AS stock_units,
    COALESCE(SUM(q.quantity*p.purchase_price),0) AS stock_cost,
    COALESCE(SUM(q.quantity*p.sale_price),0) AS stock_sale_value
    FROM products p LEFT JOIN
    (SELECT product_id,SUM(quantity) quantity FROM stock_records WHERE tenant_id=$1 GROUP BY product_id) q
    ON q.product_id=p.id WHERE p.tenant_id=$1`);
  const suppliers = await rows('SELECT id,name,lead_time_days FROM suppliers WHERE tenant_id=$1 ORDER BY id DESC LIMIT 50');
  const warehouses = await rows('SELECT id,name,type,capacity FROM warehouses WHERE tenant_id=$1 ORDER BY id DESC LIMIT 50');
  const purchaseOrders = await rows('SELECT order_no,supplier_id,target_warehouse_id,status,total_amount,created_at FROM purchase_orders WHERE tenant_id=$1 ORDER BY id DESC LIMIT 50');
  const alerts = await rows('SELECT severity,message,status,created_at FROM alerts WHERE tenant_id=$1 ORDER BY id DESC LIMIT 30');
  const counts = await rows('SELECT count_no,warehouse_id,status,created_at,completed_at FROM stock_counts WHERE tenant_id=$1 ORDER BY id DESC LIMIT 20');
  const workspaces = await rows("SELECT scope,payload FROM workspace_collections WHERE tenant_id=$1 AND name='workspace'");
  const workspaceSummary = {};
  for (const row of workspaces) {
    const data = JSON.parse(row.payload);
    workspaceSummary[row.scope] = Object.fromEntries(Object.entries(data).filter(([,value])=>Array.isArray(value)).map(([key,value])=>[key,{count:value.length}]));
  }
  return { ...inventory, company:company[0], totals:totals[0], suppliers, warehouses,
    purchase_orders:purchaseOrders, alerts, stock_counts:counts, workspace_summary:workspaceSummary,
    limits:{...inventory.limits,suppliers:50,warehouses:50,purchase_orders:50,alerts:30,stock_counts:20},
    definitions:{stock_cost:'Mevcut stok alış değeri; gider veya gerçekleşmiş satış kârı değildir.',stock_sale_value:'Mevcut stok etiket satış değeri; ciro değildir.',workspace_summary:'CRM ve personel koleksiyonlarının yalnızca kayıt sayıları.'},
    navigation:{products:'/normal-depo/products',phone_or_terminal_receiving:'/magaza/hizli-ekle',purchases:'/purchase-orders',suppliers:'/suppliers',alerts:'/alerts',crm:'/crm',settings:'/settings'},
    unavailable:['Gerçekleşmiş kasa satışları ve net kâr','Müşteri alışveriş hesabı ve müşteri sipariş takibi','Kayıt dışı bilgiler'] };
}
module.exports = { businessContext };
