"use client";

import { Card, CardContent, CardHeader } from "~/components/ui/Card";
import { MatchScoreInput } from "./MatchScoreInput";
import type { WeeklyMatchup, Team, Match, Player } from "~/server/db/schema";

interface WeeklyMatchupCardProps {
  matchup: WeeklyMatchup & {
    teamA: Team;
    teamB: Team;
    matches: (Match & { playerA: Player; playerB: Player })[];
  };
  onSubmitScore: (
    matchId: number,
    scoreA: number,
    scoreB: number
  ) => Promise<void>;
  disabled?: boolean;
  firstOnCourt?: number;
}

export function WeeklyMatchupCard({
  matchup,
  onSubmitScore,
  disabled,
  firstOnCourt,
}: WeeklyMatchupCardProps) {
  // Sort matches so first-on-court position appears first
  const sortedMatches = [...matchup.matches].sort((a, b) => {
    if (firstOnCourt) {
      if (a.position === firstOnCourt) return -1;
      if (b.position === firstOnCourt) return 1;
    }
    return a.position - b.position;
  });

  return (
    <Card>
      <CardHeader className="bg-gray-100 dark:bg-gray-700">
        {/* Mobile layout - stacked */}
        <div className="flex sm:hidden items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-500"
              style={{ backgroundColor: matchup.teamA.color }}
            />
            <span className="font-bold dark:text-white text-sm">{matchup.teamA.name.replace("Team ", "")}</span>
          </div>

          <div className="text-center">
            <div className="text-xl font-bold dark:text-white">
              {matchup.teamAScore ?? 0} - {matchup.teamBScore ?? 0}
            </div>
            {matchup.isComplete && (
              <div className="text-xs text-green-600 dark:text-green-400">Complete</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold dark:text-white text-sm">{matchup.teamB.name.replace("Team ", "")}</span>
            <div
              className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-500"
              style={{ backgroundColor: matchup.teamB.color }}
            />
          </div>
        </div>

        {/* Desktop layout - horizontal */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-500"
              style={{ backgroundColor: matchup.teamA.color }}
            />
            <span className="font-bold dark:text-white">{matchup.teamA.name}</span>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold dark:text-white">
              {matchup.teamAScore ?? 0} - {matchup.teamBScore ?? 0}
            </div>
            {matchup.isComplete && (
              <div className="text-xs text-green-600 dark:text-green-400">Complete</div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="font-bold dark:text-white">{matchup.teamB.name}</span>
            <div
              className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-500"
              style={{ backgroundColor: matchup.teamB.color }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {sortedMatches.map((match) => (
          <MatchScoreInput
            key={match.id}
            match={match}
            teamAColor={matchup.teamA.color}
            teamBColor={matchup.teamB.color}
            onSubmit={onSubmitScore}
            disabled={disabled}
            isFirstOnCourt={firstOnCourt === match.position}
          />
        ))}
      </CardContent>
    </Card>
  );
}
