"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "~/components/ui/Button";
import { Modal } from "~/components/ui/Modal";
import { ScorePanel } from "./ScorePanel";
import { MatchTimer } from "./MatchTimer";
import { ScoringControls } from "./ScoringControls";
import { ResumePrompt } from "./ResumePrompt";
import { ScoreHistoryTable } from "./ScoreHistoryTable";
import { useScoringState } from "~/hooks/scoring/useScoringState";
import { TEAM_COLORS } from "~/lib/constants";
import {
  useScoringPersistence,
  loadExistingSession,
  cleanupExpiredSessions,
} from "~/hooks/scoring/useScoringPersistence";
import { useWakeLock } from "~/hooks/scoring/useWakeLock";
import { useOrientation } from "~/hooks/scoring/useOrientation";
import type { MatchInfo, StoredSession } from "~/lib/scoring/types";

interface LiveScoringAppProps {
  match: MatchInfo;
  onClose: () => void;
  onMatchComplete: (
    matchId: number,
    scoreA: number,
    scoreB: number
  ) => Promise<void>;
}

type AppPhase =
  | "checking_session"
  | "resume_prompt"
  | "scoring"
  | "confirm_end";

export function LiveScoringApp({
  match,
  onClose,
  onMatchComplete,
}: LiveScoringAppProps) {
  const [phase, setPhase] = useState<AppPhase>("checking_session");
  const [existingSession, setExistingSession] = useState<StoredSession | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    state,
    scorePoint,
    selectServiceBox,
    setServer,
    undo,
    restore,
    canUndo,
  } = useScoringState(match);
  const { save, clear } = useScoringPersistence(match.id);
  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
  const orientation = useOrientation();

  // Check for existing session on mount
  useEffect(() => {
    // Clean up any expired sessions from localStorage
    cleanupExpiredSessions();

    const session = loadExistingSession(match.id);
    if (session && session.state.status === "in_progress") {
      setExistingSession(session);
      setPhase("resume_prompt");
    } else {
      setPhase("scoring");
    }
  }, [match.id]);

  // Request wake lock when scoring
  useEffect(() => {
    if (phase === "scoring") {
      requestWakeLock();
    }
    return () => {
      releaseWakeLock();
    };
  }, [phase, requestWakeLock, releaseWakeLock]);

  // Save state after each point
  useEffect(() => {
    if (phase === "scoring") {
      save(state);
    }
  }, [phase, state, save]);

  const handleResume = useCallback(() => {
    if (existingSession) {
      restore(existingSession.state);
      setPhase("scoring");
    }
  }, [existingSession, restore]);

  const handleStartFresh = useCallback(() => {
    clear();
    setPhase("scoring");
  }, [clear]);

  const handleEndMatch = useCallback(() => {
    setPhase("confirm_end");
  }, []);

  const handleConfirmEnd = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onMatchComplete(match.id, state.scoreA, state.scoreB);
      clear();
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit score"
      );
      setIsSubmitting(false);
    }
  }, [match.id, state.scoreA, state.scoreB, onMatchComplete, clear, onClose]);

  const handleCancelEnd = useCallback(() => {
    setPhase("scoring");
    setSubmitError(null);
  }, []);

  const handleServiceBoxTap = useCallback(
    (player: "A" | "B") => {
      if (state.server === player && state.isHandout) {
        const newBox = state.serviceBox === "R" ? "L" : "R";
        selectServiceBox(newBox);
      }
    },
    [state.server, state.isHandout, state.serviceBox, selectServiceBox]
  );

  // Handle close with confirmation if match in progress
  const handleClose = useCallback(() => {
    if (phase === "scoring" && (state.scoreA > 0 || state.scoreB > 0)) {
      // State is already saved, just close
      onClose();
    } else {
      clear();
      onClose();
    }
  }, [phase, state.scoreA, state.scoreB, clear, onClose]);

  // Resume prompt
  if (phase === "resume_prompt" && existingSession) {
    return (
      <ResumePrompt
        session={existingSession}
        onResume={handleResume}
        onStartFresh={handleStartFresh}
      />
    );
  }

  // End match confirmation
  if (phase === "confirm_end") {
    const getTextColorForTeam = (teamColor: string) => {
      const teamInfo = TEAM_COLORS.find((c) => c.value === teamColor);
      return teamInfo?.name === "White" || teamInfo?.name === "Yellow"
        ? "text-gray-900"
        : "text-white";
    };

    return (
      <Modal
        isOpen={true}
        onClose={handleCancelEnd}
        title="End Match"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Final score:
          </p>
          <div className="flex justify-center items-center gap-4">
            <div className="text-center w-28">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">
                {state.playerA.name}
              </div>
              <div
                className={`text-3xl font-bold py-2 rounded-lg ${getTextColorForTeam(match.playerA.teamColor)}`}
                style={{ backgroundColor: match.playerA.teamColor }}
              >
                {state.scoreA}
              </div>
            </div>
            <span className="text-gray-400 dark:text-gray-500 text-2xl font-bold">-</span>
            <div className="text-center w-28">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">
                {state.playerB.name}
              </div>
              <div
                className={`text-3xl font-bold py-2 rounded-lg ${getTextColorForTeam(match.playerB.teamColor)}`}
                style={{ backgroundColor: match.playerB.teamColor }}
              >
                {state.scoreB}
              </div>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm text-center">
            Submit this score? This cannot be changed.
          </p>

          {submitError && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 p-2 rounded">
              {submitError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleConfirmEnd}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Submitting..." : "Confirm"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleCancelEnd}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // Main scoring UI - Portrait
  if (orientation === "portrait") {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white p-2 -ml-2"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="text-white flex items-center gap-2">
            <span className="text-gray-400 text-sm">Match:</span>
            <MatchTimer startTime={state.matchStartTime} />
          </div>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>

        {/* Score panels */}
        <div className="flex-1 flex flex-col justify-center gap-4 p-4">
          <ScorePanel
            playerName={state.playerA.name}
            score={state.scoreA}
            teamColor={state.playerA.teamColor}
            isServing={state.server === "A"}
            serviceBox={state.serviceBox}
            isHandout={state.isHandout}
            onTap={() => scorePoint("A")}
            onServiceBoxTap={() => handleServiceBoxTap("A")}
            onBecomeServer={() => setServer("A")}
          />
          <ScorePanel
            playerName={state.playerB.name}
            score={state.scoreB}
            teamColor={state.playerB.teamColor}
            isServing={state.server === "B"}
            serviceBox={state.serviceBox}
            isHandout={state.isHandout}
            onTap={() => scorePoint("B")}
            onServiceBoxTap={() => handleServiceBoxTap("B")}
            onBecomeServer={() => setServer("B")}
          />
        </div>

        {/* Controls */}
        <div className="pb-6 pt-2">
          <ScoringControls
            canUndo={canUndo}
            onUndo={undo}
            onEndMatch={handleEndMatch}
          />
        </div>
      </div>
    );
  }

  // Main scoring UI - Landscape
  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-white p-2 -ml-2"
          aria-label="Close"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="text-white flex items-center gap-2">
          <span className="text-gray-400 text-sm">Match:</span>
          <MatchTimer startTime={state.matchStartTime} />
        </div>
        <div className="w-10" /> {/* Spacer for alignment */}
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-stretch gap-2 p-2 min-h-0">
        {/* Player A panel */}
        <div className="flex-1">
          <ScorePanel
            playerName={state.playerA.name}
            score={state.scoreA}
            teamColor={state.playerA.teamColor}
            isServing={state.server === "A"}
            serviceBox={state.serviceBox}
            isHandout={state.isHandout}
            onTap={() => scorePoint("A")}
            onServiceBoxTap={() => handleServiceBoxTap("A")}
            onBecomeServer={() => setServer("A")}
          />
        </div>

        {/* History table */}
        <div className="w-48 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          <ScoreHistoryTable
            history={state.history}
            teamAColor={state.playerA.teamColor}
            teamBColor={state.playerB.teamColor}
          />
        </div>

        {/* Player B panel */}
        <div className="flex-1">
          <ScorePanel
            playerName={state.playerB.name}
            score={state.scoreB}
            teamColor={state.playerB.teamColor}
            isServing={state.server === "B"}
            serviceBox={state.serviceBox}
            isHandout={state.isHandout}
            onTap={() => scorePoint("B")}
            onServiceBoxTap={() => handleServiceBoxTap("B")}
            onBecomeServer={() => setServer("B")}
          />
        </div>
      </div>

      {/* Controls - same as portrait */}
      <div className="pb-2 pt-2 px-2">
        <ScoringControls
          canUndo={canUndo}
          onUndo={undo}
          onEndMatch={handleEndMatch}
        />
      </div>
    </div>
  );
}
