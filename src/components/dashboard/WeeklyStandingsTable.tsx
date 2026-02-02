import type { Team } from "~/server/db/schema";

interface Matchup {
  teamA: Team;
  teamB: Team;
  teamAScore: number | null;
  teamBScore: number | null;
}

interface WeeklyStandingsTableProps {
  matchups: Matchup[];
  teams: Team[];
}

export function WeeklyStandingsTable({
  matchups,
  teams,
}: WeeklyStandingsTableProps) {
  // Calculate weekly scores from matchups
  const weeklyScores = new Map<number, number>();

  // Initialize all teams with 0
  for (const team of teams) {
    weeklyScores.set(team.id, 0);
  }

  // Sum scores from matchups
  for (const matchup of matchups) {
    const currentA = weeklyScores.get(matchup.teamA.id) ?? 0;
    const currentB = weeklyScores.get(matchup.teamB.id) ?? 0;
    weeklyScores.set(matchup.teamA.id, currentA + (matchup.teamAScore ?? 0));
    weeklyScores.set(matchup.teamB.id, currentB + (matchup.teamBScore ?? 0));
  }

  // Create sorted standings
  const standings = teams
    .map((team) => ({
      ...team,
      weeklyScore: weeklyScores.get(team.id) ?? 0,
    }))
    .sort((a, b) => b.weeklyScore - a.weeklyScore);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 px-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
              Rank
            </th>
            <th className="py-2 px-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
              Team
            </th>
            <th className="py-2 px-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
              Points
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team, index) => (
            <tr
              key={team.id}
              className={`border-b border-gray-100 dark:border-gray-700 ${
                index === 0 ? "bg-green-50 dark:bg-green-900/20" : ""
              }`}
            >
              <td className="py-3 px-3">
                <span
                  className={`font-bold ${
                    index === 0
                      ? "text-green-600 dark:text-green-400"
                      : index === 1
                      ? "text-gray-500 dark:text-gray-400"
                      : index === 2
                      ? "text-amber-700 dark:text-amber-500"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {index + 1}
                </span>
              </td>
              <td className="py-3 px-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="font-medium dark:text-white">{team.name}</span>
                </div>
              </td>
              <td className="py-3 px-3 text-right font-bold dark:text-white">
                {team.weeklyScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
