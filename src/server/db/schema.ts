import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  timestamp,
  boolean,
  primaryKey,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Tournament status enum
export const tournamentStatusEnum = pgEnum("tournament_status", ["draft", "active", "ended"]);
export type TournamentStatus = "draft" | "active" | "ended";

// Type for weekDates JSON structure: { 1: "2024-10-05", 2: "2024-10-12", ... }
export type WeekDates = Record<number, string>;

// Tournament table - stores tournament metadata
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  numWeeks: integer("num_weeks").notNull().default(10),
  currentWeek: integer("current_week").notNull().default(1),
  status: tournamentStatusEnum("status").notNull().default("active"),
  configData: text("config_data"), // JSON config for draft tournaments (cleared on activation)
  weekDates: jsonb("week_dates").$type<WeekDates>(), // Maps week numbers to play dates
  password: varchar("password", { length: 100 }), // Optional password for public access
  endedAt: timestamp("ended_at"), // When the tournament was ended
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Teams table - stores team information
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(), // Hex color code
  totalScore: integer("total_score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Players table - stores player information
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  playerCode: varchar("player_code", { length: 50 }), // MySquash unique identifier
  level: integer("level").notNull().default(500000), // 1-1,000,000 level rating
  position: integer("position").notNull(), // 1-5 position within team
  isCaptain: boolean("is_captain").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Weekly matchups table - which teams play each other each week
export const weeklyMatchups = pgTable("weekly_matchups", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  week: integer("week").notNull(),
  teamAId: integer("team_a_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  teamBId: integer("team_b_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  teamAScore: integer("team_a_score").default(0),
  teamBScore: integer("team_b_score").default(0),
  isComplete: boolean("is_complete").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Individual matches table - player vs player matches
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  weeklyMatchupId: integer("weekly_matchup_id")
    .notNull()
    .references(() => weeklyMatchups.id, { onDelete: "cascade" }),
  position: integer("position").notNull(), // 1-5
  playerAId: integer("player_a_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  playerBId: integer("player_b_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  substituteAId: integer("substitute_a_id")
    .references(() => reserves.id, { onDelete: "set null" }),
  substituteBId: integer("substitute_b_id")
    .references(() => reserves.id, { onDelete: "set null" }),
  // Custom substitute fields for non-member/player database substitutes
  customSubstituteAName: varchar("custom_substitute_a_name", { length: 255 }),
  customSubstituteALevel: integer("custom_substitute_a_level"),
  customSubstituteBName: varchar("custom_substitute_b_name", { length: 255 }),
  customSubstituteBLevel: integer("custom_substitute_b_level"),
  scoreA: integer("score_a"), // nullable until score entered
  scoreB: integer("score_b"),
  handicap: integer("handicap").default(0), // Percentage: Positive = A's score reduced, Negative = B's score reduced
  scoredAt: timestamp("scored_at"), // When scores were first entered (for auditing)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Weekly duties table - dinner and cleanup assignments
export const weeklyDuties = pgTable("weekly_duties", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  week: integer("week").notNull(),
  dinnerTeamId: integer("dinner_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  cleanupTeamId: integer("cleanup_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Player Database table - global directory of all players
export const playerDatabase = pgTable("player_database", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  playerCode: varchar("player_code", { length: 50 }), // MySquash unique identifier
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  level: integer("level").notNull().default(500000),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Reserves table - reserve player directory
export const reserves = pgTable("reserves", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  playerDatabaseId: integer("player_database_id")
    .references(() => playerDatabase.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  notes: text("notes"),
  level: integer("level").notNull().default(500000),
  suggestedPosition: varchar("suggested_position", { length: 10 }), // e.g. "1", "1-2", "2-3"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// First on Court table - tracks which position group plays first each week
export const firstOnCourt = pgTable("first_on_court", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  week: integer("week").notNull(),
  positionGroup: integer("position_group").notNull(), // 1-4 (Position 1-4)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Admin settings table - stores admin password hash
export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Admin sessions table - stores session tokens for persistence across server restarts
export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Relations
export const tournamentsRelations = relations(tournaments, ({ many }) => ({
  teams: many(teams),
  players: many(players),
  weeklyMatchups: many(weeklyMatchups),
  weeklyDuties: many(weeklyDuties),
  reserves: many(reserves),
  firstOnCourt: many(firstOnCourt),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [teams.tournamentId],
    references: [tournaments.id],
  }),
  players: many(players),
  homeMatchups: many(weeklyMatchups, { relationName: "teamA" }),
  awayMatchups: many(weeklyMatchups, { relationName: "teamB" }),
  dinnerDuties: many(weeklyDuties, { relationName: "dinner" }),
  cleanupDuties: many(weeklyDuties, { relationName: "cleanup" }),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [players.tournamentId],
    references: [tournaments.id],
  }),
  team: one(teams, {
    fields: [players.teamId],
    references: [teams.id],
  }),
  matchesAsA: many(matches, { relationName: "playerA" }),
  matchesAsB: many(matches, { relationName: "playerB" }),
}));

export const weeklyMatchupsRelations = relations(
  weeklyMatchups,
  ({ one, many }) => ({
    tournament: one(tournaments, {
      fields: [weeklyMatchups.tournamentId],
      references: [tournaments.id],
    }),
    teamA: one(teams, {
      fields: [weeklyMatchups.teamAId],
      references: [teams.id],
      relationName: "teamA",
    }),
    teamB: one(teams, {
      fields: [weeklyMatchups.teamBId],
      references: [teams.id],
      relationName: "teamB",
    }),
    matches: many(matches),
  })
);

export const matchesRelations = relations(matches, ({ one }) => ({
  weeklyMatchup: one(weeklyMatchups, {
    fields: [matches.weeklyMatchupId],
    references: [weeklyMatchups.id],
  }),
  playerA: one(players, {
    fields: [matches.playerAId],
    references: [players.id],
    relationName: "playerA",
  }),
  playerB: one(players, {
    fields: [matches.playerBId],
    references: [players.id],
    relationName: "playerB",
  }),
  substituteA: one(reserves, {
    fields: [matches.substituteAId],
    references: [reserves.id],
    relationName: "substituteA",
  }),
  substituteB: one(reserves, {
    fields: [matches.substituteBId],
    references: [reserves.id],
    relationName: "substituteB",
  }),
}));

export const weeklyDutiesRelations = relations(weeklyDuties, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [weeklyDuties.tournamentId],
    references: [tournaments.id],
  }),
  dinnerTeam: one(teams, {
    fields: [weeklyDuties.dinnerTeamId],
    references: [teams.id],
    relationName: "dinner",
  }),
  cleanupTeam: one(teams, {
    fields: [weeklyDuties.cleanupTeamId],
    references: [teams.id],
    relationName: "cleanup",
  }),
}));

export const playerDatabaseRelations = relations(playerDatabase, ({ many }) => ({
  reserves: many(reserves),
}));

export const reservesRelations = relations(reserves, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [reserves.tournamentId],
    references: [tournaments.id],
  }),
  playerDatabaseEntry: one(playerDatabase, {
    fields: [reserves.playerDatabaseId],
    references: [playerDatabase.id],
  }),
  matchesAsSubstituteA: many(matches, { relationName: "substituteA" }),
  matchesAsSubstituteB: many(matches, { relationName: "substituteB" }),
}));

export const firstOnCourtRelations = relations(firstOnCourt, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [firstOnCourt.tournamentId],
    references: [tournaments.id],
  }),
}));

// Type exports
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type WeeklyMatchup = typeof weeklyMatchups.$inferSelect;
export type NewWeeklyMatchup = typeof weeklyMatchups.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type WeeklyDuty = typeof weeklyDuties.$inferSelect;
export type NewWeeklyDuty = typeof weeklyDuties.$inferInsert;
export type PlayerDatabaseEntry = typeof playerDatabase.$inferSelect;
export type NewPlayerDatabaseEntry = typeof playerDatabase.$inferInsert;
export type Reserve = typeof reserves.$inferSelect;
export type NewReserve = typeof reserves.$inferInsert;
export type FirstOnCourt = typeof firstOnCourt.$inferSelect;
export type NewFirstOnCourt = typeof firstOnCourt.$inferInsert;
export type AdminSettings = typeof adminSettings.$inferSelect;
export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;
