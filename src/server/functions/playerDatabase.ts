import { createServerFn } from "@tanstack/react-start";
import { db } from "../db";
import { playerDatabase } from "../db/schema";
import { eq, or } from "drizzle-orm";

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
        skill: skill ?? 0,
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

// Maximum players allowed in database
const MAX_PLAYERS = 500;

// Import players from MySquash CSV
export const importPlayersFromCsv = createServerFn({ method: "POST" })
  .inputValidator((data: { csvContent: string }) => data)
  .handler(async ({ data }) => {
    const { csvContent } = data;

    // Parse CSV
    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error("CSV file appears to be empty or invalid");
    }

    // Parse header to find column indices
    const header = parseCSVLine(lines[0]);
    const nameIndex = header.findIndex((h) => h.toLowerCase() === "name");
    const playerCodeIndex = header.findIndex(
      (h) => h.toLowerCase() === "player code"
    );
    const levelIndex = header.findIndex((h) => h.toLowerCase() === "level");

    if (nameIndex === -1) {
      throw new Error('CSV must have a "Name" column');
    }
    if (playerCodeIndex === -1) {
      throw new Error('CSV must have a "Player Code" column');
    }
    if (levelIndex === -1) {
      throw new Error('CSV must have a "Level" column');
    }

    // Get all existing players for matching
    const existingPlayers = await db.query.playerDatabase.findMany();
    let currentCount = existingPlayers.length;

    // Create lookup maps
    const playersByCode = new Map(
      existingPlayers
        .filter((p) => p.playerCode)
        .map((p) => [p.playerCode!.toLowerCase(), p])
    );
    const playersByName = new Map(
      existingPlayers.map((p) => [p.name.toLowerCase(), p])
    );

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let limitReached = false;

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= Math.max(nameIndex, playerCodeIndex, levelIndex)) {
        skipped++;
        continue;
      }

      const name = values[nameIndex]?.trim();
      const playerCode = values[playerCodeIndex]?.trim();
      const levelStr = values[levelIndex]?.trim();

      if (!name || !playerCode) {
        skipped++;
        continue;
      }

      // Parse level - default to 0 if not provided or invalid
      const level = parseInt(levelStr) || 0;

      // Try to find existing player: first by code, then by name
      let existingPlayer =
        playersByCode.get(playerCode.toLowerCase()) ||
        playersByName.get(name.toLowerCase());

      if (existingPlayer) {
        // Update existing player
        await db
          .update(playerDatabase)
          .set({
            name,
            playerCode,
            skill: level,
            updatedAt: new Date(),
          })
          .where(eq(playerDatabase.id, existingPlayer.id));
        updated++;
      } else {
        // Check limit before inserting new player
        if (currentCount >= MAX_PLAYERS) {
          limitReached = true;
          skipped++;
          continue;
        }

        // Insert new player
        await db.insert(playerDatabase).values({
          name,
          playerCode,
          skill: level,
          isActive: true,
        });
        imported++;
        currentCount++;
      }
    }

    return {
      success: true,
      imported,
      updated,
      skipped,
      total: imported + updated,
      limitReached,
    };
  });

// Clear all players from database
export const clearPlayerDatabase = createServerFn({ method: "POST" }).handler(
  async () => {
    await db.delete(playerDatabase);
    return { success: true };
  }
);

// Helper function to parse CSV line (handles quoted values)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  // Remove BOM if present
  if (line.charCodeAt(0) === 0xfeff) {
    line = line.slice(1);
  }

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
