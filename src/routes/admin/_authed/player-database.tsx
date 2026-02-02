"use client";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useRef } from "react";
import {
  getPlayerDatabase,
  createPlayerDatabaseEntry,
  updatePlayerDatabaseEntry,
  deletePlayerDatabaseEntry,
  togglePlayerDatabaseActive,
  importPlayersFromCsv,
  clearPlayerDatabase,
} from "~/server/functions/playerDatabase";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Card, CardContent, CardHeader } from "~/components/ui/Card";
import { Modal } from "~/components/ui/Modal";

export const Route = createFileRoute("/admin/_authed/player-database")({
  loader: async () => {
    return await getPlayerDatabase();
  },
  component: PlayerDatabasePage,
});

function PlayerDatabasePage() {
  const { players } = Route.useLoaderData();
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<typeof players[0] | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    level: "0",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    total: number;
    limitReached: boolean;
  } | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "", level: "0", notes: "" });
    setShowAddModal(false);
    setEditingPlayer(null);
    setError(null);
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createPlayerDatabaseEntry({
        data: {
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          level: parseInt(formData.level) || 500000,
          notes: formData.notes || undefined,
        },
      });
      resetForm();
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add player");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPlayer || !formData.name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updatePlayerDatabaseEntry({
        data: {
          playerId: editingPlayer.id,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          level: parseInt(formData.level) || 500000,
          notes: formData.notes || null,
        },
      });
      resetForm();
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update player");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (playerId: number) => {
    if (!confirm("Are you sure you want to delete this player from the database?")) return;

    try {
      await deletePlayerDatabaseEntry({ data: { playerId } });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete player");
    }
  };

  const handleToggleActive = async (playerId: number) => {
    try {
      await togglePlayerDatabaseActive({ data: { playerId } });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle status");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be selected again
    e.target.value = "";

    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please select a CSV file");
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const csvContent = await file.text();
      const result = await importPlayersFromCsv({ data: { csvContent } });
      setImportResult(result);
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to import CSV");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearDatabase = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL players from the database?\n\nThis will not affect players already in tournaments, but you will lose all player data in this directory."
      )
    ) {
      return;
    }

    setIsClearing(true);
    try {
      await clearPlayerDatabase();
      setImportResult(null);
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to clear database");
    } finally {
      setIsClearing(false);
    }
  };

  const openEditModal = (player: typeof players[0]) => {
    setEditingPlayer(player);
    setFormData({
      name: player.name,
      email: player.email ?? "",
      phone: player.phone ?? "",
      level: player.level.toString(),
      notes: player.notes ?? "",
    });
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Player Database</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your global player directory. These players can be added to tournaments.
          </p>
        </div>
        <div className="flex gap-2">
          {players.length > 0 && (
            <Button
              variant="danger"
              onClick={handleClearDatabase}
              disabled={isClearing}
            >
              {isClearing ? "Clearing..." : "Clear All"}
            </Button>
          )}
          <Button variant="secondary" onClick={handleImportClick} disabled={isImporting}>
            {isImporting ? "Importing..." : "Import CSV"}
          </Button>
          <Button onClick={() => setShowAddModal(true)}>Add Player</Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* MySquash Import Info */}
      <Card>
        <CardContent className="text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">Importing from MySquash</p>
          <p className="mb-2">
            You can import players from Squash New Zealand's MySquash portal. Export the "Grading List"
            as a CSV file, then use the Import button above.
          </p>
          <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 p-2 rounded">
            <strong>Important:</strong> The database has a limit of 500 players. Apply filters in MySquash
            before exporting (e.g. filter by club or district) to only import players who might participate.
            Players will be imported until the limit is reached.
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            Current: {players.length} / 500 players
          </p>
        </CardContent>
      </Card>

      {/* Import Result */}
      {importResult && (
        <Card>
          <CardContent className="text-sm">
            <p className="font-medium text-green-700 mb-1">Import Complete</p>
            <ul className="text-gray-600 space-y-1">
              <li>New players added: <strong>{importResult.imported}</strong></li>
              <li>Existing players updated: <strong>{importResult.updated}</strong></li>
              {importResult.skipped > 0 && (
                <li className="text-amber-600">Rows skipped: <strong>{importResult.skipped}</strong></li>
              )}
            </ul>
            {importResult.limitReached && (
              <p className="mt-2 text-red-600 bg-red-50 p-2 rounded">
                <strong>Limit reached:</strong> The 500 player limit was reached. Some players from the CSV were not imported.
              </p>
            )}
            <button
              onClick={() => setImportResult(null)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700"
            >
              Dismiss
            </button>
          </CardContent>
        </Card>
      )}

      {players.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600 mb-4">No players in database yet.</p>
            <Button onClick={() => setShowAddModal(true)}>Add First Player</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                  <th className="py-3 px-4 text-left">Name</th>
                  <th className="py-3 px-4 text-left hidden lg:table-cell">Code</th>
                  <th className="py-3 px-4 text-left hidden sm:table-cell">Email</th>
                  <th className="py-3 px-4 text-left hidden md:table-cell">Phone</th>
                  <th className="py-3 px-4 text-right">Level</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-3 px-4">
                      <div className="font-medium dark:text-white">{player.name}</div>
                      {player.notes && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                          {player.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell font-mono text-xs text-gray-500 dark:text-gray-400">
                      {player.playerCode || "-"}
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell dark:text-gray-300">
                      {player.email || "-"}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell dark:text-gray-300">
                      {player.phone || "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm dark:text-white">
                      {player.level.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(player.id)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          player.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {player.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditModal(player)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(player.id)}
                        >
                          Delete
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal || editingPlayer !== null}
        onClose={resetForm}
        title={editingPlayer ? "Edit Player" : "Add Player to Database"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="John Smith"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="john@example.com"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone
            </label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="555-123-4567"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Level (1 - 1,000,000)
            </label>
            <Input
              type="number"
              min={1}
              max={1000000}
              value={formData.level}
              onChange={(e) =>
                setFormData({ ...formData, level: e.target.value })
              }
              placeholder="0"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              rows={2}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={editingPlayer ? handleUpdate : handleAdd}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting
                ? "Saving..."
                : editingPlayer
                ? "Update"
                : "Add Player"}
            </Button>
            <Button variant="secondary" onClick={resetForm} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
