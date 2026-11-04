const pool = require('../config/database');

class MedulaProvisionService {
  async calculateProvision(prescriptionData, tenantId, client = pool) {
    const { items = [], provision_type = 'normal' } = prescriptionData;
    let total_sgk_amount = 0;
    let total_patient_copay = 0;
    let total_equivalent_diff = 0;
    
    const copayRate = provision_type === 'kronik' || provision_type === 'chronic' ? 0.0 : 0.20;

    const calculatedItems = [];

    for (const item of items) {
      const productResult = await client.query('SELECT * FROM products WHERE id = $1 AND tenant_id = $2', [item.product_id, tenantId]);
      const product = productResult.rows[0];
      
      if (!product) continue;
      
      const qty = parseInt(item.quantity, 10) || 1;
      const kamuFiyati = Number(product.kamu_fiyati || product.sale_price || 0);
      const retailFiyat = Number(product.perakende_fiyat || product.sale_price || kamuFiyati);
      
      const sgkAmount = kamuFiyati * qty;
      const copay = sgkAmount * copayRate;
      const equivalentDiff = Math.max(0, (retailFiyat - kamuFiyati) * qty);
      
      total_sgk_amount += sgkAmount;
      total_patient_copay += copay;
      total_equivalent_diff += equivalentDiff;
      
      calculatedItems.push({
        product_id: product.id,
        quantity: qty,
        product_name: product.name,
        unit_kamu_fiyati: kamuFiyati,
        unit_retail_fiyati: retailFiyat,
        kamu_fiyati: kamuFiyati,
        sgk_amount: parseFloat(sgkAmount.toFixed(2)),
        patient_copay: copay,
        copay: parseFloat(copay.toFixed(2)),
        equivalent_diff: parseFloat(equivalentDiff.toFixed(2))
      });
    }

    return {
      official_submission: false,
      calculation_basis: 'local_estimate',
      warning: 'Yerel tahmin; SGK/SUT doğrulaması veya Medula onayı değildir.',
      total_sgk_amount: parseFloat(total_sgk_amount.toFixed(2)),
      total_patient_copay: parseFloat(total_patient_copay.toFixed(2)),
      total_equivalent_diff: parseFloat(total_equivalent_diff.toFixed(2)),
      grand_total: parseFloat((total_sgk_amount + total_patient_copay + total_equivalent_diff).toFixed(2)),
      items: calculatedItems
    };
  }

  async createProvision(provisionData, tenantId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const provisionNo = 'PRV-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
      
      let sgkAmt = provisionData.total_sgk_amount;
      let copayAmt = provisionData.total_patient_copay;
      let diffAmt = provisionData.total_equivalent_diff;

      if (sgkAmt === undefined && provisionData.items && provisionData.items.length > 0) {
        const calc = await this.calculateProvision(provisionData, tenantId, client);
        sgkAmt = calc.total_sgk_amount;
        copayAmt = calc.total_patient_copay;
        diffAmt = calc.total_equivalent_diff;
      }

      const itemsJson = JSON.stringify(provisionData.items || []);
      
      const query = `
        INSERT INTO medula_provisions (
          tenant_id, provision_no, prescription_no, patient_tc, patient_name, doctor_name, 
          diagnosis_code, hospital_name, provision_type, total_sgk_amount, 
          total_patient_copay, total_equivalent_diff, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
        RETURNING *
      `;
      
      const values = [
        tenantId,
        provisionNo,
        provisionData.prescription_no || null,
        provisionData.patient_tc || null,
        provisionData.patient_name || null,
        provisionData.doctor_name || null,
        provisionData.diagnosis_code || null,
        provisionData.hospital_name || null,
        provisionData.provision_type || 'normal',
        parseFloat(sgkAmt) || 0,
        parseFloat(copayAmt) || 0,
        parseFloat(diffAmt) || 0
      ];
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      return {...result.rows[0],official_submission:false,message:'Yerel taslak kaydedildi. Medula gönderimi veya kurum onayı yapılmadı.'};
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getProvisionHistory(filters = {}) {
    let query = 'SELECT * FROM medula_provisions WHERE tenant_id=$1';
    const params = [filters.tenant_id];
    
    if (filters.patient_tc) {
      params.push(`%${filters.patient_tc}%`);
      query += ` AND patient_tc LIKE $${params.length}`;
    }
    
    if (filters.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC LIMIT 100';
    
    const result = await pool.query(query, params);
    return result.rows.map(row=>({...row,official_submission:false,verification_status:'local_unverified'}));
  }

  async getProvisionById(id,tenantId) {
    const result = await pool.query('SELECT * FROM medula_provisions WHERE id = $1 AND tenant_id=$2', [id,tenantId]);
    const provision = result.rows[0];
    
    if (provision && provision.items_json) {
      try {
        provision.items = typeof provision.items_json === 'string' ? JSON.parse(provision.items_json) : provision.items_json;
      } catch (e) {
        provision.items = [];
      }
    }
    
    return provision ? {...provision,official_submission:false,verification_status:'local_unverified'} : provision;
  }
}

module.exports = new MedulaProvisionService();
