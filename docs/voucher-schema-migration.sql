-- Migration: Add Voucher System Tables
-- Created: 2025-12-05
-- Description: Creates tables for template publishing reward vouchers, invitations, and promotion activities

-- ============================================================================
-- Table: vouchers
-- Description: Stores voucher/discount code information for users
-- ============================================================================
CREATE TABLE IF NOT EXISTS refly.vouchers (
    pk BIGSERIAL PRIMARY KEY,
    voucher_id VARCHAR(255) NOT NULL UNIQUE,
    uid VARCHAR(255) NOT NULL,
    discount_percent INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'unused',
    source VARCHAR(100) NOT NULL,
    source_id VARCHAR(255),
    llm_score INTEGER,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    subscription_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for vouchers table
CREATE INDEX idx_vouchers_uid_status_expires ON refly.vouchers(uid, status, expires_at);
CREATE INDEX idx_vouchers_status_expires ON refly.vouchers(status, expires_at);

-- Add comments to vouchers table
COMMENT ON TABLE refly.vouchers IS 'Voucher/discount code for template publishing rewards';
COMMENT ON COLUMN refly.vouchers.pk IS 'Primary key';
COMMENT ON COLUMN refly.vouchers.voucher_id IS 'Voucher ID';
COMMENT ON COLUMN refly.vouchers.uid IS 'User ID who owns this voucher';
COMMENT ON COLUMN refly.vouchers.discount_percent IS 'Discount rate (10-90, representing 10% to 90% off)';
COMMENT ON COLUMN refly.vouchers.status IS 'Voucher status: unused, used, expired, invalid';
COMMENT ON COLUMN refly.vouchers.source IS 'Voucher source: template_publish, invitation_claim';
COMMENT ON COLUMN refly.vouchers.source_id IS 'Source entity ID (template_id for publish, invitation_id for claim)';
COMMENT ON COLUMN refly.vouchers.llm_score IS 'LLM score that generated this voucher (0-100)';
COMMENT ON COLUMN refly.vouchers.expires_at IS 'Expiration timestamp (created_at + 7 days)';
COMMENT ON COLUMN refly.vouchers.used_at IS 'Used timestamp';
COMMENT ON COLUMN refly.vouchers.subscription_id IS 'Subscription ID when used';
COMMENT ON COLUMN refly.vouchers.created_at IS 'Create timestamp';
COMMENT ON COLUMN refly.vouchers.updated_at IS 'Update timestamp';

-- ============================================================================
-- Table: voucher_invitations
-- Description: Stores voucher invitation/sharing records
-- ============================================================================
CREATE TABLE IF NOT EXISTS refly.voucher_invitations (
    pk BIGSERIAL PRIMARY KEY,
    invitation_id VARCHAR(255) NOT NULL UNIQUE,
    inviter_uid VARCHAR(255) NOT NULL,
    invitee_uid VARCHAR(255),
    invite_code VARCHAR(255) NOT NULL UNIQUE,
    voucher_id VARCHAR(255) NOT NULL,
    discount_percent INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'unclaimed',
    claimed_at TIMESTAMPTZ,
    reward_granted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for voucher_invitations table
CREATE INDEX idx_voucher_invitations_inviter ON refly.voucher_invitations(inviter_uid, status);
CREATE INDEX idx_voucher_invitations_invitee ON refly.voucher_invitations(invitee_uid);
CREATE INDEX idx_voucher_invitations_code ON refly.voucher_invitations(invite_code);
CREATE INDEX idx_voucher_invitations_status ON refly.voucher_invitations(status, claimed_at);

-- Add comments to voucher_invitations table
COMMENT ON TABLE refly.voucher_invitations IS 'Voucher invitation/sharing records';
COMMENT ON COLUMN refly.voucher_invitations.pk IS 'Primary key';
COMMENT ON COLUMN refly.voucher_invitations.invitation_id IS 'Invitation ID';
COMMENT ON COLUMN refly.voucher_invitations.inviter_uid IS 'Inviter user ID';
COMMENT ON COLUMN refly.voucher_invitations.invitee_uid IS 'Invitee user ID (NULL if not yet registered)';
COMMENT ON COLUMN refly.voucher_invitations.invite_code IS 'Unique invitation code for URL parameter';
COMMENT ON COLUMN refly.voucher_invitations.voucher_id IS 'Voucher ID associated with this invitation';
COMMENT ON COLUMN refly.voucher_invitations.discount_percent IS 'Discount rate of the shared voucher';
COMMENT ON COLUMN refly.voucher_invitations.status IS 'Invitation status: unclaimed, claimed, expired';
COMMENT ON COLUMN refly.voucher_invitations.claimed_at IS 'Claimed timestamp';
COMMENT ON COLUMN refly.voucher_invitations.reward_granted IS 'Whether inviter reward (2000 credits) has been granted';
COMMENT ON COLUMN refly.voucher_invitations.created_at IS 'Create timestamp';
COMMENT ON COLUMN refly.voucher_invitations.updated_at IS 'Update timestamp';

-- ============================================================================
-- Table: voucher_popup_logs
-- Description: User voucher popup display logs (for daily trigger limit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS refly.voucher_popup_logs (
    pk BIGSERIAL PRIMARY KEY,
    uid VARCHAR(255) NOT NULL,
    template_id VARCHAR(255) NOT NULL,
    popup_date VARCHAR(10) NOT NULL,
    voucher_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for voucher_popup_logs table
CREATE INDEX idx_voucher_popup_logs_uid_date ON refly.voucher_popup_logs(uid, popup_date);
CREATE INDEX idx_voucher_popup_logs_voucher ON refly.voucher_popup_logs(voucher_id);

-- Add comments to voucher_popup_logs table
COMMENT ON TABLE refly.voucher_popup_logs IS 'User voucher popup display logs (for daily trigger limit)';
COMMENT ON COLUMN refly.voucher_popup_logs.pk IS 'Primary key';
COMMENT ON COLUMN refly.voucher_popup_logs.uid IS 'User ID';
COMMENT ON COLUMN refly.voucher_popup_logs.template_id IS 'Template ID that triggered the popup';
COMMENT ON COLUMN refly.voucher_popup_logs.popup_date IS 'Popup date (YYYY-MM-DD) for daily counting';
COMMENT ON COLUMN refly.voucher_popup_logs.voucher_id IS 'Voucher ID generated from this popup';
COMMENT ON COLUMN refly.voucher_popup_logs.created_at IS 'Create timestamp';

-- ============================================================================
-- Table: promotion_activities
-- Description: Promotion activity configuration (read by frontend)
-- ============================================================================
CREATE TABLE IF NOT EXISTS refly.promotion_activities (
    pk BIGSERIAL PRIMARY KEY,
    activity_id VARCHAR(255) NOT NULL UNIQUE,
    activity_name VARCHAR(255) NOT NULL,
    activity_text TEXT NOT NULL,
    image_url TEXT NOT NULL,
    landing_page_url TEXT NOT NULL,
    landing_page_url_zh TEXT,
    landing_page_url_en TEXT,
    positions TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Create indexes for promotion_activities table
CREATE INDEX idx_promotion_activities_status ON refly.promotion_activities(status, deleted_at);
CREATE INDEX idx_promotion_activities_created ON refly.promotion_activities(created_at);

-- Add comments to promotion_activities table
COMMENT ON TABLE refly.promotion_activities IS 'Promotion activity configuration (read by frontend)';
COMMENT ON COLUMN refly.promotion_activities.pk IS 'Primary key';
COMMENT ON COLUMN refly.promotion_activities.activity_id IS 'Activity ID';
COMMENT ON COLUMN refly.promotion_activities.activity_name IS 'Activity name (for admin reference)';
COMMENT ON COLUMN refly.promotion_activities.activity_text IS 'Activity text to display at entry point';
COMMENT ON COLUMN refly.promotion_activities.image_url IS 'Activity image URL (required)';
COMMENT ON COLUMN refly.promotion_activities.landing_page_url IS 'Default landing page URL';
COMMENT ON COLUMN refly.promotion_activities.landing_page_url_zh IS 'Chinese landing page URL (optional)';
COMMENT ON COLUMN refly.promotion_activities.landing_page_url_en IS 'English landing page URL (optional)';
COMMENT ON COLUMN refly.promotion_activities.positions IS 'Display positions (array): dashboard, marketplace';
COMMENT ON COLUMN refly.promotion_activities.status IS 'Activity status: draft, published, unpublished';
COMMENT ON COLUMN refly.promotion_activities.created_at IS 'Create timestamp';
COMMENT ON COLUMN refly.promotion_activities.updated_at IS 'Update timestamp';
COMMENT ON COLUMN refly.promotion_activities.deleted_at IS 'Soft delete timestamp';

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Verify tables were created
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'refly' AND columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'refly'
    AND table_name IN ('vouchers', 'voucher_invitations', 'voucher_popup_logs', 'promotion_activities')
ORDER BY table_name;

-- Verify indexes were created
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'refly'
    AND tablename IN ('vouchers', 'voucher_invitations', 'voucher_popup_logs', 'promotion_activities')
ORDER BY tablename, indexname;
