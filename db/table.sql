-- Supprimer les tables si elles existent (attention : perd les donnees)
DROP TABLE IF EXISTS replies;
DROP TABLE IF EXISTS sendings;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS contacts;

-- Recreer les tables
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    siren VARCHAR(9) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_normalized VARCHAR(255) NOT NULL,
    societe VARCHAR(255) NOT NULL,
    source VARCHAR(50),
    is_generic_email BOOLEAN DEFAULT FALSE,
    is_disposable_email BOOLEAN DEFAULT FALSE,
    has_valid_mx BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sendings (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES campaigns(id),
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    current_step INTEGER DEFAULT 0,
    step_0_sent_at TIMESTAMP,
    step_1_sent_at TIMESTAMP,
    step_2_sent_at TIMESTAMP,
    replied_at TIMESTAMP,
    bounced_at TIMESTAMP,
    stopped_at TIMESTAMP,
    last_error TEXT,
    next_action_at TIMESTAMP,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS replies (
    id SERIAL PRIMARY KEY,
    sending_id INTEGER REFERENCES sendings(id),
    message_id VARCHAR(255) UNIQUE,
    from_email VARCHAR(255),
    subject TEXT,
    body TEXT,
    is_bounce BOOLEAN DEFAULT FALSE,
    bounce_type VARCHAR(50),
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creer les index
CREATE INDEX IF NOT EXISTS idx_sendings_status_next_action ON sendings(status, next_action_at);
CREATE INDEX IF NOT EXISTS idx_sendings_contact_campaign ON sendings(contact_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_replies_message_id ON replies(message_id);