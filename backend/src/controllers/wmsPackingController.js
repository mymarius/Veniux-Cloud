const wmsPackingService = require('../services/wmsPackingService');

class WMSPackingController {
  async createHandlingUnit(req, res) {
    try {
      const data = {
        ...req.body,
        tenant_id: req.user.tenantId
      };
      const hu = await wmsPackingService.createHandlingUnit(data);
      res.status(201).json(hu);
    } catch (err) {
      console.error('Create HU error:', err);
      res.status(400).json({ error: err.message || 'Taşıma birimi oluşturulamadı' });
    }
  }

  async dispatchShipment(req, res) {
    try {
      const data = {
        ...req.body,
        tenant_id: req.user.tenantId,
        user_id: req.user?.id || null,
        device_id: req.headers['x-device-id'] || 'DISPATCH_CONSOLE'
      };
      const result = await wmsPackingService.dispatchShipment(data);
      res.json(result);
    } catch (err) {
      console.error('Dispatch shipment error:', err);
      res.status(400).json({ error: err.message || 'Sevkiyat gerçekleştirilemedi' });
    }
  }

  async getHandlingUnits(req, res) {
    try {
      const { warehouse_id } = req.query;
      if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id gereklidir' });
      const hus = await wmsPackingService.getHandlingUnits(warehouse_id);
      res.json(hus);
    } catch (err) {
      console.error('Get HUs error:', err);
      res.status(500).json({ error: 'Taşıma birimleri listelenemedi' });
    }
  }

  async getDockAppointments(req, res) {
    try {
      const { warehouse_id } = req.query;
      if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id gereklidir' });
      const appointments = await wmsPackingService.getDockAppointments(warehouse_id);
      res.json(appointments);
    } catch (err) {
      console.error('Get dock appointments error:', err);
      res.status(500).json({ error: 'Rampa randevuları yüklenemedi' });
    }
  }

  async createDockAppointment(req, res) {
    try {
      const app = await wmsPackingService.createDockAppointment({...req.body,tenant_id:req.user.tenantId});
      res.status(201).json(app);
    } catch (err) {
      console.error('Create dock appointment error:', err);
      res.status(400).json({ error: err.message || 'Randevu oluşturulamadı' });
    }
  }
}

module.exports = new WMSPackingController();
