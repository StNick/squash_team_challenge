import { Modal } from "~/components/ui/Modal";
import type { Reserve } from "~/server/db/schema";

interface ReserveModalProps {
  isOpen: boolean;
  onClose: () => void;
  reserves: Reserve[];
}

/**
 * Extract level display from notes string
 * Looks for patterns like "Suggested level: 2" or "Level 2 or 3"
 */
function extractLevelDisplay(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/level[:\s]*(\d(?:\s*(?:or|\/|-)\s*\d)?)/i);
  return match ? match[1] : null;
}

/**
 * Get the primary level number for sorting
 */
function getSortLevel(notes: string | null): number {
  const level = extractLevelDisplay(notes);
  if (!level) return 999; // Sort reserves without level to the end
  const firstDigit = level.match(/\d/);
  return firstDigit ? parseInt(firstDigit[0], 10) : 999;
}

export function ReserveModal({ isOpen, onClose, reserves }: ReserveModalProps) {
  // Sort reserves by level
  const sortedReserves = [...reserves].sort((a, b) => {
    return getSortLevel(a.notes) - getSortLevel(b.notes);
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Need a Reserve?">
      {sortedReserves.length === 0 ? (
        <p className="text-gray-500 text-center py-4">
          No reserves available at the moment.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-4">
            Contact one of our reserve players if you can't make it:
          </p>
          <ul className="space-y-3">
            {sortedReserves.map((reserve) => {
              const levelDisplay = extractLevelDisplay(reserve.notes);
              return (
                <li
                  key={reserve.id}
                  className="p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{reserve.name}</span>
                    {levelDisplay && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        Level {levelDisplay}
                      </span>
                    )}
                  </div>
                  {reserve.phone && (
                    <a
                      href={`tel:${reserve.phone}`}
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
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
                  {reserve.email && (
                    <a
                      href={`mailto:${reserve.email}`}
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
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
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
