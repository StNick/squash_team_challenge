import { createServerFn } from "@tanstack/react-start";
import { db } from "../db";
import { matches, weeklyMatchups, teams, reserves, playerDatabase } from "../db/schema";
import { eq } from "drizzle-orm";
import { calculateSuggestedHandicap } from "../lib/generation";

// Submit a match score (public - anyone can enter scores)
export const submitMatchScore = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { matchId: number; scoreA: number; scoreB: number }) => data
  )
  .handler(async ({ data }) => {
    const { matchId, scoreA, scoreB } = data;

    // Validate scores
    if (scoreA < 0 || scoreB < 0) {
      throw new Error("Scores cannot be negative");
    }

    if (scoreA > 999 || scoreB > 999) {
      throw new Error("Scores cannot exceed 999");
    }

    // Get the match with its weekly matchup
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: {
        weeklyMatchup: true,
      },
    });

    if (!match) {
      throw new Error("Match not found");
    }

    // Check if this is the first score entry (for audit timestamp)
    const isFirstScore = match.scoreA === null && match.scoreB === null;

    // Update match score
    await db
      .update(matches)
      .set({
        scoreA,
        scoreB,
        updatedAt: new Date(),
        ...(isFirstScore && { scoredAt: new Date() }),
      })
      .where(eq(matches.id, matchId));

    // Recalculate weekly matchup totals
    await recalculateWeeklyMatchupScores(match.weeklyMatchupId);

    return { success: true };
  });

// Admin: Update any match score
export const updateMatchScore = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { matchId: number; scoreA: number | null; scoreB: number | null }) =>
      data
  )
  .handler(async ({ data }) => {
    const { matchId, scoreA, scoreB } = data;

    // Validate scores if provided
    if (scoreA !== null && (scoreA < 0 || scoreA > 999)) {
      throw new Error("Score A must be between 0 and 999");
    }
    if (scoreB !== null && (scoreB < 0 || scoreB > 999)) {
      throw new Error("Score B must be between 0 and 999");
    }

    // Get the match
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    });

    if (!match) {
      throw new Error("Match not found");
    }

    // Check if this is the first score entry (for audit timestamp)
    const isFirstScore = match.scoreA === null && match.scoreB === null;
    const isSettingScores = scoreA !== null && scoreB !== null;

    // Update match score
    await db
      .update(matches)
      .set({
        scoreA,
        scoreB,
        updatedAt: new Date(),
        ...(isFirstScore && isSettingScores && { scoredAt: new Date() }),
      })
      .where(eq(matches.id, matchId));

    // Recalculate weekly matchup totals
    await recalculateWeeklyMatchupScores(match.weeklyMatchupId);

    return { success: true };
  });

// Recalculate weekly matchup scores and team totals
async function recalculateWeeklyMatchupScores(weeklyMatchupId: number) {
  // Get all matches for this weekly matchup
  const matchesForWeek = await db.query.matches.findMany({
    where: eq(matches.weeklyMatchupId, weeklyMatchupId),
  });

  // Calculate team totals for this matchup using ADJUSTED scores
  let teamATotal = 0;
  let teamBTotal = 0;
  let allComplete = true;

  for (const match of matchesForWeek) {
    if (match.scoreA !== null && match.scoreB !== null) {
      // Apply handicap as percentage reduction
      // Positive handicap = A's score reduced, Negative = B's score reduced
      const handicapPct = Math.abs(match.handicap ?? 0) / 100;
      const adjustedScoreA =
        (match.handicap ?? 0) > 0
          ? Math.round(match.scoreA * (1 - handicapPct))
          : match.scoreA;
      const adjustedScoreB =
        (match.handicap ?? 0) < 0
          ? Math.round(match.scoreB * (1 - handicapPct))
          : match.scoreB;
      teamATotal += adjustedScoreA;
      teamBTotal += adjustedScoreB;
    } else {
      allComplete = false;
    }
  }

  // Update weekly matchup scores
  await db
    .update(weeklyMatchups)
    .set({
      teamAScore: teamATotal,
      teamBScore: teamBTotal,
      isComplete: allComplete,
    })
    .where(eq(weeklyMatchups.id, weeklyMatchupId));

  // Get the weekly matchup to find the teams
  const weeklyMatchup = await db.query.weeklyMatchups.findFirst({
    where: eq(weeklyMatchups.id, weeklyMatchupId),
  });

  if (weeklyMatchup) {
    // Recalculate overall team totals
    await recalculateTeamTotal(weeklyMatchup.teamAId);
    await recalculateTeamTotal(weeklyMatchup.teamBId);
  }
}

// Recalculate a team's total score across all matchups
async function recalculateTeamTotal(teamId: number) {
  // Get all matchups involving this team
  const teamMatchups = await db.query.weeklyMatchups.findMany({
    where: (wm, { or, eq }) =>
      or(eq(wm.teamAId, teamId), eq(wm.teamBId, teamId)),
  });

  // Sum up the scores
  let totalScore = 0;
  for (const matchup of teamMatchups) {
    if (matchup.teamAId === teamId) {
      totalScore += matchup.teamAScore ?? 0;
    } else {
      totalScore += matchup.teamBScore ?? 0;
    }
  }

  // Update team total
  await db
    .update(teams)
    .set({ totalScore })
    .where(eq(teams.id, teamId));
}

// Get matches for a specific week
export const getMatchesForWeek = createServerFn({ method: "GET" })
  .inputValidator((data: { week: number }) => data)
  .handler(async ({ data }) => {
    const { week } = data;

    const weekMatchups = await db.query.weeklyMatchups.findMany({
      where: eq(weeklyMatchups.week, week),
      with: {
        teamA: true,
        teamB: true,
        matches: {
          with: {
            playerA: true,
            playerB: true,
          },
          orderBy: (m, { asc }) => [asc(m.position)],
        },
      },
    });

    return { matchups: weekMatchups };
  });

