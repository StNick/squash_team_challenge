"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  getDraftTournamentForEdit,
  updateDraftTournament,
  updateTournamentStatus,
} from "~/server/functions/tournament";
import { getActivePlayerDatabase } from "~/server/functions/playerDatabase";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Card, CardContent, CardHeader } from "~/components/ui/Card";

export const Route = createFileRoute("/admin/_authed/tournament/edit")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: Number(search.id) || 0,
  }),
  loaderDeps: ({ search: { id } }) => ({ id }),
  loader: async ({ deps: { id } }) => {
    if (!id) {
      throw new Error("Tournament ID is required");
    }
    const [tournamentData, playerDbData] = await Promise.all([
      getDraftTournamentForEdit({ data: { tournamentId: id } }),
      getActivePlayerDatabase(),
    ]);
    return {
      ...tournamentData,
      databasePlayers: playerDbData.players,
    };
  },
  component: EditTournamentPage,
});

function EditTournamentPage() {
  const {
    tournament,
    selectedPlayerIds: initialSelectedPlayerIds,
    playersCsv: initialPlayersCsv,
    selectedReserveIds: initialSelectedReserveIds,
    reservesCsv: initialReservesCsv,
    dinnerDutiesOrder: initialDinnerDutiesOrder,
    cleanupDutiesOrder: initialCleanupDutiesOrder,
    firstOnCourtOrder: initialFirstOnCourtOrder,
    matchupSchedule: initialMatchupSchedule,
    databasePlayers,
  } = Route.useLoaderData();

  const navigate = useNavigate();
  const [name, setName] = useState(tournament.name);
  const [numWeeks, setNumWeeks] = useState(tournament.numWeeks);
  const [numTeams, setNumTeams] = useState(tournament.numTeams);
  const [playersCsv, setPlayersCsv] = useState(initialPlayersCsv);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>(initialSelectedPlayerIds);
  const [selectedReserveIds, setSelectedReserveIds] = useState<number[]>(initialSelectedReserveIds);
  const [reservesCsv, setReservesCsv] = useState(initialReservesCsv);
  // Advanced options (now loaded from stored config)
  const [dinnerDutiesOrder, setDinnerDutiesOrder] = useState(initialDinnerDutiesOrder);
  const [cleanupDutiesOrder, setCleanupDutiesOrder] = useState(initialCleanupDutiesOrder);
  const [firstOnCourtOrder, setFirstOnCourtOrder] = useState(initialFirstOnCourtOrder);
  const [matchupSchedule, setMatchupSchedule] = useState(initialMatchupSchedule);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveSuccess(false);
    setIsLoading(true);

    try {
      await updateDraftTournament({
        data: {
          tournamentId: tournament.id,
          name,
          numWeeks,
          numTeams,
          playersCsv,
          selectedPlayerIds,
          selectedReserveIds,
          reservesCsv,
          dinnerDutiesOrder: dinnerDutiesOrder.trim() || undefined,
          cleanupDutiesOrder: cleanupDutiesOrder.trim() || undefined,
          firstOnCourtOrder: firstOnCourtOrder.trim() || undefined,
          matchupSchedule: matchupSchedule.trim() || undefined,
        },
      });
      setSaveSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tournament");
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async () => {
    setIsLoading(true);
    try {
      await updateTournamentStatus({
        data: { tournamentId: tournament.id, status: "active" },
      });
      navigate({ to: "/admin/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate tournament");
    } finally {
      setIsLoading(false);
    }
  };

  // Parse CSV players for preview
  const csvPlayers = playersCsv
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [name, levelStr, teamStr, captainStr] = line.split(",").map((s) => s.trim());
      return {
        name,
        level: levelStr ? parseInt(levelStr) : 500000,
        team: teamStr || undefined,
        isCaptain: captainStr ? /^c(aptain)?$/i.test(captainStr) : false,
        source: "csv" as const,
      };
    });

  // Get selected database players
  const selectedDbPlayers = databasePlayers
    .filter((p) => selectedPlayerIds.includes(p.id))
    .map((p) => ({ name: p.name, level: p.level, source: "database" as const }));

  // Combine all players
  const allPlayers = [...selectedDbPlayers, ...csvPlayers];

  const playersPerTeam = Math.floor(allPlayers.length / numTeams);
  const isValid =
    name.trim().length > 0 &&
    allPlayers.length >= numTeams &&
    playersPerTeam >= 1 &&
    playersPerTeam <= 5;

  const togglePlayer = (playerId: number) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
    setSaveSuccess(false);
  };

  const selectAllPlayers = () => {
    setSelectedPlayerIds(databasePlayers.map((p) => p.id));
    setSaveSuccess(false);
  };

  const deselectAllPlayers = () => {
    setSelectedPlayerIds([]);
    setSaveSuccess(false);
  };

  // Reserves selection helpers
  const availableReservePlayers = databasePlayers.filter(
    (p) => !selectedPlayerIds.includes(p.id)
  );

  const toggleReserve = (playerId: number) => {
    setSelectedReserveIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
    setSaveSuccess(false);
  };

  const selectAllReserves = () => {
    setSelectedReserveIds(availableReservePlayers.map((p) => p.id));
    setSaveSuccess(false);
  };

  const deselectAllReserves = () => {
    setSelectedReserveIds([]);
    setSaveSuccess(false);
  };

  const actualSelectedReserveIds = selectedReserveIds.filter(
    (id) => !selectedPlayerIds.includes(id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Edit Tournament: {tournament.name}
        </h1>
        <div className="flex gap-2">
          <Button onClick={handleActivate} disabled={isLoading}>
            {isLoading ? "Activating..." : "Activate Tournament"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate({ to: "/admin/dashboard" })}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      {saveSuccess && (
        <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
          Tournament updated successfully! You can continue editing or activate the tournament.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 dark:text-white">Tournament Details</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Tournament Name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setSaveSuccess(false); }}
                placeholder="e.g., Spring 2024 Tournament"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="numWeeks"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Number of Weeks
                </label>
                <Input
                  id="numWeeks"
                  type="number"
                  min={1}
                  max={20}
                  value={numWeeks}
                  onChange={(e) => { setNumWeeks(parseInt(e.target.value) || 10); setSaveSuccess(false); }}
                  className="w-full"
                />
              </div>

              <div>
                <label
                  htmlFor="numTeams"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Number of Teams
                </label>
                <Input
                  id="numTeams"
                  type="number"
                  min={2}
                  max={8}
                  value={numTeams}
                  onChange={(e) => { setNumTeams(parseInt(e.target.value) || 4); setSaveSuccess(false); }}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Select from Player Database */}
        {databasePlayers.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Select from Player Database</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedPlayerIds.length} of {databasePlayers.length} players selected
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={selectAllPlayers}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={deselectAllPlayers}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                {databasePlayers.map((player) => (
                  <label
                    key={player.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                      selectedPlayerIds.includes(player.id) ? "bg-blue-50 dark:bg-blue-900/50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.includes(player.id)}
                      onChange={() => togglePlayer(player.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="flex-1 dark:text-white">{player.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {player.level.toLocaleString()}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 dark:text-white">Additional Players (CSV)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Format: name,level,team,captain (all except name are optional). Level: 1-1,000,000 (defaults to 500,000).
              Team: Red, Orange, Green, Black, White, Blue. Captain: use "C" to mark as team captain.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={playersCsv}
              onChange={(e) => { setPlayersCsv(e.target.value); setSaveSuccess(false); }}
              placeholder={`John Smith,800000,Red,C
Jane Doe,750000,Blue
Bob Wilson,700000,Red
Alice Brown,650000,Blue,C`}
              className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </CardContent>
        </Card>

        {/* Select Reserves from Player Database */}
        {availableReservePlayers.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Select Reserves from Player Database</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {actualSelectedReserveIds.length} of {availableReservePlayers.length} available players selected as reserves
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={selectAllReserves}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={deselectAllReserves}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                {availableReservePlayers.map((player) => (
                  <label
                    key={player.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                      actualSelectedReserveIds.includes(player.id) ? "bg-green-50 dark:bg-green-900/50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={actualSelectedReserveIds.includes(player.id)}
                      onChange={() => toggleReserve(player.id)}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <span className="flex-1 dark:text-white">{player.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {player.level.toLocaleString()}
                    </span>
                    {player.phone && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {player.phone}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 dark:text-white">Additional Reserves (CSV)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Format: name,phone,level (phone and level are optional). Level: 1-1,000,000.
              The suggested position (1-4) is auto-calculated based on the tournament's player level distribution.
            </p>
          </CardHeader>
          <CardContent>
            <textarea
              value={reservesCsv}
              onChange={(e) => { setReservesCsv(e.target.value); setSaveSuccess(false); }}
              placeholder={`Nolan Shaw,0210 263 1290,750000
Trevor Moore,021 166 6214,600000
Spencer Craft,021 174 7700,850000`}
              className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </CardContent>
        </Card>

        {/* Player Preview */}
        {allPlayers.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                All Players ({allPlayers.length} total)
              </h2>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                <p>Teams: {numTeams}</p>
                <p>Players per team: {playersPerTeam}</p>
                {allPlayers.length % numTeams !== 0 && (
                  <p className="text-orange-600 dark:text-orange-400">
                    Note: {allPlayers.length % numTeams} player(s) will not be
                    assigned to teams
                  </p>
                )}
                {playersPerTeam > 5 && (
                  <p className="text-red-600 dark:text-red-400">
                    Error: Maximum 5 players per team
                  </p>
                )}
                {playersPerTeam < 1 && (
                  <p className="text-red-600 dark:text-red-400">
                    Error: Need at least 1 player per team
                  </p>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr className="border-b dark:border-gray-600">
                      <th className="py-2 px-3 text-left dark:text-gray-300">Name</th>
                      <th className="py-2 px-3 text-right dark:text-gray-300">Level</th>
                      <th className="py-2 px-3 text-center dark:text-gray-300">Team</th>
                      <th className="py-2 px-3 text-center dark:text-gray-300">C</th>
                      <th className="py-2 px-3 text-center dark:text-gray-300">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPlayers.slice(0, 30).map((player, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-1 px-3 dark:text-white">{player.name}</td>
                        <td className="py-1 px-3 text-right font-mono dark:text-white">
                          {player.level.toLocaleString()}
                        </td>
                        <td className="py-1 px-3 text-center">
                          {"team" in player && player.team ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                              {player.team}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="py-1 px-3 text-center">
                          {"isCaptain" in player && player.isCaptain ? (
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">C</span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="py-1 px-3 text-center">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              player.source === "database"
                                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {player.source === "database" ? "DB" : "CSV"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {allPlayers.length > 30 && (
                      <tr>
                        <td colSpan={5} className="py-2 text-center text-gray-400 dark:text-gray-500">
                          ...and {allPlayers.length - 30} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Advanced Options */}
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white py-2 list-none flex items-center gap-2">
            <svg
              className="w-4 h-4 transition-transform group-open:rotate-90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Advanced Options (Optional)
          </summary>
          <div className="mt-4 space-y-4 pl-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              These fields are optional. Leave them blank to automatically generate a balanced schedule.
              Only use these if you're importing a pre-existing tournament setup.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Weekly Matchups
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                One line per week. Format: Team1 vs Team2, Team3 vs Team4. Leave blank for round-robin.
              </p>
              <textarea
                value={matchupSchedule}
                onChange={(e) => { setMatchupSchedule(e.target.value); setSaveSuccess(false); }}
                placeholder={`Red vs Blue, Green vs Yellow
Red vs Green, Blue vs Yellow
Red vs Yellow, Blue vs Green`}
                className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dinner Duties Order
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Order of teams for dinner duty by week (comma-separated). Leave blank to randomize.
              </p>
              <Input
                value={dinnerDutiesOrder}
                onChange={(e) => { setDinnerDutiesOrder(e.target.value); setSaveSuccess(false); }}
                placeholder="Red,Blue,Green,Yellow,Red,Blue,Green,Yellow,Red,Blue"
                className="w-full font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cleanup Duties Order
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Order of teams for cleanup duty by week (comma-separated). Leave blank to randomize.
              </p>
              <Input
                value={cleanupDutiesOrder}
                onChange={(e) => { setCleanupDutiesOrder(e.target.value); setSaveSuccess(false); }}
                placeholder="Green,Yellow,Red,Blue,Green,Yellow,Red,Blue,Green,Yellow"
                className="w-full font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First on Court Order
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Which position plays first each week (1-4, comma-separated). Leave blank to randomize.
              </p>
              <Input
                value={firstOnCourtOrder}
                onChange={(e) => { setFirstOnCourtOrder(e.target.value); setSaveSuccess(false); }}
                placeholder="2,4,1,3,2,4,1,3,2,4"
                className="w-full font-mono text-sm"
              />
            </div>
          </div>
        </details>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <Button type="submit" disabled={!isValid || isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate({ to: "/admin/dashboard" })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
