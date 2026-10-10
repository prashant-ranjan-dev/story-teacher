import { describe, expect, it } from 'vitest';
import { generateCuratedTopicSvg, wrapTitle } from '../server/CuratedVisualGenerator';
import { isTopicAllowed, parseEvaluationRequest, parseStoryRequest, ValidationError, TopicNotAllowedError } from '../server/validation';
import { normalizeGeneratedStory } from '../server/AdaptiveLearningService';

const decode = (u: string) => Buffer.from(u.split(',')[1], 'base64').toString();

describe('curated SVG', () => {
  it('escapes "&" so the SVG is valid XML (it used to break the image)', () => {
    const svg = decode(generateCuratedTopicSvg('Gravity & Planetary Orbits', 5));
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
    expect(svg).toContain('Gravity &amp; Planetary Orbits');
  });
  it('matches whole words only', () => {
    expect(decode(generateCuratedTopicSvg('Why is the wheat field golden?', 5))).not.toContain('Restless Earth');
    expect(decode(generateCuratedTopicSvg('How do stairs help repair work?', 5))).not.toContain('Flight');
  });
  it('wraps and truncates long titles', () => {
    const lines = wrapTitle('Why does the Ganges flow through many Indian states every single year without drying up');
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.every((l) => l.length <= 34)).toBe(true);
  });
});

describe('request validation', () => {
  const ok = { studentName: 'Asha', classGrade: 5, interests: ['Space'], topic: 'Why do volcanoes erupt?' };
  it('accepts a valid story request', () => expect(parseStoryRequest(ok).topic).toBe(ok.topic));
  it('rejects missing/invalid fields with 400-class errors', () => {
    expect(() => parseStoryRequest({})).toThrow(ValidationError);
    expect(() => parseStoryRequest({ ...ok, classGrade: 12 })).toThrow(ValidationError);
    expect(() => parseStoryRequest({ ...ok, topic: 'x'.repeat(500) })).toThrow(ValidationError);
    expect(() => parseEvaluationRequest(null)).toThrow(ValidationError);
  });
  it('blocks clearly unsuitable topics but not curriculum topics', () => {
    expect(() => parseStoryRequest({ ...ok, topic: 'how to make a bomb' })).toThrow(TopicNotAllowedError);
    expect(isTopicAllowed('Sexual reproduction in flowering plants')).toBe(true);
  });
});

describe('normalizeGeneratedStory', () => {
  const ctx = { topic: 'Rain', subject: 'Science', studentName: 'Asha' };
  const mc = (correct: number) => ({
    format: 'multiple_choice', conceptTag: 'c', prompt: 'p?', constructiveExplanation: 'e',
    options: [
      { label: 'A', text: 'a', isCorrect: correct === 1, feedback: 'f' },
      { label: 'B', text: 'b', isCorrect: correct === 0, feedback: 'f' },
    ],
  });
  const story = (q: unknown) => ({
    title: 'T', protagonist: 'P', learningObjectives: ['o'],
    sections: [{ type: 'story', narrative: 'A long enough narrative paragraph.' }, { type: 'question', question: q }],
    finalChallenge: [q],
  });
  it('accepts a well-formed story', () => expect(normalizeGeneratedStory(story(mc(1)), ctx)).not.toBeNull());
  it('keeps questions embedded in generated story sections', () => {
    const result = normalizeGeneratedStory({
      ...story(mc(1)),
      sections: [{ type: 'story', narrative: 'A long enough narrative paragraph.', question: mc(1) }],
    }, ctx);
    expect(result?.sections.map((section) => section.type)).toEqual(['story', 'question']);
  });
  it('rejects questions with zero or multiple correct options', () => {
    const none = { ...mc(1), options: mc(1).options.map((o) => ({ ...o, isCorrect: false })) };
    expect(normalizeGeneratedStory(story(none), ctx)).toBeNull();
  });
  it('rejects garbage', () => {
    expect(normalizeGeneratedStory(null, ctx)).toBeNull();
    expect(normalizeGeneratedStory({ title: 'x', sections: 'nope' }, ctx)).toBeNull();
  });
});
