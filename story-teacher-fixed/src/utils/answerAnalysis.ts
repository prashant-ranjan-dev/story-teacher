import type {
  AnswerEvaluationRequest,
  EvaluationResult,
  InteractiveQuestion,
} from '../types/story';

const NEGATIONS = new Set([
  'not', 'no', 'never', 'isnt', 'arent', 'dont', 'doesnt', 'didnt', 'wasnt', 'werent',
  'cant', 'cannot', 'wont', 'without', 'nor', 'neither', 'nothing',
]);

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'has', 'are', 'was', 'were', 'what',
  'why', 'how', 'does', 'did', 'your', 'you', 'they', 'them', 'their', 'then', 'than', 'into',
  'about', 'which', 'when', 'where', 'while', 'would', 'could', 'should', 'there', 'these', 'those',
  'its', 'also', 'can', 'will', 'just', 'like', 'very', 'more', 'most', 'some', 'any', 'because',
]);

/** Lower-cases, normalises curly apostrophes, and splits into word tokens (apostrophes removed). */
export function tokenize(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Very small stemmer so "saves", "saving" and "saved" all match "save". */
export function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w.endsWith('e') && w.length > 3 ? w.slice(0, -1) : w;
}

/**
 * True when one of the trigger words appears in the answer and is NOT negated
 * within the three preceding words. "He is not lazy, he saves energy" no longer
 * counts as the "lazy" misconception.
 */
export function containsUnnegated(answer: string, triggers: string[]): boolean {
  const tokens = tokenize(answer);
  const stemmedTriggers = triggers.map((t) => stem(tokenize(t)[0] ?? t.toLowerCase()));
  return tokens.some((tok, i) => {
    if (!stemmedTriggers.includes(stem(tok))) return false;
    const window = tokens.slice(Math.max(0, i - 3), i);
    return !window.some((w) => NEGATIONS.has(w));
  });
}

/** Pulls meaningful keywords out of free text (used when a question has no expectedKeywords). */
export function extractKeywords(...texts: string[]): string[] {
  const seen = new Set<string>();
  for (const text of texts) {
    for (const tok of tokenize(text)) {
      if (tok.length >= 4 && !STOPWORDS.has(tok)) seen.add(stem(tok));
    }
  }
  return Array.from(seen);
}

export function matchKeywords(answer: string, keywords: string[]): string[] {
  const answerStems = new Set(tokenize(answer).map(stem));
  const matched = new Set<string>();
  for (const kw of keywords) {
    const s = stem(tokenize(kw)[0] ?? kw.toLowerCase());
    if (answerStems.has(s)) matched.add(s);
  }
  return Array.from(matched);
}

/** Catches empty, keyboard-mash and one-word answers before they earn credit. */
export function isLowEffortAnswer(answer: string): boolean {
  const tokens = tokenize(answer);
  if (tokens.length < 3) return true;
  const letters = answer.replace(/[^\p{L}]/gu, '');
  if (letters.length < 8) return true;
  if (/(.)\1{4,}/u.test(answer)) return true;
  const vowelLike = (answer.match(/[aeiouyAEIOUY\u0900-\u0DFF\u0B80-\u0BFF]/gu) ?? []).length;
  return vowelLike / Math.max(1, letters.length) < 0.15;
}

export function clampScore(n: unknown, fallback = 70): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Topic-agnostic local evaluation used by both the browser and the server when no AI is available.
 * Contains no topic-specific story text (the old fallback talked about a bear in every subject).
 */
export function evaluateAnswerLocally(
  request: AnswerEvaluationRequest,
  question?: InteractiveQuestion
): EvaluationResult {
  const answer = request.studentAnswer;
  const younger = request.classGrade <= 5;

  for (const m of question?.commonMisconceptions ?? []) {
    if (containsUnnegated(answer, m.triggerKeywords)) {
      const simplified = younger
        ? m.analogyYounger ?? m.correctConceptExplanation
        : m.analogyOlder ?? m.correctConceptExplanation;
      return {
        status: 'needs_adaptation',
        headline: "Let's look at this another way.",
        explanation: m.correctConceptExplanation,
        conceptTag: request.conceptTag,
        scoreDelta: 58,
        difficultyAdjustment: 'stepped_down',
        detectedMisconception: {
          misconception: m.misconceptionSummary,
          correctConcept: m.correctConceptExplanation,
        },
        simplifiedExplanation: simplified,
        followUpQuestion: m.followUpQuestion,
      };
    }
  }

  const keywords =
    question?.expectedKeywords && question.expectedKeywords.length > 0
      ? question.expectedKeywords
      : extractKeywords(request.expectedConcept, request.conceptTag);
  const matched = matchKeywords(answer, keywords);
  const explanationText = question?.constructiveExplanation || request.expectedConcept;
  const wordCount = tokenize(answer).length;

  if (!isLowEffortAnswer(answer) && matched.length >= 2 && wordCount >= 5) {
    return {
      status: 'correct',
      headline: 'Great discovery!',
      explanation: explanationText,
      conceptTag: request.conceptTag,
      scoreDelta: 90,
      difficultyAdjustment: 'maintained',
    };
  }

  if (!isLowEffortAnswer(answer) && matched.length >= 1) {
    return {
      status: 'partially_correct',
      headline: "You're on the right track!",
      explanation: `You mentioned an important piece of the puzzle! To make your explanation complete, remember: ${explanationText}`,
      conceptTag: request.conceptTag,
      scoreDelta: 74,
      difficultyAdjustment: 'maintained',
      simplifiedExplanation: question?.sampleIdealAnswer,
    };
  }

  const ideal = question?.sampleIdealAnswer || request.expectedConcept;
  return {
    status: 'needs_adaptation',
    headline: isLowEffortAnswer(answer) ? 'Try a full sentence!' : "Let's look at this another way.",
    explanation: isLowEffortAnswer(answer)
      ? `Write a sentence or two in your own words. Here is a clue to help: ${explanationText}`
      : explanationText,
    conceptTag: request.conceptTag,
    scoreDelta: 60,
    difficultyAdjustment: 'stepped_down',
    simplifiedExplanation: ideal,
    followUpQuestion: ideal
      ? {
          prompt: `Which idea best explains "${request.conceptTag}"?`,
          options: [
            { id: 'local-fu-a', label: 'A', text: ideal, isCorrect: true, feedback: 'Great discovery! That is the key idea.' },
            {
              id: 'local-fu-b',
              label: 'B',
              text: 'It happens randomly, with no cause or pattern behind it.',
              isCorrect: false,
              feedback: "Not quite. In science and maths there is always a reason or a pattern behind what happens.",
            },
          ],
        }
      : undefined,
  };
}
