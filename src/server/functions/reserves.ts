import { createServerFn } from "@tanstack/react-start";
import { db } from "../db";
import { reserves, tournaments, playerDatabase, players } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { calculatePositionLevelRanges, calculateSuggestedLevel } from "../lib/generation";

// Get all reserves for the active tournament
export const getReserves = createServerFn({ method: "GET" }).handler(
  async () => {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.status, "active"),
    });

    if (!tournament) {
      return { reserves: [] };
    }

    const allReserves = await db.query.reserves.findMany({
      where: eq(reserves.tournamentId, tournament.id),
      orderBy: (r, { asc }) => [asc(r.name)],
    });

    return { reserves: allReserves };
  }
);

// Get active reserves only (for public display)
export const getActiveReserves = createServerFn({ method: "GET" }).handler(
  async () => {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.status, "active"),
    });

    if (!tournament) {
      return { reserves: [] };
    }

    const activeReserves = await db.query.reserves.findMany({
      where: and(
        eq(reserves.tournamentId, tournament.id),
        eq(reserves.isActive, true)
      ),
      orderBy: (r, { asc }) => [asc(r.name)],
    });

    return { reserves: activeReserves };
  }
);

// Create a new reserve
export const createReserve = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      phone?: string;
      email?: string;
      notes?: string;
      level?: number;
      suggestedPosition?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    const { name, phone, email, notes, level, suggestedPosition } = data;

    if (!name.trim()) {
      throw new Error("Name is required");
    }

    // Validate level if provided
    if (level !== undefined && (level < 1 || level > 1000000)) {
      throw new Error("Level must be between 1 and 1,000,000");
    }

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.status, "active"),
    });

    if (!tournament) {
      throw new Error("No active tournament");
    }

    const [reserve] = await db
      .insert(reserves)
      .values({
        tournamentId: tournament.id,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        notes: notes?.trim() || null,
        level: level ?? 500000,
        suggestedPosition: suggestedPosition?.trim() || null,
        isActive: true,
      })
      .returning();

    return { success: true, reserve };
  });

// Update a reserve
export const updateReserve = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      reserveId: number;
      name?: string;
      phone?: string | null;
      email?: string | null;
      notes?: string | null;
      level?: number;
      suggestedPosition?: string | null;
      isActive?: boolean;
    }) => data
  )
  .handler(async ({ data }) => {
    const { reserveId, name, phone, email, notes, level, suggestedPosition, isActive } = data;

    const updateData: Partial<{
      name: string;
      phone: string | null;
      email: string | null;
      notes: string | null;
      level: number;
      suggestedPosition: string | null;
      isActive: boolean;
    }> = {};

    if (name !== undefined) {
      if (!name.trim()) {
        throw new Error("Name cannot be empty");
      }
      updateData.name = name.trim();
    }
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (level !== undefined) {
      if (level < 1 || level > 1000000) {
        throw new Error("Level must be between 1 and 1,000,000");
      }
      updateData.level = level;
    }
    if (suggestedPosition !== undefined) updateData.suggestedPosition = suggestedPosition?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    await db
      .update(reserves)
      .set(updateData)
      .where(eq(reserves.id, reserveId));

    return { success: true };
  });

// Delete a reserve
export const deleteReserve = createServerFn({ method: "POST" })
  .inputValidator((data: { reserveId: number }) => data)
  .handler(async ({ data }) => {
    const { reserveId } = data;

    await db.delete(reserves).where(eq(reserves.id, reserveId));

    return { success: true };
  });

// Toggle reserve active status
export const toggleReserveActive = createServerFn({ method: "POST" })
  .inputValidator((data: { reserveId: number }) => data)
  .handler(async ({ data }) => {
    const { reserveId } = data;

    const reserve = await db.query.reserves.findFirst({
      where: eq(reserves.id, reserveId),
    });

    if (!reserve) {
      throw new Error("Reserve not found");
    }

    await db
      .update(reserves)
      .set({ isActive: !reserve.isActive })
      .where(eq(reserves.id, reserveId));

    return { success: true, isActive: !reserve.isActive };
  });

