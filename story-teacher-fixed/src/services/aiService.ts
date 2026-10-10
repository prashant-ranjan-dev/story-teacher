import {
  AdaptiveLearningLoopResponse,
  AnswerEvaluationRequest,
  EvaluationResult,
  IMAGE_KEYS,
  InteractiveQuestion,
  Story,
  StoryGenerationRequest,
} from '../types/story';
import { evaluateAnswerLocally } from '../utils/answerAnalysis';
import { buildFallbackStory } from '../utils/fallbackStory';
import { slugifyTopic } from '../utils/topic';

/** Thrown when the server rejects a topic as unsuitable; the UI shows `message` to the student. */
export class TopicNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TopicNotAllowedError';
  }
}

export interface AIService {
  generateStory(request: StoryGenerationRequest): Promise<Story>;
  evaluateAnswer(request: AnswerEvaluationRequest, questionContext?: InteractiveQuestion): Promise<EvaluationResult>;
}

const STORY_TIMEOUT_MS = 120_000;
const EVAL_TIMEOUT_MS = 30_000;

async function postJson(url: string, body: unknown, timeoutMs: number): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function isUsableStory(s: unknown): s is Story {
  if (typeof s !== 'object' || s === null) return false;
  const story = s as Partial<Story>;
  return (
    typeof story.title === 'string' &&
    Array.isArray(story.sections) &&
    story.sections.length > 0 &&
    Array.isArray(story.finalChallenge) &&
    Array.isArray(story.learningObjectives) &&
    typeof story.nextRecommendedAdventure === 'object' &&
    story.nextRecommendedAdventure !== null
  );
}

class StoryTeacherAIService implements AIService {
  async generateStory(request: StoryGenerationRequest): Promise<Story> {
    try {
      const response = await postJson('/api/ai/generate-story', request, STORY_TIMEOUT_MS);
      if (response.status === 422) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new TopicNotAllowedError(data.error || "Let's pick a different topic.");
      }
      if (response.ok) {
        const data = (await response.json()) as { story?: unknown };
        if (isUsableStory(data.story)) {
          const story = data.story;
          return {
            ...story,
            id: story.id || `ai-story-${Date.now()}`,
            topicId: story.topicId || request.topicId || slugifyTopic(request.topic),
            classGrade: request.classGrade,
            imageKey: IMAGE_KEYS.includes(story.imageKey) ? story.imageKey : request.imageKey ?? 'solar_system',
          };
        }
      }
    } catch (err) {
      if (err instanceof TopicNotAllowedError) throw err;
      console.warn('Story generation unavailable, using offline story:', err);
    }
    return buildFallbackStory(request);
  }

  async evaluateAnswer(request: AnswerEvaluationRequest, questionContext?: InteractiveQuestion): Promise<EvaluationResult> {
    // Authored misconception rules answer instantly and offline.
    const local = evaluateAnswerLocally(request, questionContext);
    if (local.detectedMisconception) return local;

    try {
      const response = await postJson('/api/ai/evaluate-answer', request, EVAL_TIMEOUT_MS);
      if (response.ok) {
        const data = (await response.json()) as Partial<AdaptiveLearningLoopResponse>;
        if (data.evaluation?.headline && data.evaluation.status) {
          return {
            ...data.evaluation,
            difficultyAdjustment: data.difficultyAdjustment ?? data.evaluation.difficultyAdjustment,
            nextAdaptiveNarrative: data.adaptiveTransitionSnippet ?? data.evaluation.nextAdaptiveNarrative,
          };
        }
      }
    } catch (err) {
      console.warn('Evaluation service unavailable, using local evaluation:', err);
    }
    return local;
  }
}

export const aiService = new StoryTeacherAIService();
