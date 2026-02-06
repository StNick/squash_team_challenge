import { useState, useEffect, useRef } from "react";

interface MatchTimerProps {
  startTime: number;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function MatchTimer({ startTime }: MatchTimerProps) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      // Only update state once per second to avoid unnecessary renders
      if (now - lastUpdateRef.current >= 1000) {
        setElapsed(now - startTime);
        lastUpdateRef.current = now;
      }
      rafRef.current = requestAnimationFrame(updateTimer);
    };

    // Handle page visibility
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else {
        // Resume and immediately update
        setElapsed(Date.now() - startTime);
        lastUpdateRef.current = Date.now();
        rafRef.current = requestAnimationFrame(updateTimer);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    rafRef.current = requestAnimationFrame(updateTimer);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [startTime]);

  return (
    <span className="font-mono text-lg tabular-nums">{formatTime(elapsed)}</span>
  );
}
