CREATE TABLE business_portal_settings (
 tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE business_partners (
 id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, contact_name TEXT, phone TEXT, email TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX business_partner_tenant ON business_partners(tenant_id,id);
CREATE TABLE business_members (
 user_id INTEGER PRIMARY KEY REFERENCES users(id), tenant_id INTEGER NOT NULL REFERENCES tenants(id), portal_role TEXT NOT NULL CHECK(portal_role IN ('field','dealer')), partner_id INTEGER REFERENCES business_partners(id), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE business_assignments (
 tenant_id INTEGER NOT NULL REFERENCES tenants(id), user_id INTEGER NOT NULL REFERENCES users(id), partner_id INTEGER NOT NULL REFERENCES business_partners(id), PRIMARY KEY(tenant_id,user_id,partner_id)
);
CREATE TABLE business_invitations (
 id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES tenants(id), email TEXT NOT NULL, portal_role TEXT NOT NULL CHECK(portal_role IN ('field','dealer')), partner_id INTEGER REFERENCES business_partners(id), token_hash TEXT NOT NULL UNIQUE, expires_at DATETIME NOT NULL, redeemed_at DATETIME, created_by INTEGER NOT NULL REFERENCES users(id)
);
CREATE TABLE business_orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES tenants(id), partner_id INTEGER NOT NULL REFERENCES business_partners(id), created_by INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','rejected','cancelled')), lines_json TEXT NOT NULL, total_cents INTEGER NOT NULL CHECK(total_cents>=0), note TEXT NOT NULL DEFAULT '', request_key TEXT NOT NULL, request_hash TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, reviewed_by INTEGER REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(tenant_id,created_by,request_key)
);
CREATE INDEX business_orders_scope ON business_orders(tenant_id,partner_id,created_by,id);
CREATE TABLE business_visits (
 id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES tenants(id), partner_id INTEGER NOT NULL REFERENCES business_partners(id), user_id INTEGER NOT NULL REFERENCES users(id), note TEXT NOT NULL, visited_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
