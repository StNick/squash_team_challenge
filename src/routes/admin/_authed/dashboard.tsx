"use client";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getDashboardData, advanceWeek, goBackWeek } from "~/server/functions/tournament";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader } from "~/components/ui/Card";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_authed/dashboard")({
  loader: async () => {
    return await getDashboardData();
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const { tournament } = Route.useLoaderData();
  const router = useRouter();

  const handleAdvanceWeek = async () => {
    try {
      await advanceWeek();
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to advance week");
    }
  };

  const handleGoBackWeek = async () => {
    try {
      await goBackWeek();
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to go back");
    }
  };

  if (!tournament) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600 mb-4">No active tournament.</p>
            <Link to="/admin/tournament/create">
              <Button>Create New Tournament</Button>
            </Link>
          </CardContent>
        </Card>
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
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <Link to="/admin/tournament/create">
          <Button variant="secondary">New Tournament</Button>
        </Link>
      </div>

      {/* Tournament Info */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">{tournament.name}</h2>
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
          <div className="flex items-center justify-center gap-4 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={handleGoBackWeek}
              disabled={tournament.currentWeek <= 1}
            >
              &larr; Previous Week
            </Button>
            <span className="font-medium">
              Week {tournament.currentWeek} of {tournament.numWeeks}
            </span>
            <Button
              variant="secondary"
              onClick={handleAdvanceWeek}
              disabled={tournament.currentWeek >= tournament.numWeeks}
            >
              Next Week &rarr;
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/admin/players">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="text-3xl mb-2">👥</div>
              <h3 className="font-semibold">Manage Players</h3>
              <p className="text-sm text-gray-500">
                Swap players, assign captains
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/scores">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="text-3xl mb-2">📊</div>
              <h3 className="font-semibold">Edit Scores</h3>
              <p className="text-sm text-gray-500">
                Correct or update match scores
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/reserves">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="text-3xl mb-2">📋</div>
              <h3 className="font-semibold">Manage Reserves</h3>
              <p className="text-sm text-gray-500">
                Add or update reserve players
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Standings */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Current Standings</h2>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 px-4 text-left text-sm font-medium text-gray-500">
                  Rank
                </th>
                <th className="py-2 px-4 text-left text-sm font-medium text-gray-500">
                  Team
                </th>
                <th className="py-2 px-4 text-right text-sm font-medium text-gray-500">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {tournament.standings.map((team, index) => (
                <tr key={team.id} className="border-b border-gray-100">
                  <td className="py-2 px-4 font-medium">{index + 1}</td>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: team.color }}
                      />
                      {team.name}
                    </div>
                  </td>
                  <td className="py-2 px-4 text-right font-bold">
                    {team.totalScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
