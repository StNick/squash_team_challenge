"use client";

import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getDashboardData, verifyAccessCode } from "~/server/functions/tournament";
import { submitMatchScore } from "~/server/functions/matches";
import { TeamCard } from "~/components/dashboard/TeamCard";
import { WeeklyMatchupCard } from "~/components/dashboard/WeeklyMatchup";
import { StandingsTable } from "~/components/dashboard/StandingsTable";
import { WeeklyStandingsTable } from "~/components/dashboard/WeeklyStandingsTable";
import { DutySchedule } from "~/components/dashboard/DutySchedule";
import { ReserveModal } from "~/components/dashboard/ReserveModal";
import { RulesModal } from "~/components/dashboard/RulesModal";
import { PlayerStatsTable } from "~/components/dashboard/PlayerStatsTable";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import { formatWeekDate, formatDate } from "~/lib/utils";
import { getStoredAccess, setStoredAccess, clearStoredAccess } from "~/lib/tournamentAccess";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const router = useRouter();
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"matches" | "stats">("matches");

  // Access code state
  const [accessCode, setAccessCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingStored, setIsCheckingStored] = useState(true);

  // Dashboard data (loaded after successful code entry or from stored access)
  const [dashboardData, setDashboardData] = useState<Awaited<ReturnType<typeof getDashboardData>> | null>(null);

  // Check for code in URL params or stored access on mount
  useEffect(() => {
    const checkAccess = async () => {
      // First, check for code in URL query params
      const urlParams = new URLSearchParams(window.location.search);
      const urlCode = urlParams.get("code");

      if (urlCode) {
        try {
          // Verify the URL code
          const result = await verifyAccessCode({ data: { code: urlCode } });
          if (result.success && result.tournamentId) {
            // Valid code from URL - store it and load tournament
            setStoredAccess(result.tournamentId, urlCode.toUpperCase());
            const data = await getDashboardData({ data: { tournamentId: result.tournamentId } });
            setDashboardData(data);

            // Clean the URL by removing the code param (keeps the URL pretty)
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, "", cleanUrl);
            setIsCheckingStored(false);
            return;
          }
        } catch {
          // Invalid URL code - fall through to check stored access
        }

        // Clean the invalid code from URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }

      // Check stored access
      const stored = getStoredAccess();
      if (!stored) {
        setIsCheckingStored(false);
        return;
      }

      try {
        // Verify the stored code is still valid
        const result = await verifyAccessCode({ data: { code: stored.code } });
        if (result.success && result.tournamentId === stored.tournamentId) {
          // Load the tournament data
          const data = await getDashboardData({ data: { tournamentId: stored.tournamentId } });
          setDashboardData(data);
        } else {
          // Invalid stored code - clear it
          clearStoredAccess();
        }
      } catch {
        // Error verifying - clear stored access
        clearStoredAccess();
      } finally {
        setIsCheckingStored(false);
      }
    };

    checkAccess();
  }, []);

  const handleAccessCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      const result = await verifyAccessCode({ data: { code: accessCode } });

      if (result.success && result.tournamentId) {
        // Store the code and load the tournament
        setStoredAccess(result.tournamentId, accessCode.toUpperCase());
        const data = await getDashboardData({ data: { tournamentId: result.tournamentId } });
        setDashboardData(data);
      } else {
        setError(result.error || "Invalid access code");
        setAccessCode("");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChangeTournament = () => {
    clearStoredAccess();
    setDashboardData(null);
    setAccessCode("");
    setError(null);
  };

  const tournament = dashboardData?.tournament;

  // Show loading state while checking stored access
  if (isCheckingStored) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-end py-3">
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Landing page - no tournament loaded
  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Squash Team Challenge
              </h1>
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
          </div>
        </header>

        {/* Main content - centered access code form */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <Card>
              <CardHeader className="text-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Welcome
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Enter your tournament access code to view the dashboard
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAccessCodeSubmit} className="space-y-4">
                  <div>
                    <Input
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                      placeholder="e.g., A76BN3"
                      className="w-full font-mono uppercase text-center text-2xl tracking-widest py-3"
                      maxLength={6}
                      autoFocus
                      disabled={isVerifying}
                    />
                  </div>

                  {error && (
                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded text-center">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={accessCode.length < 6 || isVerifying}
                  >
                    {isVerifying ? "Verifying..." : "Enter"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
              Don't have a code? Contact your tournament organizer.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Tournament dashboard
  const isEnded = tournament.status === "ended";
  const isActive = tournament.status === "active";

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
    if (isEnded || !tournament) return;
    await submitMatchScore({ data: { matchId, scoreA, scoreB } });
    // Re-fetch dashboard data to show updated scores
    const data = await getDashboardData({ data: { tournamentId: tournament.id } });
    setDashboardData(data);
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {tournament.name}
              </h1>
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
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowRulesModal(true)}
              >
                Rules
              </Button>
              {isActive && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowReserveModal(true)}
                >
                  Need a Reserve?
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChangeTournament}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Exit
              </Button>
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
              <TeamCard key={team.id} team={team} />
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
          {(["matches", "stats"] as const).map((tab) => (
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
                firstOnCourt={currentWeekData?.firstOnCourt}
              />
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Weekly Standings */}
            <Card
              className={activeTab !== "stats" ? "hidden sm:block" : ""}
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
              className={activeTab !== "stats" ? "hidden sm:block" : ""}
            >
              <CardHeader>
                <h2 className="font-semibold text-gray-900 dark:text-white">Overall Standings</h2>
              </CardHeader>
              <CardContent className="p-0">
                <StandingsTable teams={tournament.standings} />
              </CardContent>
            </Card>

            {/* Player Stats */}
            <Card
              className={activeTab !== "stats" ? "hidden sm:block" : ""}
            >
              <CardHeader>
                <h2 className="font-semibold text-gray-900 dark:text-white">Player Stats</h2>
              </CardHeader>
              <CardContent className="p-0">
                <PlayerStatsTable
                  weeklyData={tournament.weeklyData}
                  teams={tournament.teams}
                />
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
                            {matchup.matches.map((match) => {
                              const displayNameA = match.substituteA?.name ?? match.customSubstituteAName ?? match.playerA.name;
                              const displayNameB = match.substituteB?.name ?? match.customSubstituteBName ?? match.playerB.name;
                              const isSubA = !!match.substituteA || !!match.customSubstituteAName;
                              const isSubB = !!match.substituteB || !!match.customSubstituteBName;
                              return (
                                <div
                                  key={match.id}
                                  className="grid grid-cols-[1fr_auto_1fr] gap-2"
                                >
                                  <span className="text-right flex items-center justify-end gap-1">
                                    {isSubA && (
                                      <span className="text-[10px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded font-bold">
                                        SUB
                                      </span>
                                    )}
                                    {displayNameA}
                                  </span>
                                  <span className="text-center w-14">
                                    {match.scoreA ?? "-"} - {match.scoreB ?? "-"}
                                  </span>
                                  <span className="text-left flex items-center gap-1">
                                    {displayNameB}
                                    {isSubB && (
                                      <span className="text-[10px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded font-bold">
                                        SUB
                                      </span>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
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

      {/* Rules Modal */}
      <RulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />
    </div>
  );
}
