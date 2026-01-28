"use client";

import { useState } from "react";
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";
import { Modal } from "~/components/ui/Modal";
import { getTeamTextColor } from "~/lib/constants";
import type { Match, Player, Reserve } from "~/server/db/schema";

interface MatchScoreInputProps {
  match: Match & {
    playerA: Player;
    playerB: Player;
    substituteA?: Reserve | null;
    substituteB?: Reserve | null;
  };
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

  // Calculate adjusted scores based on percentage handicap
  const handicapPct = match.handicap ?? 0;
  const handicapMultiplier = Math.abs(handicapPct) / 100;

  let adjustedScoreA: number | null = null;
  let adjustedScoreB: number | null = null;

  if (match.scoreA !== null && match.scoreB !== null) {
    if (handicapPct > 0) {
      // A's score is reduced by the percentage
      adjustedScoreA = Math.round(match.scoreA * (1 - handicapMultiplier));
      adjustedScoreB = match.scoreB;
    } else if (handicapPct < 0) {
      // B's score is reduced by the percentage
      adjustedScoreA = match.scoreA;
      adjustedScoreB = Math.round(match.scoreB * (1 - handicapMultiplier));
    } else {
      adjustedScoreA = match.scoreA;
      adjustedScoreB = match.scoreB;
    }
  }

  // Determine display names and skills (use substitute if present, including custom)
  const matchWithCustom = match as typeof match & {
    customSubstituteAName?: string | null;
    customSubstituteASkill?: number | null;
    customSubstituteBName?: string | null;
    customSubstituteBSkill?: number | null;
  };

  const displayNameA = match.substituteA?.name ?? matchWithCustom.customSubstituteAName ?? match.playerA.name;
  const displayNameB = match.substituteB?.name ?? matchWithCustom.customSubstituteBName ?? match.playerB.name;
  const displaySkillA = match.substituteA?.skill ?? matchWithCustom.customSubstituteASkill ?? match.playerA.skill;
  const displaySkillB = match.substituteB?.skill ?? matchWithCustom.customSubstituteBSkill ?? match.playerB.skill;
  const isSubstituteA = !!match.substituteA || !!matchWithCustom.customSubstituteAName;
  const isSubstituteB = !!match.substituteB || !!matchWithCustom.customSubstituteBName;

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

  const formatHandicap = (h: number) => {
    if (h === 0) return null;
    if (h > 0) return `A -${h}%`;
    return `B -${Math.abs(h)}%`;
  };

  // Calculate adjusted scores for preview in confirmation modal
  const getPreviewAdjustedScores = () => {
    const rawA = parseInt(scoreA);
    const rawB = parseInt(scoreB);
    if (isNaN(rawA) || isNaN(rawB)) return null;

    const pct = Math.abs(handicapPct) / 100;
    if (handicapPct > 0) {
      return { a: Math.round(rawA * (1 - pct)), b: rawB };
    } else if (handicapPct < 0) {
      return { a: rawA, b: Math.round(rawB * (1 - pct)) };
    }
    return { a: rawA, b: rawB };
  };

  const PlayerDisplay = ({
    name,
    originalName,
    skill,
    isSubstitute,
    color,
    align,
  }: {
    name: string;
    originalName: string;
    skill: number | null;
    isSubstitute: boolean;
    color: string;
    align: "left" | "right";
  }) => (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div
        className="text-sm font-medium flex items-center gap-1"
        style={{ color: getTeamTextColor(color), justifyContent: align === "right" ? "flex-end" : "flex-start" }}
      >
        {isSubstitute && (
          <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">
            SUB
          </span>
        )}
        <span>{name}</span>
      </div>
      {isSubstitute && (
        <div className="text-xs text-gray-400">
          (for {originalName})
        </div>
      )}
      {skill !== null && <span className="text-xs text-gray-500">[{skill}]</span>}
    </div>
  );

