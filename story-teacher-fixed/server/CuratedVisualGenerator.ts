/**
 * Curated educational SVG cover generator.
 * Used when AI image generation is unavailable, slow, or rate-limited.
 *
 * Fixes over the original:
 *  - all text is XML-escaped (an "&" in a topic or category tag used to produce invalid SVG,
 *    so the cover rendered as a broken image);
 *  - themes are matched on whole words ("wheat" no longer matches "heat", "stairs" no longer matches "air");
 *  - long titles are wrapped / truncated instead of running off the canvas;
 *  - each theme's own background colours are actually used (they were computed and then ignored).
 */

interface Theme {
  pattern: RegExp;
  bg: [string, string];
  accent: string;
  tag: string;
  icon: string;
}

const THEMES: Theme[] = [
  {
    pattern: /\b(volcano\w*|lava|magma|eruption|erupt\w*|earthquake\w*)\b/,
    bg: ['#450a0a', '#1c1917'],
    accent: '#ef4444',
    tag: 'Earth Science · Restless Earth',
    icon: `
      <path d="M400 350 L500 180 L520 180 L620 350 Z" fill="#7f1d1d" opacity="0.8"/>
      <path d="M450 350 L510 200 L570 350 Z" fill="#b91c1c" opacity="0.9"/>
      <circle cx="510" cy="170" r="30" fill="#f97316" opacity="0.6"/>
      <circle cx="510" cy="160" r="16" fill="#fbbf24"/>
      <path d="M500 170 Q480 130 460 110" stroke="#f97316" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M520 170 Q550 120 570 100" stroke="#f59e0b" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  },
  {
    pattern: /\b(bears?|hibernat\w*|animals?|winter|wildlife|mammals?)\b/,
    bg: ['#1c1917', '#292524'],
    accent: '#d97706',
    tag: 'Biology · Animal Adaptations',
    icon: `
      <circle cx="512" cy="220" r="80" fill="#78350f" opacity="0.8"/>
      <circle cx="450" cy="160" r="30" fill="#92400e"/>
      <circle cx="574" cy="160" r="30" fill="#92400e"/>
      <ellipse cx="512" cy="245" rx="42" ry="32" fill="#b45309"/>
      <circle cx="512" cy="235" r="12" fill="#1c1917"/>
      <circle cx="482" cy="195" r="8" fill="#1c1917"/>
      <circle cx="542" cy="195" r="8" fill="#1c1917"/>`,
  },
  {
    pattern: /\b(space|orbits?|planets?|stars?|gravity|moon|sun|galax\w*|solar|universe)\b/,
    bg: ['#090d16', '#1e1b4b'],
    accent: '#38bdf8',
    tag: 'Astronomy · Space',
    icon: `
      <circle cx="512" cy="220" r="65" fill="#38bdf8" opacity="0.9"/>
      <ellipse cx="512" cy="220" rx="140" ry="35" fill="none" stroke="#e0f2fe" stroke-width="6" transform="rotate(-20 512 220)"/>
      <circle cx="360" cy="120" r="4" fill="#ffffff"/>
      <circle cx="680" cy="150" r="5" fill="#ffffff"/>
      <circle cx="620" cy="290" r="3" fill="#ffffff"/>
      <circle cx="390" cy="310" r="4" fill="#ffffff"/>`,
  },
  {
    pattern: /\b(plants?|leaf|leaves|photosynthesis|trees?|flowers?|seeds?|roots?)\b/,
    bg: ['#052e16', '#064e3b'],
    accent: '#10b981',
    tag: 'Botany · Plant Life',
    icon: `
      <path d="M512 120 Q620 180 570 320 Q480 340 460 270 Q440 180 512 120 Z" fill="#10b981" opacity="0.9"/>
      <path d="M512 140 L512 330" stroke="#065f46" stroke-width="4" stroke-linecap="round"/>
      <path d="M512 200 Q540 190 560 170" stroke="#065f46" stroke-width="3" fill="none"/>
      <path d="M512 250 Q480 240 465 220" stroke="#065f46" stroke-width="3" fill="none"/>`,
  },
  {
    pattern: /\b(water|rain\w*|oceans?|seas?|rivers?|clouds?|monsoon|salty|salt|weather)\b/,
    bg: ['#082f49', '#0c4a6e'],
    accent: '#38bdf8',
    tag: 'Earth Science · Water',
    icon: `
      <path d="M512 130 C450 220 440 270 440 300 C440 340 472 370 512 370 C552 370 584 340 584 300 C584 270 574 220 512 130 Z" fill="#38bdf8" opacity="0.85"/>
      <circle cx="490" cy="270" r="16" fill="#e0f2fe" opacity="0.4"/>`,
  },
  {
    pattern: /\b(air|airplanes?|planes?|aeroplanes?|fly\w*|flight|birds?|sky|wind|lift)\b/,
    bg: ['#0f172a', '#1e3a8a'],
    accent: '#60a5fa',
    tag: 'Physics · Flight & Forces',
    icon: `
      <path d="M512 130 L540 230 L660 280 L540 290 L530 350 L512 330 L494 350 L484 290 L364 280 L484 230 Z" fill="#93c5fd" opacity="0.9"/>`,
  },
  {
    pattern: /\b(fractions?|maths?|mathematics|numbers?|ratios?|shapes?|algebra|geometry|angles?|percent\w*)\b/,
    bg: ['#1e1b4b', '#312e81'],
    accent: '#fbbf24',
    tag: 'Mathematics · Numbers & Patterns',
    icon: `
      <circle cx="430" cy="220" r="65" fill="#f59e0b" opacity="0.85"/>
      <path d="M570 155 A 65 65 0 0 1 635 220 L 570 220 Z" fill="#fbbf24"/>
      <path d="M570 220 L 635 220 A 65 65 0 0 1 570 285 Z" fill="#d97706"/>
      <line x1="390" y1="320" x2="630" y2="320" stroke="#fcd34d" stroke-width="6" stroke-linecap="round"/>
      <circle cx="510" cy="220" r="12" fill="#ffffff" opacity="0.4"/>`,
  },
  {
    pattern: /\b(electric\w*|electron\w*|circuits?|energy|atoms?|magnets?|magnetic|magnetism|current|battery)\b/,
    bg: ['#0f172a', '#1e293b'],
    accent: '#38bdf8',
    tag: 'Physics · Energy',
    icon: `
      <polygon points="512,120 460,230 520,230 480,330 560,200 500,200" fill="#38bdf8"/>
      <circle cx="512" cy="220" r="75" stroke="#0284c7" stroke-width="3" stroke-dasharray="8 6" fill="none"/>`,
  },
  {
    pattern: /\b(hearts?|body|blood|lungs?|cells?|brain|bones?|digest\w*|muscles?)\b/,
    bg: ['#450a0a', '#2a0808'],
    accent: '#f87171',
    tag: 'Biology · The Human Body',
    icon: `
      <path d="M512 310 C420 230 380 180 430 140 C470 110 512 170 512 170 C512 170 554 110 594 140 C644 180 604 230 512 310 Z" fill="#ef4444" opacity="0.9"/>
      <path d="M420 220 L470 220 L485 190 L510 260 L535 200 L550 220 L600 220" stroke="#fecaca" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
];

const DEFAULT_THEME: Theme = {
  pattern: /$^/,
  bg: ['#1c1917', '#312e81'],
  accent: '#a855f7',
  tag: 'Curiosity Quest · Discovery',
  icon: `
    <circle cx="512" cy="220" r="85" fill="#a855f7" opacity="0.2"/>
    <circle cx="512" cy="220" r="50" fill="#a855f7" opacity="0.8"/>
    <path d="M512 130 L522 195 L587 205 L535 245 L555 310 L512 275 L469 310 L489 245 L437 205 L502 195 Z" fill="#facc15"/>`,
};

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Greedy word wrap into at most `maxLines` lines of `maxChars`; the last line gets an ellipsis if cut. */
export function wrapTitle(text: string, maxChars = 34, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = current ? `${current} ${words[i]}` : words[i];
    if (next.length <= maxChars || !current) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        i++;
        break;
      }
    }
  }
  const rest = [current, ...words.slice(i)].filter(Boolean).join(' ');
  if (rest) lines.push(rest.length > maxChars ? `${rest.slice(0, maxChars - 1).trimEnd()}…` : rest);
  return lines.slice(0, maxLines);
}

