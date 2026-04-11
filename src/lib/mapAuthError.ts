const AUTH_ERROR_MAP: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /invalid login credentials/i,
    message: "That email and password don't match. Try again or reset your password.",
  },
  {
    pattern: /email not confirmed/i,
    message: "Please confirm your email — check your inbox for the confirmation link.",
  },
  {
    pattern: /user already registered/i,
    message: "An account with this email already exists. Try signing in instead.",
  },
  {
    pattern: /password should be at least/i,
    message: "Password must be at least 6 characters long.",
  },
  {
    pattern: /rate limit|too many requests|request rate/i,
    message: "Too many attempts. Please wait a minute and try again.",
  },
  {
    pattern: /network|fetch|failed to fetch|ERR_NETWORK/i,
    message: "Something went wrong. Please check your connection and try again.",
  },
];

export function mapAuthError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  for (const { pattern, message } of AUTH_ERROR_MAP) {
    if (pattern.test(raw)) return message;
  }

  return "Something went wrong. Please try again.";
}
