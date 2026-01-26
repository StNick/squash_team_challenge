import { createFileRoute, redirect, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { verifyAdminSession, adminLogout } from "~/server/lib/auth";
import { Button } from "~/components/ui/Button";

export const Route = createFileRoute("/admin/_authed")({
  beforeLoad: async () => {
    const { isAuthenticated } = await verifyAdminSession();
    if (!isAuthenticated) {
      throw redirect({ to: "/admin" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await adminLogout();
    navigate({ to: "/admin" });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/admin/dashboard" className="font-bold text-lg">
                Admin Panel
              </Link>
              <nav className="hidden sm:flex items-center gap-4">
                {/* Tournament Section */}
                <Link
                  to="/admin/dashboard"
                  className="text-gray-300 hover:text-white transition-colors"
                  activeProps={{ className: "text-white font-medium" }}
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin/players"
                  className="text-gray-300 hover:text-white transition-colors"
                  activeProps={{ className: "text-white font-medium" }}
                >
                  Players
                </Link>
                <Link
                  to="/admin/scores"
                  className="text-gray-300 hover:text-white transition-colors"
                  activeProps={{ className: "text-white font-medium" }}
                >
                  Scores
                </Link>
                <Link
                  to="/admin/reserves"
                  className="text-gray-300 hover:text-white transition-colors"
                  activeProps={{ className: "text-white font-medium" }}
                >
                  Reserves
                </Link>

                {/* Divider */}
                <div className="w-px h-5 bg-gray-600" />

                {/* Global Section */}
                <Link
                  to="/admin/player-database"
                  className="text-gray-300 hover:text-white transition-colors"
                  activeProps={{ className: "text-white font-medium" }}
                >
                  Player Database
                </Link>
                <Link
                  to="/admin/tournament/create"
                  className="text-gray-300 hover:text-white transition-colors"
                  activeProps={{ className: "text-white font-medium" }}
                >
                  New Tournament
                </Link>
                <Link
                  to="/admin/settings"
                  className="text-gray-300 hover:text-white transition-colors"
                  activeProps={{ className: "text-white font-medium" }}
                >
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/" className="text-gray-300 hover:text-white text-sm">
                View Site
              </Link>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="sm:hidden bg-gray-800 text-white overflow-x-auto">
        <div className="flex px-4 py-2 gap-4">
          {/* Tournament Section */}
          <Link
            to="/admin/dashboard"
            className="text-gray-300 hover:text-white whitespace-nowrap text-sm"
            activeProps={{ className: "text-white font-medium" }}
          >
            Dashboard
          </Link>
          <Link
            to="/admin/players"
            className="text-gray-300 hover:text-white whitespace-nowrap text-sm"
            activeProps={{ className: "text-white font-medium" }}
          >
            Players
          </Link>
          <Link
            to="/admin/scores"
            className="text-gray-300 hover:text-white whitespace-nowrap text-sm"
            activeProps={{ className: "text-white font-medium" }}
          >
            Scores
          </Link>
          <Link
            to="/admin/reserves"
            className="text-gray-300 hover:text-white whitespace-nowrap text-sm"
            activeProps={{ className: "text-white font-medium" }}
          >
            Reserves
          </Link>

          {/* Divider */}
          <div className="w-px bg-gray-600 self-stretch" />

          {/* Global Section */}
          <Link
            to="/admin/player-database"
            className="text-gray-300 hover:text-white whitespace-nowrap text-sm"
            activeProps={{ className: "text-white font-medium" }}
          >
            DB
          </Link>
          <Link
            to="/admin/tournament/create"
            className="text-gray-300 hover:text-white whitespace-nowrap text-sm"
            activeProps={{ className: "text-white font-medium" }}
          >
            New
          </Link>
          <Link
            to="/admin/settings"
            className="text-gray-300 hover:text-white whitespace-nowrap text-sm"
            activeProps={{ className: "text-white font-medium" }}
          >
            Settings
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
