import { createServerFn } from "@tanstack/react-start";
import { db } from "../db";
import {
  tournaments,
  teams,
  players,
  weeklyMatchups,
  matches,
  weeklyDuties,
  reserves,
  firstOnCourt,
  playerDatabase,
  type WeekDates,
} from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  parsePlayersCsv,
  parseReservesCsv,
  generateRoundRobinSchedule,
  assignDuties,
  assignFirstOnCourt,
  distributePlayersToTeams,
  parseDutiesOrder,
  parseFirstOnCourtOrder,
  parseMatchupSchedule,
  calculatePositionLevelRanges,
  calculateSuggestedLevel,
  type PlayerInput,
} from "../lib/generation";
import { sql } from "drizzle-orm";

// Configuration stored in configData for draft tournaments
export interface TournamentConfig {
  numTeams: number;
  selectedPlayerIds: number[];
  playersCsv: string;
  selectedReserveIds: number[];
  reservesCsv: string;
  // Advanced options
  dinnerDutiesOrder?: string;
  cleanupDutiesOrder?: string;
  firstOnCourtOrder?: string;
  matchupSchedule?: string;
}

/**
 * Generate all tournament data (teams, players, matchups, matches, duties, etc.)
 * Called when activating a draft tournament.
 */
async function generateTournamentData(
  tournamentId: number,
  numWeeks: number,
  config: TournamentConfig
): Promise<void> {
  const {
    numTeams,
    playersCsv,
    selectedPlayerIds,
    selectedReserveIds,
    reservesCsv,
    dinnerDutiesOrder,
    cleanupDutiesOrder,
    firstOnCourtOrder,
    matchupSchedule,
  } = config;

  // Parse CSV players
  const csvPlayers = playersCsv.trim() ? parsePlayersCsv(playersCsv) : [];

  // Fetch selected players from database
  let dbPlayers: PlayerInput[] = [];
  if (selectedPlayerIds.length > 0) {
    const dbPlayerRecords = await db.query.playerDatabase.findMany({
      where: inArray(playerDatabase.id, selectedPlayerIds),
    });
    dbPlayers = dbPlayerRecords.map((p) => ({
      name: p.name,
      level: p.level,
      playerCode: p.playerCode ?? undefined,
    }));
  }

  // Merge players: database players first, then CSV players
  const playerInputs: PlayerInput[] = [...dbPlayers, ...csvPlayers];

  if (playerInputs.length < numTeams) {
    throw new Error("Not enough players for the number of teams");
  }

  // Generate teams with players using snake draft
  const generatedTeams = distributePlayersToTeams(playerInputs, numTeams);

  // Insert teams and players
  const teamRecords: { id: number; index: number; name: string }[] = [];
  for (let i = 0; i < generatedTeams.length; i++) {
    const teamData = generatedTeams[i];
    const [team] = await db
      .insert(teams)
      .values({
        tournamentId,
        name: teamData.name,
        color: teamData.color,
        totalScore: 0,
      })
      .returning();

    const teamNameOnly = teamData.name.replace("Team ", "");
    teamRecords.push({ id: team.id, index: i, name: teamNameOnly });

    // Insert players for this team
    for (const playerData of teamData.players) {
      await db.insert(players).values({
        tournamentId,
        teamId: team.id,
        name: playerData.name,
        playerCode: playerData.playerCode ?? null,
        level: playerData.level,
        position: playerData.position,
        isCaptain: playerData.isCaptain,
      });
    }
  }

  // Helper to find team by name (case-insensitive)
  const findTeamByName = (teamName: string) => {
    const normalized = teamName.toLowerCase().trim();
    return teamRecords.find((t) => t.name.toLowerCase() === normalized);
  };

  // Get team names for validation
  const validTeamNames = teamRecords.map((t) => t.name);

  // Parse custom matchup schedule if provided
  const customMatchups = matchupSchedule?.trim()
    ? parseMatchupSchedule(matchupSchedule, validTeamNames)
    : null;

  // Generate schedule - use custom if provided, otherwise round-robin
  if (customMatchups && customMatchups.length > 0) {
    // Use custom matchup schedule
    for (let week = 0; week < numWeeks; week++) {
      const weekMatchups = customMatchups[week % customMatchups.length];

      for (const matchup of weekMatchups) {
        const teamA = findTeamByName(matchup.teamA);
        const teamB = findTeamByName(matchup.teamB);

        if (!teamA || !teamB) {
          throw new Error(
            `Could not find teams for matchup: ${matchup.teamA} vs ${matchup.teamB}`
          );
        }

        // Insert weekly matchup
        const [weeklyMatchup] = await db
          .insert(weeklyMatchups)
          .values({
            tournamentId,
            week: week + 1,
            teamAId: teamA.id,
            teamBId: teamB.id,
            teamAScore: 0,
            teamBScore: 0,
            isComplete: false,
          })
          .returning();

        // Get players for both teams
        const teamAPlayers = await db.query.players.findMany({
          where: eq(players.teamId, teamA.id),
          orderBy: (p, { asc }) => [asc(p.position)],
        });

        const teamBPlayers = await db.query.players.findMany({
          where: eq(players.teamId, teamB.id),
          orderBy: (p, { asc }) => [asc(p.position)],
        });

        // Create individual matches (position vs position)
        const numMatches = Math.min(teamAPlayers.length, teamBPlayers.length);
        for (let pos = 0; pos < numMatches; pos++) {
          await db.insert(matches).values({
            weeklyMatchupId: weeklyMatchup.id,
            position: pos + 1,
            playerAId: teamAPlayers[pos].id,
            playerBId: teamBPlayers[pos].id,
          });
        }
      }
    }
  } else {
    // Use generated round-robin schedule
    const schedule = generateRoundRobinSchedule(numTeams, numWeeks);

    for (let week = 0; week < numWeeks; week++) {
      const weekMatchups = schedule[week];

      for (const matchup of weekMatchups) {
        const teamA = teamRecords.find((t) => t.index === matchup.teamAIndex)!;
        const teamB = teamRecords.find((t) => t.index === matchup.teamBIndex)!;

        // Insert weekly matchup
        const [weeklyMatchup] = await db
          .insert(weeklyMatchups)
          .values({
            tournamentId,
            week: week + 1,
            teamAId: teamA.id,
            teamBId: teamB.id,
            teamAScore: 0,
            teamBScore: 0,
            isComplete: false,
          })
          .returning();

        // Get players for both teams
        const teamAPlayers = await db.query.players.findMany({
          where: eq(players.teamId, teamA.id),
          orderBy: (p, { asc }) => [asc(p.position)],
        });

        const teamBPlayers = await db.query.players.findMany({
          where: eq(players.teamId, teamB.id),
          orderBy: (p, { asc }) => [asc(p.position)],
        });

        // Create individual matches (position vs position)
        const numMatches = Math.min(teamAPlayers.length, teamBPlayers.length);
        for (let pos = 0; pos < numMatches; pos++) {
          await db.insert(matches).values({
            weeklyMatchupId: weeklyMatchup.id,
            position: pos + 1,
            playerAId: teamAPlayers[pos].id,
            playerBId: teamBPlayers[pos].id,
          });
        }
      }
    }
  }

  // Parse custom duty orders if provided
  const customDinnerDuties = dinnerDutiesOrder?.trim()
    ? parseDutiesOrder(dinnerDutiesOrder, validTeamNames)
    : null;
  const customCleanupDuties = cleanupDutiesOrder?.trim()
    ? parseDutiesOrder(cleanupDutiesOrder, validTeamNames)
    : null;

  // Generate and insert duties
  if (customDinnerDuties && customCleanupDuties) {
    // Use custom duty orders
    for (let week = 0; week < numWeeks; week++) {
      const dinnerTeamName = customDinnerDuties[week % customDinnerDuties.length];
      const cleanupTeamName =
        customCleanupDuties[week % customCleanupDuties.length];

      const dinnerTeam = findTeamByName(dinnerTeamName);
      const cleanupTeam = findTeamByName(cleanupTeamName);

      if (!dinnerTeam || !cleanupTeam) {
        throw new Error(
          `Could not find teams for duties: dinner=${dinnerTeamName}, cleanup=${cleanupTeamName}`
        );
      }

      await db.insert(weeklyDuties).values({
        tournamentId,
        week: week + 1,
        dinnerTeamId: dinnerTeam.id,
        cleanupTeamId: cleanupTeam.id,
      });
    }
  } else {
    // Use generated random duties
    const duties = assignDuties(numTeams, numWeeks);
    for (let week = 0; week < numWeeks; week++) {
      const duty = duties[week];
      const dinnerTeam = teamRecords.find(
        (t) => t.index === duty.dinnerTeamIndex
      )!;
      const cleanupTeam = teamRecords.find(
        (t) => t.index === duty.cleanupTeamIndex
      )!;

      await db.insert(weeklyDuties).values({
        tournamentId,
        week: week + 1,
        dinnerTeamId: dinnerTeam.id,
        cleanupTeamId: cleanupTeam.id,
      });
    }
  }

  // Parse custom first on court order if provided
  const customFirstOnCourt = firstOnCourtOrder?.trim()
    ? parseFirstOnCourtOrder(firstOnCourtOrder)
    : null;

  // Generate and insert first on court assignments
  if (customFirstOnCourt && customFirstOnCourt.length > 0) {
    // Use custom first on court order
    for (let week = 0; week < numWeeks; week++) {
      const positionGroup = customFirstOnCourt[week % customFirstOnCourt.length];
      await db.insert(firstOnCourt).values({
        tournamentId,
        week: week + 1,
        positionGroup,
      });
    }
  } else {
    // Use generated random first on court
    const firstOnCourtAssignments = assignFirstOnCourt(numWeeks);
    for (const assignment of firstOnCourtAssignments) {
      await db.insert(firstOnCourt).values({
        tournamentId,
        week: assignment.week,
        positionGroup: assignment.positionGroup,
      });
    }
  }

  // Calculate level ranges from tournament players for reserve level calculation
  const allTournamentPlayers = await db.query.players.findMany({
    where: eq(players.tournamentId, tournamentId),
  });
  const levelRanges = calculatePositionLevelRanges(allTournamentPlayers);

  // Create reserves from selected database players
  if (selectedReserveIds.length > 0) {
    const selectedReservePlayers = await db.query.playerDatabase.findMany({
      where: inArray(playerDatabase.id, selectedReserveIds),
    });

    for (const dbPlayer of selectedReservePlayers) {
      // Calculate suggested position based on level
      let suggestedPosition: string | null = null;
      if (levelRanges.length > 0) {
        const position = calculateSuggestedLevel(dbPlayer.level, levelRanges);
        suggestedPosition = String(position);
      }

      await db.insert(reserves).values({
        tournamentId,
        playerDatabaseId: dbPlayer.id,
        name: dbPlayer.name,
        phone: dbPlayer.phone || null,
        email: dbPlayer.email || null,
        level: dbPlayer.level,
        suggestedPosition,
        isActive: true,
      });
    }
  }

  // Create reserves from CSV
  if (reservesCsv?.trim()) {
    const reserveInputs = parseReservesCsv(reservesCsv);

    for (const reserve of reserveInputs) {
      // Add to player database if not exists (case-insensitive check)
      const existingPlayer = await db.query.playerDatabase.findFirst({
        where: sql`LOWER(${playerDatabase.name}) = LOWER(${reserve.name})`,
      });

      let playerDbId: number | null = existingPlayer?.id ?? null;
      let reserveLevel = reserve.level;

      if (!existingPlayer) {
        // Use provided level or default to 500000
        const levelValue = reserve.level ?? 500000;
        const [newPlayer] = await db
          .insert(playerDatabase)
          .values({
            name: reserve.name,
            phone: reserve.phone || null,
            level: levelValue,
            isActive: true,
          })
          .returning();
        playerDbId = newPlayer.id;
        reserveLevel = levelValue;
      } else {
        // Update player database with level if provided
        if (reserve.level !== undefined) {
          await db
            .update(playerDatabase)
            .set({ level: reserve.level })
            .where(eq(playerDatabase.id, existingPlayer.id));
          reserveLevel = reserve.level;
        } else {
          reserveLevel = existingPlayer.level;
        }
      }

      // Calculate suggested position based on level and tournament player level ranges
      let suggestedPosition: string | null = null;
      if (reserveLevel !== undefined && levelRanges.length > 0) {
        const position = calculateSuggestedLevel(reserveLevel, levelRanges);
        suggestedPosition = String(position);
      }

      // Create reserve entry for tournament
      await db.insert(reserves).values({
        tournamentId,
        playerDatabaseId: playerDbId,
        name: reserve.name,
        phone: reserve.phone || null,
        level: reserveLevel ?? 500000,
        suggestedPosition,
        isActive: true,
      });
    }
  }
}

