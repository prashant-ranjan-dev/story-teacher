import type { AnswerEvaluationRequest, ClassGrade, StoryGenerationRequest } from '../src/types/story';
import { IMAGE_KEYS } from '../src/types/story';

export class ValidationError extends Error {
  readonly status = 400;
}

/** Thrown when a topic is rejected by the safety pre-check. Mapped to HTTP 422. */
export class TopicNotAllowedError extends Error {
  readonly status = 422;
  constructor() {
    super("Let's pick a different topic. Try asking about science, maths, nature or history!");
  }
}

const LIMITS = {
  name: 40,
  topic: 200,
  subject: 40,
  interest: 40,
  interests: 10,
  objective: 300,
  objectives: 8,
  id: 120,
  answer: 1000,
  prompt: 800,
  concept: 300,
  summary: 600,
};

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function cleanText(value: unknown, field: string, max: number, required = true): string {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} is required`);
    return '';
  }
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
  const text = value.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();
  if (required && !text) throw new ValidationError(`${field} is required`);
  if (text.length > max) throw new ValidationError(`${field} must be at most ${max} characters`);
  return text;
}

function cleanList(value: unknown, field: string, maxItems: number, maxLen: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array`);
  return value.slice(0, maxItems).map((v, i) => cleanText(v, `${field}[${i}]`, maxLen, false)).filter(Boolean);
}

function parseGrade(value: unknown): ClassGrade {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 3 || n > 10) {
    throw new ValidationError('classGrade must be a whole number from 3 to 10');
  }
  return n as ClassGrade;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

/**
 * Conservative stop-gap for a children's product. It is NOT a substitute for real moderation
 * (see README "Known gaps"), and is intentionally narrow so legitimate curriculum topics such as
 * "sexual reproduction in plants" are not blocked.
 */
const BLOCKED_TOPIC_PATTERNS: RegExp[] = [
  /\b(porn\w*|nudes?|naked|erotic\w*|rape|rapist)\b/i,
  /\b(suicid\w*|self[- ]?harm|kill (my|your)self)\b/i,
  /\b(make|build|making|building)\b.{0,20}\b(bomb|explosive|gun|weapon|poison)s?\b/i,
  /\b(cocaine|heroin|methamphetamine)\b/i,
];

export function isTopicAllowed(topic: string): boolean {
  return !BLOCKED_TOPIC_PATTERNS.some((re) => re.test(topic));
}

export function parseStoryRequest(body: unknown): StoryGenerationRequest {
  const b = asRecord(body);
  const topic = cleanText(b.topic, 'topic', LIMITS.topic);
  if (!isTopicAllowed(topic)) throw new TopicNotAllowedError();

  const imageKey = typeof b.imageKey === 'string' && (IMAGE_KEYS as readonly string[]).includes(b.imageKey)
    ? (b.imageKey as StoryGenerationRequest['imageKey'])
    : undefined;

  return {
    studentName: cleanText(b.studentName, 'studentName', LIMITS.name, false) || 'Explorer',
    classGrade: parseGrade(b.classGrade),
    interests: cleanList(b.interests, 'interests', LIMITS.interests, LIMITS.interest),
    topic,
    subject: cleanText(b.subject, 'subject', LIMITS.subject, false) || undefined,
    learningObjectives: cleanList(b.learningObjectives, 'learningObjectives', LIMITS.objectives, LIMITS.objective),
    topicId: cleanText(b.topicId, 'topicId', LIMITS.id, false) || undefined,
    nextTopicId: cleanText(b.nextTopicId, 'nextTopicId', LIMITS.id, false) || undefined,
    imageKey,
  };
}

export function parseEvaluationRequest(body: unknown): AnswerEvaluationRequest {
  const b = asRecord(body);
  const difficulty = b.currentDifficulty;
  return {
    classGrade: parseGrade(b.classGrade),
    topic: cleanText(b.topic, 'topic', LIMITS.topic),
    conceptTag: cleanText(b.conceptTag, 'conceptTag', LIMITS.concept),
    questionPrompt: cleanText(b.questionPrompt, 'questionPrompt', LIMITS.prompt),
    studentAnswer: cleanText(b.studentAnswer, 'studentAnswer', LIMITS.answer),
    expectedConcept: cleanText(b.expectedConcept, 'expectedConcept', LIMITS.prompt),
    currentDifficulty:
      difficulty === 'elementary' || difficulty === 'standard' || difficulty === 'advanced' ? difficulty : undefined,
    priorAnswersSummary: cleanText(b.priorAnswersSummary, 'priorAnswersSummary', LIMITS.summary, false) || undefined,
  };
}
