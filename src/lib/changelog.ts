/**
 * "What's new" copy shown once per version in `WhatsNewModal`. English only
 * — like the GitHub release notes it mirrors, this isn't run through i18n;
 * translating changelog prose for every release isn't sustainable by hand.
 *
 * Add a new entry when cutting a release. If a version has no entry, the
 * modal silently skips it (no popup, just marks the version as seen).
 */
export interface ChangelogEntry {
  version: string;
  /** Institutional "file number" flavor text, e.g. "MDR-0091". */
  fileNumber: string;
  headline: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.9.2",
    fileNumber: "MDR-0092",
    headline: "Refinement Complete",
    highlights: [
      "Free, local, GPU-accelerated AI post-processing — download a small language model right from Settings, no API key required and nothing leaves your machine.",
      "Fixed the recording pill's status text losing its first letter when transcribing or processing.",
      "Fixed the Flow Bar's hover card clipping on multi-monitor setups with mixed display scaling.",
      "You're looking at the result of this update: a short briefing like this one now appears after any update that changes something worth knowing about.",
    ],
  },
];

export const getChangelogEntry = (
  version: string,
): ChangelogEntry | undefined =>
  CHANGELOG.find((entry) => entry.version === version);
