import { hashString } from './topic';

/** Deterministic PRNG (mulberry32) so a question's option order is stable across re-renders. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffles answer options deterministically and re-labels them A, B, C…
 * Authored content and the fallback generator always put the right answer first,
 * which students learn to exploit within a few questions.
 * True/False questions are left in their natural order.
 */
export function shuffleOptions<T extends { label: string }>(
  options: T[],
  seedText: string,
  keepOrder = false
): T[] {
  if (keepOrder || options.length < 2) return options;
  const random = rng(parseInt(hashString(seedText), 36) || 1);
  const copy = [...options];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.map((o, i) => ({ ...o, label: String.fromCharCode(65 + i) }));
}
