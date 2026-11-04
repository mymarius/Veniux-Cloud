const pool = require('../config/database');
const medulaProvisionService = require('../services/medulaProvisionService');

class MedulaProvisionController {
  async calculateProvision(req, res) {
    try {
      const prescriptionData = req.body;
      if (!prescriptionData || !prescriptionData.items) {
        return res.status(400).json({ error: 'Eksik reçete bilgisi' });
      }
      
      const calculatedData = await medulaProvisionService.calculateProvision(prescriptionData,req.user.tenantId);
      res.json(calculatedData);
    } catch (error) {
      console.error('Calculate Provision Error:', error);
      res.status(500).json({ error: 'Provizyon hesaplanırken bir hata oluştu' });
    }
  }

  async createProvision(req, res) {
    try {
      const provisionData = req.body;
      const newProvision = await medulaProvisionService.createProvision(provisionData, req.user.tenantId);
      res.status(201).json(newProvision);
    } catch (error) {
      console.error('Create Provision Error:', error);
      res.status(500).json({ error: 'Provizyon oluşturulurken bir hata oluştu' });
    }
  }

  async getProvisionHistory(req, res) {
    try {
      const filters = {...req.query,tenant_id:req.user.tenantId};
      const history = await medulaProvisionService.getProvisionHistory(filters);
      res.json(history);
    } catch (error) {
      console.error('Get Provision History Error:', error);
      res.status(500).json({ error: 'Provizyon geçmişi alınırken bir hata oluştu' });
    }
  }

  async getProvisionById(req, res) {
    try {
      const { id } = req.params;
      const provision = await medulaProvisionService.getProvisionById(id,req.user.tenantId);
      
      if (!provision) {
        return res.status(404).json({ error: 'Provizyon bulunamadı' });
      }
      
      res.json(provision);
    } catch (error) {
      console.error('Get Provision By Id Error:', error);
      res.status(500).json({ error: 'Provizyon detayı alınırken bir hata oluştu' });
    }
  }

  async getSutPrices(req, res) {
    try {
      const query = `
        SELECT id, sku, name, barcode, gtin, kamu_fiyati, depocu_fiyati, perakende_fiyat, is_medicine 
        FROM products 
        WHERE tenant_id=$1 AND (is_medicine = 1 OR category LIKE '%İlaç%')
        ORDER BY name ASC
      `;
      const result = await pool.query(query,[req.user.tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error('Get SUT Prices Error:', error);
      res.status(500).json({ error: 'SUT fiyatları alınırken bir hata oluştu' });
    }
  }
}

module.exports = new MedulaProvisionController();
