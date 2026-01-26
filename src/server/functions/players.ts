import { createServerFn } from "@tanstack/react-start";
import { db } from "../db";
import { players, tournaments } from "../db/schema";
import { eq, and } from "drizzle-orm";

// Get all players for the active tournament
export const getPlayers = createServerFn({ method: "GET" }).handler(async () => {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.isActive, true),
  });

  if (!tournament) {
    return { players: [] };
  }

  const allPlayers = await db.query.players.findMany({
    where: eq(players.tournamentId, tournament.id),
    with: {
      team: true,
    },
    orderBy: (p, { asc }) => [asc(p.teamId), asc(p.position)],
  });

  return { players: allPlayers };
});

// Swap two players between teams
export const swapPlayers = createServerFn({ method: "POST" })
  .inputValidator((data: { playerAId: number; playerBId: number }) => data)
  .handler(async ({ data }) => {
    const { playerAId, playerBId } = data;

    // Get both players
    const playerA = await db.query.players.findFirst({
      where: eq(players.id, playerAId),
    });

    const playerB = await db.query.players.findFirst({
      where: eq(players.id, playerBId),
    });

    if (!playerA || !playerB) {
      throw new Error("One or both players not found");
    }

    if (playerA.teamId === playerB.teamId) {
      throw new Error("Cannot swap players on the same team");
    }

    // Swap team assignments and positions
    await db
      .update(players)
      .set({
        teamId: playerB.teamId,
        position: playerB.position,
      })
      .where(eq(players.id, playerAId));

    await db
      .update(players)
      .set({
        teamId: playerA.teamId,
        position: playerA.position,
      })
      .where(eq(players.id, playerBId));

    return { success: true };
  });

// Set a player as captain
export const setCaptain = createServerFn({ method: "POST" })
  .inputValidator((data: { playerId: number }) => data)
  .handler(async ({ data }) => {
    const { playerId } = data;

    // Get the player
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw new Error("Player not found");
    }

    // Remove captain status from current captain on the same team
    await db
      .update(players)
      .set({ isCaptain: false })
      .where(
        and(eq(players.teamId, player.teamId), eq(players.isCaptain, true))
      );

    // Set new captain
    await db
      .update(players)
      .set({ isCaptain: true })
      .where(eq(players.id, playerId));

    return { success: true };
  });

// Update player details
export const updatePlayer = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { playerId: number; name?: string; skill?: number }) => data
  )
  .handler(async ({ data }) => {
    const { playerId, name, skill } = data;

    const updateData: Partial<{ name: string; skill: number }> = {};
    if (name !== undefined) updateData.name = name;
    if (skill !== undefined) {
      if (skill < 1 || skill > 1000000) {
        throw new Error("Skill must be between 1 and 1,000,000");
      }
      updateData.skill = skill;
    }

    await db
      .update(players)
      .set(updateData)
      .where(eq(players.id, playerId));

    return { success: true };
  });

// Move player to a different position within their team
export const movePlayerPosition = createServerFn({ method: "POST" })
  .inputValidator((data: { playerId: number; newPosition: number }) => data)
  .handler(async ({ data }) => {
    const { playerId, newPosition } = data;

    if (newPosition < 1 || newPosition > 5) {
      throw new Error("Position must be between 1 and 5");
    }

    // Get the player
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw new Error("Player not found");
    }

    // Get the player currently at the target position
    const playerAtPosition = await db.query.players.findFirst({
      where: and(
        eq(players.teamId, player.teamId),
        eq(players.position, newPosition)
      ),
    });

    if (playerAtPosition) {
      // Swap positions
      await db
        .update(players)
        .set({ position: player.position })
        .where(eq(players.id, playerAtPosition.id));
    }

    // Update the moving player's position
    await db
      .update(players)
      .set({ position: newPosition })
      .where(eq(players.id, playerId));

    return { success: true };
  });
