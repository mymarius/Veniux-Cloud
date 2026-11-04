const coldChainService = require('../services/coldChainService');

class ColdChainController {
  async getDevices(req, res) {
    try {
      const devices = await coldChainService.getDevices(req.user.tenantId);
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async addDevice(req, res) {
    try {
      const device = await coldChainService.addDevice(req.body, req.user.tenantId);
      res.status(201).json(device);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async logTemperature(req, res) {
    try {
      const { device_id, temperature, humidity } = req.body;
      const log = await coldChainService.logTemperature(device_id, temperature, humidity, req.user.tenantId);
      res.status(201).json(log);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getTemperatureHistory(req, res) {
    try {
      const { deviceId } = req.params;
      const { period } = req.query;
      const history = await coldChainService.getTemperatureHistory(deviceId, period || '24h', req.user.tenantId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAlarms(req, res) {
    try {
      const { device_id } = req.query;
      const alarms = await coldChainService.getAlarms(device_id, req.user.tenantId);
      res.json(alarms);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getCurrentReadings(req, res) {
    try {
      const readings = await coldChainService.getCurrentReadings(req.user.tenantId);
      res.json(readings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ColdChainController();