// Get all data needed for the public dashboard
export const getDashboardData = createServerFn({ method: "GET" })
  .inputValidator((data?: { tournamentId?: number }) => data)
  .handler(async ({ data }) => {
    // Get tournament - either by ID or find the active one
    const tournament = await db.query.tournaments.findFirst({
      where: data?.tournamentId
        ? eq(tournaments.id, data.tournamentId)
        : eq(tournaments.status, "active"),
      with: {
        teams: {
          with: {
            players: {
              orderBy: (players, { asc }) => [asc(players.position)],
            },
          },
        },
        reserves: {
          where: eq(reserves.isActive, true),
        },
        firstOnCourt: true,
      },
    });

    if (!tournament) {
      return { tournament: null };
    }

    // Get all weekly matchups with matches
    const allMatchups = await db.query.weeklyMatchups.findMany({
      where: eq(weeklyMatchups.tournamentId, tournament.id),
      with: {
        teamA: true,
        teamB: true,
        matches: {
          with: {
            playerA: true,
            playerB: true,
            substituteA: true,
            substituteB: true,
          },
          orderBy: (matches, { asc }) => [asc(matches.position)],
        },
      },
      orderBy: (wm, { asc }) => [asc(wm.week), asc(wm.id)],
    });

    // Get all weekly duties
    const allDuties = await db.query.weeklyDuties.findMany({
      where: eq(weeklyDuties.tournamentId, tournament.id),
      with: {
        dinnerTeam: true,
        cleanupTeam: true,
      },
      orderBy: (wd, { asc }) => [asc(wd.week)],
    });

    // Get first on court for current week
    const currentFirstOnCourt = tournament.firstOnCourt.find(
      (f) => f.week === tournament.currentWeek
    );

    // Group matchups by week
    const weeklyData: Record<
      number,
      {
        matchups: typeof allMatchups;
        duties: (typeof allDuties)[0] | undefined;
        firstOnCourt: number | undefined;
      }
    > = {};

    for (let week = 1; week <= tournament.numWeeks; week++) {
      const weekFirstOnCourt = tournament.firstOnCourt.find((f) => f.week === week);
      weeklyData[week] = {
        matchups: allMatchups.filter((m) => m.week === week),
        duties: allDuties.find((d) => d.week === week),
        firstOnCourt: weekFirstOnCourt?.positionGroup,
      };
    }

    // Calculate team standings
    const standings = tournament.teams
      .map((team) => ({
        ...team,
        totalScore: team.totalScore,
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    return {
      tournament: {
        ...tournament,
        weeklyData,
        standings,
        currentFirstOnCourt: currentFirstOnCourt?.positionGroup,
      },
    };
  });

// Get list of all tournaments for selector
export const getTournamentList = createServerFn({ method: "GET" }).handler(
  async () => {
    const allTournaments = await db.query.tournaments.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      columns: {
        id: true,
        name: true,
        status: true,
        currentWeek: true,
        numWeeks: true,
        createdAt: true,
        configData: true,
        weekDates: true,
        endedAt: true,
      },
      with: {
        teams: {
          columns: {
            id: true,
          },
        },
      },
    });

    // Transform to include numTeams (from configData for drafts, from team count for active/ended)
    const tournamentsWithNumTeams = allTournaments.map((t) => {
      let numTeams: number | undefined;
      if (t.status === "draft" && t.configData) {
        const config: TournamentConfig = JSON.parse(t.configData);
        numTeams = config.numTeams;
      } else {
        numTeams = t.teams.length;
      }
      return {
        id: t.id,
        name: t.name,
        status: t.status,
        currentWeek: t.currentWeek,
        numWeeks: t.numWeeks,
        createdAt: t.createdAt,
        weekDates: t.weekDates,
        endedAt: t.endedAt,
        numTeams,
      };
    });

    return { tournaments: tournamentsWithNumTeams };
  }
);

// Update tournament status (generates data when activating a draft)
export const updateTournamentStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      tournamentId: number;
      status: "draft" | "active" | "ended";
      week1Date?: string; // ISO date string for week 1 when activating
    }) => data
  )
  .handler(async ({ data }) => {
    const { tournamentId, status, week1Date } = data;

    // Get the tournament to check its current state
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });

    if (!tournament) {
      throw new Error("Tournament not found");
    }

    // When activating a draft tournament, generate all tournament data first
    if (status === "active" && tournament.status === "draft") {
      // Verify configData exists
      if (!tournament.configData) {
        throw new Error("Cannot activate tournament: configuration data is missing");
      }

      const config: TournamentConfig = JSON.parse(tournament.configData);

      // Deactivate any existing active tournament (set endedAt)
      await db
        .update(tournaments)
        .set({ status: "ended", endedAt: new Date(), updatedAt: new Date() })
        .where(eq(tournaments.status, "active"));

      // Generate all tournament data (teams, players, matchups, etc.)
      await generateTournamentData(tournamentId, tournament.numWeeks, config);

      // Build weekDates with week 1 date if provided
      const weekDates: WeekDates | null = week1Date ? { 1: week1Date } : null;

      // Update status to active and clear configData
      await db
        .update(tournaments)
        .set({
          status: "active",
          configData: null,
          weekDates,
          updatedAt: new Date(),
        })
        .where(eq(tournaments.id, tournamentId));

      return { success: true };
    }

    // For other status changes, just update the status
    if (status === "active") {
      // Deactivate any existing active tournament (set endedAt)
      await db
        .update(tournaments)
        .set({ status: "ended", endedAt: new Date(), updatedAt: new Date() })
        .where(eq(tournaments.status, "active"));
    }

    // When ending a tournament, set endedAt
    if (status === "ended") {
      await db
        .update(tournaments)
        .set({ status, endedAt: new Date(), updatedAt: new Date() })
        .where(eq(tournaments.id, tournamentId));

      return { success: true };
    }

    await db
      .update(tournaments)
      .set({ status, updatedAt: new Date() })
      .where(eq(tournaments.id, tournamentId));

    return { success: true };
  });

