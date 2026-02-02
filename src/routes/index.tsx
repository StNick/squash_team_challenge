"use client";

import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getDashboardData, getTournamentList } from "~/server/functions/tournament";
import { submitMatchScore } from "~/server/functions/matches";
import { TeamCard } from "~/components/dashboard/TeamCard";
import { WeeklyMatchupCard } from "~/components/dashboard/WeeklyMatchup";
import { StandingsTable } from "~/components/dashboard/StandingsTable";
import { WeeklyStandingsTable } from "~/components/dashboard/WeeklyStandingsTable";
import { DutySchedule } from "~/components/dashboard/DutySchedule";
import { ReserveModal } from "~/components/dashboard/ReserveModal";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader } from "~/components/ui/Card";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import { TournamentSelector } from "~/components/ui/TournamentSelector";
import type { TournamentStatus } from "~/server/db/schema";
import { formatWeekDate, formatDate } from "~/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tournament: search.tournament ? Number(search.tournament) : undefined,
  }),
  loaderDeps: ({ search: { tournament } }) => ({ tournament }),
  loader: async ({ deps }) => {
    const [dashboardData, tournamentList] = await Promise.all([
      getDashboardData({ data: { tournamentId: deps.tournament } }),
      getTournamentList(),
    ]);
    return {
      ...dashboardData,
      allTournaments: tournamentList.tournaments,
    };
  },
  component: HomePage,
});

function HomePage() {
  const { tournament, allTournaments } = Route.useLoaderData();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"matches" | "standings">("matches");

  // Determine if this is an ended tournament (read-only mode)
  const isEnded = tournament?.status === "ended";
  const isActive = tournament?.status === "active";

  // Filter tournaments for selector (only active and ended, not drafts)
  const selectableTournaments = allTournaments.filter(
    (t) => t.status === "active" || t.status === "ended"
  );

  const handleTournamentSelect = (id: number) => {
    navigate({ search: { tournament: id } });
  };

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-end py-3">
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link
                to="/admin"
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Admin
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Squash Team Challenge
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                No active tournament. Check back soon!
              </p>
              {selectableTournaments.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    View a past tournament:
                  </p>
                  <TournamentSelector
                    tournaments={selectableTournaments}
                    selectedId={null}
                    onSelect={handleTournamentSelect}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentWeekData = tournament.weeklyData[tournament.currentWeek];
  const allDuties = Object.values(tournament.weeklyData)
    .map((wd) => {
      if (!wd.duties) return null;
      return {
        ...wd.duties,
        firstOnCourt: wd.firstOnCourt,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const handleSubmitScore = async (
    matchId: number,
    scoreA: number,
    scoreB: number
  ) => {
    if (isEnded) return; // Don't allow score entry for ended tournaments
    await submitMatchScore({ data: { matchId, scoreA, scoreB } });
    router.invalidate();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Ended tournament banner */}
      {isEnded && (
        <div className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-center py-2 text-sm">
          Viewing past tournament
          {tournament.weekDates?.[1] && tournament.endedAt && (
            <span>
              {" "}({formatDate(tournament.weekDates[1])} - {formatDate(tournament.endedAt)})
            </span>
          )}
          {" "}- scores are locked
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {tournament.name}
                </h1>
                {selectableTournaments.length > 1 && (
                  <TournamentSelector
                    tournaments={selectableTournaments}
                    selectedId={tournament.id}
                    onSelect={handleTournamentSelect}
                  />
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Week {tournament.currentWeek} of {tournament.numWeeks}
                {tournament.weekDates?.[tournament.currentWeek] && (
                  <span className="ml-1">
                    - {formatWeekDate(tournament.weekDates[tournament.currentWeek])}
                  </span>
                )}
                {isEnded && <span className="ml-2 text-amber-600 dark:text-amber-400">(Ended)</span>}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {isActive && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowReserveModal(true)}
                >
                  Need a Reserve?
                </Button>
              )}
              <ThemeToggle />
              <Link
                to="/admin"
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Admin
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Teams Grid */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Teams</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tournament.standings.map((team, index) => (
              <TeamCard key={team.id} team={team} rank={index} />
            ))}
          </div>
        </section>

        {/* Duty Schedule - Full Width */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 dark:text-white">Duty Schedule</h2>
          </CardHeader>
          <CardContent className="p-0">
            <DutySchedule
              duties={allDuties}
              currentWeek={tournament.currentWeek}
            />
          </CardContent>
        </Card>

        {/* Tab Navigation (Mobile) */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 sm:hidden">
          {(["matches", "standings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content - tabs on mobile, grid on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Week Matches */}
          <div
            className={`lg:col-span-2 space-y-4 ${
              activeTab !== "matches" ? "hidden sm:block" : ""
            }`}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white hidden sm:block">
              Week {tournament.currentWeek} Matches
            </h2>
            {currentWeekData?.matchups.map((matchup) => (
              <WeeklyMatchupCard
                key={matchup.id}
                matchup={matchup}
                onSubmitScore={handleSubmitScore}
                disabled={isEnded}
              />
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Weekly Standings */}
            <Card
              className={activeTab !== "standings" ? "hidden sm:block" : ""}
            >
              <CardHeader>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Week {tournament.currentWeek} Standings
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                <WeeklyStandingsTable
                  matchups={currentWeekData?.matchups ?? []}
                  teams={tournament.standings}
                />
              </CardContent>
            </Card>

            {/* Overall Standings */}
            <Card
              className={activeTab !== "standings" ? "hidden sm:block" : ""}
            >
              <CardHeader>
                <h2 className="font-semibold text-gray-900 dark:text-white">Overall Standings</h2>
              </CardHeader>
              <CardContent className="p-0">
                <StandingsTable teams={tournament.standings} />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Previous Weeks (Collapsible) */}
        {tournament.currentWeek > 1 && (
          <details className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
              Previous Weeks
            </summary>
            <div className="p-4 space-y-6 border-t border-gray-100 dark:border-gray-700">
              {Array.from({ length: tournament.currentWeek - 1 }, (_, i) => {
                const week = tournament.currentWeek - 1 - i;
                const weekData = tournament.weeklyData[week];
                return (
                  <div key={week}>
                    <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Week {week}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {weekData?.matchups.map((matchup) => (
                        <div
                          key={matchup.id}
                          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-500"
                                style={{ backgroundColor: matchup.teamA.color }}
                              />
                              <span className="text-sm font-medium dark:text-white">
                                {matchup.teamA.name}
                              </span>
                            </div>
                            <span className="font-bold dark:text-white">
                              {matchup.teamAScore} - {matchup.teamBScore}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium dark:text-white">
                                {matchup.teamB.name}
                              </span>
                              <div
                                className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-500"
                                style={{ backgroundColor: matchup.teamB.color }}
                              />
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                            {matchup.matches.map((match) => (
                              <div
                                key={match.id}
                                className="flex justify-between"
                              >
                                <span>{match.playerA.name}</span>
                                <span>
                                  {match.scoreA ?? "-"} - {match.scoreB ?? "-"}
                                </span>
                                <span>{match.playerB.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </main>

      {/* Reserve Modal */}
      <ReserveModal
        isOpen={showReserveModal}
        onClose={() => setShowReserveModal(false)}
        reserves={tournament.reserves}
        tournamentStatus={tournament.status}
      />
    </div>
  );
}
