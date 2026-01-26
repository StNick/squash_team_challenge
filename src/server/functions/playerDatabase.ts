import { createServerFn } from "@tanstack/react-start";
import { db } from "../db";
import { playerDatabase } from "../db/schema";
import { eq } from "drizzle-orm";

// Get all players from database
export const getPlayerDatabase = createServerFn({ method: "GET" }).handler(
  async () => {
    const players = await db.query.playerDatabase.findMany({
      orderBy: (p, { asc }) => [asc(p.name)],
    });

    return { players };
  }
);

// Get active players only
export const getActivePlayerDatabase = createServerFn({ method: "GET" }).handler(
  async () => {
    const players = await db.query.playerDatabase.findMany({
      where: eq(playerDatabase.isActive, true),
      orderBy: (p, { asc }) => [asc(p.name)],
    });

    return { players };
  }
);

// Create a new player database entry
export const createPlayerDatabaseEntry = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      email?: string;
      phone?: string;
      skill?: number;
      notes?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    const { name, email, phone, skill, notes } = data;

    if (!name.trim()) {
      throw new Error("Name is required");
    }

    // Validate skill if provided
    if (skill !== undefined && (skill < 1 || skill > 1000000)) {
      throw new Error("Skill must be between 1 and 1,000,000");
    }

    const [player] = await db
      .insert(playerDatabase)
      .values({
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        skill: skill ?? 500000,
        notes: notes?.trim() || null,
        isActive: true,
      })
      .returning();

    return { success: true, player };
  });

// Update a player database entry
export const updatePlayerDatabaseEntry = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      playerId: number;
      name?: string;
      email?: string | null;
      phone?: string | null;
      skill?: number;
      notes?: string | null;
      isActive?: boolean;
    }) => data
  )
  .handler(async ({ data }) => {
    const { playerId, name, email, phone, skill, notes, isActive } = data;

    // Get current player to check contact validation
    const currentPlayer = await db.query.playerDatabase.findFirst({
      where: eq(playerDatabase.id, playerId),
    });

    if (!currentPlayer) {
      throw new Error("Player not found");
    }

    // Prepare update data
    const updateData: Partial<{
      name: string;
      email: string | null;
      phone: string | null;
      skill: number;
      notes: string | null;
      isActive: boolean;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      if (!name.trim()) {
        throw new Error("Name cannot be empty");
      }
      updateData.name = name.trim();
    }

    if (email !== undefined) {
      updateData.email = email?.trim() || null;
    }

    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null;
    }

    if (skill !== undefined) {
      if (skill < 1 || skill > 1000000) {
        throw new Error("Skill must be between 1 and 1,000,000");
      }
      updateData.skill = skill;
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    await db
      .update(playerDatabase)
      .set(updateData)
      .where(eq(playerDatabase.id, playerId));

    return { success: true };
  });

// Delete a player database entry
export const deletePlayerDatabaseEntry = createServerFn({ method: "POST" })
  .inputValidator((data: { playerId: number }) => data)
  .handler(async ({ data }) => {
    const { playerId } = data;

    await db.delete(playerDatabase).where(eq(playerDatabase.id, playerId));

    return { success: true };
  });

// Toggle player active status
export const togglePlayerDatabaseActive = createServerFn({ method: "POST" })
  .inputValidator((data: { playerId: number }) => data)
  .handler(async ({ data }) => {
    const { playerId } = data;

    const player = await db.query.playerDatabase.findFirst({
      where: eq(playerDatabase.id, playerId),
    });

    if (!player) {
      throw new Error("Player not found");
    }

    await db
      .update(playerDatabase)
      .set({
        isActive: !player.isActive,
        updatedAt: new Date(),
      })
      .where(eq(playerDatabase.id, playerId));

    return { success: true, isActive: !player.isActive };
  });

// Get players by IDs (for tournament creation)
export const getPlayerDatabaseByIds = createServerFn({ method: "POST" })
  .inputValidator((data: { playerIds: number[] }) => data)
  .handler(async ({ data }) => {
    const { playerIds } = data;

    if (playerIds.length === 0) {
      return { players: [] };
    }

    const players = await db.query.playerDatabase.findMany({
      where: (p, { inArray }) => inArray(p.id, playerIds),
    });

    return { players };
  });
