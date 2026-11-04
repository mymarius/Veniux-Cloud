const wmsPickingService = require('../services/wmsPickingService');

class WMSPickingController {
  async createWave(req, res) {
    try {
      const data = {
        ...req.body,
        tenant_id: req.user.tenantId
      };
      const wave = await wmsPickingService.createWave(data);
      res.status(201).json(wave);
    } catch (err) {
      console.error('Create wave error:', err);
      res.status(400).json({ error: err.message || 'Toplama dalgası oluşturulamadı' });
    }
  }

  async confirmPickItem(req, res) {
    try {
      const data = {
        ...req.body,
        tenant_id: req.user.tenantId,
        user_id: req.user?.id || null,
        device_id: req.headers['x-device-id'] || 'PDA_CONSOLE'
      };
      const result = await wmsPickingService.confirmPickItem(data);
      res.json(result);
    } catch (err) {
      console.error('Confirm pick error:', err);
      res.status(400).json({ error: err.message || 'Toplama kalemi doğrulanamadı' });
    }
  }

  async getWaves(req, res) {
    try {
      const waves = await wmsPickingService.getWaves({...req.query,tenant_id:req.user.tenantId});
      res.json(waves);
    } catch (err) {
      console.error('Get waves error:', err);
      res.status(500).json({ error: 'Toplama dalgaları yüklenemedi' });
    }
  }

  async getWaveById(req, res) {
    try {
      const { id } = req.params;
      const wave = await wmsPickingService.getWaveById(id,req.user.tenantId);
      if (!wave) return res.status(404).json({ error: 'Toplama dalgası bulunamadı' });
      res.json(wave);
    } catch (err) {
      console.error('Get wave by ID error:', err);
      res.status(500).json({ error: 'Dalga detayı yüklenemedi' });
    }
  }
}

module.exports = new WMSPickingController();
