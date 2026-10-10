import type { ImageKey } from '../types/story';

/** Small, stable, dependency-free string hash (djb2) → base36. */
export function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** Lower-cases, strips trailing "?" and collapses punctuation/whitespace (Unicode-aware). */
export function canonicalTopic(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Builds a stable topic id.
 *
 * The previous implementation stripped everything outside [a-z0-9], so every Tamil / Hindi /
 * Arabic topic collapsed to the same id ("topic--") and shared one cached cover image.
 * A short hash of the canonical text is always appended so ids never collide.
 */
export function slugifyTopic(raw: string): string {
  const canonical = canonicalTopic(raw);
  const ascii = canonical
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  const hash = hashString(canonical || raw).slice(0, 5);
  return `custom-${ascii ? `${ascii}-` : ''}${hash}`;
}

/** Strips a trailing question mark and surrounding whitespace. */
export function cleanTopicName(raw: string): string {
  return raw.trim().replace(/\?+$/, '').trim();
}

const IMAGE_KEY_RULES: { key: ImageKey; pattern: RegExp }[] = [
  { key: 'hibernation', pattern: /\b(bears?|hibernat\w*|animals?|winter|migrat\w*|wildlife|mammals?)\b/ },
  { key: 'photosynthesis', pattern: /\b(plants?|leaf|leaves|trees?|photosynthesis|flowers?|seeds?|roots?|forests?)\b/ },
  { key: 'water_cycle', pattern: /\b(rain\w*|water|clouds?|ocean\w*|sea|rivers?|volcano\w*|earth\w*|weather|monsoon)\b/ },
  { key: 'fractions', pattern: /\b(fractions?|maths?|mathematics|numbers?|shapes?|ratios?|algebra|geometry|angles?)\b/ },
];

/** Whole-word matching, so "wheat" no longer matches "heat" and "stairs" no longer matches "air". */
export function inferImageKey(topic: string): ImageKey {
  const t = topic.toLowerCase();
  for (const rule of IMAGE_KEY_RULES) {
    if (rule.pattern.test(t)) return rule.key;
  }
  return 'solar_system';
}
