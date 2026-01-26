export const TEAM_COLORS = [
  // Primary 6 colors (matching standard tournament setup)
  { name: "Red", value: "#EF4444", bg: "bg-red-500", text: "text-white" },
  { name: "Orange", value: "#F97316", bg: "bg-orange-500", text: "text-white" },
  { name: "Green", value: "#22C55E", bg: "bg-green-500", text: "text-white" },
  { name: "Black", value: "#1F2937", bg: "bg-gray-800", text: "text-white" },
  { name: "White", value: "#F9FAFB", bg: "bg-gray-100 border border-gray-300", text: "text-gray-900" },
  { name: "Blue", value: "#3B82F6", bg: "bg-blue-500", text: "text-white" },
  // Additional colors for tournaments with more than 6 teams
  { name: "Yellow", value: "#EAB308", bg: "bg-yellow-500", text: "text-black" },
  { name: "Purple", value: "#A855F7", bg: "bg-purple-500", text: "text-white" },
] as const;

export type TeamColor = (typeof TEAM_COLORS)[number];

export function getTeamColorClasses(colorValue: string): {
  bg: string;
  text: string;
  border: string;
} {
  const color = TEAM_COLORS.find((c) => c.value === colorValue);
  if (color) {
    return {
      bg: color.bg,
      text: color.text,
      border: color.bg.replace("bg-", "border-"),
    };
  }
  return { bg: "bg-gray-500", text: "text-white", border: "border-gray-500" };
}

/**
 * Get a suitable text color for displaying text in the team's color
 * against a light/neutral background. For light teams (White, Yellow),
 * returns a darker shade so text is visible.
 */
export function getTeamTextColor(colorValue: string): string {
  const color = TEAM_COLORS.find((c) => c.value === colorValue);
  if (!color) return colorValue;

  // For light-colored teams, use a darker shade for text visibility
  if (color.name === "White") return "#374151"; // gray-700
  if (color.name === "Yellow") return "#CA8A04"; // yellow-600 (darker yellow)

  return colorValue;
}

export const MATCH_POSITIONS = [1, 2, 3, 4, 5] as const;
export type MatchPosition = (typeof MATCH_POSITIONS)[number];

export const SESSION_COOKIE_NAME = "squash_admin_session";
export const SESSION_EXPIRY_DAYS = 7;
