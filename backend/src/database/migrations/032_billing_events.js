// Ödeme bildirimlerinin işlenme sonucu ve sırası kaydedilir; lisans en son işlenen olayın zamanını tutar
// ki geç gelen eski bir olay (ör. başarılı ödemeden önceki "ödeme başarısız") durumu geri almasın.
module.exports = db => {
  const extend = (table, definitions) => {
    const names = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
    for (const [name, type] of Object.entries(definitions)) {
      if (!names.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  };
  extend('webhook_logs', {
    provider: "TEXT DEFAULT 'stripe'",
    status: "TEXT DEFAULT 'processed'",
    tenant_id: 'INTEGER',
    license_id: 'INTEGER',
    invoice_id: 'INTEGER',
    event_created_at: 'INTEGER',
    error_message: 'TEXT'
  });
  extend('licenses', { last_billing_event_at: 'INTEGER', cancelled_at: 'DATETIME' });
  extend('invoices', { provider_reference: 'TEXT' });
};