// Create a new tournament (draft only - generation happens on activation)
export const createTournament = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      numWeeks: number;
      numTeams: number;
      playersCsv: string;
      selectedPlayerIds?: number[];
      selectedReserveIds?: number[];
      reservesCsv?: string;
      // Advanced options for pre-defined tournament configuration
      dinnerDutiesOrder?: string;
      cleanupDutiesOrder?: string;
      firstOnCourtOrder?: string;
      matchupSchedule?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    const {
      name,
      numWeeks,
      numTeams,
      playersCsv,
      selectedPlayerIds = [],
      selectedReserveIds = [],
      reservesCsv,
      dinnerDutiesOrder,
      cleanupDutiesOrder,
      firstOnCourtOrder,
      matchupSchedule,
    } = data;

    // Parse CSV players to validate and auto-add to player database
    const csvPlayers = playersCsv.trim() ? parsePlayersCsv(playersCsv) : [];

    // Auto-add CSV players to the player database (with deduplication)
    if (csvPlayers.length > 0) {
      const existingDbPlayers = await db.query.playerDatabase.findMany();
      const existingNames = new Set(
        existingDbPlayers.map((p) => p.name.toLowerCase().trim())
      );

      for (const csvPlayer of csvPlayers) {
        const normalizedName = csvPlayer.name.toLowerCase().trim();
        if (!existingNames.has(normalizedName)) {
          await db.insert(playerDatabase).values({
            name: csvPlayer.name,
            level: csvPlayer.level,
            isActive: true,
          });
          existingNames.add(normalizedName);
        }
      }
    }

    // Build config to store
    const config: TournamentConfig = {
      numTeams,
      selectedPlayerIds,
      playersCsv,
      selectedReserveIds,
      reservesCsv: reservesCsv || "",
      dinnerDutiesOrder,
      cleanupDutiesOrder,
      firstOnCourtOrder,
      matchupSchedule,
    };

    // Create tournament as draft with config stored
    // Generation happens when the tournament is activated
    const [tournament] = await db
      .insert(tournaments)
      .values({
        name,
        numWeeks,
        currentWeek: 1,
        status: "draft",
        configData: JSON.stringify(config),
      })
      .returning();

    return { success: true, tournamentId: tournament.id };
  });

