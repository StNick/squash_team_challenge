"use client";

import { useState } from "react";
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";
import { Modal } from "~/components/ui/Modal";
import { getTeamTextColor } from "~/lib/constants";
import type { Match, Player } from "~/server/db/schema";

interface MatchScoreInputProps {
  match: Match & { playerA: Player; playerB: Player };
  teamAColor: string;
  teamBColor: string;
  onSubmit: (matchId: number, scoreA: number, scoreB: number) => Promise<void>;
  disabled?: boolean;
}

export function MatchScoreInput({
  match,
  teamAColor,
  teamBColor,
  onSubmit,
  disabled,
}: MatchScoreInputProps) {
  const [scoreA, setScoreA] = useState<string>(
    match.scoreA?.toString() ?? ""
  );
  const [scoreB, setScoreB] = useState<string>(
    match.scoreB?.toString() ?? ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const hasExistingScores = match.scoreA !== null && match.scoreB !== null;
  const inputsDisabled = disabled || isSubmitting || hasExistingScores;
  const canSubmit =
    !disabled &&
    !hasExistingScores &&
    scoreA !== "" &&
    scoreB !== "" &&
    !isNaN(parseInt(scoreA)) &&
    !isNaN(parseInt(scoreB));

  const handleSubmitClick = () => {
    if (!canSubmit) return;
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmation(false);
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(match.id, parseInt(scoreA), parseInt(scoreB));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit score");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
      <div className="text-xs text-gray-500 text-center">
        Position {match.position}
      </div>

      <div className="flex items-center justify-center gap-2">
        {/* Player A */}
        <div className="flex-1 text-right">
          <div
            className="text-sm font-medium truncate"
            style={{ color: getTeamTextColor(teamAColor) }}
          >
            {match.playerA.name}
          </div>
        </div>

        {/* Score A Input */}
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={scoreA}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "" || (/^\d+$/.test(val) && parseInt(val) <= 999)) {
              setScoreA(val);
            }
          }}
          className={`w-20 h-12 text-center text-xl font-bold ${
            hasExistingScores ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
          style={{ borderColor: teamAColor }}
          disabled={inputsDisabled}
          aria-label={`Score for ${match.playerA.name}`}
        />

        <span className="text-gray-400 font-bold">-</span>

        {/* Score B Input */}
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={scoreB}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "" || (/^\d+$/.test(val) && parseInt(val) <= 999)) {
              setScoreB(val);
            }
          }}
          className={`w-20 h-12 text-center text-xl font-bold ${
            hasExistingScores ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
          style={{ borderColor: teamBColor }}
          disabled={inputsDisabled}
          aria-label={`Score for ${match.playerB.name}`}
        />

        {/* Player B */}
        <div className="flex-1 text-left">
          <div
            className="text-sm font-medium truncate"
            style={{ color: getTeamTextColor(teamBColor) }}
          >
            {match.playerB.name}
          </div>
        </div>
      </div>

      {/* Submit button */}
      {!hasExistingScores && (
        <Button
          onClick={handleSubmitClick}
          disabled={!canSubmit || isSubmitting}
          size="sm"
          className="w-full mt-1"
        >
          {isSubmitting ? "Saving..." : "Submit Score"}
        </Button>
      )}

      {error && <div className="text-xs text-red-600 text-center">{error}</div>}

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        title="Confirm Score Submission"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            You are about to capture the score between{" "}
            <strong style={{ color: getTeamTextColor(teamAColor) }}>{match.playerA.name}</strong>{" "}
            ({scoreA}) and{" "}
            <strong style={{ color: getTeamTextColor(teamBColor) }}>{match.playerB.name}</strong>{" "}
            ({scoreB}).
          </p>
          <p className="text-gray-600 text-sm">
            You will not be able to change this. Are you sure?
          </p>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleConfirmSubmit} className="flex-1">
              Confirm
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowConfirmation(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
