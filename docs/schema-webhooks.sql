-- Webhook and audit logging tables for production

-- Webhook logs for debugging
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT, -- 'mpesa', 'sms', 'email'
    endpoint TEXT,
    payload JSONB,
    valid BOOLEAN,
    error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_source ON webhook_logs(source);
CREATE INDEX idx_webhook_created ON webhook_logs(created_at);

-- Webhook deliveries for retry logic
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID REFERENCES webhook_logs(id),
    attempt_number INTEGER DEFAULT 1,
    status TEXT CHECK (status IN ('pending', 'success', 'failed')) DEFAULT 'pending',
    response_status INTEGER,
    response_body JSONB,
    next_retry TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    endpoint TEXT,
    ip_address INET,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint, ip_address, window_start)
);

CREATE INDEX idx_rate_limit_lookup ON rate_limits(user_id, endpoint, ip_address, window_start);

-- API keys for external integrations
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    key_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT[],
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Enable RLS
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- webhook_logs, webhook_deliveries, and rate_limits are internal operational
-- tables written exclusively by the service-role admin client (see
-- lib/supabase.ts getAdminClient / getServiceClient), which bypasses RLS
-- entirely. No policy here grants access to "authenticated" or "anon" — a
-- policy with no TO clause defaults to PUBLIC (every role, including
-- unauthenticated anon requests), which would otherwise let any signed-in
-- user, or even an anonymous caller, read every organization's rate-limit
-- counters and webhook payloads, or forge rows in them. Deliberately
-- omitting authenticated/anon policies means RLS denies all access to those
-- roles by default; only service_role (which bypasses RLS) can touch these
-- tables. Do not add a permissive "USING (true)" policy for authenticated
-- or anon here.

-- api_keys is organization-scoped data that legitimate org members do need
-- to manage from the client, so it gets real authenticated-only, org-scoped
-- policies (mirroring private.has_org_role in docs/schema.sql) instead of a
-- table-wide USING (true).
CREATE POLICY "api_keys_org_owner_manage" ON api_keys
    FOR ALL TO authenticated
    USING (private.has_org_role(organization_id, ARRAY['owner','manager']))
    WITH CHECK (private.has_org_role(organization_id, ARRAY['owner','manager']));

REVOKE ALL ON webhook_logs, webhook_deliveries, rate_limits, api_keys FROM anon;