// Advance to next week
export const advanceWeek = createServerFn({ method: "POST" })
  .inputValidator((data?: { weekDate?: string }) => data)
  .handler(async ({ data }) => {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.status, "active"),
    });

    if (!tournament) {
      throw new Error("No active tournament");
    }

    if (tournament.currentWeek >= tournament.numWeeks) {
      throw new Error("Tournament is already at the final week");
    }

    const newWeek = tournament.currentWeek + 1;

    // Update weekDates if a date is provided
    let updatedWeekDates: WeekDates | null = tournament.weekDates ?? null;
    if (data?.weekDate) {
      updatedWeekDates = {
        ...(tournament.weekDates ?? {}),
        [newWeek]: data.weekDate,
      };
    }

    await db
      .update(tournaments)
      .set({
        currentWeek: newWeek,
        weekDates: updatedWeekDates,
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, tournament.id));

    return { success: true, newWeek };
  });

// Go back to previous week
export const goBackWeek = createServerFn({ method: "POST" }).handler(
  async () => {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.status, "active"),
    });

    if (!tournament) {
      throw new Error("No active tournament");
    }

    if (tournament.currentWeek <= 1) {
      throw new Error("Tournament is already at week 1");
    }

    await db
      .update(tournaments)
      .set({
        currentWeek: tournament.currentWeek - 1,
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, tournament.id));

    return { success: true, newWeek: tournament.currentWeek - 1 };
  }
);

