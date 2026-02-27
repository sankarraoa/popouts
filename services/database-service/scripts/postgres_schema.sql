-- PostgreSQL schema for Popouts database service
-- Run this in Railway's PostgreSQL query console if you need to create tables manually.
-- Otherwise, the app creates tables automatically on startup via init_database().

-- Licenses: email, license_key, expiry, status
CREATE TABLE IF NOT EXISTS licenses (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    license_key VARCHAR(255) NOT NULL UNIQUE,
    expiry_date VARCHAR(50) NOT NULL,
    created_at VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    CONSTRAINT uq_licenses_email_key UNIQUE (email, license_key)
);
CREATE INDEX IF NOT EXISTS ix_licenses_email ON licenses (email);
CREATE INDEX IF NOT EXISTS ix_licenses_license_key ON licenses (license_key);

-- Installations: email, installation_id, activated_at, last_seen
CREATE TABLE IF NOT EXISTS installations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    installation_id VARCHAR(255) NOT NULL,
    activated_at VARCHAR(50),
    last_seen VARCHAR(50),
    CONSTRAINT uq_installations_email_inst UNIQUE (email, installation_id)
);
CREATE INDEX IF NOT EXISTS ix_installations_email ON installations (email);
CREATE INDEX IF NOT EXISTS ix_installations_installation_id ON installations (installation_id);

-- API requests: audit log
CREATE TABLE IF NOT EXISTS api_requests (
    id SERIAL PRIMARY KEY,
    timestamp VARCHAR(50),
    service VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    user_identifier VARCHAR(255),
    request_body VARCHAR(10000),
    response_body VARCHAR(10000),
    status_code INTEGER,
    duration_ms INTEGER
);

-- Extract action items: LLM extract-actions API call log
CREATE TABLE IF NOT EXISTS extract_action_items (
    id SERIAL PRIMARY KEY,
    correlation_id VARCHAR(64) NOT NULL UNIQUE,
    created_at VARCHAR(50),
    updated_at VARCHAR(50),
    license_key VARCHAR(255),
    installation_id VARCHAR(255),
    input_json TEXT,
    output_json TEXT,
    input_hash VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    http_status_code INTEGER,
    duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS ix_extract_action_items_correlation_id ON extract_action_items (correlation_id);
CREATE INDEX IF NOT EXISTS ix_extract_action_items_license_key ON extract_action_items (license_key);
CREATE INDEX IF NOT EXISTS ix_extract_action_items_installation_id ON extract_action_items (installation_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_extract_action_items_input_hash ON extract_action_items (input_hash) WHERE input_hash IS NOT NULL;
