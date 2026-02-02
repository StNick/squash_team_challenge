"use client";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { getPlayers, swapPlayers, setCaptain } from "~/server/functions/players";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader } from "~/components/ui/Card";
import { getTeamColorClasses } from "~/lib/constants";

export const Route = createFileRoute("/admin/_authed/players")({
  loader: async () => {
    return await getPlayers();
  },
  component: PlayersPage,
});

function PlayersPage() {
  const { players } = Route.useLoaderData();
  const router = useRouter();
  const [playerA, setPlayerA] = useState<number | null>(null);
  const [playerB, setPlayerB] = useState<number | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group players by team
  const playersByTeam = players.reduce(
    (acc, player) => {
      if (!acc[player.teamId]) {
        acc[player.teamId] = {
          team: player.team,
          players: [],
        };
      }
      acc[player.teamId].players.push(player);
      return acc;
    },
    {} as Record<number, { team: typeof players[0]["team"]; players: typeof players }>
  );

  const handleSwap = async () => {
    if (!playerA || !playerB) return;

    setIsSwapping(true);
    setError(null);

    try {
      await swapPlayers({ data: { playerAId: playerA, playerBId: playerB } });
      setPlayerA(null);
      setPlayerB(null);
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to swap players");
    } finally {
      setIsSwapping(false);
    }
  };

  const handleSetCaptain = async (playerId: number) => {
    try {
      await setCaptain({ data: { playerId } });
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set captain");
    }
  };

  if (players.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Players</h1>
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">No players found. Create a tournament first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Players</h1>

      {/* Swap Players Card */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900 dark:text-white">Swap Players</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select two players from different teams to swap their positions
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Player 1
              </label>
              <select
                value={playerA ?? ""}
                onChange={(e) => setPlayerA(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select a player</option>
                {Object.values(playersByTeam).map(({ team, players: teamPlayers }) => (
                  <optgroup key={team.id} label={team.name}>
                    {teamPlayers.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.id === playerB}>
                        {p.name} [{p.level}] - Pos {p.position}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Player 2
              </label>
              <select
                value={playerB ?? ""}
                onChange={(e) => setPlayerB(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select a player</option>
                {Object.values(playersByTeam).map(({ team, players: teamPlayers }) => (
                  <optgroup key={team.id} label={team.name}>
                    {teamPlayers.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.id === playerA}>
                        {p.name} [{p.level}] - Pos {p.position}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <Button
            onClick={handleSwap}
            disabled={!playerA || !playerB || isSwapping}
          >
            {isSwapping ? "Swapping..." : "Swap Players"}
          </Button>
        </CardContent>
      </Card>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.values(playersByTeam).map(({ team, players: teamPlayers }) => {
          const colors = getTeamColorClasses(team.color);
          return (
            <Card key={team.id} className="h-full">
              <CardHeader className={`${colors.bg} ${colors.text}`}>
                <h3 className="font-bold text-lg">{team.name}</h3>
              </CardHeader>
              <CardContent className="p-3">
                <ul className="space-y-2">
                  {teamPlayers
                    .sort((a, b) => a.position - b.position)
                    .map((player) => (
                      <li
                        key={player.id}
                        className="group flex items-center justify-between text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-gray-400 dark:text-gray-500 w-4">{player.position}.</span>
                          <span className={`dark:text-white ${player.isCaptain ? "font-medium" : ""}`}>
                            {player.name}
                          </span>
                          <span className="text-gray-400 dark:text-gray-500 text-xs">[{player.level.toLocaleString()}]</span>
                          {player.isCaptain ? (
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${colors.text} ${colors.bg}`}
                            >
                              C
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetCaptain(player.id)}
                              className="text-xs text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Make captain"
                            >
                              C
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
