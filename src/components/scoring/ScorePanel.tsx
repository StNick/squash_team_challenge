import { TEAM_COLORS } from "~/lib/constants";
import type { ServiceBox } from "~/lib/scoring/types";

interface ScorePanelProps {
  playerName: string;
  score: number;
  teamColor: string;
  isServing: boolean;
  serviceBox: ServiceBox;
  isHandout: boolean;
  onTap: () => void;
  onServiceBoxTap: () => void;
  onBecomeServer: () => void;
}

export function ScorePanel({
  playerName,
  score,
  teamColor,
  isServing,
  serviceBox,
  isHandout,
  onTap,
  onServiceBoxTap,
  onBecomeServer,
}: ScorePanelProps) {
  // Determine text color based on team color
  const teamColorInfo = TEAM_COLORS.find((c) => c.value === teamColor);
  const textColor = teamColorInfo?.text ?? "text-white";
  const isLightBackground =
    teamColorInfo?.name === "White" || teamColorInfo?.name === "Yellow";

  // Server shows L/R (with ? if handout), non-server shows empty circle
  const serverIndicator = isServing
    ? isHandout
      ? `${serviceBox}?`
      : serviceBox
    : "";

  const handleCircleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isServing && isHandout) {
      // Toggle service box during handout
      onServiceBoxTap();
    } else if (!isServing) {
      // Non-server taps to become server
      onBecomeServer();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap();
        }
      }}
      className="w-full h-full rounded-xl shadow-lg transition-transform active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-white/30 cursor-pointer select-none"
      style={{ backgroundColor: teamColor }}
      aria-label={`Score point for ${playerName}. Current score: ${score}`}
    >
      <div className="p-4 relative h-full flex flex-col justify-center">
        {/* Player name */}
        <div
          className={`text-center font-bold text-lg sm:text-xl truncate ${textColor}`}
        >
          {playerName}
        </div>

        {/* Score */}
        <div
          className={`text-center font-bold tabular-nums ${textColor}`}
          style={{ fontSize: "clamp(60px, 15vw, 120px)", lineHeight: 1.1 }}
        >
          {score}
        </div>

        {/* Server indicator - always shown */}
        <button
          onClick={handleCircleTap}
          className={`absolute bottom-4 right-4 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${
            isServing
              ? isHandout
                ? "bg-white/90 text-gray-800 cursor-pointer hover:bg-white"
                : "bg-white/70 text-gray-600 cursor-default"
              : "bg-white/40 text-transparent cursor-pointer hover:bg-white/60"
          } ${isLightBackground ? "border-2 border-gray-400" : ""}`}
          aria-label={
            isServing
              ? isHandout
                ? `Server can choose box. Currently ${serviceBox}. Tap to change.`
                : `Serving from ${serviceBox} box`
              : "Tap to make this player the server"
          }
        >
          {serverIndicator}
        </button>
      </div>
    </div>
  );
}
