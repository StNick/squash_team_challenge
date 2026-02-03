"use client";

import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { changeAdminPassword, adminLogout } from "~/server/lib/auth";
import { getTournamentPassword, updateTournamentPassword, getDashboardData } from "~/server/functions/tournament";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Card, CardContent, CardHeader } from "~/components/ui/Card";

export const Route = createFileRoute("/admin/_authed/settings")({
  loader: async () => {
    // Get active tournament to manage its password
    const dashboardData = await getDashboardData({ data: {} });
    if (dashboardData.tournament) {
      const passwordData = await getTournamentPassword({ data: { tournamentId: dashboardData.tournament.id } });
      return {
        tournamentId: dashboardData.tournament.id,
        tournamentName: dashboardData.tournament.name,
        currentPassword: passwordData.password,
      };
    }
    return {
      tournamentId: null,
      tournamentName: null,
      currentPassword: null,
    };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { tournamentId, tournamentName, currentPassword } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Tournament password state
  const [tournamentPassword, setTournamentPassword] = useState(currentPassword || "");
  const [isUpdatingTournamentPassword, setIsUpdatingTournamentPassword] = useState(false);
  const [tournamentPasswordError, setTournamentPasswordError] = useState<string | null>(null);
  const [tournamentPasswordSuccess, setTournamentPasswordSuccess] = useState(false);

  // Update tournament password state when loader data changes
  useEffect(() => {
    setTournamentPassword(currentPassword || "");
  }, [currentPassword]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await changeAdminPassword({
        data: {
          currentPassword: currentAdminPassword,
          newPassword,
        },
      });

      if (result.success) {
        setSuccess(true);
        setCurrentAdminPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(result.error || "Failed to change password");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTournamentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournamentId) return;

    setTournamentPasswordError(null);
    setTournamentPasswordSuccess(false);
    setIsUpdatingTournamentPassword(true);

    try {
      const result = await updateTournamentPassword({
        data: {
          tournamentId,
          password: tournamentPassword.trim() || null,
        },
      });
      // If password was cleared, show the auto-generated one
      if (!tournamentPassword.trim() && result.password) {
        setTournamentPassword(result.password);
      }
      setTournamentPasswordSuccess(true);
      router.invalidate();
    } catch (err) {
      setTournamentPasswordError("Failed to update tournament password");
    } finally {
      setIsUpdatingTournamentPassword(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    navigate({ to: "/admin" });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Tournament Access Code */}
      {tournamentId && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 dark:text-white">Tournament Access Code</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Share this code with players so they can access <strong>{tournamentName}</strong>
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateTournamentPassword} className="space-y-4 max-w-md">
              <div>
                <label
                  htmlFor="tournamentPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Access Code
                </label>
                <Input
                  id="tournamentPassword"
                  type="text"
                  value={tournamentPassword}
                  onChange={(e) => setTournamentPassword(e.target.value.toUpperCase())}
                  placeholder="e.g., A76BN3"
                  className="w-full font-mono uppercase text-lg tracking-widest"
                  maxLength={6}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Players enter this code to view the tournament. Codes are unique and case-insensitive.
                </p>
              </div>

              {tournamentPasswordError && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded">
                  {tournamentPasswordError}
                </div>
              )}

              {tournamentPasswordSuccess && (
                <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 p-2 rounded">
                  Access code updated successfully!
                </div>
              )}

              <Button type="submit" disabled={isUpdatingTournamentPassword}>
                {isUpdatingTournamentPassword ? "Updating..." : "Update Access Code"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Change Admin Password */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900 dark:text-white">Change Admin Password</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label
                htmlFor="currentPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Current Password
              </label>
              <Input
                id="currentPassword"
                type="password"
                value={currentAdminPassword}
                onChange={(e) => setCurrentAdminPassword(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                New Password
              </label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Confirm New Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 p-2 rounded">
                Password changed successfully!
              </div>
            )}

            <Button
              type="submit"
              disabled={
                !currentAdminPassword ||
                !newPassword ||
                !confirmPassword ||
                isSubmitting
              }
            >
              {isSubmitting ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900 dark:text-white">Session</h2>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            End your current admin session and return to the login page.
          </p>
          <Button variant="danger" onClick={handleLogout}>
            Logout
          </Button>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900 dark:text-white">About</h2>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p>
              <strong className="dark:text-white">Squash Team Challenge</strong>
            </p>
            <p>Version 1.0.0</p>
            <p>Built with TanStack Start, Drizzle ORM, and PostgreSQL</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
