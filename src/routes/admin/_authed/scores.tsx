"use client";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getDashboardData } from "~/server/functions/tournament";
import {
  updateMatchScore,
  setMatchSubstitute,
  setMatchHandicap,
  getSuggestedHandicap,
  type SubstituteType,
} from "~/server/functions/matches";
import { getReserves } from "~/server/functions/reserves";
import { getPlayerDatabase } from "~/server/functions/playerDatabase";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Card, CardContent, CardHeader } from "~/components/ui/Card";
import { Modal } from "~/components/ui/Modal";

export const Route = createFileRoute("/admin/_authed/scores")({
  loader: async () => {
    const [dashboardData, reservesData, playerDbData] = await Promise.all([
      getDashboardData(),
      getReserves(),
      getPlayerDatabase(),
    ]);
    return {
      ...dashboardData,
      reserves: reservesData.reserves,
      playerDatabase: playerDbData.players,
    };
  },
  component: ScoresPage,
});

// Handicap percentage options (0%, 5%, 10%, ... 50%)
const HANDICAP_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

function ScoresPage() {
  const { tournament, reserves, playerDatabase } = Route.useLoaderData();
  const router = useRouter();
  const [selectedWeek, setSelectedWeek] = useState(tournament?.currentWeek ?? 1);
  const [editingMatch, setEditingMatch] = useState<number | null>(null);
  const [editScoreA, setEditScoreA] = useState("");
  const [editScoreB, setEditScoreB] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savingSubstitute, setSavingSubstitute] = useState<string | null>(null);
  const [savingHandicap, setSavingHandicap] = useState<number | null>(null);

  // Custom substitute modal state
  const [customSubModal, setCustomSubModal] = useState<{
    matchId: number;
    side: "A" | "B";
  } | null>(null);
  const [customSubName, setCustomSubName] = useState("");
  const [customSubLevel, setCustomSubLevel] = useState("");

  // Track recommended handicaps for each match
  const [recommendedHandicaps, setRecommendedHandicaps] = useState<Record<number, number>>({});

  // Pre-fetch recommended handicaps for all matches in the selected week
  useEffect(() => {
    if (!tournament) return;

    const weekData = tournament.weeklyData[selectedWeek];
    if (!weekData) return;

    const fetchRecommendedHandicaps = async () => {
      const matchIds = weekData.matchups.flatMap((m) => m.matches.map((match) => match.id));

      const results = await Promise.all(
        matchIds.map(async (matchId) => {
          try {
            const result = await getSuggestedHandicap({ data: { matchId } });
            return { matchId, handicap: result.suggestedHandicap };
          } catch {
            return null;
          }
        })
      );

      const handicapMap: Record<number, number> = {};
      for (const r of results) {
        if (r) handicapMap[r.matchId] = r.handicap;
      }
      setRecommendedHandicaps(handicapMap);
    };

    fetchRecommendedHandicaps();
  }, [tournament, selectedWeek]);

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

  const handleSubstituteChange = async (
    matchId: number,
    side: "A" | "B",
    value: string
  ) => {
    // Value format: "none", "reserve:ID", "player:ID", or "custom"
    if (value === "custom") {
      setCustomSubModal({ matchId, side });
      setCustomSubName("");
      setCustomSubLevel("");
      return;
    }

    const key = `${matchId}-${side}`;
    setSavingSubstitute(key);

    try {
      let type: SubstituteType;
      let reserveId: number | undefined;
      let playerDatabaseId: number | undefined;

      if (value === "none" || value === "") {
        type = "none";
      } else if (value.startsWith("reserve:")) {
        type = "reserve";
        reserveId = parseInt(value.replace("reserve:", ""));
      } else if (value.startsWith("player:")) {
        type = "playerDatabase";
        playerDatabaseId = parseInt(value.replace("player:", ""));
      } else {
        // Legacy format - just a number means reserve ID
        type = "reserve";
        reserveId = parseInt(value);
      }

      await setMatchSubstitute({
        data: { matchId, side, type, reserveId, playerDatabaseId },
      });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to set substitute");
    } finally {
      setSavingSubstitute(null);
    }
  };

  const handleCustomSubSubmit = async () => {
    if (!customSubModal) return;

    const key = `${customSubModal.matchId}-${customSubModal.side}`;
    setSavingSubstitute(key);

    try {
      await setMatchSubstitute({
        data: {
          matchId: customSubModal.matchId,
          side: customSubModal.side,
          type: "custom",
          customName: customSubName,
          customLevel: customSubLevel ? parseInt(customSubLevel) : undefined,
        },
      });
      setCustomSubModal(null);
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to set substitute");
    } finally {
      setSavingSubstitute(null);
    }
  };

  const handleHandicapChange = async (matchId: number, handicap: number) => {
    setSavingHandicap(matchId);
    try {
      await setMatchHandicap({ data: { matchId, handicap } });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to set handicap");
    } finally {
      setSavingHandicap(null);
    }
  };

  const handleAutoHandicap = async (matchId: number) => {
    setSavingHandicap(matchId);
    try {
      const result = await getSuggestedHandicap({ data: { matchId } });
      setRecommendedHandicaps((prev) => ({
        ...prev,
        [matchId]: result.suggestedHandicap,
      }));
      await setMatchHandicap({ data: { matchId, handicap: result.suggestedHandicap } });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to calculate handicap");
    } finally {
      setSavingHandicap(null);
    }
  };

  // Get substitute display (reserve or custom)
  const getSubstituteDisplay = (match: {
    substituteA?: { id: number; name: string; level: number } | null;
    substituteB?: { id: number; name: string; level: number } | null;
    customSubstituteAName?: string | null;
    customSubstituteALevel?: number | null;
    customSubstituteBName?: string | null;
    customSubstituteBLevel?: number | null;
  }, side: "A" | "B"): string | null => {
    if (side === "A") {
      if (match.substituteA) {
        return `${match.substituteA.name} [${match.substituteA.level}]`;
      }
      if (match.customSubstituteAName) {
        return `${match.customSubstituteAName}${match.customSubstituteALevel ? ` [${match.customSubstituteALevel}]` : ""}`;
      }
    } else {
      if (match.substituteB) {
        return `${match.substituteB.name} [${match.substituteB.level}]`;
      }
      if (match.customSubstituteBName) {
        return `${match.customSubstituteBName}${match.customSubstituteBLevel ? ` [${match.customSubstituteBLevel}]` : ""}`;
      }
    }
    return null;
  };

  // Check if a substitute is set
  const hasSubstitute = (match: {
    substituteA?: { id: number } | null;
    substituteB?: { id: number } | null;
    customSubstituteAName?: string | null;
    customSubstituteBName?: string | null;
  }, side: "A" | "B"): boolean => {
    if (side === "A") {
      return !!(match.substituteA?.id || match.customSubstituteAName);
    }
    return !!(match.substituteB?.id || match.customSubstituteBName);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Scores</h1>

      {/* Handicap explanation */}
      <Card>
        <CardContent className="text-sm text-gray-600">
          <p className="font-medium text-gray-800 mb-1">Handicap System</p>
          <p>Recommended handicap is calculated as half the level advantage. For example, a player with 48% higher level gets a 24% handicap applied to their actual score.</p>
        </CardContent>
      </Card>

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
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="py-2 px-2 text-left w-10">Pos</th>
                  <th className="py-2 px-2 text-left">Player A</th>
                  <th className="py-2 px-2 text-left w-40">Sub A</th>
                  <th className="py-2 px-2 text-center w-28">Score</th>
                  <th className="py-2 px-2 text-left">Player B</th>
                  <th className="py-2 px-2 text-left w-40">Sub B</th>
                  <th className="py-2 px-2 text-center w-32">Handicap</th>
                  <th className="py-2 px-2 text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matchup.matches.map((match) => {
                  const matchWithSubs = match as typeof match & {
                    substituteA?: { id: number; name: string; level: number } | null;
                    substituteB?: { id: number; name: string; level: number } | null;
                    customSubstituteAName?: string | null;
                    customSubstituteALevel?: number | null;
                    customSubstituteBName?: string | null;
                    customSubstituteBLevel?: number | null;
                    handicap?: number | null;
                  };
                  const currentHandicap = matchWithSubs.handicap ?? 0;
                  const recommended = recommendedHandicaps[match.id];

                  return (
                    <tr key={match.id} className="border-b border-gray-100">
                      <td className="py-2 px-2 text-gray-400">{match.position}</td>
                      <td className="py-2 px-2">
                        <div className="text-sm">{match.playerA.name}</div>
                        <div className="text-xs text-gray-400">[{match.playerA.level}]</div>
                      </td>
                      <td className="py-2 px-2">
                        {hasSubstitute(matchWithSubs, "A") ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded flex-1 truncate">
                              {getSubstituteDisplay(matchWithSubs, "A")}
                            </span>
                            <button
                              onClick={() => handleSubstituteChange(match.id, "A", "none")}
                              disabled={savingSubstitute === `${match.id}-A`}
                              className="text-gray-400 hover:text-red-500 px-1"
                              title="Clear substitute"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <select
                            value="none"
                            onChange={(e) =>
                              handleSubstituteChange(match.id, "A", e.target.value)
                            }
                            disabled={savingSubstitute === `${match.id}-A`}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="none">None</option>
                            {playerDatabase.map((p) => (
                              <option key={`player-${p.id}`} value={`player:${p.id}`}>
                                {p.name} [{p.level}]
                              </option>
                            ))}
                            <option value="custom">Other player...</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2 px-2">
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
                      <td className="py-2 px-2">
                        <div className="text-sm">{match.playerB.name}</div>
                        <div className="text-xs text-gray-400">[{match.playerB.level}]</div>
                      </td>
                      <td className="py-2 px-2">
                        {hasSubstitute(matchWithSubs, "B") ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded flex-1 truncate">
                              {getSubstituteDisplay(matchWithSubs, "B")}
                            </span>
                            <button
                              onClick={() => handleSubstituteChange(match.id, "B", "none")}
                              disabled={savingSubstitute === `${match.id}-B`}
                              className="text-gray-400 hover:text-red-500 px-1"
                              title="Clear substitute"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <select
                            value="none"
                            onChange={(e) =>
                              handleSubstituteChange(match.id, "B", e.target.value)
                            }
                            disabled={savingSubstitute === `${match.id}-B`}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="none">None</option>
                            {playerDatabase.map((p) => (
                              <option key={`player-${p.id}`} value={`player:${p.id}`}>
                                {p.name} [{p.level}]
                              </option>
                            ))}
                            <option value="custom">Other player...</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1 justify-center">
                          <select
                            value={currentHandicap}
                            onChange={(e) =>
                              handleHandicapChange(match.id, parseInt(e.target.value))
                            }
                            disabled={savingHandicap === match.id}
                            className="w-20 px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {/* Negative handicaps (B's score reduced) */}
                            {HANDICAP_OPTIONS.slice().reverse().map((h) =>
                              h > 0 ? (
                                <option key={-h} value={-h}>
                                  B -{h}%{recommended === -h ? " (Rec)" : ""}
                                </option>
                              ) : null
                            )}
                            {/* Zero (no handicap) */}
                            <option value={0}>
                              -{recommended === 0 ? " (Rec)" : ""}
                            </option>
                            {/* Positive handicaps (A's score reduced) */}
                            {HANDICAP_OPTIONS.map((h) =>
                              h > 0 ? (
                                <option key={h} value={h}>
                                  A -{h}%{recommended === h ? " (Rec)" : ""}
                                </option>
                              ) : null
                            )}
                          </select>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAutoHandicap(match.id)}
                            disabled={savingHandicap === match.id}
                            className="px-1 py-0 h-6 text-xs"
                            title="Auto-calculate handicap based on level difference"
                          >
                            Auto
                          </Button>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right">
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
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      {/* Custom Substitute Modal */}
      <Modal
        isOpen={!!customSubModal}
        onClose={() => setCustomSubModal(null)}
        title="Add Other Player as Substitute"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <Input
              type="text"
              value={customSubName}
              onChange={(e) => setCustomSubName(e.target.value)}
              placeholder="Enter substitute name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Level (optional)
            </label>
            <Input
              type="text"
              inputMode="numeric"
              value={customSubLevel}
              onChange={(e) => setCustomSubLevel(e.target.value)}
              placeholder="e.g., 500000"
            />
            <p className="text-xs text-gray-500 mt-1">
              Used for handicap calculation. Leave blank if unknown.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleCustomSubSubmit}
              disabled={!customSubName.trim() || savingSubstitute !== null}
              className="flex-1"
            >
              Add Substitute
            </Button>
            <Button
              variant="secondary"
              onClick={() => setCustomSubModal(null)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
