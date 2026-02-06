import { useCallback, useRef } from "react";
import type { ScoringState, StoredSession } from "~/lib/scoring/types";

const STORAGE_PREFIX = "squash-scoring-";
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function getStorageKey(matchId: number): string {
  return `${STORAGE_PREFIX}${matchId}`;
}

function isSessionExpired(session: StoredSession): boolean {
  return Date.now() - session.savedAt > SESSION_EXPIRY_MS;
}

export function useScoringPersistence(matchId: number) {
  const lastSavedRef = useRef<string | null>(null);

  const save = useCallback(
    (state: ScoringState) => {
      try {
        const session: StoredSession = {
          state,
          savedAt: Date.now(),
        };
        const serialized = JSON.stringify(session);

        // Only save if state has changed
        if (serialized !== lastSavedRef.current) {
          localStorage.setItem(getStorageKey(matchId), serialized);
          lastSavedRef.current = serialized;
        }
      } catch (error) {
        console.error("Failed to save scoring state:", error);
      }
    },
    [matchId]
  );

  const load = useCallback((): StoredSession | null => {
    try {
      const stored = localStorage.getItem(getStorageKey(matchId));
      if (!stored) return null;

      const session = JSON.parse(stored) as StoredSession;
      lastSavedRef.current = stored;
      return session;
    } catch (error) {
      console.error("Failed to load scoring state:", error);
      return null;
    }
  }, [matchId]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(getStorageKey(matchId));
      lastSavedRef.current = null;
    } catch (error) {
      console.error("Failed to clear scoring state:", error);
    }
  }, [matchId]);

  const hasSession = useCallback((): boolean => {
    try {
      const stored = localStorage.getItem(getStorageKey(matchId));
      if (!stored) return false;

      const session = JSON.parse(stored) as StoredSession;
      return session.state.status === "in_progress";
    } catch {
      return false;
    }
  }, [matchId]);

  return {
    save,
    load,
    clear,
    hasSession,
  };
}

// Utility to check for any existing session (used when opening scoring app)
export function hasExistingSession(matchId: number): boolean {
  try {
    const stored = localStorage.getItem(getStorageKey(matchId));
    if (!stored) return false;

    const session = JSON.parse(stored) as StoredSession;

    // Don't count expired sessions
    if (isSessionExpired(session)) {
      return false;
    }

    return session.state.status === "in_progress";
  } catch {
    return false;
  }
}

export function loadExistingSession(matchId: number): StoredSession | null {
  try {
    const stored = localStorage.getItem(getStorageKey(matchId));
    if (!stored) return null;

    const session = JSON.parse(stored) as StoredSession;

    // Clear expired sessions automatically
    if (isSessionExpired(session)) {
      localStorage.removeItem(getStorageKey(matchId));
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

// Clean up all expired scoring sessions from localStorage
export function cleanupExpiredSessions(): void {
  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const session = JSON.parse(stored) as StoredSession;
            if (isSessionExpired(session)) {
              keysToRemove.push(key);
            }
          } catch {
            // Invalid JSON, remove it
            keysToRemove.push(key);
          }
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore errors during cleanup
  }
}
