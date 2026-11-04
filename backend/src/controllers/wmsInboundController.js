const wmsInboundService = require('../services/wmsInboundService');

class WMSInboundController {
  async createReceipt(req, res) {
    try {
      const data = {
        ...req.body,
        tenant_id: req.user.tenantId,
        received_by: req.user?.id || null,
        operation_key:req.get('Idempotency-Key')||null
      };
      const receipt = await wmsInboundService.createReceipt(data);
      res.status(201).json(receipt);
    } catch (err) {
      console.error('Create receipt error:', err);
      res.status(err.status||400).json({ error: err.message || 'Mal kabul kaydı oluşturulamadı' });
    }
  }

  async completePutaway(req, res) {
    try {
      const data = {
        ...req.body,
        tenant_id: req.user.tenantId,
        user_id: req.user?.id || null,
        device_id: req.headers['x-device-id'] || 'PDA_CONSOLE',
        operation_key:req.get('Idempotency-Key')||null
      };
      const result = await wmsInboundService.completePutaway(data);
      res.json(result);
    } catch (err) {
      console.error('Complete putaway error:', err);
      res.status(err.status||400).json({ error: err.message || 'Raf yerleştirme tamamlanamadı' });
    }
  }

  async getReceipts(req, res) {
    try {
      const receipts = await wmsInboundService.getReceipts({...req.query,tenant_id:req.user.tenantId});
      res.json(receipts);
    } catch (err) {
      console.error('Get receipts error:', err);
      res.status(500).json({ error: 'Mal kabul kayıtları yüklenemedi' });
    }
  }

  async getReceiptById(req, res) {
    try {
      const { id } = req.params;
      const receipt = await wmsInboundService.getReceiptById(id,req.user.tenantId);
      if (!receipt) return res.status(404).json({ error: 'Mal kabul belgesi bulunamadı' });
      res.json(receipt);
    } catch (err) {
      console.error('Get receipt by ID error:', err);
      res.status(500).json({ error: 'Belge detayı yüklenemedi' });
    }
  }
}

module.exports = new WMSInboundController();
