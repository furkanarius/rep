/** Epley estimated one-rep max, reps capped at 12 (higher reps are unreliable). */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  const r = Math.min(reps, 12);
  return weight * (1 + r / 30);
}

/** Inverse Epley: the weight you could lift for `reps` given an e1RM. */
export function weightForReps(oneRm: number, reps: number): number {
  if (reps <= 1) return oneRm;
  return oneRm / (1 + Math.min(reps, 12) / 30);
}
