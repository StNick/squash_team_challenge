"use client";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  getReserves,
  updateReserve,
  deleteReserve,
  toggleReserveActive,
  addReservesFromDatabase,
} from "~/server/functions/reserves";
import { getActivePlayerDatabase } from "~/server/functions/playerDatabase";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Card, CardContent } from "~/components/ui/Card";
import { Modal } from "~/components/ui/Modal";

export const Route = createFileRoute("/admin/_authed/reserves")({
  loader: async () => {
    const [reservesData, playerDbData] = await Promise.all([
      getReserves(),
      getActivePlayerDatabase(),
    ]);
    return {
      reserves: reservesData.reserves,
      databasePlayers: playerDbData.players,
    };
  },
  component: ReservesPage,
});

function ReservesPage() {
  const { reserves, databasePlayers } = Route.useLoaderData();
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReserve, setEditingReserve] = useState<typeof reserves[0] | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", notes: "" });
    setShowAddModal(false);
    setEditingReserve(null);
    setSelectedPlayerIds([]);
  };

  // Get IDs of players already added as reserves
  const existingReservePlayerIds = reserves
    .filter((r) => r.playerDatabaseId !== null)
    .map((r) => r.playerDatabaseId as number);

  // Filter out players already added as reserves
  const availablePlayers = databasePlayers.filter(
    (p) => !existingReservePlayerIds.includes(p.id)
  );

  const handleAddFromDatabase = async () => {
    if (selectedPlayerIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await addReservesFromDatabase({ data: { playerIds: selectedPlayerIds } });
      resetForm();
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add reserves");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingReserve || !formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      await updateReserve({
        data: {
          reserveId: editingReserve.id,
          ...formData,
        },
      });
      resetForm();
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update reserve");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (reserveId: number) => {
    if (!confirm("Are you sure you want to delete this reserve?")) return;

    try {
      await deleteReserve({ data: { reserveId } });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete reserve");
    }
  };

  const handleToggleActive = async (reserveId: number) => {
    try {
      await toggleReserveActive({ data: { reserveId } });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle status");
    }
  };

  const openEditModal = (reserve: typeof reserves[0]) => {
    setEditingReserve(reserve);
    setFormData({
      name: reserve.name,
      phone: reserve.phone ?? "",
      email: reserve.email ?? "",
      notes: reserve.notes ?? "",
    });
  };

  const togglePlayer = (playerId: number) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Manage Reserves</h1>
        <Button
          onClick={() => setShowAddModal(true)}
          disabled={availablePlayers.length === 0}
        >
          Add from Player Database
        </Button>
      </div>

      {availablePlayers.length === 0 && databasePlayers.length === 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-600">
              No players in the database. Add players to the Player Database first to use them as reserves.
            </p>
          </CardContent>
        </Card>
      )}

      {reserves.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600 mb-4">No reserves added yet.</p>
            {availablePlayers.length > 0 && (
              <Button onClick={() => setShowAddModal(true)}>
                Add First Reserve from Database
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="py-3 px-4 text-left">Name</th>
                  <th className="py-3 px-4 text-center">Level</th>
                  <th className="py-3 px-4 text-left hidden sm:table-cell">Phone</th>
                  <th className="py-3 px-4 text-left hidden md:table-cell">Email</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reserves.map((reserve) => {
                  // Extract level from notes
                  const levelMatch = reserve.notes?.match(/level[:\s]*(\d(?:\s*(?:or|\/|-)\s*\d)?)/i);
                  const levelDisplay = levelMatch ? levelMatch[1] : null;
                  return (
                    <tr key={reserve.id} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <div className="font-medium">{reserve.name}</div>
                        {reserve.notes && (
                          <div className="text-xs text-gray-500 truncate max-w-[200px]">
                            {reserve.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {levelDisplay ? (
                          <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {levelDisplay}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        {reserve.phone || "-"}
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        {reserve.email || "-"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(reserve.id)}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            reserve.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {reserve.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(reserve)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(reserve.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add from Database Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={resetForm}
        title="Add Reserves from Player Database"
      >
        <div className="space-y-4">
          {availablePlayers.length === 0 ? (
            <p className="text-gray-600 text-center py-4">
              All players from the database have already been added as reserves.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Select players to add as reserves for the current tournament:
              </p>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                {availablePlayers.map((player) => (
                  <label
                    key={player.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                      selectedPlayerIds.includes(player.id) ? "bg-blue-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.includes(player.id)}
                      onChange={() => togglePlayer(player.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className="font-medium">{player.name}</span>
                      {(player.phone || player.email) && (
                        <span className="text-xs text-gray-500 ml-2">
                          {player.phone || player.email}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-sm text-gray-500">
                {selectedPlayerIds.length} player(s) selected
              </p>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleAddFromDatabase}
              disabled={selectedPlayerIds.length === 0 || isSubmitting}
              className="flex-1"
            >
              {isSubmitting
                ? "Adding..."
                : `Add ${selectedPlayerIds.length} Reserve${selectedPlayerIds.length !== 1 ? "s" : ""}`}
            </Button>
            <Button variant="secondary" onClick={resetForm} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editingReserve !== null}
        onClose={resetForm}
        title="Edit Reserve"
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

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleUpdate}
              disabled={!formData.name.trim() || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Saving..." : "Update"}
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
