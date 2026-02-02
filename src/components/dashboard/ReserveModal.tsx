import { Modal } from "~/components/ui/Modal";
import type { Reserve, TournamentStatus } from "~/server/db/schema";

interface ReserveModalProps {
  isOpen: boolean;
  onClose: () => void;
  reserves: Reserve[];
  tournamentStatus?: TournamentStatus;
}

/**
 * Get the primary position number for sorting from suggestedPosition
 * e.g. "1" → 1, "1-2" → 1, "2-3" → 2
 */
function getSortPosition(suggestedPosition: string | null): number {
  if (!suggestedPosition) return 999; // Sort reserves without position to the end
  const firstDigit = suggestedPosition.match(/\d/);
  return firstDigit ? parseInt(firstDigit[0], 10) : 999;
}

export function ReserveModal({ isOpen, onClose, reserves, tournamentStatus = "active" }: ReserveModalProps) {
  // Sort reserves by position
  const sortedReserves = [...reserves].sort((a, b) => {
    return getSortPosition(a.suggestedPosition) - getSortPosition(b.suggestedPosition);
  });

  // Hide contact info for ended tournaments
  const showContactInfo = tournamentStatus === "active";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Need a Reserve?">
      {sortedReserves.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
          No reserves available at the moment.
        </p>
      ) : (
        <div className="space-y-3">
          {!showContactInfo && (
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 p-2 rounded mb-4">
              Contact info is hidden for past tournaments.
            </p>
          )}
          {showContactInfo && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Contact one of our reserve players if you can't make it:
            </p>
          )}
          <ul className="space-y-3">
            {sortedReserves.map((reserve) => (
              <li
                key={reserve.id}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">{reserve.name}</span>
                  {reserve.suggestedPosition && (
                    <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                      Position {reserve.suggestedPosition}
                    </span>
                  )}
                </div>
                {showContactInfo && reserve.phone && (
                  <a
                    href={`tel:${reserve.phone}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    {reserve.phone}
                  </a>
                )}
                {showContactInfo && reserve.email && (
                  <a
                    href={`mailto:${reserve.email}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    {reserve.email}
                  </a>
                )}
                {reserve.notes && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{reserve.notes}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
