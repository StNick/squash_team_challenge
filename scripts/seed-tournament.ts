import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import * as schema from "../src/server/db/schema";
import "dotenv/config";

const { Pool } = pg;

// Real tournament data from the screenshot
const tournamentData = {
  name: "Team Challenge 2025",
  numWeeks: 5,
  teams: [
    {
      name: "Red",
      color: "#EF4444", // red-500
      players: [
        { name: "Stuart Donald", position: 1, isCaptain: false },
        { name: "Leon van den Berg", position: 2, isCaptain: true },
        { name: "Jayden Jones", position: 3, isCaptain: false },
        { name: "Diana Bennet", position: 4, isCaptain: false },
      ],
    },
    {
      name: "Orange",
      color: "#F97316", // orange-500
      players: [
        { name: "Nick Soper", position: 1, isCaptain: false },
        { name: "Phil Cauty", position: 2, isCaptain: true },
        { name: "Eduardo Rodrigues", position: 3, isCaptain: false },
        { name: "Juanita (Jay) Cronje", position: 4, isCaptain: false },
      ],
    },
    {
      name: "Green",
      color: "#22C55E", // green-500
      players: [
        { name: "Martin Dowson", position: 1, isCaptain: false },
        { name: "Duncan Gibbons", position: 2, isCaptain: false },
        { name: "Ilan Brook", position: 3, isCaptain: true },
        { name: "Marisse Cohen", position: 4, isCaptain: false },
      ],
    },
    {
      name: "Black",
      color: "#171717", // neutral-900
      players: [
        { name: "Heath Gordon", position: 1, isCaptain: true },
        { name: "Ross Pearce", position: 2, isCaptain: false },
        { name: "Tina Jones", position: 3, isCaptain: false },
        { name: "Ethan Radford", position: 4, isCaptain: false },
      ],
    },
    {
      name: "White",
      color: "#9CA3AF", // gray-400 (using gray so it's visible)
      players: [
        { name: "Jackie Moore", position: 1, isCaptain: false },
        { name: "Matt Dold", position: 2, isCaptain: false },
        { name: "Megan Dold", position: 3, isCaptain: true },
        { name: "Rene Estethuizen", position: 4, isCaptain: false },
      ],
    },
    {
      name: "Blue",
      color: "#3B82F6", // blue-500
      players: [
        { name: "Grant Nilsson", position: 1, isCaptain: true },
        { name: "Scott Wendt", position: 2, isCaptain: false },
        { name: "Janice Lim", position: 3, isCaptain: false },
        { name: "Milly Wendt", position: 4, isCaptain: false },
      ],
    },
  ],
};

// Pre-determined matchup schedule (team indices: 0=Red, 1=Orange, 2=Green, 3=Black, 4=White, 5=Blue)
const MATCHUP_SCHEDULE: [number, number][][] = [
  // Week 1 (27-Jan): Red vs Orange, Green vs Black, White vs Blue
  [[0, 1], [2, 3], [4, 5]],
  // Week 2 (3-Feb): Red vs Green, Orange vs Blue, Black vs White
  [[0, 2], [1, 5], [3, 4]],
  // Week 3 (10-Feb): Red vs Black, Orange vs White, Green vs Blue
  [[0, 3], [1, 4], [2, 5]],
  // Week 4 (17-Feb): Red vs White, Orange vs Green, Black vs Blue
  [[0, 4], [1, 2], [3, 5]],
  // Week 5 (24-Feb): Red vs Blue, Orange vs Black, Green vs White
  [[0, 5], [1, 3], [2, 4]],
];

// Pre-determined duty assignments (team indices: 0=Red, 1=Orange, 2=Green, 3=Black, 4=White, 5=Blue)
const DUTY_SCHEDULE: { dinner: number; cleanup: number }[] = [
  { dinner: 1, cleanup: 2 },  // Week 1: Dinner = Orange, Cleanup = Green
  { dinner: 4, cleanup: 3 },  // Week 2: Dinner = White, Cleanup = Black
  { dinner: 2, cleanup: 0 },  // Week 3: Dinner = Green, Cleanup = Red
  { dinner: 0, cleanup: 4 },  // Week 4: Dinner = Red, Cleanup = White
  { dinner: 5, cleanup: 1 },  // Week 5: Dinner = Blue, Cleanup = Orange
];

