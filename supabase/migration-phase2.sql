-- ===========================================================================
-- Vitals — Phase 2 migration.
-- Run this once in the Supabase SQL Editor if you created your database with
-- the original Phase 1 schema. It adds the one column Phase 2 needs.
-- (If you run the full schema.sql fresh, this is already included.)
-- ===========================================================================

alter table food_item add column if not exists quantity text;
