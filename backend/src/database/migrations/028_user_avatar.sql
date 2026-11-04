-- Profile photo: small pre-resized image stored as a data URL (validated by the API).
ALTER TABLE users ADD COLUMN avatar_url TEXT;
