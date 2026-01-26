import { createServerFn } from "@tanstack/react-start";
import { db } from "../db";
import { reserves, tournaments, playerDatabase } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";

// Get all reserves for the active tournament
export const getReserves = createServerFn({ method: "GET" }).handler(
  async () => {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.isActive, true),
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
      where: eq(tournaments.isActive, true),
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
    }) => data
  )
  .handler(async ({ data }) => {
    const { name, phone, email, notes } = data;

    if (!name.trim()) {
      throw new Error("Name is required");
    }

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.isActive, true),
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
      isActive?: boolean;
    }) => data
  )
  .handler(async ({ data }) => {
    const { reserveId, name, phone, email, notes, isActive } = data;

    const updateData: Partial<{
      name: string;
      phone: string | null;
      email: string | null;
      notes: string | null;
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
      where: eq(tournaments.isActive, true),
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

    // Insert each player as a reserve
    const insertedReserves = [];
    for (const player of playersToAdd) {
      const [reserve] = await db
        .insert(reserves)
        .values({
          tournamentId: tournament.id,
          playerDatabaseId: player.id,
          name: player.name,
          phone: player.phone,
          email: player.email,
          notes: player.notes,
          isActive: true,
        })
        .returning();
      insertedReserves.push(reserve);
    }

    return { success: true, count: insertedReserves.length };
  });
