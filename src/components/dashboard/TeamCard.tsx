import { Card, CardContent, CardHeader } from "~/components/ui/Card";
import { getTeamColorClasses } from "~/lib/constants";
import type { Team, Player } from "~/server/db/schema";

interface TeamCardProps {
  team: Team & { players: Player[] };
  rank?: number;
}

export function TeamCard({ team, rank }: TeamCardProps) {
  const colors = getTeamColorClasses(team.color);

  return (
    <Card className="h-full">
      <CardHeader
        className={`${colors.bg} ${colors.text}`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{team.name}</h3>
          {rank !== undefined && (
            <span className="text-sm opacity-80">#{rank + 1}</span>
          )}
        </div>
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
                <span className="text-gray-400 w-4">{player.position}.</span>
                <span className={player.isCaptain ? "font-medium" : ""}>
                  {player.name}
                </span>
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
