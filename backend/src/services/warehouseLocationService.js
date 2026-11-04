const pool = require('../config/database');
const inventoryTransactionService = require('./inventoryTransactionService');

class WarehouseLocationService {
  async getTransferOptions(tenant,warehouse){
    return pool.transaction(async tx=>{
      if(!(await tx.query('SELECT id FROM warehouses WHERE tenant_id=$1 AND id=$2',[tenant,warehouse])).rows.length)throw new Error('Depo bulunamadı.');
      const bins=(await tx.query('SELECT b.*,l.location_code,l.is_locked,p.name AS product_name,p.sku,p.barcode,p.unit,lot.lot_number,lot.expiry_date FROM product_bin_records b JOIN warehouse_locations l ON l.id=b.location_id AND l.tenant_id=b.tenant_id JOIN products p ON p.id=b.product_id AND p.tenant_id=b.tenant_id LEFT JOIN inventory_lots lot ON lot.id=b.lot_id AND lot.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND l.warehouse_id=$2 AND b.quantity>0',[tenant,warehouse])).rows;
      const lots=(await tx.query('SELECT t.product_id,t.lot_id,SUM(t.quantity) AS quantity,p.name AS product_name,p.sku,p.barcode,p.unit,l.lot_number,l.expiry_date FROM inventory_transactions t JOIN inventory_lots l ON l.id=t.lot_id AND l.tenant_id=t.tenant_id JOIN products p ON p.id=t.product_id AND p.tenant_id=t.tenant_id WHERE t.tenant_id=$1 AND t.warehouse_id=$2 GROUP BY t.product_id,t.lot_id,p.name,p.sku,p.barcode,p.unit,l.lot_number,l.expiry_date HAVING SUM(t.quantity)>0',[tenant,warehouse])).rows;
      const totals=(await tx.query('SELECT s.product_id,SUM(s.quantity) AS quantity,p.name AS product_name,p.sku,p.barcode,p.unit FROM stock_records s JOIN products p ON p.id=s.product_id AND p.tenant_id=s.tenant_id WHERE s.tenant_id=$1 AND s.warehouse_id=$2 GROUP BY s.product_id,p.name,p.sku,p.barcode,p.unit',[tenant,warehouse])).rows;
      const held=(await tx.query('SELECT product_id,lot_id,location_id,SUM(quantity) AS quantity FROM inventory_return_holds WHERE tenant_id=$1 AND warehouse_id=$2 GROUP BY product_id,lot_id,location_id',[tenant,warehouse])).rows;
      const heldQty=r=>held.filter(h=>h.product_id===r.product_id&&(h.lot_id??null)===(r.lot_id??null)&&(h.location_id??null)===(r.source_location_id??null)).reduce((s,h)=>s+Number(h.quantity),0);
      const options=bins.map(b=>({...b,key:'bin:'+b.id,warehouse_id:Number(warehouse),source_location_id:b.location_id,quantity:Number(b.quantity),available_quantity:b.is_locked?0:Math.max(0,Number(b.quantity)-Number(b.reserved_qty||0)-heldQty({...b,source_location_id:b.location_id}))}));
      for(const l of lots){const q=Number((Number(l.quantity)-bins.filter(b=>b.product_id===l.product_id&&b.lot_id===l.lot_id).reduce((s,b)=>s+Number(b.quantity),0)).toFixed(6));if(q>0){const r={...l,key:'loose:'+l.product_id+':'+l.lot_id,warehouse_id:Number(warehouse),source_location_id:null,quantity:q};options.push({...r,available_quantity:Math.max(0,q-heldQty(r))});}}
      for(const p of totals){const q=Number((Number(p.quantity)-lots.filter(l=>l.product_id===p.product_id).reduce((s,l)=>s+Number(l.quantity),0)-bins.filter(b=>b.product_id===p.product_id&&b.lot_id==null).reduce((s,b)=>s+Number(b.quantity),0)).toFixed(6));if(q>0){const r={...p,key:'loose:'+p.product_id+':none',warehouse_id:Number(warehouse),source_location_id:null,lot_id:null,quantity:q};options.push({...r,available_quantity:Math.max(0,q-heldQty(r))});}}
      return options;
    });
  }
  /**
   * List all locations for a warehouse with occupancy statistics
   */
  async getLocations(warehouseId, filters = {}) {
    let query = `
      SELECT loc.*,
             COALESCE(SUM(pbr.quantity), 0) as total_stored_qty,
             COALESCE(COUNT(DISTINCT pbr.product_id), 0) as unique_product_count,
             COALESCE(SUM(pbr.reserved_qty), 0) as total_reserved_qty
      FROM warehouse_locations loc
      LEFT JOIN product_bin_records pbr ON loc.id = pbr.location_id
      WHERE loc.warehouse_id = $1
    `;
    const params = [warehouseId];

    if (filters.zone_name) {
      params.push(filters.zone_name);
      query += ` AND loc.zone_name = $${params.length}`;
    }
    if (filters.aisle_code) {
      params.push(filters.aisle_code);
      query += ` AND loc.aisle_code = $${params.length}`;
    }
    if (filters.location_type) {
      params.push(filters.location_type);
      query += ` AND loc.location_type = $${params.length}`;
    }

    query += ' GROUP BY loc.id ORDER BY loc.aisle_code ASC, loc.rack_number ASC, loc.shelf_tier ASC, loc.bin_position ASC';

    const result = await pool.query(query, params);

    // Compute occupancy percentage for each bin
    return result.rows.map(loc => {
      const maxWeight = loc.max_weight_kg || 500;
      const stored = parseFloat(loc.total_stored_qty) || 0;
      const occupancyRate = Math.min(100, Math.round((stored / (maxWeight > 0 ? maxWeight : 100)) * 100));

      return {
        ...loc,
        occupancy_rate: occupancyRate,
        is_empty: stored === 0,
        is_full: occupancyRate >= 95
      };
    });
  }

