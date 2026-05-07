// Plain-English creative fatigue helper.
// Standardized thresholds used across InsightsHome (campaign card badge)
// and CampaignInsightDetail (detail-view fatigue card). Single source of
// truth so we don't drift between three different "what counts as high
// frequency?" numbers across the app.

export type FatigueLevel = 'none' | 'early' | 'building' | 'high';

export interface FatigueStatus {
  level: FatigueLevel;
  /** Frequency value passed in, normalized (0 if missing/invalid). */
  frequency: number;
  /** One-word label suitable for a badge. */
  label: string;
  /** Plain-English one-line explanation for non-experts. */
  explanation: string;
  /** Suggested next action — phrased as advice, not command. */
  recommendation: string;
  /** Tailwind classes for the badge color. */
  badgeClass: string;
  /** Whether the indicator should be surfaced at all. */
  shouldSurface: boolean;
}

export function getFatigueStatus(frequency: number | null | undefined): FatigueStatus {
  const f = typeof frequency === 'number' && !isNaN(frequency) && frequency > 0 ? frequency : 0;
  const freqStr = f > 0 ? f.toFixed(1) : '—';

  if (f < 2.5) {
    return {
      level: 'none',
      frequency: f,
      label: 'Healthy',
      explanation: f > 0
        ? `Each person has seen your ad about ${freqStr} times — plenty of room to keep running.`
        : 'Not enough delivery yet to measure fatigue.',
      recommendation: 'Keep running. No action needed.',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      shouldSurface: false,
    };
  }

  if (f < 3.5) {
    return {
      level: 'early',
      frequency: f,
      label: 'Early fatigue',
      explanation: `Each person has seen your ad about ${freqStr} times. Your audience is starting to see this a lot.`,
      recommendation: 'We recommend lining up a fresh creative this week so you have it ready.',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      shouldSurface: true,
    };
  }

  if (f < 4.5) {
    return {
      level: 'building',
      frequency: f,
      label: 'Refresh soon',
      explanation: `Each person has seen your ad about ${freqStr} times. The same people are seeing it over and over.`,
      recommendation: 'We recommend refreshing creative in the next few days before performance dips.',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
      shouldSurface: true,
    };
  }

  return {
    level: 'high',
    frequency: f,
    label: 'Refresh now',
    explanation: `Each person has seen your ad about ${freqStr} times. Your audience is tapped out.`,
    recommendation: 'We recommend swapping in fresh creative now — this is the #1 driver of cost increases.',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    shouldSurface: true,
  };
}