// Get a draft tournament for editing (returns stored config directly)
export const getDraftTournamentForEdit = createServerFn({ method: "GET" })
  .inputValidator((data: { tournamentId: number }) => data)
  .handler(async ({ data }) => {
    const { tournamentId } = data;

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });

    if (!tournament) {
      throw new Error("Tournament not found");
    }

    if (tournament.status !== "draft") {
      throw new Error("Only draft tournaments can be edited");
    }

    if (!tournament.configData) {
      throw new Error("Tournament configuration data is missing");
    }

    // Parse and return the stored config directly
    const config: TournamentConfig = JSON.parse(tournament.configData);

    return {
      tournament: {
        id: tournament.id,
        name: tournament.name,
        numWeeks: tournament.numWeeks,
        numTeams: config.numTeams,
        status: tournament.status,
      },
      selectedPlayerIds: config.selectedPlayerIds,
      playersCsv: config.playersCsv,
      selectedReserveIds: config.selectedReserveIds,
      reservesCsv: config.reservesCsv,
      // Advanced options
      dinnerDutiesOrder: config.dinnerDutiesOrder || "",
      cleanupDutiesOrder: config.cleanupDutiesOrder || "",
      firstOnCourtOrder: config.firstOnCourtOrder || "",
      matchupSchedule: config.matchupSchedule || "",
    };
  });

