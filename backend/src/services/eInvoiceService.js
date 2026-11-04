const pool = require('../config/database');
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

class EInvoiceService {
  async createInvoice(data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const { invoice_type = 'sales', customer_name, customer_tc_vkn, customer_address, payment_method = 'cash', items = [], notes } = data;
      
      // Auto-generate invoice_no (VNX-YYYY-XXXXXX)
      const year = new Date().getFullYear();
      const countRes = await client.query("SELECT COUNT(*) as count FROM pharmacy_invoices WHERE strftime('%Y', created_at) = $1", [String(year)]);
      const nextId = parseInt(countRes.rows[0]?.count || 0, 10) + 1;
      const invoice_no = `VNX-${year}-${nextId.toString().padStart(6, '0')}`;
      
      const {processedItems,subtotal,kdv_total,grand_total,kdvBreakdown} = require('./invoiceTotals').calculate(items);

      const invoiceQuery = `
        INSERT INTO pharmacy_invoices (
          tenant_id, invoice_no, invoice_type, invoice_format, customer_name, customer_tc_vkn, 
          customer_address, subtotal, kdv_total, grand_total, kdv_breakdown_json, 
          payment_method, status, notes
        ) VALUES ($13, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12)
        RETURNING *
      `;
      const invoiceValues = [
        invoice_no,
        invoice_type,
        'internal_draft',
        customer_name || 'Müşteri',
        customer_tc_vkn || null, 
        customer_address || 'Adres',
        parseFloat(subtotal.toFixed(2)),
        parseFloat(kdv_total.toFixed(2)),
        parseFloat(grand_total.toFixed(2)),
        JSON.stringify(kdvBreakdown), 
        payment_method,
        notes || null,
        data.tenant_id
      ];
      
      const invoiceRes = await client.query(invoiceQuery, invoiceValues);
      const invoiceId = invoiceRes.rows[0].id;

      const itemQuery = `
        INSERT INTO pharmacy_invoice_items (
          tenant_id, invoice_id, product_id, description, quantity, unit_price, kdv_rate, kdv_amount, total_price
        ) VALUES ($9, $1, $2, $3, $4, $5, $6, $7, $8)
      `;

      for (const item of processedItems) {
        await client.query(itemQuery, [
          invoiceId,
          item.product_id,
          item.description,
          item.quantity, 
          item.unit_price,
          item.kdv_rate,
          item.itemKdvAmount,
          item.totalPrice,
          data.tenant_id
        ]);
      }

      await client.query('COMMIT');
      return await this.getInvoiceById(invoiceId,data.tenant_id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getInvoices(filters = {}) {
    let query = 'SELECT * FROM pharmacy_invoices WHERE tenant_id=$1';
    const params = [filters.tenant_id];
    
    if (filters.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }
    if (filters.type) {
      params.push(filters.type);
      query += ` AND invoice_type = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC LIMIT 100';
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getInvoiceById(id,tenantId) {
    const invoiceRes = await pool.query('SELECT * FROM pharmacy_invoices WHERE id = $1 AND tenant_id=$2', [id,tenantId]);
    if (invoiceRes.rows.length === 0) return null;
    const invoice = invoiceRes.rows[0];

    const itemsRes = await pool.query(`
      SELECT i.*, p.name as product_name
      FROM pharmacy_invoice_items i
      LEFT JOIN products p ON i.product_id = p.id
      WHERE i.invoice_id = $1
    `, [id]);
    
    invoice.items = itemsRes.rows;
    return invoice;
  }

  async updateInvoiceStatus(id, status,tenantId) {
    if (!['draft','cancelled'].includes(status)) throw Object.assign(new Error('Entegratör doğrulaması olmadan resmî fatura durumu atanamaz.'),{status:400});
    const query = 'UPDATE pharmacy_invoices SET status = $1 WHERE id = $2 AND tenant_id=$3 RETURNING *';
    const result = await pool.query(query, [status, id,tenantId]);
    return result.rows[0];
  }

  async getInvoiceSummary(month, year,tenantId) {
    const formattedMonth = String(month).padStart(2, '0');
    const monthYear = `${year}-${formattedMonth}`;
    const query = `
      SELECT 
        COUNT(*) as invoice_count,
        COALESCE(SUM(subtotal), 0) as total_subtotal,
        COALESCE(SUM(kdv_total), 0) as total_kdv,
        COALESCE(SUM(grand_total), 0) as total_revenue,
        invoice_type
      FROM pharmacy_invoices
      WHERE strftime('%Y-%m', created_at) = $1 AND tenant_id=$2
      GROUP BY invoice_type
    `;
    const result = await pool.query(query, [monthYear,tenantId]);
    return result.rows;
  }

  async generateInvoiceHtml(id,tenantId) {
    const invoice = await this.getInvoiceById(id,tenantId);
    if (!invoice) throw new Error('Fatura bulunamadı');
    
    let itemsHtml = '';
    (invoice.items || []).forEach((item, index) => {
      itemsHtml += `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.product_name || item.description)}</td>
          <td>${item.quantity}</td>
          <td>${Number(item.unit_price).toFixed(2)} TL</td>
          <td>%${item.kdv_rate}</td>
          <td>${Number(item.kdv_amount).toFixed(2)} TL</td>
          <td>${Number(item.total_price).toFixed(2)} TL</td>
        </tr>
      `;
    });

    return `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Fatura - ${escapeHtml(invoice.invoice_no)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; }
          .details { margin-bottom: 20px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; }
          .totals { width: 40%; float: right; margin-top: 10px; }
          .totals table { border: none; }
          .totals th, .totals td { border: none; text-align: right; padding: 4px 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>VENİUX ECZANE SİSTEMİ</h2>
          <p>FATURA TASLAĞI — RESMÎ E-BELGE DEĞİLDİR</p>
        </div>
        <div class="details">
          <div>
            <strong>Müşteri:</strong> ${escapeHtml(invoice.customer_name)}<br>
            <strong>VKN/TCKN:</strong> ${escapeHtml(invoice.customer_tc_vkn)}<br>
            <strong>Adres:</strong> ${escapeHtml(invoice.customer_address)}
          </div>
          <div>
            <strong>Fatura No:</strong> ${escapeHtml(invoice.invoice_no)}<br>
            <strong>Tarih:</strong> ${new Date(invoice.created_at).toLocaleDateString('tr-TR')}<br>
            <strong>Ödeme Yöntemi:</strong> ${escapeHtml(invoice.payment_method)}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Açıklama</th>
              <th>Miktar</th>
              <th>Birim Fiyat</th>
              <th>KDV</th>
              <th>KDV Tutarı</th>
              <th>Toplam</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="totals">
          <table>
            <tr><th>Ara Toplam:</th><td>${Number(invoice.subtotal).toFixed(2)} TL</td></tr>
            <tr><th>KDV Toplamı:</th><td>${Number(invoice.kdv_total).toFixed(2)} TL</td></tr>
            <tr><th>Genel Toplam:</th><td><strong>${Number(invoice.grand_total).toFixed(2)} TL</strong></td></tr>
          </table>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EInvoiceService();
