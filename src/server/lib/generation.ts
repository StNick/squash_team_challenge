import type { NewTeam, NewWeeklyMatchup, NewWeeklyDuty } from "../db/schema";
import { TEAM_COLORS } from "~/lib/constants";

// Valid team names for pre-assignment (case-insensitive)
// Must match order in TEAM_COLORS from constants.ts
export const VALID_TEAM_NAMES = ["red", "orange", "green", "black", "white", "blue", "yellow", "purple"] as const;
export type ValidTeamName = (typeof VALID_TEAM_NAMES)[number];

export interface PlayerInput {
  name: string;
  skill: number;
  team?: string; // Optional team name: Red, Orange, Green, Black, White, Blue, etc.
  isCaptain?: boolean; // Optional captain designation
}

// Player in a generated team - skill is always required
export interface GeneratedPlayer {
  name: string;
  skill: number;
  position: number;
  isCaptain: boolean;
}

export interface GeneratedTeam extends Omit<NewTeam, "tournamentId"> {
  players: GeneratedPlayer[];
}

export interface GeneratedSchedule {
  teams: GeneratedTeam[];
  matchups: Omit<NewWeeklyMatchup, "tournamentId" | "teamAId" | "teamBId">[][];
  duties: Omit<NewWeeklyDuty, "tournamentId" | "dinnerTeamId" | "cleanupTeamId">[];
}

/**
 * Snake draft algorithm to distribute players evenly across teams
 * Players are sorted by skill (descending), then distributed in a snake pattern:
 * Round 1: Team 0, 1, 2, 3
 * Round 2: Team 3, 2, 1, 0
 * Round 3: Team 0, 1, 2, 3
 * etc.
 *
 * If players have team assignments, those are respected and remaining players
 * are snake-drafted to fill the gaps.
 */
export function distributePlayersToTeams(
  players: PlayerInput[],
  numTeams: number
): GeneratedTeam[] {
  // Validate inputs
  if (numTeams < 2 || numTeams > 8) {
    throw new Error("Number of teams must be between 2 and 8");
  }

  const playersPerTeam = Math.floor(players.length / numTeams);
  if (playersPerTeam < 1) {
    throw new Error("Not enough players for the number of teams");
  }

  if (playersPerTeam > 5) {
    throw new Error("Maximum 5 players per team");
  }

  // Initialize teams
  const teams: GeneratedTeam[] = Array.from({ length: numTeams }, (_, i) => ({
    name: `Team ${TEAM_COLORS[i].name}`,
    color: TEAM_COLORS[i].value,
    totalScore: 0,
    players: [],
  }));

  // Create a map of team name (lowercase) to team index
  const teamNameToIndex = new Map<string, number>();
  teams.forEach((team, index) => {
    const teamName = team.name.replace("Team ", "").toLowerCase();
    teamNameToIndex.set(teamName, index);
  });

  // Separate players with pre-assigned teams from those to be drafted
  const preAssignedPlayers: PlayerInput[] = [];
  const unassignedPlayers: PlayerInput[] = [];

  for (const player of players) {
    if (player.team) {
      const normalizedTeamName = player.team.toLowerCase().trim();
      if (teamNameToIndex.has(normalizedTeamName)) {
        preAssignedPlayers.push(player);
      } else {
        throw new Error(`Invalid team name "${player.team}" for player ${player.name}. Valid teams are: ${teams.map(t => t.name.replace("Team ", "")).join(", ")}`);
      }
    } else {
      unassignedPlayers.push(player);
    }
  }

  // Assign pre-assigned players to their teams (sorted by skill within each team)
  const preAssignedByTeam = new Map<number, PlayerInput[]>();
  for (const player of preAssignedPlayers) {
    const teamIndex = teamNameToIndex.get(player.team!.toLowerCase().trim())!;
    if (!preAssignedByTeam.has(teamIndex)) {
      preAssignedByTeam.set(teamIndex, []);
    }
    preAssignedByTeam.get(teamIndex)!.push(player);
  }

  // Sort pre-assigned players by skill and add to teams
  for (const [teamIndex, teamPlayers] of preAssignedByTeam) {
    teamPlayers.sort((a, b) => b.skill - a.skill);
    for (const player of teamPlayers) {
      const position = teams[teamIndex].players.length + 1;
      teams[teamIndex].players.push({
        name: player.name,
        skill: player.skill,
        position,
        isCaptain: player.isCaptain === true, // Preserve explicit captain designation
      });
    }
  }

  // Sort remaining unassigned players by skill descending for snake draft
  const sortedUnassigned = [...unassignedPlayers].sort((a, b) => b.skill - a.skill);

  // Snake draft remaining players to fill gaps
  // First, determine how many spots each team needs
  const spotsNeeded = teams.map((team) => playersPerTeam - team.players.length);
  const totalSpotsNeeded = spotsNeeded.reduce((a, b) => a + b, 0);

  // Snake draft order
  let direction = 1;
  let teamIndex = 0;
  let assignedCount = 0;

  for (const player of sortedUnassigned) {
    if (assignedCount >= totalSpotsNeeded) break;

    // Find next team that needs a player
    while (spotsNeeded[teamIndex] <= 0) {
      teamIndex += direction;
      if (teamIndex >= numTeams || teamIndex < 0) {
        direction *= -1;
        teamIndex += direction;
      }
    }

    const position = teams[teamIndex].players.length + 1;
    teams[teamIndex].players.push({
      name: player.name,
      skill: player.skill,
      position,
      isCaptain: player.isCaptain === true, // Preserve explicit captain designation
    });

    spotsNeeded[teamIndex]--;
    assignedCount++;

    // Move to next team in snake pattern
    teamIndex += direction;
    if (teamIndex >= numTeams || teamIndex < 0) {
      direction *= -1;
      teamIndex += direction;
    }
  }

  // Re-sort players within each team by skill and assign positions
  teams.forEach((team) => {
    team.players.sort((a, b) => b.skill - a.skill);

    // Check if any player is explicitly marked as captain
    const hasExplicitCaptain = team.players.some((p) => p.isCaptain === true);

    team.players.forEach((player, index) => {
      player.position = index + 1;
      // If no explicit captain, default to position 1 (highest skill)
      if (!hasExplicitCaptain) {
        player.isCaptain = index === 0;
      }
    });
  });

  return teams;
}

