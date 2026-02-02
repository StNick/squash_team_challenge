-- Add tournament status enum to replace is_active boolean
-- Made idempotent to handle partial migrations

-- Create enum type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE tournament_status AS ENUM ('draft', 'active', 'ended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add status column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE "tournaments" ADD COLUMN "status" tournament_status NOT NULL DEFAULT 'active';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Migrate existing data: is_active = true -> 'active', is_active = false -> 'ended'
-- Only run if is_active column still exists
DO $$ BEGIN
  UPDATE "tournaments" SET "status" = CASE
    WHEN "is_active" = true THEN 'active'::tournament_status
    ELSE 'ended'::tournament_status
  END;
EXCEPTION
  WHEN undefined_column THEN null;
END $$;

-- Drop the old is_active column if it exists
ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "is_active";
