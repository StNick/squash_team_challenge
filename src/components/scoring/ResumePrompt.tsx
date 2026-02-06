import { Button } from "~/components/ui/Button";
import type { StoredSession } from "~/lib/scoring/types";

interface ResumePromptProps {
  session: StoredSession;
  onResume: () => void;
  onStartFresh: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function ResumePrompt({
  session,
  onResume,
  onStartFresh,
}: ResumePromptProps) {
  const { state, savedAt } = session;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Resume Match?
        </h2>

        <p className="text-gray-600 dark:text-gray-300 mb-4">
          You have an in-progress match that was saved {formatTimeAgo(savedAt)}.
        </p>

        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                {state.playerA.name}
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {state.scoreA}
              </div>
            </div>
            <div className="text-gray-400 dark:text-gray-500 font-bold text-xl px-4">
              -
            </div>
            <div className="text-center flex-1">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                {state.playerB.name}
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {state.scoreB}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={onResume} className="flex-1" size="lg">
            Resume
          </Button>
          <Button
            variant="secondary"
            onClick={onStartFresh}
            className="flex-1"
            size="lg"
          >
            Start Fresh
          </Button>
        </div>
      </div>
    </div>
  );
}
