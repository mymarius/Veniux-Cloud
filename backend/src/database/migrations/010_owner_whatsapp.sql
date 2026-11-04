ALTER TABLE assistant_runs ADD COLUMN whatsapp_status TEXT DEFAULT 'not_requested';
ALTER TABLE assistant_runs ADD COLUMN whatsapp_message_id TEXT;