async function seedTournament() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  console.log("Seeding tournament data...");

  // Check if there's already an active tournament
  const existingTournament = await db.query.tournaments.findFirst({
    where: (t, { eq }) => eq(t.isActive, true),
  });

  if (existingTournament) {
    console.log("An active tournament already exists. Deactivating it...");
    await db
      .update(schema.tournaments)
      .set({ isActive: false })
      .where(eq(schema.tournaments.id, existingTournament.id));
  }

  // Create tournament
  const [tournament] = await db
    .insert(schema.tournaments)
    .values({
      name: tournamentData.name,
      numWeeks: tournamentData.numWeeks,
      currentWeek: 1,
      isActive: true,
    })
    .returning();

  console.log(`Created tournament: ${tournament.name} (ID: ${tournament.id})`);

  // Create teams and players
  const teamIds: number[] = [];
  const playersByTeam: Map<number, { id: number; position: number }[]> = new Map();

  for (const teamData of tournamentData.teams) {
    const [team] = await db
      .insert(schema.teams)
      .values({
        tournamentId: tournament.id,
        name: teamData.name,
        color: teamData.color,
        totalScore: 0,
      })
      .returning();

    teamIds.push(team.id);
    console.log(`Created team: ${team.name} (ID: ${team.id})`);

    const teamPlayers: { id: number; position: number }[] = [];

    for (const playerData of teamData.players) {
      const [player] = await db
        .insert(schema.players)
        .values({
          tournamentId: tournament.id,
          teamId: team.id,
          name: playerData.name,
          skill: 50, // Default skill
          position: playerData.position,
          isCaptain: playerData.isCaptain,
        })
        .returning();

      teamPlayers.push({ id: player.id, position: player.position });
      console.log(`  - ${playerData.isCaptain ? "© " : ""}${player.name} (Position ${player.position})`);
    }

    playersByTeam.set(team.id, teamPlayers);
  }

  // Use pre-determined matchup schedule
  console.log("\nCreating weekly matchups and matches...");

  for (let week = 0; week < MATCHUP_SCHEDULE.length; week++) {
    const weekMatchups = MATCHUP_SCHEDULE[week];
    console.log(`Week ${week + 1}:`);

    for (const [teamAIdx, teamBIdx] of weekMatchups) {
      const teamAId = teamIds[teamAIdx];
      const teamBId = teamIds[teamBIdx];

      // Create weekly matchup
      const [matchup] = await db
        .insert(schema.weeklyMatchups)
        .values({
          tournamentId: tournament.id,
          week: week + 1,
          teamAId,
          teamBId,
          teamAScore: 0,
          teamBScore: 0,
          isComplete: false,
        })
        .returning();

      const teamAPlayers = playersByTeam.get(teamAId)!;
      const teamBPlayers = playersByTeam.get(teamBId)!;

      console.log(`  ${tournamentData.teams[teamAIdx].name} vs ${tournamentData.teams[teamBIdx].name}`);

      // Create individual matches (position vs position)
      for (let pos = 1; pos <= 4; pos++) {
        const playerA = teamAPlayers.find((p) => p.position === pos);
        const playerB = teamBPlayers.find((p) => p.position === pos);

        if (playerA && playerB) {
          await db.insert(schema.matches).values({
            weeklyMatchupId: matchup.id,
            position: pos,
            playerAId: playerA.id,
            playerBId: playerB.id,
            scoreA: null,
            scoreB: null,
          });
        }
      }
    }
  }

  // Use pre-determined duty assignments
  console.log("\nCreating duty assignments...");

  for (let week = 0; week < DUTY_SCHEDULE.length; week++) {
    const { dinner, cleanup } = DUTY_SCHEDULE[week];
    await db.insert(schema.weeklyDuties).values({
      tournamentId: tournament.id,
      week: week + 1,
      dinnerTeamId: teamIds[dinner],
      cleanupTeamId: teamIds[cleanup],
    });
    console.log(`Week ${week + 1}: Dinner - ${tournamentData.teams[dinner].name}, Cleanup - ${tournamentData.teams[cleanup].name}`);
  }

  await pool.end();
  console.log("\nTournament seeding complete!");
}

seedTournament().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
