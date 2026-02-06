import { Button } from "~/components/ui/Button";

interface ScoringControlsProps {
  canUndo: boolean;
  onUndo: () => void;
  onEndMatch: () => void;
  variant?: "portrait" | "landscape";
}

export function ScoringControls({
  canUndo,
  onUndo,
  onEndMatch,
  variant = "portrait",
}: ScoringControlsProps) {
  if (variant === "landscape") {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="lg"
          onClick={onUndo}
          disabled={!canUndo}
          className="min-h-[48px]"
        >
          Undo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-4 px-4">
      <Button
        variant="secondary"
        size="lg"
        onClick={onUndo}
        disabled={!canUndo}
        className="flex-1 min-h-[48px]"
      >
        Undo
      </Button>
      <Button
        variant="danger"
        size="lg"
        onClick={onEndMatch}
        className="flex-1 min-h-[48px]"
      >
        End Match
      </Button>
    </div>
  );
}
