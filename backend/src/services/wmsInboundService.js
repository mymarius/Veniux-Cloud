const pool = require('../config/database');
const inventoryTransactionService = require('./inventoryTransactionService');
const wmsEventService = require('./wmsEventService');
const crypto=require('crypto');
async function operation(client,data,scope){
  if(!data.operation_key)return null;
  if(typeof data.operation_key!=='string'||!data.operation_key.trim()||data.operation_key.length>120)throw new Error('Geçersiz işlem anahtarı.');
  const key='wms-inbound:'+scope+':'+data.operation_key;
  const payload={...data};delete payload.operation_key;delete payload.user_email;delete payload.received_by;delete payload.user_id;delete payload.device_id;
  const hash=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const old=(await client.query('SELECT * FROM depot_operation_keys WHERE tenant_id=$1 AND operation_key=$2',[data.tenant_id,key])).rows[0];
  if(old&&old.request_hash!==hash)throw Object.assign(Error('İşlem anahtarı farklı bilgilerle kullanılmış.'),{status:409});
  return {key,hash,old:old?JSON.parse(old.result_json):null};
}
async function saveOperation(client,data,op,result){if(op)await client.query('INSERT INTO depot_operation_keys (tenant_id,operation_key,request_hash,result_json) VALUES ($1,$2,$3,$4)',[data.tenant_id,op.key,op.hash,JSON.stringify(result)]);}
async function auditInbound(client,data,action,id,details){const uid=data.user_id||data.received_by;const user=uid?(await client.query('SELECT email FROM users WHERE id=$1 AND tenant_id=$2',[uid,data.tenant_id])).rows[0]:null;await client.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,'inbound',$4,$5)",[data.tenant_id,user?.email||'system',action,String(id),JSON.stringify({user_id:uid||null,...details})]);}

