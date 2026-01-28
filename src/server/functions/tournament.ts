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

// Get all data needed for the public dashboard
export const getDashboardData = createServerFn({ method: "GET" }).handler(
  async () => {
    // Get active tournament
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.isActive, true),
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
  }
);

// Create a new tournament
export const createTournament = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      numWeeks: number;
      numTeams: number;
      playersCsv: string;
      selectedPlayerIds?: number[];
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
      reservesCsv,
      dinnerDutiesOrder,
      cleanupDutiesOrder,
      firstOnCourtOrder,
      matchupSchedule,
    } = data;

    // Parse CSV players
    const csvPlayers = playersCsv.trim()
      ? parsePlayersCsv(playersCsv)
      : [];

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

    // Auto-add CSV players to the player database (with deduplication)
    if (csvPlayers.length > 0) {
      // Get all existing players from database for name matching
      const existingDbPlayers = await db.query.playerDatabase.findMany();
      const existingNames = new Set(
        existingDbPlayers.map((p) => p.name.toLowerCase().trim())
      );

      for (const csvPlayer of csvPlayers) {
        const normalizedName = csvPlayer.name.toLowerCase().trim();
        if (!existingNames.has(normalizedName)) {
          // Add new player to database
          await db.insert(playerDatabase).values({
            name: csvPlayer.name,
            level: csvPlayer.level,
            isActive: true,
          });
          existingNames.add(normalizedName);
        }
      }
    }

    // Merge players: database players first, then CSV players
    const playerInputs: PlayerInput[] = [...dbPlayers, ...csvPlayers];

    if (playerInputs.length < numTeams) {
      throw new Error("Not enough players for the number of teams");
    }

    // Deactivate any existing active tournament
    await db
      .update(tournaments)
      .set({ isActive: false })
      .where(eq(tournaments.isActive, true));

    // Create tournament
    const [tournament] = await db
      .insert(tournaments)
      .values({
        name,
        numWeeks,
        currentWeek: 1,
        isActive: true,
      })
      .returning();

    // Generate teams with players using snake draft (respects pre-assigned teams)
    const generatedTeams = distributePlayersToTeams(playerInputs, numTeams);

    // Insert teams and players
    const teamRecords: { id: number; index: number; name: string }[] = [];
    for (let i = 0; i < generatedTeams.length; i++) {
      const teamData = generatedTeams[i];
      const [team] = await db
        .insert(teams)
        .values({
          tournamentId: tournament.id,
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
          tournamentId: tournament.id,
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
            throw new Error(`Could not find teams for matchup: ${matchup.teamA} vs ${matchup.teamB}`);
          }

          // Insert weekly matchup
          const [weeklyMatchup] = await db
            .insert(weeklyMatchups)
            .values({
              tournamentId: tournament.id,
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
              tournamentId: tournament.id,
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
        const cleanupTeamName = customCleanupDuties[week % customCleanupDuties.length];

        const dinnerTeam = findTeamByName(dinnerTeamName);
        const cleanupTeam = findTeamByName(cleanupTeamName);

        if (!dinnerTeam || !cleanupTeam) {
          throw new Error(`Could not find teams for duties: dinner=${dinnerTeamName}, cleanup=${cleanupTeamName}`);
        }

        await db.insert(weeklyDuties).values({
          tournamentId: tournament.id,
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
          tournamentId: tournament.id,
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
          tournamentId: tournament.id,
          week: week + 1,
          positionGroup,
        });
      }
    } else {
      // Use generated random first on court
      const firstOnCourtAssignments = assignFirstOnCourt(numWeeks);
      for (const assignment of firstOnCourtAssignments) {
        await db.insert(firstOnCourt).values({
          tournamentId: tournament.id,
          week: assignment.week,
          positionGroup: assignment.positionGroup,
        });
      }
    }

    // Calculate level ranges from tournament players for reserve level calculation
    const allTournamentPlayers = await db.query.players.findMany({
      where: eq(players.tournamentId, tournament.id),
    });
    const levelRanges = calculatePositionLevelRanges(allTournamentPlayers);

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
          tournamentId: tournament.id,
          playerDatabaseId: playerDbId,
          name: reserve.name,
          phone: reserve.phone || null,
          level: reserveLevel ?? 500000,
          suggestedPosition,
          isActive: true,
        });
      }
    }

    return { success: true, tournamentId: tournament.id };
  });

// Advance to next week
export const advanceWeek = createServerFn({ method: "POST" }).handler(
  async () => {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.isActive, true),
    });

    if (!tournament) {
      throw new Error("No active tournament");
    }

    if (tournament.currentWeek >= tournament.numWeeks) {
      throw new Error("Tournament is already at the final week");
    }

    await db
      .update(tournaments)
      .set({
        currentWeek: tournament.currentWeek + 1,
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, tournament.id));

    return { success: true, newWeek: tournament.currentWeek + 1 };
  }
);

// Go back to previous week
export const goBackWeek = createServerFn({ method: "POST" }).handler(
  async () => {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.isActive, true),
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
