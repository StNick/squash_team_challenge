"use client";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { getDashboardData } from "~/server/functions/tournament";
import { submitMatchScore } from "~/server/functions/matches";
import { TeamCard } from "~/components/dashboard/TeamCard";
import { WeeklyMatchupCard } from "~/components/dashboard/WeeklyMatchup";
import { StandingsTable } from "~/components/dashboard/StandingsTable";
import { WeeklyStandingsTable } from "~/components/dashboard/WeeklyStandingsTable";
import { DutySchedule } from "~/components/dashboard/DutySchedule";
import { ReserveModal } from "~/components/dashboard/ReserveModal";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader } from "~/components/ui/Card";

export const Route = createFileRoute("/")({
  loader: async () => {
    return await getDashboardData();
  },
  component: HomePage,
});

function HomePage() {
  const { tournament } = Route.useLoaderData();
  const router = useRouter();
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"matches" | "standings">("matches");

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Squash Team Challenge
          </h1>
          <p className="text-gray-600">
            No active tournament. Check back soon!
          </p>
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
    await submitMatchScore({ data: { matchId, scoreA, scoreB } });
    router.invalidate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {tournament.name}
              </h1>
              <p className="text-sm text-gray-600">
                Week {tournament.currentWeek} of {tournament.numWeeks}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowReserveModal(true)}
              >
                Need a Reserve?
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Teams Grid */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Teams</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tournament.standings.map((team, index) => (
              <TeamCard key={team.id} team={team} rank={index} />
            ))}
          </div>
        </section>

        {/* Duty Schedule - Full Width */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Duty Schedule</h2>
          </CardHeader>
          <CardContent className="p-0">
            <DutySchedule
              duties={allDuties}
              currentWeek={tournament.currentWeek}
            />
          </CardContent>
        </Card>

        {/* Tab Navigation (Mobile) */}
        <div className="flex border-b border-gray-200 sm:hidden">
          {(["matches", "standings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500"
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
            <h2 className="text-lg font-semibold text-gray-900 hidden sm:block">
              Week {tournament.currentWeek} Matches
            </h2>
            {currentWeekData?.matchups.map((matchup) => (
              <WeeklyMatchupCard
                key={matchup.id}
                matchup={matchup}
                onSubmitScore={handleSubmitScore}
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
                <h2 className="font-semibold text-gray-900">
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
                <h2 className="font-semibold text-gray-900">Overall Standings</h2>
              </CardHeader>
              <CardContent className="p-0">
                <StandingsTable teams={tournament.standings} />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Previous Weeks (Collapsible) */}
        {tournament.currentWeek > 1 && (
          <details className="bg-white rounded-xl shadow-md overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer font-semibold text-gray-900 hover:bg-gray-50">
              Previous Weeks
            </summary>
            <div className="p-4 space-y-6 border-t border-gray-100">
              {Array.from({ length: tournament.currentWeek - 1 }, (_, i) => {
                const week = tournament.currentWeek - 1 - i;
                const weekData = tournament.weeklyData[week];
                return (
                  <div key={week}>
                    <h3 className="font-medium text-gray-700 mb-3">
                      Week {week}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {weekData?.matchups.map((matchup) => (
                        <div
                          key={matchup.id}
                          className="bg-gray-50 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full border border-gray-300"
                                style={{ backgroundColor: matchup.teamA.color }}
                              />
                              <span className="text-sm font-medium">
                                {matchup.teamA.name}
                              </span>
                            </div>
                            <span className="font-bold">
                              {matchup.teamAScore} - {matchup.teamBScore}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {matchup.teamB.name}
                              </span>
                              <div
                                className="w-3 h-3 rounded-full border border-gray-300"
                                style={{ backgroundColor: matchup.teamB.color }}
                              />
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 space-y-0.5">
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
      />
    </div>
  );
}