class WMSInboundService {
  /**
   * Create an Inbound Receipt document
   */
  async createReceipt(data, externalClient = null) {
    const client = externalClient || await pool.connect();
    try {
      if (!externalClient) await client.query('BEGIN');
      const op=await operation(client,data,'create');
      if(op?.old){if(!externalClient)await client.query('COMMIT');return op.old;}

      const {
        warehouse_id,
        supplier_id = null,
        waybill_no = null,
        appointment_id = null,
        items: rawItems = [],
        received_by = null
, tenant_id } = data;
      const items=Array.isArray(rawItems)?rawItems.map(i=>({...i})):rawItems;

      if (!warehouse_id) {
        throw new Error('warehouse_id zorunludur.');
      }
      if(!(await client.query('SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2',[warehouse_id,tenant_id])).rows.length)throw new Error('Depo bulunamadı.');
      if(supplier_id&&!(await client.query('SELECT id FROM suppliers WHERE id=$1 AND tenant_id=$2',[supplier_id,tenant_id])).rows.length)throw new Error('Tedarikçi bulunamadı.');
      if(data.purchase_order_id&&!externalClient)throw new Error('Sipariş kabulünü satın alma ekranından yapın.');
      if(waybill_no!=null&&(typeof waybill_no!=='string'||waybill_no.length>160||/[\x00-\x1f]/.test(waybill_no)))throw new Error('İrsaliye numarası geçersiz.');
      if(waybill_no&&(await client.query('SELECT id FROM wms_inbound_receipts WHERE tenant_id=$1 AND (supplier_id=$2 OR (supplier_id IS NULL AND $2 IS NULL)) AND waybill_no=$3',[tenant_id,supplier_id,String(waybill_no).trim()])).rows.length)throw Object.assign(Error('Bu teslimat numarası zaten kayıtlı. Mevcut mal kabul belgesini kullanın.'),{status:409});
      if(!Array.isArray(items)||!items.length)throw new Error('Mal kabul kalemleri gerekli.');
      for(const item of items){
        const product=(await client.query('SELECT id,purchase_price_tax_basis,kdv_orani FROM products WHERE id=$1 AND tenant_id=$2',[item.product_id,tenant_id])).rows[0];
        if(!product)throw new Error('Ürün bulunamadı.');
        item.purchase_price_tax_basis=item.purchase_price_tax_basis??product.purchase_price_tax_basis;
        item.purchase_vat_rate=item.purchase_vat_rate??product.kdv_orani;
        if(item.purchase_price_tax_basis!=null&&!['exclusive','inclusive'].includes(item.purchase_price_tax_basis))throw new Error('Alış fiyatı KDV temeli geçersiz.');
        if(item.purchase_price_tax_basis!=null&&!require('./retailCostService').vatValid(item.purchase_vat_rate))throw new Error('Alış KDV oranı geçersiz.');
        if(!Number.isFinite(Number(item.expected_qty))||Number(item.expected_qty)<=0)throw new Error('Miktar pozitif olmalıdır.');
        if(item.expiry_date&&(!item.lot_number||!Number.isFinite(require('./stockHealthService').daysUntil(item.expiry_date))))throw new Error('Geçerli son kullanma tarihi ve lot numarası gerekli.');
        if(item.unit_purchase_price!=null&&(!['number','string'].includes(typeof item.unit_purchase_price)||String(item.unit_purchase_price).trim()===''||!Number.isFinite(Number(item.unit_purchase_price))||Number(item.unit_purchase_price)<0||Number(item.unit_purchase_price)>1000000||Math.abs(Number(item.unit_purchase_price)*100-Math.round(Number(item.unit_purchase_price)*100))>0.00001))throw new Error('Alış fiyatı en fazla iki ondalık basamak olabilir.');
      }

      const year = new Date().getFullYear();
      // Visible row counts vary by access scope and cannot be document counters.
      const receiptNo = `INB-${year}-${crypto.randomUUID()}`;

      let totalExpected = 0;
      items.forEach(i => { totalExpected += (parseFloat(i.expected_qty) || 0); });

      const receiptRes = await client.query(`
        INSERT INTO wms_inbound_receipts (
          tenant_id, receipt_no, warehouse_id, supplier_id, waybill_no, appointment_id,
          status, total_expected_qty, total_received_qty, received_by
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 0, $8)
        RETURNING *
      `, [tenant_id, receiptNo, warehouse_id, supplier_id,waybill_no?waybill_no.trim():null, appointment_id, totalExpected, received_by]);

      const receipt = receiptRes.rows[0];

      // Insert Inbound Items with suggested putaway bins
      for (const item of items) {
        // Smart Putaway Suggestion: find an empty or compatible bin in General / Fast Pick
        const suggestedBinRes = await client.query(`
          SELECT loc.id FROM warehouse_locations loc
          LEFT JOIN product_bin_records pbr ON loc.id = pbr.location_id
          WHERE loc.warehouse_id = $1 AND loc.is_locked = 0 AND loc.location_type IN ('storage', 'pick_face')
          GROUP BY loc.id
          ORDER BY COALESCE(SUM(pbr.quantity), 0) ASC
          LIMIT 1
        `, [warehouse_id]);

        const targetLocId = suggestedBinRes.rows[0]?.id || null;

        await client.query(`
          INSERT INTO wms_inbound_items (
            tenant_id, receipt_id, product_id, lot_number, expiry_date, expected_qty, target_location_id, status, unit_purchase_price,purchase_price_tax_basis,purchase_vat_rate
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8,$9,$10)
        `, [tenant_id, receipt.id, item.product_id, item.lot_number || null, item.expiry_date || null, item.expected_qty, targetLocId,item.unit_purchase_price==null?null:Number(item.unit_purchase_price),item.purchase_price_tax_basis,item.purchase_price_tax_basis==null?null:Number(item.purchase_vat_rate)]);
      }

      if(data.purchase_order_id)await client.query('UPDATE wms_inbound_receipts SET purchase_order_id=$1 WHERE id=$2',[data.purchase_order_id,receipt.id]);
      const result=await this.getReceiptById(receipt.id,tenant_id,client);
      await saveOperation(client,data,op,result);
      await auditInbound(client,data,'wms.inbound.create',receipt.id,{receipt_no:receipt.receipt_no,items:result.items});
      if (!externalClient) { await client.query('COMMIT'); wmsEventService.emit('inbound.created', { receipt_id: receipt.id, receipt_no: receiptNo }); }
      return result;
    } catch (err) {
      if (!externalClient) await client.query('ROLLBACK');
      throw err;
    } finally {
      if (!externalClient) client.release();
    }
  }

