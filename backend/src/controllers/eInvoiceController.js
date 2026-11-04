const eInvoiceService = require('../services/eInvoiceService');

class EInvoiceController {
  async createInvoice(req, res) {
    try {
      const invoiceData = req.body;
      if (!invoiceData || !invoiceData.items || invoiceData.items.length === 0) {
        return res.status(400).json({ error: 'Fatura oluşturmak için en az 1 kalem gereklidir.' });
      }

      invoiceData.tenant_id = req.user.tenantId;
      const invoice = await eInvoiceService.createInvoice(invoiceData);
      res.status(201).json({
        message: 'Fatura taslağı oluşturuldu. Resmî e-belge gönderilmedi.',
        legal_invoice: false,
        invoice
      });
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(error.status || 500).json({ error: error.message || 'Fatura oluşturulamadı.' });
    }
  }

  async getInvoices(req, res) {
    try {
      const filters = {...req.query,tenant_id:req.user.tenantId};
      const invoices = await eInvoiceService.getInvoices(filters);
      res.json(invoices);
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({ error: 'Faturalar listelenemedi.' });
    }
  }

  async getInvoiceById(req, res) {
    try {
      const { id } = req.params;
      const invoice = await eInvoiceService.getInvoiceById(id,req.user.tenantId);
      if (!invoice) {
        return res.status(404).json({ error: 'Fatura bulunamadı.' });
      }
      res.json(invoice);
    } catch (error) {
      console.error('Get invoice by ID error:', error);
      res.status(500).json({ error: 'Fatura yüklenemedi.' });
    }
  }

  async updateInvoiceStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Durum bilgisi zorunludur.' });
      }
      const updated = await eInvoiceService.updateInvoiceStatus(id, status,req.user.tenantId);
      res.json(updated);
    } catch (error) {
      console.error('Update invoice status error:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Fatura durumu güncellenemedi.' });
    }
  }

  async getInvoiceSummary(req, res) {
    try {
      const { month, year } = req.query;
      const currentYear = year || new Date().getFullYear();
      const currentMonth = month || (new Date().getMonth() + 1);
      const summary = await eInvoiceService.getInvoiceSummary(currentMonth, currentYear,req.user.tenantId);
      res.json(summary);
    } catch (error) {
      console.error('Get invoice summary error:', error);
      res.status(500).json({ error: 'Fatura özeti yüklenemedi.' });
    }
  }

  async getInvoiceHtml(req, res) {
    try {
      const { id } = req.params;
      const html = await eInvoiceService.generateInvoiceHtml(id,req.user.tenantId);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'none'");
      res.send(html);
    } catch (error) {
      console.error('Get invoice HTML error:', error);
      res.status(500).json({ error: error.message || 'Fatura HTML oluşturulamadı.' });
    }
  }
}

module.exports = new EInvoiceController();
