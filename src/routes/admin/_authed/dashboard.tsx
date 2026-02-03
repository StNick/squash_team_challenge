"use client";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  getDashboardData,
  advanceWeek,
  goBackWeek,
  getTournamentList,
  updateTournamentStatus,
  updateTournamentAccessCode,
} from "~/server/functions/tournament";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { Modal } from "~/components/ui/Modal";
import { Link } from "@tanstack/react-router";
import { formatWeekDate } from "~/lib/utils";

export const Route = createFileRoute("/admin/_authed/dashboard")({
  loader: async () => {
    const [dashboardData, tournamentList] = await Promise.all([
      getDashboardData(),
      getTournamentList(),
    ]);
    return {
      ...dashboardData,
      allTournaments: tournamentList.tournaments,
    };
  },
  component: AdminDashboard,
});

// Helper to format a date as YYYY-MM-DD for input[type="date"]
function toDateInputValue(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Helper to add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function AdminDashboard() {
  const { tournament, allTournaments } = Route.useLoaderData();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Date picker modal state
  const [dateModal, setDateModal] = useState<{
    type: "activate" | "advance";
    tournamentId?: number;
    weekNum?: number;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Access code modal state
  const [accessCodeModal, setAccessCodeModal] = useState<{
    tournamentId: number;
    currentCode: string | null;
  } | null>(null);
  const [newAccessCode, setNewAccessCode] = useState<string>("");
  const [accessCodeError, setAccessCodeError] = useState<string | null>(null);
  const [accessCodeLoading, setAccessCodeLoading] = useState(false);

  const openActivateModal = (tournamentId: number) => {
    setSelectedDate(toDateInputValue(new Date()));
    setDateModal({ type: "activate", tournamentId });
  };

  const openAdvanceModal = () => {
    if (!tournament) return;
    const nextWeek = tournament.currentWeek + 1;
    // Default to previous week's date + 7 days, or today if no previous date
    const prevWeekDate = tournament.weekDates?.[tournament.currentWeek];
    const defaultDate = prevWeekDate
      ? addDays(new Date(prevWeekDate), 7)
      : new Date();
    setSelectedDate(toDateInputValue(defaultDate));
    setDateModal({ type: "advance", weekNum: nextWeek });
  };

  const handleDateModalConfirm = async () => {
    if (!dateModal) return;

    if (dateModal.type === "activate" && dateModal.tournamentId) {
      setActionLoading(dateModal.tournamentId);
      try {
        await updateTournamentStatus({
          data: {
            tournamentId: dateModal.tournamentId,
            status: "active",
            week1Date: selectedDate || undefined,
          },
        });
        router.invalidate();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to activate tournament");
      } finally {
        setActionLoading(null);
      }
    } else if (dateModal.type === "advance") {
      try {
        await advanceWeek({ data: { weekDate: selectedDate || undefined } });
        router.invalidate();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to advance week");
      }
    }

    setDateModal(null);
  };

  const handleGoBackWeek = async () => {
    try {
      await goBackWeek();
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to go back");
    }
  };

  const handleEndTournament = async (tournamentId: number) => {
    if (!confirm("Are you sure you want to end this tournament? This will make it inactive.")) {
      return;
    }
    setActionLoading(tournamentId);
    try {
      await updateTournamentStatus({
        data: { tournamentId, status: "ended" },
      });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to end tournament");
    } finally {
      setActionLoading(null);
    }
  };

  const openAccessCodeModal = (tournamentId: number, currentCode: string | null) => {
    setNewAccessCode(currentCode ?? "");
    setAccessCodeError(null);
    setAccessCodeModal({ tournamentId, currentCode });
  };

  const handleAccessCodeSave = async () => {
    if (!accessCodeModal) return;

    setAccessCodeError(null);
    setAccessCodeLoading(true);

    try {
      await updateTournamentAccessCode({
        data: {
          tournamentId: accessCodeModal.tournamentId,
          accessCode: newAccessCode.trim() || null, // null = generate new
        },
      });
      router.invalidate();
      setAccessCodeModal(null);
    } catch (err) {
      setAccessCodeError(err instanceof Error ? err.message : "Failed to update access code");
    } finally {
      setAccessCodeLoading(false);
    }
  };

  // Get draft and ended tournaments for management section
  const draftTournaments = allTournaments.filter((t) => t.status === "draft");
  const endedTournaments = allTournaments.filter((t) => t.status === "ended");

  if (!tournament) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <Link to="/admin/tournament/create">
            <Button>Create New Tournament</Button>
          </Link>
        </div>
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No active tournament.</p>
          </CardContent>
        </Card>

        {/* Draft Tournaments */}
        {draftTournaments.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900 dark:text-white">Draft Tournaments</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                These tournaments are not yet active. Edit or activate them.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 px-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Name</th>
                    <th className="py-2 px-4 text-center text-sm font-medium text-gray-500 dark:text-gray-400">Teams</th>
                    <th className="py-2 px-4 text-center text-sm font-medium text-gray-500 dark:text-gray-400">Weeks</th>
                    <th className="py-2 px-4 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {draftTournaments.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2 px-4 dark:text-white">{t.name}</td>
                      <td className="py-2 px-4 text-center dark:text-gray-300">{t.numTeams}</td>
                      <td className="py-2 px-4 text-center dark:text-gray-300">{t.numWeeks}</td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Link to="/admin/tournament/edit" search={{ id: t.id }}>
                            <Button size="sm" variant="secondary">Edit</Button>
                          </Link>
                          <Button
                            size="sm"
                            onClick={() => openActivateModal(t.id)}
                            disabled={actionLoading === t.id}
                          >
                            {actionLoading === t.id ? "..." : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Date Picker Modal */}
        <Modal
          isOpen={dateModal !== null}
          onClose={() => setDateModal(null)}
          title={
            dateModal?.type === "activate"
              ? "Set Week 1 Date"
              : `Set Week ${dateModal?.weekNum} Date`
          }
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              {dateModal?.type === "activate"
                ? "What date is Week 1 scheduled for?"
                : `What date is Week ${dateModal?.weekNum} scheduled for?`}
            </p>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setDateModal(null)}>
                Skip
              </Button>
              <Button onClick={handleDateModalConfirm}>
                {dateModal?.type === "activate" ? "Activate" : "Advance Week"}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Ended Tournaments */}
        {endedTournaments.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900 dark:text-white">Past Tournaments</h2>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 px-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Name</th>
                    <th className="py-2 px-4 text-center text-sm font-medium text-gray-500 dark:text-gray-400">Weeks</th>
                    <th className="py-2 px-4 text-center text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {endedTournaments.slice(0, 5).map((t) => (
                    <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2 px-4 dark:text-white">{t.name}</td>
                      <td className="py-2 px-4 text-center dark:text-gray-300">{t.numWeeks}</td>
                      <td className="py-2 px-4 text-center">
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          Ended
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Calculate stats
  const totalMatches = Object.values(tournament.weeklyData).reduce(
    (acc, week) =>
      acc + week.matchups.reduce((a, m) => a + m.matches.length, 0),
    0
  );

  const completedMatches = Object.values(tournament.weeklyData).reduce(
    (acc, week) =>
      acc +
      week.matchups.reduce(
        (a, m) =>
          a + m.matches.filter((match) => match.scoreA !== null).length,
        0
      ),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <Link to="/admin/tournament/create">
          <Button variant="secondary">New Tournament</Button>
        </Link>
      </div>

      {/* Tournament Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">{tournament.name}</h2>
            <button
              onClick={() => openAccessCodeModal(tournament.id, tournament.password ?? null)}
              className="flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Edit access code"
            >
              {tournament.password ?? "No code"}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">
                {tournament.currentWeek}
              </div>
              <div className="text-sm text-blue-600">Current Week</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">
                {tournament.numWeeks}
              </div>
              <div className="text-sm text-green-600">Total Weeks</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">
                {tournament.teams.length}
              </div>
              <div className="text-sm text-purple-600">Teams</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">
                {completedMatches}/{totalMatches}
              </div>
              <div className="text-sm text-orange-600">Matches Played</div>
            </div>
          </div>

          {/* Week Navigation */}
          <div className="flex flex-col items-center gap-2 pt-4 border-t">
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                onClick={handleGoBackWeek}
                disabled={tournament.currentWeek <= 1}
              >
                &larr; Previous Week
              </Button>
              <span className="font-medium dark:text-white">
                Week {tournament.currentWeek} of {tournament.numWeeks}
              </span>
              <Button
                variant="secondary"
                onClick={openAdvanceModal}
                disabled={tournament.currentWeek >= tournament.numWeeks}
              >
                Next Week &rarr;
              </Button>
            </div>
            {tournament.weekDates?.[tournament.currentWeek] && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {formatWeekDate(tournament.weekDates[tournament.currentWeek])}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/admin/players">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="text-3xl mb-2">👥</div>
              <h3 className="font-semibold dark:text-white">Manage Players</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Swap players, assign captains
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/scores">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="text-3xl mb-2">📊</div>
              <h3 className="font-semibold dark:text-white">Edit Scores</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Correct or update match scores
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/reserves">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="text-3xl mb-2">📋</div>
              <h3 className="font-semibold dark:text-white">Manage Reserves</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add or update reserve players
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Tournament Management */}
      {(draftTournaments.length > 0 || tournament) && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 dark:text-white">Tournament Management</h2>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 px-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="py-2 px-4 text-center text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="py-2 px-4 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Current active tournament */}
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
                  <td className="py-2 px-4 dark:text-white font-medium">
                    <div className="flex items-center gap-2">
                      {tournament.name}
                      {tournament.password && (
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                          {tournament.password}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-4 text-center">
                    <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">
                      Active
                    </span>
                  </td>
                  <td className="py-2 px-4 text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleEndTournament(tournament.id)}
                      disabled={actionLoading === tournament.id}
                    >
                      {actionLoading === tournament.id ? "..." : "End Tournament"}
                    </Button>
                  </td>
                </tr>
                {/* Draft tournaments */}
                {draftTournaments.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 px-4 dark:text-white">{t.name}</td>
                    <td className="py-2 px-4 text-center">
                      <span className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                        Draft
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Link to="/admin/tournament/edit" search={{ id: t.id }}>
                          <Button size="sm" variant="secondary">Edit</Button>
                        </Link>
                        <Button
                          size="sm"
                          onClick={() => openActivateModal(t.id)}
                          disabled={actionLoading === t.id}
                        >
                          {actionLoading === t.id ? "..." : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Standings */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900 dark:text-white">Current Standings</h2>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 px-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                  Rank
                </th>
                <th className="py-2 px-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                  Team
                </th>
                <th className="py-2 px-4 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {tournament.standings.map((team, index) => (
                <tr key={team.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 px-4 font-medium dark:text-white">{index + 1}</td>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2 dark:text-white">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: team.color }}
                      />
                      {team.name}
                    </div>
                  </td>
                  <td className="py-2 px-4 text-right font-bold dark:text-white">
                    {team.totalScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Date Picker Modal */}
      <Modal
        isOpen={dateModal !== null}
        onClose={() => setDateModal(null)}
        title={
          dateModal?.type === "activate"
            ? "Set Week 1 Date"
            : `Set Week ${dateModal?.weekNum} Date`
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            {dateModal?.type === "activate"
              ? "What date is Week 1 scheduled for?"
              : `What date is Week ${dateModal?.weekNum} scheduled for?`}
          </p>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDateModal(null)}>
              Skip
            </Button>
            <Button onClick={handleDateModalConfirm}>
              {dateModal?.type === "activate" ? "Activate" : "Advance Week"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Access Code Modal */}
      <Modal
        isOpen={accessCodeModal !== null}
        onClose={() => setAccessCodeModal(null)}
        title="Edit Access Code"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Enter a new 6-character access code, or leave empty to generate a random one.
          </p>
          <div>
            <Input
              type="text"
              value={newAccessCode}
              onChange={(e) => setNewAccessCode(e.target.value.toUpperCase())}
              placeholder="e.g., A76BN3"
              className="w-full font-mono uppercase text-center text-lg tracking-widest"
              maxLength={6}
              autoFocus
              disabled={accessCodeLoading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
              6 alphanumeric characters (letters and numbers)
            </p>
          </div>

          {accessCodeError && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded">
              {accessCodeError}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => setAccessCodeModal(null)}
              disabled={accessCodeLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAccessCodeSave}
              disabled={accessCodeLoading}
            >
              {accessCodeLoading
                ? "Saving..."
                : newAccessCode.trim()
                  ? "Save"
                  : "Generate Random"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