  /**
   * Complete Putaway: Move accepted item to actual bin location (Duplicate Safe)
   */
  async completePutaway(data, externalClient = null) {
    const {
      tenant_id,
      receipt_id,
      item_id,
      actual_location_id,
      quantity,
      user_id = null,
      device_id = null
    } = data;

    const client = externalClient || await pool.connect();
    try {
      if (!externalClient) await client.query('BEGIN');
      const op=await operation(client,data,'putaway');
      if(op?.old){if(!externalClient)await client.query('COMMIT');return op.old;}

      const itemRes = await client.query('SELECT * FROM wms_inbound_items WHERE id = $1 AND tenant_id=$2 AND receipt_id=$3', [item_id,tenant_id,receipt_id]);
      if (itemRes.rows.length === 0) throw new Error('Mal kabul kalemi bulunamadı');
      const item = itemRes.rows[0];

      // 1. SECURITY: Prevent duplicate putaway on already completed items
      if (item.status === 'completed') {
        throw new Error('Bu mal kabul kalemi zaten depoya yerleştirilmiş.');
      }

      const receiptRes = await client.query('SELECT * FROM wms_inbound_receipts WHERE id = $1 AND tenant_id=$2', [item.receipt_id,tenant_id]);
      if (receiptRes.rows.length === 0) throw new Error('İlgili mal kabul belgesi bulunamadı');
      const receipt = receiptRes.rows[0];
      if(receipt.purchase_order_id&&!externalClient)throw new Error('Sipariş kabulünü satın alma ekranından yapın.');

      // 2. SECURITY: Verify target location belongs to the same warehouse and is not locked
      if (actual_location_id) {
        const locCheck = await client.query(
          'SELECT * FROM warehouse_locations WHERE id = $1 AND warehouse_id = $2',
          [actual_location_id, receipt.warehouse_id]
        );
        if (locCheck.rows.length === 0) {
          throw new Error('Hedef lokasyon bu depoya ait değil veya bulunamadı.');
        }
        if (locCheck.rows[0].is_locked) {
          throw new Error(`Hedef lokasyon kilitlidir: ${locCheck.rows[0].lock_reason || 'Kilitli'}`);
        }
      }

      const qtyToStore = Number(quantity??item.expected_qty);
      if(!Number.isFinite(qtyToStore)||qtyToStore<=0||qtyToStore>Number(item.expected_qty))throw new Error('Kabul miktarı beklenen miktarı aşamaz ve pozitif olmalıdır.');

      // Handle Lot registration if provided
      let lotId = null;
      if (item.lot_number) {
        const prior=(await client.query('SELECT expiry_date FROM inventory_lots WHERE tenant_id=$1 AND product_id=$2 AND lot_number=$3',[tenant_id,item.product_id,item.lot_number])).rows[0];
        if(prior&&String(prior.expiry_date||'').slice(0,10)!==String(item.expiry_date||'').slice(0,10))throw new Error('Aynı lot için farklı son kullanma tarihi girilemez. Lot kaydını doğrulayın.');
        const lotRes = await client.query(`
          INSERT INTO inventory_lots (tenant_id, product_id, lot_number, expiry_date, supplier_id, status, qa_status)
          VALUES ($1, $2, $3, $4, $5, 'available', 'approved')
          ON CONFLICT(product_id, lot_number) DO UPDATE SET expiry_date = COALESCE(EXCLUDED.expiry_date, inventory_lots.expiry_date)
          RETURNING id
        `, [tenant_id, item.product_id, item.lot_number, item.expiry_date, receipt.supplier_id]);
        lotId = lotRes.rows[0]?.id || null;
      }

      // Execute Ledger Transaction (RECEIVE + PUTAWAY)
      await inventoryTransactionService.recordTransaction({ tenant_id, 
        warehouse_id: receipt.warehouse_id,
        location_id: actual_location_id,
        product_id: item.product_id,
        lot_id: lotId,
        transaction_type: 'PUTAWAY',
        quantity: qtyToStore,
        reference_type: 'INBOUND_RECEIPT',
        reference_id: receipt.receipt_no,
        user_id,
        device_id,
        notes: `Mal kabul raf yerleştirme (İrsaliye: ${receipt.waybill_no || '-'})`
      }, client);
      await client.query('UPDATE wms_inbound_items SET lot_id=$1 WHERE id=$2 AND tenant_id=$3',[lotId,item_id,tenant_id]);
      if(item.unit_purchase_price!=null) {
        // Preserve the receipt's tax basis when updating the catalog price. A
        // different purchase VAT rate cannot be inferred from the sale VAT field.
        await client.query(`UPDATE products SET purchase_price=$1,
          purchase_price_tax_basis=CASE WHEN kdv_orani=$2 THEN $3 ELSE NULL END
          WHERE id=$4 AND tenant_id=$5`,[item.unit_purchase_price,item.purchase_vat_rate,item.purchase_price_tax_basis,item.product_id,tenant_id]);
      }

      // Update inbound item status
      await client.query(`
        UPDATE wms_inbound_items
        SET actual_location_id = $1, received_qty = $2, status = 'completed'
        WHERE id = $3
      `, [actual_location_id, qtyToStore, item_id]);

      // Update receipt overall totals
      await client.query(`
        UPDATE wms_inbound_receipts
        SET total_received_qty = total_received_qty + $1,
            status = CASE 
              WHEN (SELECT COUNT(*) FROM wms_inbound_items WHERE receipt_id = $2 AND status != 'completed') = 0 THEN 'stored'
              ELSE 'receiving'
            END,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [qtyToStore, receipt.id]);

      const result={ success: true, receipt_id: receipt.id, stored_qty: qtyToStore };
      await saveOperation(client,data,op,result);
      await auditInbound(client,data,'wms.inbound.putaway',receipt.id,{item_id,lot_id:lotId,location_id:actual_location_id,quantity:qtyToStore,unit_purchase_price:item.unit_purchase_price});
      if (!externalClient) { await client.query('COMMIT'); wmsEventService.emit('inbound.putaway_completed', { receipt_id: receipt.id, item_id, location_id: actual_location_id, quantity: qtyToStore }); }
      return result;
    } catch (err) {
      if (!externalClient) await client.query('ROLLBACK');
      throw err;
    } finally {
      if (!externalClient) client.release();
    }
  }

  /**
   * List all receipts
   */
  async getReceipts(filters = {}) {
    let query = `
      SELECT r.*, w.name as warehouse_name, s.name as supplier_name,
             (SELECT COUNT(*) FROM wms_inbound_items WHERE receipt_id = r.id) as item_count
      FROM wms_inbound_receipts r
      JOIN warehouses w ON r.warehouse_id = w.id
      LEFT JOIN suppliers s ON r.supplier_id = s.id
      WHERE r.tenant_id = $1
    `;
    const params = [filters.tenant_id];

    if (filters.warehouse_id) {
      params.push(filters.warehouse_id);
      query += ` AND r.warehouse_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      query += ` AND r.status = $${params.length}`;
    }

    query += ' ORDER BY r.received_at DESC LIMIT 100';
    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get single receipt by ID with items and target bins
   */
  async getReceiptById(id,tenantId,client=pool) {
    const res = await client.query(`
      SELECT r.*, w.name as warehouse_name, s.name as supplier_name
      FROM wms_inbound_receipts r
      JOIN warehouses w ON r.warehouse_id = w.id
      LEFT JOIN suppliers s ON r.supplier_id = s.id
      WHERE r.id = $1 AND r.tenant_id = $2
    `, [id,tenantId]);

    if (res.rows.length === 0) return null;
    const receipt = res.rows[0];

    const itemsRes = await client.query(`
      SELECT i.*, p.name as product_name, p.sku, p.barcode,
             target_loc.location_code as target_location_code,
             actual_loc.location_code as actual_location_code
      FROM wms_inbound_items i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN warehouse_locations target_loc ON i.target_location_id = target_loc.id
      LEFT JOIN warehouse_locations actual_loc ON i.actual_location_id = actual_loc.id
      WHERE i.receipt_id = $1 ORDER BY i.id
    `, [id]);

    receipt.items = itemsRes.rows;
    return receipt;
  }
}

module.exports = new WMSInboundService();
