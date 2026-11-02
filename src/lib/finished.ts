/**
 * A title counts as finished once the viewer is in its final stretch
 * (usually the credits): the last 10%, or the last 8 minutes for anything
 * over 40 minutes — whichever starts earlier.
 */
export function isFinished(positionSeconds: number, durationSeconds: number | null | undefined): boolean {
  if (!durationSeconds || durationSeconds <= 0) return false;
  const tail = durationSeconds > 40 * 60 ? Math.max(durationSeconds * 0.1, 8 * 60) : durationSeconds * 0.1;
  return positionSeconds >= durationSeconds - tail;
}
