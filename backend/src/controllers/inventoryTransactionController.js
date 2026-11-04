const inventoryTransactionService = require('../services/inventoryTransactionService');
const barcodeResolutionService = require('../services/barcodeResolutionService');

class InventoryTransactionController {
  async recordTransaction(req, res) {
    try {
      if (['COUNT_ADJUSTMENT','TRANSFER_OUT','TRANSFER_IN'].includes(req.body.transaction_type)) return res.status(400).json({error:'Bu işlem için onaylı sayım veya lot seçilen transfer akışını kullanın.'});
      const data = {
        ...req.body,
        user_id: req.user?.userId || null
      };
      const result = await inventoryTransactionService.recordTransaction({ ...data, tenant_id: req.user.tenantId });
      res.status(201).json(result);
    } catch (err) {
      console.error('Record transaction error:', err);
      res.status(400).json({ error: err.message || 'İşlem kaydedilemedi' });
    }
  }

  async getLedgerHistory(req, res) {
    try {
      const filters = {...req.query,tenant_id:req.user.tenantId};
      const history = await inventoryTransactionService.getLedgerHistory(filters);
      res.json(history);
    } catch (err) {
      console.error('Get ledger error:', err);
      res.status(500).json({ error: 'Stok defteri yüklenemedi' });
    }
  }

  async getProductBreakdown(req, res) {
    try {
      const { productId } = req.params;
      const { warehouse_id } = req.query;
      const breakdown = await inventoryTransactionService.getProductStockBreakdown(productId, warehouse_id);
      res.json(breakdown);
    } catch (err) {
      console.error('Get product breakdown error:', err);
      res.status(500).json({ error: 'Ürün stok kırılımı yüklenemedi' });
    }
  }

  async resolveBarcode(req, res) {
    try {
      const { barcode, warehouse_id } = req.body;
      const result = await barcodeResolutionService.resolveBarcode(barcode, warehouse_id,req.user.tenantId);
      
      // Log scan event
      await barcodeResolutionService.logScanEvent(req.user.tenantId, {
        device_id: req.headers['x-device-id'] || 'WEB_CONSOLE',
        user_id: req.user?.id || null,
        raw_barcode: barcode,
        resolved_type: result.type,
        resolved_id: result.id,
        operation: req.body.operation || 'LOOKUP',
        is_success: result.matched,
        error_message: result.matched ? null : result.message
      });

      res.json(result);
    } catch (err) {
      console.error('Resolve barcode error:', err);
      res.status(500).json({ error: 'Barkod çözümlenemedi' });
    }
  }
}

module.exports = new InventoryTransactionController();
