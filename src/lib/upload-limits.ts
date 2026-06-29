// Single source of truth for Creative Studio upload limits.
//
// We previously advertised 250MB, but uploads consistently failed around
// ~194MB because of a project-level Storage / Edge body-size ceiling that
// isn't adjustable from the app. Rather than letting users hit a confusing
// mid-upload failure, we cap at a known-good value and surface the same
// number everywhere (validators + UI copy).
//
// If/when the platform ceiling is raised (or we implement TUS-resumable
// uploads end-to-end), bump MAX_UPLOAD_BYTES — every screen reads from
// here, so the displayed and enforced limits cannot drift apart.

export const MAX_UPLOAD_MB = 150;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MAX_UPLOAD_LABEL = `${MAX_UPLOAD_MB}MB`;

export function tooLargeMessage(fileName?: string) {
  const prefix = fileName ? `${fileName}: ` : '';
  return `${prefix}File is over the ${MAX_UPLOAD_LABEL} upload limit. Please compress or trim it and try again.`;
}
