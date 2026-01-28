ALTER TABLE "matches" ADD COLUMN "substitute_a_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "substitute_b_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "handicap" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "reserves" ADD COLUMN "skill" integer DEFAULT 500000 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_substitute_a_id_reserves_id_fk" FOREIGN KEY ("substitute_a_id") REFERENCES "public"."reserves"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_substitute_b_id_reserves_id_fk" FOREIGN KEY ("substitute_b_id") REFERENCES "public"."reserves"("id") ON DELETE set null ON UPDATE no action;