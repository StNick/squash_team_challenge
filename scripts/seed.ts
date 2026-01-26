import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcrypt";
import * as schema from "../src/server/db/schema";
import "dotenv/config";

const { Pool } = pg;

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  console.log("Seeding database...");

  // Check if admin settings already exist
  const existingAdmin = await db.query.adminSettings.findFirst();

  if (existingAdmin) {
    console.log("Admin settings already exist, skipping seed.");
    await pool.end();
    return;
  }

  // Create default admin password
  const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  await db.insert(schema.adminSettings).values({
    passwordHash,
  });

  console.log(`Admin user created with password: ${defaultPassword}`);
  console.log("Please change this password after first login!");

  await pool.end();
  console.log("Seeding complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
