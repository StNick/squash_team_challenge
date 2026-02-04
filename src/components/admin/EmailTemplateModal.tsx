"use client";

import { useState, useMemo, useRef } from "react";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import type { Team, Player, Match, WeeklyMatchup, WeeklyDuty } from "~/server/db/schema";

interface WeekData {
  matchups: (WeeklyMatchup & {
    teamA: Team;
    teamB: Team;
    matches: (Match & { playerA: Player; playerB: Player })[];
  })[];
  duties?: WeeklyDuty & {
    dinnerTeam: Team;
    cleanupTeam: Team;
  };
  firstOnCourt?: number;
}

interface EmailTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeek: number;
  weeklyData: Record<number, WeekData>;
  accessCode?: string | null;
}

// Helper to determine if a color is light (needs dark text)
function isLightColor(color: string): boolean {
  // Handle hex colors
  let hex = color.replace("#", "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.7;
}

// Helper to create a colored team badge
function teamBadge(teamName: string, color: string): string {
  const name = teamName.replace("Team ", "");
  const isLight = isLightColor(color);
  const textColor = isLight ? "#1f2937" : "white";
  const border = isLight ? "border: 1px solid #d1d5db;" : "";
  return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: ${color}; color: ${textColor}; font-weight: bold; ${border}">${name}</span>`;
}

export function EmailTemplateModal({
  isOpen,
  onClose,
  currentWeek,
  weeklyData,
  accessCode,
}: EmailTemplateModalProps) {
  const [personalNotes, setPersonalNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const currentWeekData = weeklyData[currentWeek];

  const emailHtml = useMemo(() => {
    if (!currentWeekData) return "";

    const sections: string[] = [];

    // Personal notes
    if (personalNotes.trim()) {
      sections.push(`<p style="margin: 0 0 16px 0;">${personalNotes.trim().replace(/\n/g, "<br>")}</p>`);
      sections.push(`<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">`);
    }

    // App URL and access code
    sections.push(`
      <p style="margin: 0 0 8px 0;">
        View the website at: <a href="http://www.squashteamchallenge.co.nz" style="color: #2563eb; text-decoration: underline;">www.squashteamchallenge.co.nz</a>
      </p>
    `);
    if (accessCode) {
      sections.push(`
        <p style="margin: 0 0 16px 0;">
          Access code: <strong style="font-family: monospace; font-size: 1.1em; letter-spacing: 0.1em;">${accessCode}</strong>
        </p>
      `);
    }
    sections.push(`<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">`);

    // Duties
    if (currentWeekData.duties) {
      const dinnerTeam = currentWeekData.duties.dinnerTeam;
      const cleanupTeam = currentWeekData.duties.cleanupTeam;
      sections.push(`
        <p style="margin: 0 0 8px 0; font-weight: bold;">This week's duties:</p>
        <p style="margin: 0 0 4px 0;">Dinner: ${teamBadge(dinnerTeam.name, dinnerTeam.color)}</p>
        <p style="margin: 0 0 16px 0;">Cleanup: ${teamBadge(cleanupTeam.name, cleanupTeam.color)}</p>
      `);
      sections.push(`<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">`);
    }

    // Match Schedule
    const firstOnCourt = currentWeekData.firstOnCourt;

    if (firstOnCourt) {
      sections.push(`
        <p style="margin: 0 0 12px 0; font-weight: bold;">
          Match Schedule <span style="color: #2563eb;">(Position ${firstOnCourt} plays first at 6:15 pm)</span>
        </p>
      `);

      // Show first on court matches highlighted
      const matchRows: string[] = [];
      for (const matchup of currentWeekData.matchups) {
        for (const match of matchup.matches) {
          if (match.position === firstOnCourt) {
            matchRows.push(`
              <tr style="background-color: #fef3c7;">
                <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${matchup.teamA.color}; margin-right: 6px;"></span>
                  <strong>${match.playerA.name}</strong>
                </td>
                <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align: center; font-weight: bold;">vs</td>
                <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">
                  <strong>${match.playerB.name}</strong>
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${matchup.teamB.color}; margin-left: 6px;"></span>
                </td>
              </tr>
            `);
          }
        }
      }

      sections.push(`
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 16px;">
          <tbody>${matchRows.join("")}</tbody>
        </table>
      `);
    }

    // All matchups
    for (const matchup of currentWeekData.matchups) {
      const matchRows: string[] = [];
      for (const match of matchup.matches) {
        const isFirstOnCourt = firstOnCourt && match.position === firstOnCourt;
        const rowStyle = isFirstOnCourt ? "background-color: #fef3c7;" : "";
        matchRows.push(`
          <tr style="${rowStyle}">
            <td style="padding: 6px 10px; border: 1px solid #e5e7eb;">${match.playerA.name}</td>
            <td style="padding: 6px 10px; border: 1px solid #e5e7eb; text-align: center; color: #6b7280;">vs</td>
            <td style="padding: 6px 10px; border: 1px solid #e5e7eb;">${match.playerB.name}</td>
          </tr>
        `);
      }

      sections.push(`
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0;">
            ${teamBadge(matchup.teamA.name, matchup.teamA.color)}
            <span style="margin: 0 8px; color: #6b7280;">vs</span>
            ${teamBadge(matchup.teamB.name, matchup.teamB.color)}
          </p>
          <table style="border-collapse: collapse; width: 100%;">
            <tbody>${matchRows.join("")}</tbody>
          </table>
        </div>
      `);
    }

    sections.push(`<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">`);

    // Footer
    sections.push(`
      <p style="margin: 0 0 12px 0;">
        If you cannot make your scheduled game, please use the <strong>"Need a Reserve?"</strong> button at the top of the website to arrange a sub. If you are unable to find a sub, please let me know as soon as possible.
      </p>
      <p style="margin: 0 0 12px 0;">
        As always, we will also need umpires for the first round of games (starting at 6:15 pm), so please arrive on time if you're able to help.
      </p>
      <p style="margin: 0 0 12px 0;">
        Thank you all, and see you next Tuesday from 6 pm onward!
      </p>
      <p style="margin: 0;">Cheers</p>
    `);

    return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: #1f2937;">${sections.join("")}</div>`;
  }, [currentWeekData, personalNotes, accessCode]);

  const handleCopy = async () => {
    try {
      // Copy as rich HTML
      const blob = new Blob([emailHtml], { type: "text/html" });
      const clipboardItem = new ClipboardItem({
        "text/html": blob,
        "text/plain": new Blob([previewRef.current?.innerText || ""], { type: "text/plain" }),
      });
      await navigator.clipboard.write([clipboardItem]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy plain text
      try {
        await navigator.clipboard.writeText(previewRef.current?.innerText || "");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Final fallback
        const textArea = document.createElement("textarea");
        textArea.value = previewRef.current?.innerText || "";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Week ${currentWeek} Email Template`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Personal notes input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Personal Notes (optional)
          </label>
          <textarea
            value={personalNotes}
            onChange={(e) => setPersonalNotes(e.target.value)}
            placeholder="Add a personal message to include at the top of the email..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email Preview
          </label>
          <div className="bg-white border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
            <div
              ref={previewRef}
              dangerouslySetInnerHTML={{ __html: emailHtml }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleCopy}>
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
