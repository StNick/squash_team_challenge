import type { Team, WeeklyDuty } from "~/server/db/schema";

interface DutyScheduleProps {
  duties: (WeeklyDuty & {
    dinnerTeam: Team;
    cleanupTeam: Team;
    firstOnCourt?: number; // Position 1-4
  })[];
  currentWeek: number;
}

export function DutySchedule({ duties, currentWeek }: DutyScheduleProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 px-3 text-left font-medium text-gray-500 dark:text-gray-400">
              Week
            </th>
            <th className="py-2 px-3 text-left font-medium text-gray-500 dark:text-gray-400">
              Dinner
            </th>
            <th className="py-2 px-3 text-left font-medium text-gray-500 dark:text-gray-400">
              Cleanup
            </th>
            <th className="py-2 px-3 text-left font-medium text-gray-500 dark:text-gray-400">
              First on Court
            </th>
          </tr>
        </thead>
        <tbody>
          {duties.map((duty) => (
            <tr
              key={duty.id}
              className={`border-b border-gray-100 dark:border-gray-700 ${
                duty.week === currentWeek ? "bg-blue-50 dark:bg-blue-900/20" : ""
              }`}
            >
              <td className="py-2 px-3">
                <span
                  className={`${
                    duty.week === currentWeek
                      ? "font-bold text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  Week {duty.week}
                  {duty.week === currentWeek && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </span>
              </td>
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: duty.dinnerTeam.color }}
                  />
                  <span className="dark:text-gray-200">{duty.dinnerTeam.name}</span>
                </div>
              </td>
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: duty.cleanupTeam.color }}
                  />
                  <span className="dark:text-gray-200">{duty.cleanupTeam.name}</span>
                </div>
              </td>
              <td className="py-2 px-3">
                {duty.firstOnCourt ? (
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Position {duty.firstOnCourt}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
