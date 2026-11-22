// İşletme içi görev listesi (kasiyer/depocu kendi görevini görür, yönetici atar ve izler). CRM görevlerinden ayrıdır. Yalnız yeni tablo.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','doing','done')),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
      completed_at DATETIME,
      completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_business_tasks_tenant_assignee ON business_tasks(tenant_id, assignee_id, status);
    CREATE INDEX IF NOT EXISTS idx_business_tasks_tenant_due ON business_tasks(tenant_id, status, due_date);
  `);
};