// Update a draft tournament (just updates configData and metadata)
export const updateDraftTournament = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      tournamentId: number;
      name: string;
      numWeeks: number;
      numTeams: number;
      playersCsv: string;
      selectedPlayerIds?: number[];
      selectedReserveIds?: number[];
      reservesCsv?: string;
      dinnerDutiesOrder?: string;
      cleanupDutiesOrder?: string;
      firstOnCourtOrder?: string;
      matchupSchedule?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    const {
      tournamentId,
      name,
      numWeeks,
      numTeams,
      playersCsv,
      selectedPlayerIds = [],
      selectedReserveIds = [],
      reservesCsv,
      dinnerDutiesOrder,
      cleanupDutiesOrder,
      firstOnCourtOrder,
      matchupSchedule,
    } = data;

    // Verify tournament exists and is a draft
    const existingTournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });

    if (!existingTournament) {
      throw new Error("Tournament not found");
    }

    if (existingTournament.status !== "draft") {
      throw new Error("Only draft tournaments can be edited");
    }

    // Parse CSV players to validate and auto-add to player database
    const csvPlayers = playersCsv.trim() ? parsePlayersCsv(playersCsv) : [];

    // Auto-add CSV players to the player database (with deduplication)
    if (csvPlayers.length > 0) {
      const existingDbPlayers = await db.query.playerDatabase.findMany();
      const existingNames = new Set(
        existingDbPlayers.map((p) => p.name.toLowerCase().trim())
      );

      for (const csvPlayer of csvPlayers) {
        const normalizedName = csvPlayer.name.toLowerCase().trim();
        if (!existingNames.has(normalizedName)) {
          await db.insert(playerDatabase).values({
            name: csvPlayer.name,
            level: csvPlayer.level,
            isActive: true,
          });
          existingNames.add(normalizedName);
        }
      }
    }

    // Build updated config
    const config: TournamentConfig = {
      numTeams,
      selectedPlayerIds,
      playersCsv,
      selectedReserveIds,
      reservesCsv: reservesCsv || "",
      dinnerDutiesOrder,
      cleanupDutiesOrder,
      firstOnCourtOrder,
      matchupSchedule,
    };

    // Update tournament metadata and config
    await db
      .update(tournaments)
      .set({
        name,
        numWeeks,
        configData: JSON.stringify(config),
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, tournamentId));

    return { success: true, tournamentId };
  });
