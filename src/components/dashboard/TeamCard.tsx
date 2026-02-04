import { Card, CardContent, CardHeader } from "~/components/ui/Card";
import { getTeamColorClasses } from "~/lib/constants";
import type { Team, Player } from "~/server/db/schema";

interface TeamCardProps {
  team: Team & { players: Player[] };
}

export function TeamCard({ team }: TeamCardProps) {
  const colors = getTeamColorClasses(team.color);

  return (
    <Card className="h-full">
      <CardHeader
        className={`${colors.bg} ${colors.text}`}
      >
        <h3 className="font-bold text-lg">{team.name}</h3>
        <div className="text-2xl font-bold mt-1">{team.totalScore} pts</div>
      </CardHeader>
      <CardContent className="p-3">
        <ul className="space-y-1">
          {team.players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500 w-4">{player.position}.</span>
                <span className={`${player.isCaptain ? "font-medium" : ""} dark:text-gray-200`}>
                  {player.name}
                </span>
                <span className="text-gray-400 dark:text-gray-500 text-xs">[{player.level.toLocaleString()}]</span>
                {player.isCaptain && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${colors.text} ${colors.bg}`}
                  >
                    C
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