// Substitute types:
// - "reserve": Use an existing reserve (by reserveId)
// - "playerDatabase": Use a player from the database (by playerDatabaseId) - stores as custom substitute
// - "custom": Use a custom name/level for non-members
export type SubstituteType = "reserve" | "playerDatabase" | "custom" | "none";

export interface SubstituteInput {
  matchId: number;
  side: "A" | "B";
  type: SubstituteType;
  reserveId?: number;
  playerDatabaseId?: number;
  customName?: string;
  customLevel?: number;
}

// Set a substitute player for a match
export const setMatchSubstitute = createServerFn({ method: "POST" })
  .inputValidator((data: SubstituteInput) => data)
  .handler(async ({ data }) => {
    const { matchId, side, type, reserveId, playerDatabaseId, customName, customLevel } = data;

    // Build update data based on substitute type
    type UpdateData = {
      substituteAId?: number | null;
      substituteBId?: number | null;
      customSubstituteAName?: string | null;
      customSubstituteALevel?: number | null;
      customSubstituteBName?: string | null;
      customSubstituteBLevel?: number | null;
      updatedAt: Date;
    };

    const updateData: UpdateData = { updatedAt: new Date() };

    if (type === "none") {
      // Clear all substitute fields for this side
      if (side === "A") {
        updateData.substituteAId = null;
        updateData.customSubstituteAName = null;
        updateData.customSubstituteALevel = null;
      } else {
        updateData.substituteBId = null;
        updateData.customSubstituteBName = null;
        updateData.customSubstituteBLevel = null;
      }
    } else if (type === "reserve") {
      // Use existing reserve
      if (reserveId === undefined) {
        throw new Error("Reserve ID required for reserve substitute");
      }

      const reserve = await db.query.reserves.findFirst({
        where: eq(reserves.id, reserveId),
      });
      if (!reserve) {
        throw new Error("Reserve not found");
      }

      if (side === "A") {
        updateData.substituteAId = reserveId;
        updateData.customSubstituteAName = null;
        updateData.customSubstituteALevel = null;
      } else {
        updateData.substituteBId = reserveId;
        updateData.customSubstituteBName = null;
        updateData.customSubstituteBLevel = null;
      }
    } else if (type === "playerDatabase") {
      // Use player from database - store as custom substitute
      if (playerDatabaseId === undefined) {
        throw new Error("Player database ID required");
      }

      const player = await db.query.playerDatabase.findFirst({
        where: eq(playerDatabase.id, playerDatabaseId),
      });
      if (!player) {
        throw new Error("Player not found in database");
      }

      // Store as custom substitute with player database info
      if (side === "A") {
        updateData.substituteAId = null;
        updateData.customSubstituteAName = player.name;
        updateData.customSubstituteALevel = player.level;
      } else {
        updateData.substituteBId = null;
        updateData.customSubstituteBName = player.name;
        updateData.customSubstituteBLevel = player.level;
      }
    } else if (type === "custom") {
      // Custom non-member substitute
      if (!customName?.trim()) {
        throw new Error("Name required for custom substitute");
      }

      if (side === "A") {
        updateData.substituteAId = null;
        updateData.customSubstituteAName = customName.trim();
        updateData.customSubstituteALevel = customLevel ?? null;
      } else {
        updateData.substituteBId = null;
        updateData.customSubstituteBName = customName.trim();
        updateData.customSubstituteBLevel = customLevel ?? null;
      }
    }

    await db.update(matches).set(updateData).where(eq(matches.id, matchId));

    return { success: true };
  });

// Set handicap for a match (percentage-based: -50 to 50)
export const setMatchHandicap = createServerFn({ method: "POST" })
  .inputValidator((data: { matchId: number; handicap: number }) => data)
  .handler(async ({ data }) => {
    const { matchId, handicap } = data;

    // Validate handicap range (percentage: -50 to 50)
    if (handicap < -50 || handicap > 50) {
      throw new Error("Handicap must be between -50% and 50%");
    }

    // Get the match to find its weekly matchup for recalculation
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    });

    if (!match) {
      throw new Error("Match not found");
    }

    // Update handicap
    await db
      .update(matches)
      .set({ handicap, updatedAt: new Date() })
      .where(eq(matches.id, matchId));

    // Recalculate scores if match has scores entered
    if (match.scoreA !== null && match.scoreB !== null) {
      await recalculateWeeklyMatchupScores(match.weeklyMatchupId);
    }

    return { success: true };
  });

// Get suggested handicap for a match based on level difference
export const getSuggestedHandicap = createServerFn({ method: "GET" })
  .inputValidator((data: { matchId: number }) => data)
  .handler(async ({ data }) => {
    const { matchId } = data;

    // Get match with players and substitutes
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: {
        playerA: true,
        playerB: true,
        substituteA: true,
        substituteB: true,
      },
    });

    if (!match) {
      throw new Error("Match not found");
    }

    // Use substitute level if present (reserve first, then custom), otherwise player level
    const levelA =
      match.substituteA?.level ??
      match.customSubstituteALevel ??
      match.playerA.level;
    const levelB =
      match.substituteB?.level ??
      match.customSubstituteBLevel ??
      match.playerB.level;

    const suggestedHandicap = calculateSuggestedHandicap(levelA, levelB);

    return {
      suggestedHandicap,
      levelA,
      levelB,
    };
  });