  return (
    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-center gap-2">
        <div className="text-xs text-gray-500">
          Position {match.position}
        </div>
        {handicapPct !== 0 && (
          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
            {formatHandicap(handicapPct)}
          </span>
        )}
      </div>

      {/* Desktop layout - names on sides */}
      <div className="hidden md:flex items-center justify-center gap-2">
        <div className="flex-1">
          <PlayerDisplay
            name={displayNameA}
            originalName={match.playerA.name}
            skill={displaySkillA}
            isSubstitute={isSubstituteA}
            color={teamAColor}
            align="right"
          />
        </div>

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
          aria-label={`Score for ${displayNameA}`}
        />

        <span className="text-gray-400 font-bold">-</span>

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
          aria-label={`Score for ${displayNameB}`}
        />

        <div className="flex-1">
          <PlayerDisplay
            name={displayNameB}
            originalName={match.playerB.name}
            skill={displaySkillB}
            isSubstitute={isSubstituteB}
            color={teamBColor}
            align="left"
          />
        </div>
      </div>

      {/* Mobile layout - names below score inputs */}
      <div className="flex md:hidden flex-col gap-2">
        <div className="flex items-center justify-center gap-2">
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
            aria-label={`Score for ${displayNameA}`}
          />

          <span className="text-gray-400 font-bold">-</span>

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
            aria-label={`Score for ${displayNameB}`}
          />
        </div>

        <div className="flex justify-between px-2">
          <PlayerDisplay
            name={displayNameA}
            originalName={match.playerA.name}
            skill={displaySkillA}
            isSubstitute={isSubstituteA}
            color={teamAColor}
            align="left"
          />
          <PlayerDisplay
            name={displayNameB}
            originalName={match.playerB.name}
            skill={displaySkillB}
            isSubstitute={isSubstituteB}
            color={teamBColor}
            align="right"
          />
        </div>
      </div>

      {/* Adjusted scores display when handicap is applied */}
      {hasExistingScores && handicapPct !== 0 && adjustedScoreA !== null && adjustedScoreB !== null && (
        <div className="text-center text-xs text-gray-500 mt-1 p-2 bg-purple-50 rounded">
          <span className="font-medium">Weighted result:</span>{" "}
          <span className="font-bold">{adjustedScoreA} - {adjustedScoreB}</span>
          <span className="relative inline-block ml-1 group">
            <span className="cursor-help text-purple-600">ℹ️</span>
            <span className="invisible group-hover:visible absolute z-10 w-56 p-2 text-left text-xs bg-gray-800 text-white rounded shadow-lg -left-24 bottom-full mb-1">
              <span className="block font-medium mb-1">Handicap: {formatHandicap(handicapPct)}</span>
              <span className="block">Actual score: {match.scoreA} - {match.scoreB}</span>
              <span className="block">
                Calculation: {handicapPct > 0 ? match.scoreA : match.scoreB} × {(1 - handicapMultiplier).toFixed(2)} = {handicapPct > 0 ? adjustedScoreA : adjustedScoreB}
              </span>
              <span className="block mt-1 text-gray-300">
                The stronger player's score is reduced by the handicap percentage.
              </span>
              <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></span>
            </span>
          </span>
        </div>
      )}

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
            <strong style={{ color: getTeamTextColor(teamAColor) }}>{displayNameA}</strong>{" "}
            ({scoreA}) and{" "}
            <strong style={{ color: getTeamTextColor(teamBColor) }}>{displayNameB}</strong>{" "}
            ({scoreB}).
          </p>
          {handicapPct !== 0 && (
            <p className="text-gray-600 text-sm bg-purple-50 p-2 rounded">
              <span className="font-medium">Handicap applied:</span> {formatHandicap(handicapPct)}
              <br />
              <span className="text-gray-500">
                Adjusted scores for standings:{" "}
                {(() => {
                  const preview = getPreviewAdjustedScores();
                  return preview ? `${preview.a} - ${preview.b}` : "N/A";
                })()}
              </span>
            </p>
          )}
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
