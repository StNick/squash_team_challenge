import { useEffect, useRef } from "react";
import type { PointEvent } from "~/lib/scoring/types";

interface ScoreHistoryTableProps {
  history: PointEvent[];
  teamAColor: string;
  teamBColor: string;
}

export function ScoreHistoryTable({
  history,
  teamAColor,
  teamBColor,
}: ScoreHistoryTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new points are added
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [history.length]);

  if (history.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
    >
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
          <tr className="text-gray-500 dark:text-gray-400 text-xs">
            <th className="py-1 px-2 text-center w-1/4">Box</th>
            <th className="py-1 px-2 text-center w-1/4">A</th>
            <th className="py-1 px-2 text-center w-1/4">B</th>
            <th className="py-1 px-2 text-center w-1/4">Box</th>
          </tr>
        </thead>
        <tbody>
          {history.map((point, index) => {
            const isServerA = point.server === "A";
            const scorerIsA = point.scorer === "A";

            return (
              <tr
                key={index}
                className="border-b border-gray-200 dark:border-gray-600"
              >
                {/* Player A's service box */}
                <td
                  className="py-1 px-2 text-center font-mono text-white"
                  style={{
                    backgroundColor: isServerA
                      ? `${teamAColor}90`
                      : "transparent",
                  }}
                >
                  {isServerA ? point.serviceBox : "-"}
                </td>

                {/* Player A's score (only shown when they scored) */}
                <td
                  className="py-1 px-2 text-center font-bold tabular-nums text-white"
                  style={{
                    backgroundColor: scorerIsA
                      ? `${teamAColor}80`
                      : "transparent",
                  }}
                >
                  {scorerIsA ? point.scoreA : "-"}
                </td>

                {/* Player B's score (only shown when they scored) */}
                <td
                  className="py-1 px-2 text-center font-bold tabular-nums text-white"
                  style={{
                    backgroundColor: !scorerIsA
                      ? `${teamBColor}80`
                      : "transparent",
                  }}
                >
                  {!scorerIsA ? point.scoreB : "-"}
                </td>

                {/* Player B's service box */}
                <td
                  className="py-1 px-2 text-center font-mono text-white"
                  style={{
                    backgroundColor: !isServerA
                      ? `${teamBColor}90`
                      : "transparent",
                  }}
                >
                  {!isServerA ? point.serviceBox : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
