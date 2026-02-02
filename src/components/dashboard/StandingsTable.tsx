import type { Team } from "~/server/db/schema";

interface StandingsTableProps {
  teams: (Team & { totalScore: number })[];
}

export function StandingsTable({ teams }: StandingsTableProps) {
  const sortedTeams = [...teams].sort((a, b) => b.totalScore - a.totalScore);

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
          {sortedTeams.map((team, index) => (
            <tr
              key={team.id}
              className={`border-b border-gray-100 dark:border-gray-700 ${
                index === 0 ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
              }`}
            >
              <td className="py-3 px-3">
                <span
                  className={`font-bold ${
                    index === 0
                      ? "text-yellow-600 dark:text-yellow-500"
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
                {team.totalScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
