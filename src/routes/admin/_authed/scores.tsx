"use client";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { getDashboardData } from "~/server/functions/tournament";
import { updateMatchScore } from "~/server/functions/matches";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Card, CardContent, CardHeader } from "~/components/ui/Card";

export const Route = createFileRoute("/admin/_authed/scores")({
  loader: async () => {
    return await getDashboardData();
  },
  component: ScoresPage,
});

function ScoresPage() {
  const { tournament } = Route.useLoaderData();
  const router = useRouter();
  const [selectedWeek, setSelectedWeek] = useState(tournament?.currentWeek ?? 1);
  const [editingMatch, setEditingMatch] = useState<number | null>(null);
  const [editScoreA, setEditScoreA] = useState("");
  const [editScoreB, setEditScoreB] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!tournament) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Scores</h1>
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">No active tournament.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const weekData = tournament.weeklyData[selectedWeek];

  const handleEdit = (matchId: number, currentA: number | null, currentB: number | null) => {
    setEditingMatch(matchId);
    setEditScoreA(currentA?.toString() ?? "");
    setEditScoreB(currentB?.toString() ?? "");
  };

  const handleSave = async (matchId: number) => {
    setIsSaving(true);
    try {
      await updateMatchScore({
        data: {
          matchId,
          scoreA: editScoreA === "" ? null : parseInt(editScoreA),
          scoreB: editScoreB === "" ? null : parseInt(editScoreB),
        },
      });
      setEditingMatch(null);
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update score");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingMatch(null);
    setEditScoreA("");
    setEditScoreB("");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Scores</h1>

      {/* Week Selector */}
      <Card>
        <CardContent className="flex items-center gap-4">
          <label className="font-medium text-gray-700">Select Week:</label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: tournament.numWeeks }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Week {i + 1}
                {i + 1 === tournament.currentWeek ? " (Current)" : ""}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Matchups */}
      {weekData?.matchups.map((matchup) => (
        <Card key={matchup.id}>
          <CardHeader className="bg-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: matchup.teamA.color }}
                />
                <span className="font-bold">{matchup.teamA.name}</span>
              </div>
              <div className="text-xl font-bold">
                {matchup.teamAScore} - {matchup.teamBScore}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{matchup.teamB.name}</span>
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: matchup.teamB.color }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="py-2 px-3 text-left">Pos</th>
                  <th className="py-2 px-3 text-left">Player A</th>
                  <th className="py-2 px-3 text-center">Score</th>
                  <th className="py-2 px-3 text-left">Player B</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matchup.matches.map((match) => (
                  <tr key={match.id} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-gray-400">{match.position}</td>
                    <td className="py-2 px-3">{match.playerA.name}</td>
                    <td className="py-2 px-3">
                      {editingMatch === match.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={editScoreA}
                            onChange={(e) => setEditScoreA(e.target.value)}
                            className="w-12 h-8 text-center text-sm"
                          />
                          <span>-</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={editScoreB}
                            onChange={(e) => setEditScoreB(e.target.value)}
                            className="w-12 h-8 text-center text-sm"
                          />
                        </div>
                      ) : (
                        <div className="text-center font-medium">
                          {match.scoreA ?? "-"} - {match.scoreB ?? "-"}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">{match.playerB.name}</td>
                    <td className="py-2 px-3 text-right">
                      {editingMatch === match.id ? (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleSave(match.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? "..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleCancel}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleEdit(match.id, match.scoreA, match.scoreB)
                          }
                        >
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
