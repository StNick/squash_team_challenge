import { useState, useEffect, useCallback, useRef } from "react";

interface WakeLockState {
  isActive: boolean;
  isSupported: boolean;
}

export function useWakeLock(): WakeLockState & {
  request: () => Promise<void>;
  release: () => Promise<void>;
} {
  const [isActive, setIsActive] = useState(false);
  const [isSupported] = useState(() => "wakeLock" in navigator);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const request = useCallback(async () => {
    if (!isSupported) return;

    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setIsActive(true);

      wakeLockRef.current.addEventListener("release", () => {
        setIsActive(false);
      });
    } catch (error) {
      // Wake lock request can fail (e.g., low battery, page not visible)
      console.warn("Wake lock request failed:", error);
      setIsActive(false);
    }
  }, [isSupported]);

  const release = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
      } catch (error) {
        console.warn("Wake lock release failed:", error);
      }
    }
  }, []);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        await request();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSupported, request]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  return {
    isActive,
    isSupported,
    request,
    release,
  };
}
