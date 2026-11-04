const pool = require('../config/database');
const barcodeResolver = require('../services/barcodeResolutionService');

/**
 * 1. Register or Update Terminal Device
 * Endpoint: POST /api/terminal/register
 */
const registerDevice = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 1;
    const {
      device_uid,
      device_name = 'Zebra TC26 Terminal',
      device_type = 'PDA',
      manufacturer = 'Zebra Technologies',
      warehouse_id,
      battery_level = 100
    } = req.body;

    if (!device_uid) {
      return res.status(400).json({ error: 'device_uid zorunludur.' });
    }

    // Determine target warehouse
    let targetWarehouseId = warehouse_id;
    if (!targetWarehouseId) {
      const whRes = await pool.query('SELECT id FROM warehouses WHERE tenant_id = $1 LIMIT 1', [tenantId]);
      if (whRes.rows.length > 0) {
        targetWarehouseId = whRes.rows[0].id;
      } else {
        const createWh = await pool.query(
          "INSERT INTO warehouses (tenant_id, name, type, location, capacity, warehouse_type) VALUES ($1, 'Ana Depo', 'internal', 'Merkez Tesis', 10000, 'NORMAL') RETURNING id",
          [tenantId]
        );
        targetWarehouseId = createWh.rows[0].id;
      }
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    // Check if device already registered
    const existing = await pool.query(
      'SELECT * FROM warehouse_devices WHERE device_uid = $1 AND tenant_id = $2',
      [device_uid, tenantId]
    );

    let device;
    if (existing.rows.length > 0) {
      const updateRes = await pool.query(`
        UPDATE warehouse_devices 
        SET device_name = COALESCE($1, device_name),
            device_type = COALESCE($2, device_type),
            manufacturer = COALESCE($3, manufacturer),
            warehouse_id = COALESCE($4, warehouse_id),
            battery_level = $5,
            last_ip_address = $6,
            last_heartbeat = CURRENT_TIMESTAMP,
            status = 'active'
        WHERE device_uid = $7 AND tenant_id = $8
        RETURNING *
      `, [device_name, device_type, manufacturer, targetWarehouseId, battery_level, ip, device_uid, tenantId]);
      device = updateRes.rows[0];
    } else {
      const insertRes = await pool.query(`
        INSERT INTO warehouse_devices 
          (tenant_id, device_uid, device_name, device_type, manufacturer, warehouse_id, battery_level, last_ip_address, status, last_heartbeat)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, 'active', CURRENT_TIMESTAMP)
        RETURNING *
      `, [tenantId, device_uid, device_name, device_type, manufacturer, targetWarehouseId, battery_level, ip]);
      device = insertRes.rows[0];
    }

    res.status(200).json({
      success: true,
      message: 'Terminal başarıyla sisteme bağlandı.',
      device
    });
  } catch (err) {
    console.error('[Terminal Register Error]:', err);
    res.status(err.status||500).json({ error: 'Cihaz kaydı yapılamadı: ' + err.message });
  }
};

/**
 * 2. Terminal Heartbeat & Live Telemetry
 * Endpoint: POST /api/terminal/heartbeat
 */
