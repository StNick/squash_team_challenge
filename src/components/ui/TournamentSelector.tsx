"use client";

import type { TournamentStatus } from "~/server/db/schema";

interface Tournament {
  id: number;
  name: string;
  status: TournamentStatus;
  currentWeek: number;
  numWeeks: number;
}

interface TournamentSelectorProps {
  tournaments: Tournament[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/**
 * Dropdown selector for viewing different tournaments.
 * Only shows 'active' and 'ended' tournaments (not drafts).
 */
export function TournamentSelector({
  tournaments,
  selectedId,
  onSelect,
}: TournamentSelectorProps) {
  // Filter to only show active and ended tournaments (not drafts)
  const visibleTournaments = tournaments.filter(
    (t) => t.status === "active" || t.status === "ended"
  );

  if (visibleTournaments.length <= 1) {
    return null; // Don't show selector if only one tournament
  }

  return (
    <select
      value={selectedId ?? ""}
      onChange={(e) => onSelect(Number(e.target.value))}
      className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
    >
      {visibleTournaments.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
          {t.status === "active" ? " (Active)" : " (Ended)"}
        </option>
      ))}
    </select>
  );
}
