CREATE TABLE cloud_license_bindings (
 authority_license_id INTEGER PRIMARY KEY,
 tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX cloud_license_binding_tenant ON cloud_license_bindings(tenant_id);
