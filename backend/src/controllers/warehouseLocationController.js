const warehouseLocationService = require('../services/warehouseLocationService');

class WarehouseLocationController {
  async getLocations(req, res) {
    try {
      const { warehouse_id } = req.query;
      if (!warehouse_id) {
        return res.status(400).json({ error: 'warehouse_id query parametresi zorunludur' });
      }
      const locations = await warehouseLocationService.getLocations(warehouse_id, req.query);
      res.json(locations);
    } catch (err) {
      console.error('Get locations error:', err);
      res.status(500).json({ error: 'Lokasyonlar yüklenemedi' });
    }
  }

  async getLocationById(req, res) {
    try {
      const { id } = req.params;
      const location = await warehouseLocationService.getLocationById(id, req.user.tenantId);
      if (!location) {
        return res.status(404).json({ error: 'Lokasyon bulunamadı' });
      }
      res.json(location);
    } catch (err) {
      console.error('Get location by ID error:', err);
      res.status(500).json({ error: 'Lokasyon detayı yüklenemedi' });
    }
  }

  async generateAisleGrid(req, res) {
    try {
      const created = await warehouseLocationService.generateAisleGrid(req.body, req.user.tenantId);
      res.status(201).json({ message: `${created.length} adet yeni göz oluşturuldu`, locations: created });
    } catch (err) {
      console.error('Generate aisle grid error:', err);
      res.status(400).json({ error: err.message || 'Koridor şablonu oluşturulamadı' });
    }
  }

  async relocateStock(req, res) {
    try {
      const data = {
        ...req.body,
        user_id: req.user.userId,
        user_email: req.user.email,
        operation_key: req.get('Idempotency-Key'),
        device_id: req.headers['x-device-id'] || 'PDA_CONSOLE'
      };
      const result = await warehouseLocationService.relocateStock(req.user.tenantId, data);
      res.status(200).json(result);
    } catch (err) {
      console.error('Relocate stock error:', err);
      res.status(err.status||400).json({ error: err.message || 'Stok transferi gerçekleştirilemedi' });
    }
  }

  async toggleLock(req, res) {
    try {
      const { id } = req.params;
      const { is_locked, reason } = req.body;
      const updated = await warehouseLocationService.toggleLockLocation(id, is_locked, reason, req.user.tenantId);
      res.json(updated);
    } catch (err) {
      console.error('Toggle lock error:', err);
      res.status(500).json({ error: 'Raf kilitleme durumu güncellenemedi' });
    }
  }
}

module.exports = new WarehouseLocationController();