/**
 * Generate round-robin schedule using the circle method
 * Ensures each team plays every other team
 */
export function generateRoundRobinSchedule(
  numTeams: number,
  numWeeks: number
): { teamAIndex: number; teamBIndex: number }[][] {
  // For odd number of teams, add a "bye" team
  const teams = numTeams % 2 === 0 ? numTeams : numTeams + 1;
  const rounds: { teamAIndex: number; teamBIndex: number }[][] = [];

  // Create initial array of team indices
  const teamIndices = Array.from({ length: teams }, (_, i) => i);

  // Circle method: fix team 0, rotate others
  for (let round = 0; round < teams - 1; round++) {
    const matchups: { teamAIndex: number; teamBIndex: number }[] = [];

    for (let i = 0; i < teams / 2; i++) {
      const home = teamIndices[i];
      const away = teamIndices[teams - 1 - i];

      // Skip if either team is the "bye" team (index >= actual numTeams)
      if (home < numTeams && away < numTeams) {
        matchups.push({
          teamAIndex: home,
          teamBIndex: away,
        });
      }
    }

    rounds.push(matchups);

    // Rotate: keep first element fixed, rotate others
    const last = teamIndices.pop()!;
    teamIndices.splice(1, 0, last);
  }

  // Extend schedule to fill all weeks
  const schedule: { teamAIndex: number; teamBIndex: number }[][] = [];
  for (let week = 0; week < numWeeks; week++) {
    schedule.push(rounds[week % rounds.length]);
  }

  return schedule;
}

/**
 * Assign dinner and cleanup duties to teams for each week
 * Distributes duties as evenly as possible
 */
export function assignDuties(
  numTeams: number,
  numWeeks: number
): { dinnerTeamIndex: number; cleanupTeamIndex: number }[] {
  const duties: { dinnerTeamIndex: number; cleanupTeamIndex: number }[] = [];

  // Shuffle team indices for random initial assignment
  const shuffledTeams = Array.from({ length: numTeams }, (_, i) => i).sort(
    () => Math.random() - 0.5
  );

  for (let week = 0; week < numWeeks; week++) {
    const dinnerIndex = shuffledTeams[week % numTeams];
    const cleanupIndex = shuffledTeams[(week + 1) % numTeams];

    duties.push({
      dinnerTeamIndex: dinnerIndex,
      cleanupTeamIndex: cleanupIndex,
    });
  }

  return duties;
}

/**
 * Generate complete tournament schedule
 */
