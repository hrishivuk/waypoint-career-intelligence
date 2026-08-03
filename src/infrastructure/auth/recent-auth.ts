const DEFAULT_RECENT_AUTH_WINDOW_MS = 15 * 60 * 1000;

export function hasRecentSignIn(
  lastSignInAt: string | undefined,
  now = Date.now(),
  windowMs = DEFAULT_RECENT_AUTH_WINDOW_MS,
) {
  if (!lastSignInAt) return false;
  const signedInAt = Date.parse(lastSignInAt);
  return Number.isFinite(signedInAt)
    && signedInAt <= now
    && now - signedInAt <= windowMs;
}