  /**
   * Get single location details with products, lots, and UOM details
   */
  async getLocationById(id,tenantId) {
    const locRes = await pool.query('SELECT * FROM warehouse_locations WHERE id = $1 AND tenant_id=$2', [id,tenantId]);
    if (locRes.rows.length === 0) return null;
    const location = locRes.rows[0];

    const inventoryRes = await pool.query(`
      SELECT pbr.*, p.name as product_name, p.sku, p.barcode, p.unit, p.sale_price,
             lot.lot_number, lot.expiry_date, lot.status as lot_status,
             (pbr.quantity - pbr.reserved_qty) as available_qty
      FROM product_bin_records pbr
      JOIN products p ON pbr.product_id = p.id
      LEFT JOIN inventory_lots lot ON pbr.lot_id = lot.id
      WHERE pbr.location_id = $1 AND pbr.tenant_id = $2 AND pbr.quantity > 0
      ORDER BY p.name ASC
    `, [id, tenantId]);

    const husRes = await pool.query(`
      SELECT * FROM handling_units 
      WHERE current_location_id = $1 AND tenant_id = $2
    `, [id, tenantId]);

    return {
      ...location,
      inventory: inventoryRes.rows,
      handling_units: husRes.rows
    };
  }

  /**
   * Generate entire Aisle grid automatically (e.g., Aisle A, 5 racks, 4 tiers, 4 bins = 80 bins)
   */
  async generateAisleGrid(data, tenantId) {
    const {
      warehouse_id,
      aisle_code,
      zone_name = 'General',
      rack_count = 5,
      tier_count = 3,
      bin_count = 3,
      x_start = 10,
      y_start = 0,
      max_weight_kg = 500
    } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const createdLocations = [];
      const cleanAisle = (aisle_code || 'A').toUpperCase().trim();

      for (let r = 1; r <= parseInt(rack_count, 10); r++) {
        for (let t = 1; t <= parseInt(tier_count, 10); t++) {
          for (let b = 1; b <= parseInt(bin_count, 10); b++) {
            const locCode = `T${tenantId}-${cleanAisle}-${String(r).padStart(2, '0')}-${String(t).padStart(2, '0')}-${String(b).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
            const posX = x_start + (r - 1) * 35;
            const posY = y_start + (t - 1) * 20;

            const res = await client.query(`
              INSERT INTO warehouse_locations (
                tenant_id, warehouse_id, location_code, zone_name, aisle_code, rack_number,
                shelf_tier, bin_position, location_type, x_coord, y_coord, max_weight_kg, is_locked
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'storage', $9, $10, $11, 0)
              ON CONFLICT(location_code) DO NOTHING
              RETURNING *
            `, [tenantId, warehouse_id, locCode, zone_name, cleanAisle, r, t, b, posX, posY, max_weight_kg]);

            if (res.rows.length > 0) {
              createdLocations.push(res.rows[0]);
            }
          }
        }
      }

      await client.query('COMMIT');
      return createdLocations;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Relocate Stock (Bin-to-Bin internal transfer with security checks)
   */
  async relocateStock(tenantId,data){
    const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
    const warehouse=Number(data.warehouse_id),targetWarehouse=Number(data.target_warehouse_id||warehouse),product=Number(data.product_id),lot=data.lot_id==null||data.lot_id===''?null:Number(data.lot_id),source=data.source_location_id?Number(data.source_location_id):null,target=data.target_location_id?Number(data.target_location_id):null,qty=Number(data.quantity);
    if([warehouse,targetWarehouse,product].some(x=>!Number.isSafeInteger(x)||x<1)||!Number.isFinite(qty)||qty<=0||qty>1000000||Math.abs(qty*1e6-Math.round(qty*1e6))>0.001)fail('Geçerli depo, ürün ve miktar gereklidir.');
    if(warehouse===targetWarehouse&&source===target)fail('Kaynak ve hedef aynı olamaz.');
    const body={warehouse_id:warehouse,target_warehouse_id:targetWarehouse,source_location_id:source,target_location_id:target,product_id:product,lot_id:lot,quantity:qty,notes:data.notes||'',actor:data.user_id};
    const retail=require('./retailDailyService');
    return pool.transaction(async client=>{await retail.lock(client,tenantId);return retail.idempotent(client,tenantId,data.operation_key,'wms-transfer',body,async()=>{
      for(const [table,id,wh] of [['warehouses',warehouse,null],['warehouses',targetWarehouse,null],['products',product,null],['inventory_lots',lot,null],['warehouse_locations',source,warehouse],['warehouse_locations',target,targetWarehouse]]){if(id==null)continue;const row=(await client.query(`SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2`,[id,tenantId])).rows[0];if(!row)fail('Transfer kaydı bulunamadı.',404);if(wh&&Number(row.warehouse_id)!==wh)fail('Raf seçilen depoya ait değil.');if(table==='inventory_lots'&&Number(row.product_id)!==product)fail('Lot seçilen ürüne ait değil.');if(table==='warehouse_locations'&&row.is_locked)fail('Kaynak veya hedef lokasyon kilitlidir.');}
      let available=0;
      const holds=Number((await client.query('SELECT COALESCE(SUM(quantity),0) AS q FROM inventory_return_holds WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3 AND (lot_id=$4 OR (lot_id IS NULL AND $4 IS NULL)) AND (location_id=$5 OR (location_id IS NULL AND $5 IS NULL))',[tenantId,product,warehouse,lot,source])).rows[0].q);
      if(source){const bins=(await client.query('SELECT * FROM product_bin_records WHERE tenant_id=$1 AND location_id=$2 AND product_id=$3 AND (lot_id=$4 OR (lot_id IS NULL AND $4 IS NULL))',[tenantId,source,product,lot])).rows;if(bins.length>1)fail('Ürün/lot/raf için mükerrer kayıt var.',409);available=Number(bins[0]?.quantity||0)-Number(bins[0]?.reserved_qty||0)-holds;}
      else{const lots=await require('./stockHealthService').lotAvailability(tenantId,product,warehouse,client),binned=Number((await client.query('SELECT COALESCE(SUM(b.quantity),0) AS q FROM product_bin_records b JOIN warehouse_locations l ON l.id=b.location_id AND l.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND b.product_id=$2 AND l.warehouse_id=$3 AND (b.lot_id=$4 OR (b.lot_id IS NULL AND $4 IS NULL))',[tenantId,product,warehouse,lot])).rows[0].q);const total=Number((await client.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3',[tenantId,product,warehouse])).rows[0].q);available=(lot?Number(lots.find(l=>l.id===lot)?.quantity||0):total-lots.reduce((s,l)=>s+l.quantity,0))-binned-holds;}
      if(available+0.000001<qty)fail('Seçilen lot/lokasyonda serbest stok yetersiz; raflı, rezerve veya karantina stoğu dahil edilmez.',409);
      const ref='RELOC-'+require('crypto').randomUUID();
      const out=await inventoryTransactionService.recordTransaction({tenant_id:tenantId,warehouse_id:warehouse,location_id:source,product_id:product,lot_id:lot,transaction_type:'TRANSFER_OUT',quantity:-qty,reference_type:'RELOCATION',reference_id:ref,user_id:data.user_id,notes:data.notes||'Lotlu transfer çıkışı'},client);
      const incoming=await inventoryTransactionService.recordTransaction({tenant_id:tenantId,warehouse_id:targetWarehouse,location_id:target,product_id:product,lot_id:lot,transaction_type:'TRANSFER_IN',quantity:qty,reference_type:'RELOCATION',reference_id:ref,user_id:data.user_id,notes:data.notes||'Lotlu transfer girişi'},client);
      await client.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,target_warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,$5,'transfer','wms_transfer',$6)",[tenantId,product,warehouse,targetWarehouse,-qty,ref]);
      const lotInfo=lot?(await client.query('SELECT lot_number,expiry_date FROM inventory_lots WHERE tenant_id=$1 AND id=$2',[tenantId,lot])).rows[0]:null;
      const result={success:true,transfer_ref:ref,lot_id:lot,...lotInfo,quantity:qty,source_transaction:out,transaction:incoming};
      await client.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,'wms.transfer','inventory_transfer',$3)",[tenantId,data.user_email||null,JSON.stringify({...body,...result})]);return result;
    });});
  }

  /**
   * Lock / Unlock location
   */
  async toggleLockLocation(id, isLocked, reason = null, tenantId) {
    const query = `
      UPDATE warehouse_locations 
      SET is_locked = $1, lock_reason = $2
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [isLocked ? 1 : 0, reason, id, tenantId]);
    return result.rows[0];
  }
}

module.exports = new WarehouseLocationService();
