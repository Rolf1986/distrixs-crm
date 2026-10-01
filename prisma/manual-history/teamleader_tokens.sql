ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS teamleader_access_token TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS teamleader_refresh_token TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS teamleader_token_expires_at TIMESTAMP;
