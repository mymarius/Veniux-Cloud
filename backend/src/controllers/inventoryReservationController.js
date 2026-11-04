const inventoryReservationService = require('../services/inventoryReservationService');

class InventoryReservationController {
  async createReservation(req, res) {
    try {
      const data = {
        ...req.body,
        tenant_id: req.user.tenantId
      };
      const result = await inventoryReservationService.createReservation(data);
      res.status(201).json(result);
    } catch (err) {
      console.error('Create reservation error:', err);
      res.status(400).json({ error: err.message || 'Rezervasyon oluşturulamadı' });
    }
  }

  async releaseReservation(req, res) {
    try {
      const { id } = req.params;
      const result = await inventoryReservationService.releaseReservation(id);
      res.json(result);
    } catch (err) {
      console.error('Release reservation error:', err);
      res.status(400).json({ error: err.message || 'Rezervasyon serbest bırakılamadı' });
    }
  }

  async getActiveReservations(req, res) {
    try {
      const { warehouse_id } = req.query;
      const reservations = await inventoryReservationService.getActiveReservations(warehouse_id,req.user.tenantId);
      res.json(reservations);
    } catch (err) {
      console.error('Get reservations error:', err);
      res.status(500).json({ error: 'Rezervasyonlar listelenemedi' });
    }
  }
}

module.exports = new InventoryReservationController();