export function generateTournament(
  players: PlayerInput[],
  numTeams: number,
  numWeeks: number
): GeneratedSchedule {
  const teams = distributePlayersToTeams(players, numTeams);
  const matchups = generateRoundRobinSchedule(numTeams, numWeeks);
  const duties = assignDuties(numTeams, numWeeks);

  return {
    teams,
    matchups: matchups.map((weekMatchups, week) =>
      weekMatchups.map(() => ({
        week: week + 1,
        teamAScore: 0,
        teamBScore: 0,
        isComplete: false,
      }))
    ),
    duties: duties.map((_, week) => ({
      week: week + 1,
    })),
  };
}

/**
 * Assign first on court for each week
 * Rotates through position groups 1-4 with a randomized start order
 * Each group gets a turn before any repeats
 */
export function assignFirstOnCourt(
  numWeeks: number
): { week: number; positionGroup: number }[] {
  // Shuffle levels 1-4 to randomize starting order
  const levels = [1, 2, 3, 4].sort(() => Math.random() - 0.5);

  // Rotate through levels: each gets a turn before any repeats
  return Array.from({ length: numWeeks }, (_, i) => ({
    week: i + 1,
    positionGroup: levels[i % 4],
  }));
}

export interface ReserveInput {
  name: string;
  phone?: string;
  skill?: number; // Skill value 1-1,000,000, used to calculate suggested level
}

/**
 * Parse CSV input for reserves
 * Expected format: name,phone,skill (one per line)
 * Phone and skill are optional. Skill must be 1-1,000,000 if provided.
 */
export function parseReservesCsv(csv: string): ReserveInput[] {
  const lines = csv
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => {
    const [name, phone, skillStr] = line.split(",").map((s) => s.trim());

    if (!name) {
      throw new Error("Reserve name is required");
    }

    const skill = skillStr ? parseInt(skillStr, 10) : undefined;
    if (
      skill !== undefined &&
      (isNaN(skill) || skill < 1 || skill > 1000000)
    ) {
      throw new Error(`Invalid skill value for ${name}: must be 1-1,000,000`);
    }

    return {
      name,
      phone: phone || undefined,
      skill,
    };
  });
}

/**
 * Parse CSV input for players
 * Expected format: name,skill,team,captain (one per line)
 * skill is optional (defaults to 500000)
 * team is optional (if omitted, player will be snake drafted)
 * captain is optional (use "C" or "c" to mark as captain)
 */
export function parsePlayersCsv(csv: string): PlayerInput[] {
  const lines = csv
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => {
    const [name, skillStr, teamStr, captainStr] = line.split(",").map((s) => s.trim());
    const skill = skillStr ? parseInt(skillStr, 10) : 500000;

    if (!name) {
      throw new Error("Player name is required");
    }

    if (isNaN(skill) || skill < 1 || skill > 1000000) {
      throw new Error(`Invalid skill value for ${name}: must be 1-1,000,000`);
    }

    const team = teamStr || undefined;
    // Team validation happens in distributePlayersToTeams when we know the actual team names

    // Check for captain designation (C, c, Captain, captain, etc.)
    const isCaptain = captainStr ? /^c(aptain)?$/i.test(captainStr) : undefined;

    return { name, skill, team, isCaptain };
  });
}

// =============================================================================
// Skill Range and Suggested Level Calculation
// =============================================================================

export interface PositionSkillRange {
  position: number;
  minSkill: number;
  maxSkill: number;
}

/**
 * Calculate min/max skill for each position (1-4) from tournament players
 */
export function calculatePositionSkillRanges(
  players: { skill: number; position: number }[]
): PositionSkillRange[] {
  // Group players by position
  const byPosition = new Map<number, number[]>();
  for (const player of players) {
    if (!byPosition.has(player.position)) {
      byPosition.set(player.position, []);
    }
    byPosition.get(player.position)!.push(player.skill);
  }

  // Calculate ranges for positions 1-4
  const ranges: PositionSkillRange[] = [];
  for (let position = 1; position <= 4; position++) {
    const skills = byPosition.get(position) || [];
    if (skills.length > 0) {
      ranges.push({
        position,
        minSkill: Math.min(...skills),
        maxSkill: Math.max(...skills),
      });
    }
  }

  return ranges;
}

/**
 * Determine suggested level (1-4) for a skill value based on position ranges
 * Uses the midpoint of each position's skill range
 */
export function calculateSuggestedLevel(
  skill: number,
  ranges: PositionSkillRange[]
): number {
  if (ranges.length === 0) return 2; // Default to level 2 if no data

  // Sort ranges by position
  const sortedRanges = [...ranges].sort((a, b) => a.position - b.position);

  // Find which position range the skill fits into
  // Higher skill = lower position number (1 = best)
  for (const range of sortedRanges) {
    const midpoint = (range.minSkill + range.maxSkill) / 2;
    if (skill >= midpoint) {
      return range.position;
    }
  }

  // If skill is lower than all ranges, return the last (lowest) position
  return sortedRanges[sortedRanges.length - 1]?.position || 4;
}

