"use client";

import { useState, useMemo } from "react";
import type { Team, Player, Match, WeeklyMatchup, Reserve } from "~/server/db/schema";

interface PlayerStats {
  id: string; // Can be player ID or substitute identifier
  name: string;
  teamName: string;
  teamColor: string;
  totalPoints: number;
  matchesPlayed: number;
  average: number;
  isSub: boolean;
}

interface MatchWithSubs extends Match {
  playerA: Player;
  playerB: Player;
  substituteA?: Reserve | null;
  substituteB?: Reserve | null;
}

interface WeekData {
  matchups: (WeeklyMatchup & {
    teamA: Team;
    teamB: Team;
    matches: MatchWithSubs[];
  })[];
}

interface PlayerStatsTableProps {
  weeklyData: Record<number, WeekData>;
  teams: (Team & { players: Player[] })[];
}

type SortKey = "name" | "total" | "average" | "matches";
type SortDirection = "asc" | "desc";

export function PlayerStatsTable({ weeklyData, teams }: PlayerStatsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const playerStats = useMemo(() => {
    // Create a map to aggregate stats per player/substitute
    const statsMap = new Map<string, PlayerStats>();

    // Initialize all players from teams
    for (const team of teams) {
      for (const player of team.players) {
        statsMap.set(`player-${player.id}`, {
          id: `player-${player.id}`,
          name: player.name,
          teamName: team.name,
          teamColor: team.color,
          totalPoints: 0,
          matchesPlayed: 0,
          average: 0,
          isSub: false,
        });
      }
    }

    // Helper to get or create substitute stats
    const getOrCreateSubStats = (subName: string): PlayerStats => {
      const key = `sub-${subName}`;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          id: key,
          name: subName,
          teamName: "",
          teamColor: "",
          totalPoints: 0,
          matchesPlayed: 0,
          average: 0,
          isSub: true,
        });
      }
      return statsMap.get(key)!;
    };

    // Iterate through all weeks and matches
    for (const weekData of Object.values(weeklyData)) {
      for (const matchup of weekData.matchups) {
        for (const match of matchup.matches) {
          // Only count matches with scores
          if (match.scoreA !== null && match.scoreB !== null) {
            // Check if Player A was substituted
            const hasSubA = match.substituteAId || match.customSubstituteAName;
            if (hasSubA) {
              // Credit the substitute, not the original player
              const subName = match.substituteA?.name || match.customSubstituteAName;
              if (subName) {
                const subStats = getOrCreateSubStats(subName);
                subStats.totalPoints += match.scoreA;
                subStats.matchesPlayed += 1;
              }
            } else {
              // Credit the original player
              const playerAStats = statsMap.get(`player-${match.playerAId}`);
              if (playerAStats) {
                playerAStats.totalPoints += match.scoreA;
                playerAStats.matchesPlayed += 1;
              }
            }

            // Check if Player B was substituted
            const hasSubB = match.substituteBId || match.customSubstituteBName;
            if (hasSubB) {
              // Credit the substitute, not the original player
              const subName = match.substituteB?.name || match.customSubstituteBName;
              if (subName) {
                const subStats = getOrCreateSubStats(subName);
                subStats.totalPoints += match.scoreB;
                subStats.matchesPlayed += 1;
              }
            } else {
              // Credit the original player
              const playerBStats = statsMap.get(`player-${match.playerBId}`);
              if (playerBStats) {
                playerBStats.totalPoints += match.scoreB;
                playerBStats.matchesPlayed += 1;
              }
            }
          }
        }
      }
    }

    // Calculate averages
    for (const stats of statsMap.values()) {
      if (stats.matchesPlayed > 0) {
        stats.average = stats.totalPoints / stats.matchesPlayed;
      }
    }

    return Array.from(statsMap.values());
  }, [weeklyData, teams]);

  const sortedStats = useMemo(() => {
    return [...playerStats].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "total":
          comparison = a.totalPoints - b.totalPoints;
          break;
        case "average":
          comparison = a.average - b.average;
          break;
        case "matches":
          comparison = a.matchesPlayed - b.matchesPlayed;
          break;
      }

      return sortDirection === "desc" ? -comparison : comparison;
    });
  }, [playerStats, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const SortIndicator = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return (
      <span className="ml-1">
        {sortDirection === "desc" ? "▼" : "▲"}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th
              className="py-2 px-3 text-left font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
              onClick={() => handleSort("name")}
            >
              Player
              <SortIndicator columnKey="name" />
            </th>
            <th className="py-2 px-3 text-left font-medium text-gray-500 dark:text-gray-400">
              Team
            </th>
            <th
              className="py-2 px-3 text-right font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
              onClick={() => handleSort("total")}
            >
              Total
              <SortIndicator columnKey="total" />
            </th>
            <th
              className="py-2 px-3 text-right font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
              onClick={() => handleSort("matches")}
            >
              Played
              <SortIndicator columnKey="matches" />
            </th>
            <th
              className="py-2 px-3 text-right font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
              onClick={() => handleSort("average")}
            >
              Avg
              <SortIndicator columnKey="average" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedStats.map((stats) => (
            <tr
              key={stats.id}
              className="border-b border-gray-100 dark:border-gray-700"
            >
              <td className="py-2 px-3 dark:text-white">
                {stats.name}
                {stats.isSub && (
                  <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500 italic">
                    (sub)
                  </span>
                )}
              </td>
              <td className="py-2 px-3">
                {stats.isSub ? (
                  <span className="text-gray-400 dark:text-gray-500">-</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-500"
                      style={{ backgroundColor: stats.teamColor }}
                    />
                    <span className="text-gray-600 dark:text-gray-400 text-xs">
                      {stats.teamName.replace("Team ", "")}
                    </span>
                  </div>
                )}
              </td>
              <td className="py-2 px-3 text-right font-medium dark:text-white">
                {stats.totalPoints}
              </td>
              <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                {stats.matchesPlayed}
              </td>
              <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                {stats.matchesPlayed > 0 ? stats.average.toFixed(1) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
