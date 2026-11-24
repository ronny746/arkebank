// Shared by the paper-generation API and Paper Studio so the browser predicts
// exactly the per-level counts the server will sample.

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export const DIFFICULTY_LEVELS: DifficultyLevel[] = ['easy', 'medium', 'hard'];

export type LevelAvailability = { needed: number; available: number };
export type DifficultyAvailability = {
  requested: number;
  levels: Record<DifficultyLevel, LevelAvailability>;
};

/**
 * Largest-remainder allocation: turns integer percentages into question counts
 * that always sum to `count`.
 */
export function allocateDifficultyTargets(count: number, ratios: number[]): number[] {
  const exact = ratios.map((ratio) => (count * ratio) / 100);
  const targets = exact.map(Math.floor);
  let remaining = count - targets.reduce((sum, target) => sum + target, 0);
  [...exact.keys()]
    .sort((a, b) => (exact[b] - Math.floor(exact[b])) - (exact[a] - Math.floor(exact[a])))
    .forEach((index) => {
      if (remaining > 0) { targets[index] += 1; remaining -= 1; }
    });
  return targets;
}

/**
 * Finds the integer split (summing to 100) closest to the teacher's split whose
 * per-level counts all fit what the scope actually has. Returns null when the
 * scope cannot fill `count` questions at all.
 *
 * Brute force is intentional: 5,151 candidate splits × 3 levels is trivial and
 * guarantees the result round-trips through allocateDifficultyTargets exactly
 * (a proportional formula can be off by one after rounding).
 */
export function fitSplitToAvailability(
  count: number,
  desired: [number, number, number],
  available: [number, number, number],
): [number, number, number] | null {
  if (available.reduce((sum, value) => sum + value, 0) < count) return null;
  let best: [number, number, number] | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let easy = 0; easy <= 100; easy += 1) {
    for (let medium = 0; medium <= 100 - easy; medium += 1) {
      const split: [number, number, number] = [easy, medium, 100 - easy - medium];
      const targets = allocateDifficultyTargets(count, split);
      if (targets.some((target, index) => target > available[index])) continue;
      const distance = split.reduce((sum, value, index) => sum + Math.abs(value - desired[index]), 0);
      if (distance < bestDistance) { best = split; bestDistance = distance; }
    }
  }
  return best;
}

export function hasShortfall(availability: DifficultyAvailability): boolean {
  return DIFFICULTY_LEVELS.some((level) => availability.levels[level].available < availability.levels[level].needed);
}
