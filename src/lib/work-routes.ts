// Shared helpers for tracking "what the user was working on" so we can
// surface a Return-to-work button if Lumi pulls them somewhere else.

export interface WorkRoute {
  /** Path prefix that identifies this kind of work */
  match: (path: string) => boolean;
  /** Human label for the button: "Return to {label}" */
  label: string;
}

// Anything in this list is treated as "real work in progress" — if Lumi
// navigates the user away from one of these to a setup/admin screen we save
// it so the user can jump back in one click.
const WORK_ROUTES: WorkRoute[] = [
  { match: (p) => p.startsWith('/creative-studio'), label: 'your creative' },
  { match: (p) => p.startsWith('/campaign-builder'), label: 'your campaign builder' },
  { match: (p) => p.startsWith('/launch'), label: 'your launch' },
  { match: (p) => p.startsWith('/campaigns/'), label: 'your campaign' },
  { match: (p) => p.startsWith('/strategy'), label: 'your strategy' },
  { match: (p) => p.startsWith('/performance'), label: 'your performance review' },
  { match: (p) => p.startsWith('/ad-generator'), label: 'your ad' },
  { match: (p) => p.startsWith('/retrospectives'), label: 'your retrospective' },
];

export function getWorkLabel(path: string): string | null {
  const w = WORK_ROUTES.find(r => r.match(path));
  return w ? w.label : null;
}

export function isWorkPath(path: string): boolean {
  return getWorkLabel(path) !== null;
}
