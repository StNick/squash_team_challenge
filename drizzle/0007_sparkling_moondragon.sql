-- Create enum if not exists
DO $$ BEGIN
  CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'active', 'ended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
-- Add columns if not exist
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "custom_substitute_a_level" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "custom_substitute_b_level" integer;--> statement-breakpoint
ALTER TABLE "player_database" ADD COLUMN IF NOT EXISTS "level" integer DEFAULT 500000 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "player_code" varchar(50);--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "level" integer DEFAULT 500000 NOT NULL;--> statement-breakpoint
ALTER TABLE "reserves" ADD COLUMN IF NOT EXISTS "level" integer DEFAULT 500000 NOT NULL;--> statement-breakpoint
ALTER TABLE "reserves" ADD COLUMN IF NOT EXISTS "suggested_position" varchar(10);--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "status" "tournament_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "config_data" text;--> statement-breakpoint
-- Drop old columns if they exist
ALTER TABLE "matches" DROP COLUMN IF EXISTS "custom_substitute_a_skill";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN IF EXISTS "custom_substitute_b_skill";--> statement-breakpoint
ALTER TABLE "player_database" DROP COLUMN IF EXISTS "skill";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN IF EXISTS "skill";--> statement-breakpoint
ALTER TABLE "reserves" DROP COLUMN IF EXISTS "skill";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "is_active";