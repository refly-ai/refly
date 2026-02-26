-- Migration: add ptc_enabled column to action_results
-- Spec: 20260224-ptc-enabled-action-results

ALTER TABLE action_results
  ADD COLUMN IF NOT EXISTS ptc_enabled BOOLEAN NOT NULL DEFAULT false;
