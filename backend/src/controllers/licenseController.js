const licenseService = require('../services/licenseService');

class LicenseController {
  async getPlans(req, res) {
    try {
      const plans = licenseService.getPlans();
      res.json(plans);
    } catch (err) {
      console.error('Get plans error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  async getPublicKey(req, res) {
    try {
      const pubKey = licenseService.getPublicKey();
      res.type('text/plain').send(pubKey);
    } catch (err) {
      console.error('Get public key error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  async purchase(req, res) {
    try {
      const result = await licenseService.purchaseAnnualLicense(req.body);
      res.status(201).json(result);
    } catch (err) {
      console.error('Purchase license error:', err);
      res.status(400).json({ error: err.message });
    }
  }

  async activate(req, res) {
    try {
      const result = await licenseService.activateLicense(req.body);
      res.status(200).json(result);
    } catch (err) {
      console.error('Activate license error:', err);
      res.status(400).json({ error: err.message });
    }
  }

  async validate(req, res) {
    try {
      const result = await licenseService.validateLicense(req.body);
      res.status(200).json(result);
    } catch (err) {
      console.error('Validate license error:', err);
      res.status(400).json({ error: err.message });
    }
  }

  async deactivate(req, res) {
    try {
      const result = await licenseService.deactivateDevice(req.body);
      res.status(200).json(result);
    } catch (err) {
      console.error('Deactivate device error:', err);
      res.status(400).json({ error: err.message });
    }
  }

  async heartbeat(req, res) {
    try {
      const { license_key, device_fingerprint } = req.body;
      const result=await licenseService.validateLicense({ license_key, device_fingerprint });
      res.json({ ...result, license_status:result.status, status:result.valid?'ok':'warning', timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(400).json({ status: 'warning', valid:false, error: err.message });
    }
  }
}

module.exports = new LicenseController();
