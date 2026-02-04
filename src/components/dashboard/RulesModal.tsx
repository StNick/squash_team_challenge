"use client";

import { Modal } from "~/components/ui/Modal";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Team Challenge Rules">
      <div className="space-y-6 text-gray-700 dark:text-gray-300">
        <section>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Match Format
          </h3>
          <ul className="list-disc list-outside ml-5 space-y-1 text-sm">
            <li>5 minute warm-up</li>
            <li>15 minutes of play</li>
            <li>1 minute break</li>
            <li>14 minutes of play</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Scoring
          </h3>
          <ul className="list-disc list-outside ml-5 space-y-1 text-sm">
            <li>Score as many points as possible for your team</li>
            <li>Regular squash rules apply</li>
            <li>
              If time runs out during a point, play stops immediately - that
              point is not counted
            </li>
            <li>A match may end in a tie</li>
          </ul>
        </section>
      </div>
    </Modal>
  );
}
