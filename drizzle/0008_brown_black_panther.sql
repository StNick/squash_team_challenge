ALTER TABLE "matches" ADD COLUMN "scored_at" timestamp;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "week_dates" jsonb;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "ended_at" timestamp;