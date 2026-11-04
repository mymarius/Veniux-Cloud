const wmsSlottingService = require('../services/wmsSlottingService');

class WMSSlottingController {
  async getABCAnalysis(req, res) {
    try {
      const { warehouse_id, period = '30d' } = req.query;
      if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id zorunludur' });
      const analysis = await wmsSlottingService.getABCVelocityAnalysis(warehouse_id, period,req.user.tenantId);
      res.json(analysis);
    } catch (err) {
      console.error('Get ABC analysis error:', err);
      res.status(err.status || 500).json({ error: 'ABC analizi yüklenemedi' });
    }
  }

  async getRecommendations(req, res) {
    try {
      const { warehouse_id } = req.query;
      if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id zorunludur' });
      const recommendations = await wmsSlottingService.getSlottingRecommendations(warehouse_id,req.user.tenantId);
      res.json(recommendations);
    } catch (err) {
      console.error('Get slotting recs error:', err);
      res.status(500).json({ error: 'Slotting önerileri yüklenemedi' });
    }
  }

  async getReplenishments(req, res) {
    try {
      const { warehouse_id } = req.query;
      if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id zorunludur' });
      const needs = await wmsSlottingService.checkReplenishmentNeeds(warehouse_id);
      res.json(needs);
    } catch (err) {
      console.error('Get replenishment error:', err);
      res.status(500).json({ error: 'İkmal listesi yüklenemedi' });
    }
  }
}

module.exports = new WMSSlottingController();
