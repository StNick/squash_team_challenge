"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";

interface TournamentPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<boolean>;
  tournamentName: string;
}

export function TournamentPasswordModal({
  isOpen,
  onClose,
  onSubmit,
  tournamentName,
}: TournamentPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const success = await onSubmit(password);
      if (!success) {
        setError("Incorrect code");
        setPassword("");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Access Code Required">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-gray-600 dark:text-gray-400">
          Enter the 6-character access code to view <strong className="text-gray-900 dark:text-white">{tournamentName}</strong>.
        </p>

        <div>
          <label
            htmlFor="tournament-password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Access Code
          </label>
          <Input
            id="tournament-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value.toUpperCase())}
            placeholder="e.g., A76BN3"
            className="w-full font-mono uppercase text-center text-lg tracking-widest"
            maxLength={6}
            autoFocus
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
            Case-insensitive
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={!password.trim() || isLoading}>
            {isLoading ? "Verifying..." : "Submit"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