export function generateCuratedTopicSvg(topicName: string, classGrade: number): string {
  const lower = topicName.toLowerCase();
  const theme = THEMES.find((t) => t.pattern.test(lower)) ?? DEFAULT_THEME;
  const titleLines = wrapTitle(topicName);
  const [bgFrom, bgTo] = theme.bg;

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="64" y="${486 + i * 40}" font-family="Georgia, 'Noto Serif', 'Noto Serif Devanagari', 'Noto Serif Tamil', serif" font-size="32" font-weight="bold" fill="#ffffff">${escapeXml(line)}</text>`
    )
    .join('\n    ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 576" width="100%" height="100%" role="img" aria-label="${escapeXml(topicName)}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgFrom}" />
        <stop offset="100%" stop-color="${bgTo}" />
      </linearGradient>
      <linearGradient id="panel" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.75" />
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1" />
      </pattern>
    </defs>
    <rect width="1024" height="576" fill="url(#bg)" />
    <rect width="1024" height="576" fill="url(#grid)" />
    <g>${theme.icon}</g>
    <rect y="390" width="1024" height="186" fill="url(#panel)" />
    <text x="64" y="440" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="${theme.accent}" letter-spacing="1.5">${escapeXml(theme.tag.toUpperCase())} · CLASS ${Math.round(classGrade)}</text>
    ${titleSvg}
    <text x="64" y="560" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#a1a1aa">Story Teacher Interactive Adventure</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}