// =============================================================================
// Pre-defined Tournament Configuration Parsing
// =============================================================================

/**
 * Parse dinner duties order string
 * Format: "Red,Green,Orange,..." (team names separated by commas)
 * Returns array of team names in order for each week
 */
export function parseDutiesOrder(
  dutiesStr: string,
  validTeamNames: string[]
): string[] {
  if (!dutiesStr.trim()) return [];

  const teamNames = dutiesStr.split(",").map((s) => s.trim());
  const normalizedValid = validTeamNames.map((n) => n.toLowerCase());

  for (const name of teamNames) {
    if (!normalizedValid.includes(name.toLowerCase())) {
      throw new Error(`Invalid team name in duties order: "${name}". Valid teams: ${validTeamNames.join(", ")}`);
    }
  }

  return teamNames;
}

/**
 * Parse first on court order string
 * Format: "2,4,1,3,..." (level numbers 1-4 separated by commas)
 * Returns array of position groups for each week
 */
export function parseFirstOnCourtOrder(orderStr: string): number[] {
  if (!orderStr.trim()) return [];

  const levels = orderStr.split(",").map((s) => {
    const num = parseInt(s.trim(), 10);
    if (isNaN(num) || num < 1 || num > 4) {
      throw new Error(`Invalid first on court level: "${s.trim()}". Must be 1-4.`);
    }
    return num;
  });

  return levels;
}

/**
 * Parse matchup schedule string
 * Format: Multi-line, each line is one week
 * "Red vs Orange, Green vs Black\nRed vs Green, Orange vs Black"
 * Returns array of weeks, each containing array of matchup pairs
 */
export function parseMatchupSchedule(
  scheduleStr: string,
  validTeamNames: string[]
): { teamA: string; teamB: string }[][] {
  if (!scheduleStr.trim()) return [];

  const normalizedValid = validTeamNames.map((n) => n.toLowerCase());
  const weeks = scheduleStr.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);

  return weeks.map((weekLine, weekIndex) => {
    const matchupStrs = weekLine.split(",").map((s) => s.trim());
    return matchupStrs.map((matchupStr) => {
      const parts = matchupStr.split(/\s+vs\s+/i);
      if (parts.length !== 2) {
        throw new Error(`Invalid matchup format in week ${weekIndex + 1}: "${matchupStr}". Expected "Team1 vs Team2".`);
      }

      const teamA = parts[0].trim();
      const teamB = parts[1].trim();

      if (!normalizedValid.includes(teamA.toLowerCase())) {
        throw new Error(`Invalid team name in week ${weekIndex + 1}: "${teamA}". Valid teams: ${validTeamNames.join(", ")}`);
      }
      if (!normalizedValid.includes(teamB.toLowerCase())) {
        throw new Error(`Invalid team name in week ${weekIndex + 1}: "${teamB}". Valid teams: ${validTeamNames.join(", ")}`);
      }

      return { teamA, teamB };
    });
  });
}

/**
 * Extract level from notes string
 * Looks for patterns like "Suggested level: 2" or "Level 2 or 3"
 */
export function extractLevelFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/level[:\s]*(\d(?:\s*(?:or|\/|-)\s*\d)?)/i);
  return match ? match[1] : null;
}

/**
 * Calculate suggested handicap percentage based on skill difference between two players.
 * Returns positive if player A's score should be reduced (A is stronger).
 * Returns negative if player B's score should be reduced (B is stronger).
 *
 * Formula: Handicap % = (Skill Difference / Higher Skill) × 50
 * Rounded to nearest 5% increment.
 *
 * Example: 1500 vs 780 skill
 * - Difference = 720
 * - Handicap % = (720 / 1500) × 50 = 24%
 * - A's score would be reduced by 24% (multiplied by 0.76)
 */
export function calculateSuggestedHandicap(skillA: number, skillB: number): number {
  const higherSkill = Math.max(skillA, skillB);
  const lowerSkill = Math.min(skillA, skillB);
  const difference = higherSkill - lowerSkill;

  // Calculate raw percentage
  const rawPercent = (difference / higherSkill) * 50;

  // Round to nearest 5
  const roundedPercent = Math.round(rawPercent / 5) * 5;

  // Return positive if A is stronger, negative if B is stronger
  return skillA >= skillB ? roundedPercent : -roundedPercent;
}
