CREATE TABLE user_access_scopes (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 tenant_id INTEGER NOT NULL REFERENCES tenants(id),
 mode TEXT NOT NULL DEFAULT 'restricted' CHECK(mode IN ('company','restricted')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE user_warehouse_access (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
 tenant_id INTEGER NOT NULL REFERENCES tenants(id),
 PRIMARY KEY(user_id,warehouse_id)
);
CREATE INDEX idx_user_warehouse_access_tenant ON user_warehouse_access(tenant_id,user_id);
-- Explicit one-time transition: existing admins retain company administration.
-- Every other existing role starts with NO warehouse assignments.
INSERT INTO user_access_scopes(user_id,tenant_id,mode)
 SELECT id,tenant_id,CASE WHEN role='admin' THEN 'company' ELSE 'restricted' END FROM users;
INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,entity_id,details)
 SELECT tenant_id,'system:migration:027','access.scope_migrated','user',id,
 json_object('user_id',id,'previous',NULL,'new',json_object('mode',CASE WHEN role='admin' THEN 'company' ELSE 'restricted' END,'warehouse_ids',json('[]')),'policy','Existing admins company; all other users require explicit assignment') FROM users;
CREATE TRIGGER default_user_access_scope AFTER INSERT ON users BEGIN
 INSERT INTO user_access_scopes(user_id,tenant_id,mode) VALUES(NEW.id,NEW.tenant_id,'restricted');
END;
CREATE TRIGGER guard_user_warehouse_access_insert BEFORE INSERT ON user_warehouse_access
 WHEN NOT EXISTS(SELECT 1 FROM users u JOIN warehouses w ON w.id=NEW.warehouse_id WHERE u.id=NEW.user_id AND u.tenant_id=NEW.tenant_id AND w.tenant_id=NEW.tenant_id)
 BEGIN SELECT RAISE(ABORT,'Warehouse assignment tenant mismatch'); END;
CREATE TRIGGER guard_user_access_scope_insert BEFORE INSERT ON user_access_scopes
 WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND tenant_id=NEW.tenant_id)
 BEGIN SELECT RAISE(ABORT,'Access scope tenant mismatch'); END;
