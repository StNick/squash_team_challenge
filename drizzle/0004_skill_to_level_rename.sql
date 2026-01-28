-- Add playerCode column to players table
ALTER TABLE "players" ADD COLUMN "player_code" varchar(50);

-- Rename skill to level in all tables
ALTER TABLE "players" RENAME COLUMN "skill" TO "level";
ALTER TABLE "player_database" RENAME COLUMN "skill" TO "level";
ALTER TABLE "reserves" RENAME COLUMN "skill" TO "level";
ALTER TABLE "matches" RENAME COLUMN "custom_substitute_a_skill" TO "custom_substitute_a_level";
ALTER TABLE "matches" RENAME COLUMN "custom_substitute_b_skill" TO "custom_substitute_b_level";
