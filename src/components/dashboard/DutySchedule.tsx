import type { Team, WeeklyDuty } from "~/server/db/schema";

interface DutyScheduleProps {
  duties: (WeeklyDuty & {
    dinnerTeam: Team;
    cleanupTeam: Team;
    firstOnCourt?: number; // Level 1-4
  })[];
  currentWeek: number;
}

export function DutySchedule({ duties, currentWeek }: DutyScheduleProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 px-3 text-left font-medium text-gray-500">
              Week
            </th>
            <th className="py-2 px-3 text-left font-medium text-gray-500">
              Dinner
            </th>
            <th className="py-2 px-3 text-left font-medium text-gray-500">
              Cleanup
            </th>
            <th className="py-2 px-3 text-left font-medium text-gray-500">
              First on Court
            </th>
          </tr>
        </thead>
        <tbody>
          {duties.map((duty) => (
            <tr
              key={duty.id}
              className={`border-b border-gray-100 ${
                duty.week === currentWeek ? "bg-blue-50" : ""
              }`}
            >
              <td className="py-2 px-3">
                <span
                  className={`${
                    duty.week === currentWeek
                      ? "font-bold text-blue-600"
                      : "text-gray-600"
                  }`}
                >
                  Week {duty.week}
                  {duty.week === currentWeek && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
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
                  <span>{duty.dinnerTeam.name}</span>
                </div>
              </td>
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: duty.cleanupTeam.color }}
                  />
                  <span>{duty.cleanupTeam.name}</span>
                </div>
              </td>
              <td className="py-2 px-3">
                {duty.firstOnCourt ? (
                  <span className="text-sm text-gray-700">
                    Level {duty.firstOnCourt}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
