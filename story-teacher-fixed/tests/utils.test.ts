import { describe, expect, it } from 'vitest';
import { slugifyTopic, inferImageKey } from '../src/utils/topic';
import { containsUnnegated, evaluateAnswerLocally, isLowEffortAnswer, stem } from '../src/utils/answerAnalysis';
import { formatRelativeDate, daysBetweenKeys } from '../src/utils/format';
import { shuffleOptions } from '../src/utils/shuffle';
import { buildFallbackStory } from '../src/utils/fallbackStory';
import { pickNextAdventure } from '../src/data/curriculumData';

describe('slugifyTopic', () => {
  it('gives non-Latin topics distinct ids (previously all became "topic--")', () => {
    const a = slugifyTopic('மழை எப்படி வருகிறது?');
    const b = slugifyTopic('ज्वालामुखी क्यों फटता है?');
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^custom-/);
  });
  it('is stable and ignores case, punctuation and trailing "?"', () => {
    expect(slugifyTopic('Why do volcanoes erupt?')).toEqual(slugifyTopic('why do volcanoes erupt'));
  });
});

describe('inferImageKey', () => {
  it('matches whole words only', () => {
    expect(inferImageKey('Why is the wheat field golden?')).toBe('solar_system'); // not "heat"/"water"
    expect(inferImageKey('How do plants make food?')).toBe('photosynthesis');
    expect(inferImageKey('Where does rain come from?')).toBe('water_cycle');
  });
});

describe('negation-aware misconception detection', () => {
  const triggers = ['lazy', 'bored', 'tired', 'sleepy'];
  it('flags the misconception', () => expect(containsUnnegated('Bears hibernate because they are lazy', triggers)).toBe(true));
  it('does not flag negated statements', () => {
    expect(containsUnnegated('He is not lazy, he saves energy', triggers)).toBe(false);
    expect(containsUnnegated("Bears aren't lazy", triggers)).toBe(false);
  });
  it('stems consistently', () => expect(stem('saving')).toBe(stem('saves')));
});

describe('evaluateAnswerLocally', () => {
  const req = {
    classGrade: 5 as const,
    topic: 'Food Chains',
    conceptTag: 'Energy flow in ecosystems',
    questionPrompt: 'How does energy move through a food chain?',
    expectedConcept: 'Energy flows from producers to consumers when one organism eats another.',
    studentAnswer: '',
  };
  it('never mentions bears for another topic', () => {
    const r = evaluateAnswerLocally({ ...req, studentAnswer: 'I am tired but energy moves when animals eat plants' });
    expect(JSON.stringify(r)).not.toMatch(/Barnaby|bear|hibernat/i);
    expect(r.detectedMisconception).toBeUndefined();
  });
  it('rejects gibberish and one-word answers', () => {
    expect(isLowEffortAnswer('asdfghjkl')).toBe(true);
    expect(evaluateAnswerLocally({ ...req, studentAnswer: 'aaaaaaaaaaaa' }).status).toBe('needs_adaptation');
  });
  it('credits a good answer without hibernation keywords', () => {
    const r = evaluateAnswerLocally({ ...req, studentAnswer: 'Energy flows from producers to consumers when animals eat plants' });
    expect(r.status).toBe('correct');
  });
});

describe('misc helpers', () => {
  it('formats relative dates', () => {
    const now = new Date('2026-10-10T12:00:00');
    expect(formatRelativeDate('2026-10-10T08:00:00', now)).toBe('Today');
    expect(formatRelativeDate('2026-10-09T08:00:00', now)).toBe('Yesterday');
    expect(formatRelativeDate('2026-10-07T08:00:00', now)).toBe('3 days ago');
    expect(daysBetweenKeys('2026-10-09', '2026-10-10')).toBe(1);
  });
  it('shuffles deterministically, keeps one correct option, relabels', () => {
    const opts = [
      { id: 'a', label: 'A', text: 'x', isCorrect: true },
      { id: 'b', label: 'B', text: 'y', isCorrect: false },
      { id: 'c', label: 'C', text: 'z', isCorrect: false },
    ];
    const one = shuffleOptions(opts, 'seed');
    expect(one).toEqual(shuffleOptions(opts, 'seed'));
    expect(one.map((o) => o.label)).toEqual(['A', 'B', 'C']);
    expect(one.filter((o) => o.isCorrect)).toHaveLength(1);
    expect(shuffleOptions(opts, 'seed', true)).toBe(opts);
  });
  it('fallback story is flagged offline and has a valid next adventure', () => {
    const s = buildFallbackStory({ studentName: 'Asha', classGrade: 5, interests: [], topic: 'Why is the sky blue?' });
    expect(s.source).toBe('offline');
    expect(s.isAiGenerated).toBe(false);
    expect(s.nextRecommendedAdventure.topicId).toBeTruthy();
  });
  it('pickNextAdventure never returns the current topic', () => {
    expect(pickNextAdventure(5, 'sci-hibernation').topicId).not.toBe('sci-hibernation');
  });
});