const sendHeartbeat = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 1;
    const {
      device_uid,
      battery_level = 100,
      status = 'active',
      current_mode = 'LOOKUP'
    } = req.body;

    if (!device_uid) {
      return res.status(400).json({ error: 'device_uid belirtilmelidir.' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    const updateRes = await pool.query(`
      UPDATE warehouse_devices 
      SET battery_level = $1,
          status = $2,
          last_ip_address = $3,
          last_heartbeat = CURRENT_TIMESTAMP
      WHERE device_uid = $4 AND tenant_id = $5
      RETURNING *
    `, [battery_level, status, ip, device_uid, tenantId]);

    res.json({
      status: 'ok',
      server_time: new Date().toISOString(),
      registered: updateRes.rows.length > 0
    });
  } catch (err) {
    console.error('[Terminal Heartbeat Error]:', err);
    res.status(err.status||500).json({ error: 'Heartbeat işlenemedi.' });
  }
};

/**
 * 3. Barcode & Karekod Resolution for Handheld Terminals
 * Endpoint: POST /api/terminal/scan
 */
const resolveScan = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 1;
    const { barcode, warehouse_id, device_uid } = req.body;

    if (!barcode || !barcode.trim()) {
      return res.status(400).json({ error: 'Barkod değeri girilmelidir.' });
    }

    const raw = barcode.trim();

    // Parse GS1 DataMatrix (Karekod) if standard 01 GTIN format
    let karekodData = null;
    if (raw.length > 20 && (raw.includes('010') || raw.startsWith('01'))) {
      try {
        const gtinMatch = raw.match(/01(\d{14})/);
        const expMatch = raw.match(/17(\d{6})/);
        const lotMatch = raw.match(/10([A-Za-z0-9_-]+?)(?:21|$)/);
        const snMatch = raw.match(/21([A-Za-z0-9_-]+)/);

        if (gtinMatch) {
          karekodData = {
            gtin: gtinMatch[1],
            expiry_date: expMatch ? `20${expMatch[1].slice(0, 2)}-${expMatch[1].slice(2, 4)}-${expMatch[1].slice(4, 6)}` : null,
            lot_number: lotMatch ? lotMatch[1] : null,
            serial_number: snMatch ? snMatch[1] : null
          };
        }
      } catch (e) {
        // Fall back to standard barcode resolution
      }
    }

    // Resolve via Unified Barcode Resolver
    const searchCode = karekodData ? karekodData.gtin : raw;
    const resolved = await barcodeResolver.resolveBarcode(searchCode, warehouse_id,tenantId);

    if (resolved && resolved.matched) {
      return res.json({
        success: true,
        type: resolved.type,
        code: raw,
        parsed_karekod: karekodData,
        item: resolved.data,
        message: `${resolved.type === 'LOCATION' ? 'Lokasyon' : 'Ürün'} tespit edildi.`
      });
    }

    // Fallback: check direct product by barcode or SKU
    const prodRes = await pool.query(
      'SELECT * FROM products WHERE (barcode = $1 OR sku = $1) AND tenant_id = $2 LIMIT 1',
      [raw, tenantId]
    );

    if (prodRes.rows.length > 0) {
      const prod = prodRes.rows[0];
      return res.json({
        success: true,
        type: 'PRODUCT',
        code: raw,
        parsed_karekod: karekodData,
        item: prod,
        message: 'Ürün bulundu: ' + prod.name
      });
    }

    // Fallback: check location code directly
    const locRes = await pool.query(
      'SELECT * FROM warehouse_locations WHERE UPPER(location_code) = UPPER($1) AND tenant_id = $2 LIMIT 1',
      [raw, tenantId]
    );

    if (locRes.rows.length > 0) {
      const loc = locRes.rows[0];
      return res.json({
        success: true,
        type: 'LOCATION',
        code: raw,
        item: loc,
        message: 'Lokasyon bulundu: ' + loc.location_code
      });
    }

    return res.status(404).json({
      success: false,
      error: `'${raw}' koduna ait ürün veya lokasyon bulunamadı.`
    });
  } catch (err) {
    console.error('[Terminal Scan Error]:', err);
    res.status(err.status||500).json({ error: 'Barkod okuma hatası: ' + err.message });
  }
};

/**
 * 4. Fast Inbound / Putaway Operation
 * Endpoint: POST /api/terminal/operations/inbound
 */
