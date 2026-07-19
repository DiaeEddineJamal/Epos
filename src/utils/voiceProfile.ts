/**
 * Voice Profile tiers — accomplishment badges earned by lifetime dictated
 * words, from first words up to one million. Each tier has an i18n name key
 * (home.voiceProfile.tiers.<id>). The tier advances as the user dictates more.
 */
export interface VoiceTier {
  id: string;
  /** Inclusive lower bound of dictated words for this tier. */
  threshold: number;
}

export const VOICE_TIERS: VoiceTier[] = [
  { id: "firstWords", threshold: 0 },
  { id: "cadet", threshold: 1_000 },
  { id: "fluent", threshold: 8_000 },
  { id: "wordsmith", threshold: 25_000 },
  { id: "orator", threshold: 60_000 },
  { id: "adept", threshold: 120_000 },
  { id: "master", threshold: 250_000 },
  { id: "silverTongue", threshold: 500_000 },
  { id: "luminary", threshold: 1_000_000 },
];

export interface VoiceProfileState {
  /** Current tier. */
  tier: VoiceTier;
  /** 1-based index of the current tier. */
  index: number;
  total: number;
  /** Next tier, or null when the top tier is reached. */
  next: VoiceTier | null;
  /** Words remaining to reach the next tier (0 at the top). */
  toNext: number;
  /** Progress through the current tier's span, 0..1. */
  progress: number;
}

/** Resolve the voice profile for a lifetime word count. */
export const voiceProfileFor = (totalWords: number): VoiceProfileState => {
  const words = Math.max(0, Math.floor(totalWords));
  let idx = 0;
  for (let i = 0; i < VOICE_TIERS.length; i++) {
    if (words >= VOICE_TIERS[i].threshold) idx = i;
  }
  const tier = VOICE_TIERS[idx];
  const next = VOICE_TIERS[idx + 1] ?? null;
  const toNext = next ? Math.max(0, next.threshold - words) : 0;
  const span = next ? next.threshold - tier.threshold : 1;
  const progress = next
    ? Math.min(1, Math.max(0, (words - tier.threshold) / span))
    : 1;
  return { tier, index: idx + 1, total: VOICE_TIERS.length, next, toNext, progress };
};