// Add reserves from player database
export const addReservesFromDatabase = createServerFn({ method: "POST" })
  .inputValidator((data: { playerIds: number[] }) => data)
  .handler(async ({ data }) => {
    const { playerIds } = data;

    if (playerIds.length === 0) {
      throw new Error("No players selected");
    }

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.status, "active"),
    });

    if (!tournament) {
      throw new Error("No active tournament");
    }

    // Fetch the selected players from the database
    const playersToAdd = await db.query.playerDatabase.findMany({
      where: inArray(playerDatabase.id, playerIds),
    });

    if (playersToAdd.length === 0) {
      throw new Error("No valid players found");
    }

    // Calculate position ranges from tournament players for suggested position
    const allTournamentPlayers = await db.query.players.findMany({
      where: eq(players.tournamentId, tournament.id),
    });
    const levelRanges = calculatePositionLevelRanges(allTournamentPlayers);

    // Insert each player as a reserve
    const insertedReserves = [];
    for (const player of playersToAdd) {
      // Calculate suggested position based on level
      let suggestedPosition: string | null = null;
      if (player.level && levelRanges.length > 0) {
        const position = calculateSuggestedLevel(player.level, levelRanges);
        suggestedPosition = String(position);
      }

      const [reserve] = await db
        .insert(reserves)
        .values({
          tournamentId: tournament.id,
          playerDatabaseId: player.id,
          name: player.name,
          phone: player.phone,
          email: player.email,
          notes: player.notes ?? null,
          level: player.level,
          suggestedPosition,
          isActive: true,
        })
        .returning();
      insertedReserves.push(reserve);
    }

    return { success: true, count: insertedReserves.length };
  });

// Update reserve levels from player database
// Updates reserves by playerDatabaseId link, or by name match if no link exists
// Also sets suggestedPosition for reserves that don't have one
export const updateReserveLevelsFromDatabase = createServerFn({ method: "POST" }).handler(
  async () => {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.status, "active"),
    });

    if (!tournament) {
      throw new Error("No active tournament");
    }

    // Get all reserves for this tournament
    const allReserves = await db.query.reserves.findMany({
      where: eq(reserves.tournamentId, tournament.id),
    });

    if (allReserves.length === 0) {
      return { success: true, updated: 0 };
    }

    // Get all player database entries
    const allPlayerDbEntries = await db.query.playerDatabase.findMany();

    // Create maps for lookup
    const levelByPlayerId = new Map(allPlayerDbEntries.map(p => [p.id, p.level]));
    const levelByNameLower = new Map(allPlayerDbEntries.map(p => [p.name.toLowerCase().trim(), p.level]));
    const playerIdByNameLower = new Map(allPlayerDbEntries.map(p => [p.name.toLowerCase().trim(), p.id]));

    // Calculate position ranges from tournament players for suggested position
    const allTournamentPlayers = await db.query.players.findMany({
      where: eq(players.tournamentId, tournament.id),
    });
    const levelRanges = calculatePositionLevelRanges(allTournamentPlayers);

    // Update each reserve with the level from player database
    let updated = 0;
    for (const reserve of allReserves) {
      let newLevel: number | undefined;
      let newPlayerDbId: number | null = reserve.playerDatabaseId;

      if (reserve.playerDatabaseId !== null) {
        // Use linked player database entry
        newLevel = levelByPlayerId.get(reserve.playerDatabaseId);
      } else {
        // Try to match by name (case-insensitive)
        const nameLower = reserve.name.toLowerCase().trim();
        newLevel = levelByNameLower.get(nameLower);
        // Also link the reserve to the player database for future updates
        const matchedPlayerId = playerIdByNameLower.get(nameLower);
        if (matchedPlayerId !== undefined) {
          newPlayerDbId = matchedPlayerId;
        }
      }

      // Determine effective level (new or existing)
      const effectiveLevel = newLevel ?? reserve.level;

      // Calculate suggested position if reserve doesn't have one
      let newSuggestedPosition: string | null = reserve.suggestedPosition;
      if (!reserve.suggestedPosition && effectiveLevel && levelRanges.length > 0) {
        const position = calculateSuggestedLevel(effectiveLevel, levelRanges);
        newSuggestedPosition = String(position);
      }

      // Update if level changed, link changed, or position needs to be set
      const levelChanged = newLevel !== undefined && newLevel !== reserve.level;
      const linkChanged = newPlayerDbId !== reserve.playerDatabaseId;
      const positionAdded = newSuggestedPosition !== reserve.suggestedPosition;

      if (levelChanged || linkChanged || positionAdded) {
        const updateValues: { level?: number; playerDatabaseId?: number | null; suggestedPosition?: string | null } = {};
        if (levelChanged) updateValues.level = newLevel;
        if (linkChanged) updateValues.playerDatabaseId = newPlayerDbId;
        if (positionAdded) updateValues.suggestedPosition = newSuggestedPosition;

        await db
          .update(reserves)
          .set(updateValues)
          .where(eq(reserves.id, reserve.id));
        updated++;
      }
    }

    return { success: true, updated };
  }
);