const terminalMovement = direction => async (req,res) => {
 try{
  const tenantId=req.user.tenantId,body=req.body;
  const qty=Number(body.quantity??1);
  if(!Number.isFinite(qty)||qty<=0||!body.product_id)return res.status(400).json({error:'Ürün ve geçerli miktar zorunludur.'});
  let warehouseId=body.warehouse_id;
  if(!warehouseId)warehouseId=(await pool.query('SELECT id FROM warehouses WHERE tenant_id=$1 ORDER BY id LIMIT 1',[tenantId])).rows[0]?.id;
  if(!warehouseId)return res.status(400).json({error:'Depo bulunamadı.'});
  const transaction=await pool.transaction(async client=>{
   const key=req.get('idempotency-key');
   if(key){const previous=(await client.query('SELECT * FROM inventory_transactions WHERE tenant_id=$1 AND idempotency_key=$2',[tenantId,key])).rows[0];if(previous)return previous;}
   const tx=await require('../services/inventoryTransactionService').recordTransaction({tenant_id:tenantId,warehouse_id:warehouseId,product_id:body.product_id,location_id:body.location_id,quantity:direction*qty,transaction_type:direction>0?'RECEIVE':'PICK',user_id:req.user.userId,device_id:body.device_uid||'PDA',idempotency_key:req.get('idempotency-key')||null,notes:body.reason||'Terminal hareketi'},client);
   await client.query('INSERT INTO stock_movements(tenant_id,warehouse_id,product_id,change_amount,movement_type,source,note) VALUES($1,$2,$3,$4,$5,$6,$7)',[tenantId,warehouseId,body.product_id,direction*qty,direction>0?'IN':'OUT','TERMINAL',body.reason||'Terminal hareketi']);
   return tx;
  });
  res.json({success:true,message:direction>0?'Mal kabul kaydedildi.':'Ürün çıkışı kaydedildi.',warehouse_id:warehouseId,added_quantity:direction>0?qty:undefined,deducted_quantity:direction<0?qty:undefined,remaining_stock:transaction.after_quantity});
 }catch(error){res.status(400).json({error:error.message});}
};
const fastInbound=terminalMovement(1),fastOutbound=terminalMovement(-1);
const relocateStock=async(req,res)=>{
 try{const result=await require('../services/warehouseLocationService').relocateStock(req.user.tenantId,{...req.body,user_id:req.user.userId,operation_key:req.get('Idempotency-Key'),device_id:req.body.device_uid||'PDA'});res.json({...result,success:true,message:'Ürünler hedef göze aktarıldı.'});}catch(error){res.status(400).json({error:error.message});}
};
const cycleCount=async(req,res)=>{
 try{
  const tenant=req.user.tenantId,{warehouse_id,location_id,product_id,counted_quantity,device_uid}=req.body;
  const counted=Number(counted_quantity);
  if(!Number.isFinite(counted)||counted<0||counted_quantity===undefined||!warehouse_id||!location_id||!product_id)return res.status(400).json({error:'Depo, göz, ürün ve geçerli sayım miktarı zorunludur.'});
  const result=await pool.transaction(async client=>{
   const row=(await client.query('SELECT quantity FROM product_bin_records WHERE tenant_id=$1 AND location_id=$2 AND product_id=$3 AND lot_id IS NULL',[tenant,location_id,product_id])).rows[0];
   const before=Number(row?.quantity||0),diff=counted-before;
   if(diff!==0)await require('../services/inventoryTransactionService').recordTransaction({tenant_id:tenant,warehouse_id,location_id,product_id,quantity:diff,transaction_type:'COUNT_ADJUSTMENT',user_id:req.user.userId,device_id:device_uid||'PDA'},client);
   return {system_quantity:before,counted_quantity:counted,difference:diff};
  });res.json({...result,success:true,message:'Sayım kaydedildi.'});
 }catch(error){res.status(400).json({error:error.message});}
};

/**
 * 8. List Registered Terminal Devices
 * Endpoint: GET /api/terminal/devices
 */
const getRegisteredDevices = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 1;
    const devicesRes = await pool.query(`
      SELECT 
        d.*,
        w.name as warehouse_name,
        CASE 
          WHEN (strftime('%s', 'now') - strftime('%s', d.last_heartbeat)) < 60 THEN 'online'
          ELSE 'offline'
        END as connectivity_status
      FROM warehouse_devices d
      LEFT JOIN warehouses w ON d.warehouse_id = w.id
      WHERE d.tenant_id = $1
      ORDER BY d.last_heartbeat DESC
    `, [tenantId]);

    res.json(devicesRes.rows);
  } catch (err) {
    console.error('[Get Devices Error]:', err);
    res.status(err.status||500).json({ error: 'Terminal cihazları listelenemedi.' });
  }
};

module.exports = {
  registerDevice,
  sendHeartbeat,
  resolveScan,
  fastInbound,
  fastOutbound,
  relocateStock,
  cycleCount,
  getRegisteredDevices
};
