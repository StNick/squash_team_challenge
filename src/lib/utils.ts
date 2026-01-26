import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function calculateTotalScore(
  matches: { scoreA: number | null; scoreB: number | null; teamAId: number }[],
  teamId: number
): number {
  return matches.reduce((total, match) => {
    if (match.scoreA === null || match.scoreB === null) return total;
    return total + (match.teamAId === teamId ? match.scoreA : match.scoreB);
  }, 0);
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
