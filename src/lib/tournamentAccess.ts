import { TOURNAMENT_ACCESS_STORAGE_KEY } from "./constants";

interface StoredAccess {
  tournamentId: number;
  code: string;
}

/**
 * Get the stored tournament access from localStorage
 */
export function getStoredAccess(): StoredAccess | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(TOURNAMENT_ACCESS_STORAGE_KEY);
    if (!stored) return null;

    const access = JSON.parse(stored) as StoredAccess;
    // Validate shape
    if (typeof access.tournamentId === "number" && typeof access.code === "string") {
      return access;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Store tournament access in localStorage after successful verification
 */
export function setStoredAccess(tournamentId: number, code: string): void {
  if (typeof window === "undefined") return;

  try {
    const access: StoredAccess = { tournamentId, code };
    localStorage.setItem(TOURNAMENT_ACCESS_STORAGE_KEY, JSON.stringify(access));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear stored tournament access
 */
export function clearStoredAccess(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(TOURNAMENT_ACCESS_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
