"use client";

import { Card, CardContent, CardHeader } from "~/components/ui/Card";
import { MatchScoreInput } from "./MatchScoreInput";
import { getTeamColorClasses } from "~/lib/constants";
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
}

export function WeeklyMatchupCard({
  matchup,
  onSubmitScore,
  disabled,
}: WeeklyMatchupCardProps) {
  return (
    <Card>
      <CardHeader className="bg-gray-100 dark:bg-gray-700">
        <div className="flex items-center justify-between">
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
        {matchup.matches.map((match) => (
          <MatchScoreInput
            key={match.id}
            match={match}
            teamAColor={matchup.teamA.color}
            teamBColor={matchup.teamB.color}
            onSubmit={onSubmitScore}
            disabled={disabled}
          />
        ))}
      </CardContent>
    </Card>
  );
}
