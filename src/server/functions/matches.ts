import { createServerFn } from "@tanstack/react-start";
import { db } from "../db";
import { matches, weeklyMatchups, teams } from "../db/schema";
import { eq } from "drizzle-orm";

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

    // Update match score
    await db
      .update(matches)
      .set({
        scoreA,
        scoreB,
        updatedAt: new Date(),
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

    // Update match score
    await db
      .update(matches)
      .set({
        scoreA,
        scoreB,
        updatedAt: new Date(),
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

  // Calculate team totals for this matchup
  let teamATotal = 0;
  let teamBTotal = 0;
  let allComplete = true;

  for (const match of matchesForWeek) {
    if (match.scoreA !== null && match.scoreB !== null) {
      teamATotal += match.scoreA;
      teamBTotal += match.scoreB;
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
