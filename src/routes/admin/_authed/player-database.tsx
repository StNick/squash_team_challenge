"use client";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  getPlayerDatabase,
  createPlayerDatabaseEntry,
  updatePlayerDatabaseEntry,
  deletePlayerDatabaseEntry,
  togglePlayerDatabaseActive,
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
    skill: "500000",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "", skill: "500000", notes: "" });
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
          skill: parseInt(formData.skill) || 500000,
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
          skill: parseInt(formData.skill) || 500000,
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

  const openEditModal = (player: typeof players[0]) => {
    setEditingPlayer(player);
    setFormData({
      name: player.name,
      email: player.email ?? "",
      phone: player.phone ?? "",
      skill: player.skill.toString(),
      notes: player.notes ?? "",
    });
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Player Database</h1>
          <p className="text-sm text-gray-500">
            Manage your global player directory. These players can be added to tournaments.
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>Add Player</Button>
      </div>

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
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="py-3 px-4 text-left">Name</th>
                  <th className="py-3 px-4 text-left hidden sm:table-cell">Email</th>
                  <th className="py-3 px-4 text-left hidden md:table-cell">Phone</th>
                  <th className="py-3 px-4 text-right">Skill</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      <div className="font-medium">{player.name}</div>
                      {player.notes && (
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                          {player.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      {player.email || "-"}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {player.phone || "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm">
                      {player.skill.toLocaleString()}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Skill (1 - 1,000,000)
            </label>
            <Input
              type="number"
              min={1}
              max={1000000}
              value={formData.skill}
              onChange={(e) =>
                setFormData({ ...formData, skill: e.target.value })
              }
              placeholder="500000"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
