export type ClassGrade = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type ImageKey = 'hibernation' | 'photosynthesis' | 'water_cycle' | 'solar_system' | 'fractions';

export const IMAGE_KEYS: readonly ImageKey[] = [
  'hibernation',
  'photosynthesis',
  'water_cycle',
  'solar_system',
  'fractions',
];

export interface StudentProfile {
  id: string;
  name: string;
  classGrade: ClassGrade;
  interests: string[];
  favoriteSubjects: string[];
  avatar: string;
  xp: number;
  stars: number;
  streakDays: number;
  /** ISO date (YYYY-MM-DD) of the last day the student completed an adventure; drives the streak. */
  lastActiveDate?: string;
}

export interface LearningObjective {
  id: string;
  text: string;
  conceptTag: string;
}

export interface CurriculumTopic {
  id: string;
  classGrades: ClassGrade[];
  subject: 'Science' | 'Social Science' | 'Mathematics' | 'English';
  domain: string;
  topic: string;
  engagingTitle: string;
  hookDescription: string;
  estimatedMinutes: number;
  imageKey: ImageKey;
  learningObjectives: LearningObjective[];
  nextRecommendedTopicId?: string;
}

export type QuestionFormat = 'multiple_choice' | 'true_false' | 'short_answer';

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
  feedback: string;
  misconceptionTag?: string;
  remedialStory?: string;
  remedialQuestion?: {
    prompt: string;
    options: { id: string; label: string; text: string; isCorrect: boolean; feedback: string }[];
  };
}

export interface InteractiveQuestion {
  id: string;
  format: QuestionFormat;
  conceptTag: string;
  prompt: string;
  contextHint?: string;
  options?: QuestionOption[];
  expectedKeywords?: string[];
  sampleIdealAnswer?: string;
  constructiveExplanation: string;
  commonMisconceptions?: {
    triggerKeywords: string[];
    misconceptionSummary: string;
    correctConceptExplanation: string;
    /** Optional kid-friendly analogy shown to Class 3-5 learners. */
    analogyYounger?: string;
    /** Optional more precise explanation shown to Class 6+ learners. */
    analogyOlder?: string;
    followUpQuestion?: {
      prompt: string;
      options: { id: string; label: string; text: string; isCorrect: boolean; feedback: string }[];
    };
  }[];
}

export interface StorySection {
  id: string;
  type: 'story' | 'question' | 'interactive_concept';
  chapterHeading?: string;
  narrative?: string;
  characterName?: string;
  characterDialogue?: string;
  illustrationCaption?: string;
  interactiveParameter?: {
    label: string;
    unit: string;
    min: number;
    max: number;
    defaultValue: number;
    /** Optional captions under the slider (left / middle / right). */
    minLabel?: string;
    midLabel?: string;
    maxLabel?: string;
    stages: {
      threshold: number;
      stateLabel: string;
      description: string;
      metricLabel: string;
      metricValue: string;
    }[];
  };
  question?: InteractiveQuestion;
}

export interface Story {
  id: string;
  topicId: string;
  title: string;
  topic: string;
  subject: string;
  classGrade: ClassGrade;
  protagonist: string;
  imageKey: ImageKey;
  coverImageUrl?: string;
  imagePrompt?: string;
  isAiGenerated?: boolean;
  /** Where the story came from, so the UI can be honest about it. */
  source?: 'curated' | 'ai' | 'offline';
  learningObjectives: string[];
  sections: StorySection[];
  finalChallenge: InteractiveQuestion[];
  nextRecommendedAdventure: {
    topicId: string;
    title: string;
    topic: string;
    hook: string;
  };
}

export type EvaluationStatus = 'correct' | 'partially_correct' | 'needs_adaptation';

export type DifficultyAdjustment = 'stepped_down' | 'maintained' | 'stepped_up';

export interface EvaluationResult {
  status: EvaluationStatus;
  headline: string;
  explanation: string;
  conceptTag: string;
  scoreDelta: number;
  difficultyAdjustment?: DifficultyAdjustment;
  nextAdaptiveNarrative?: string;
  detectedMisconception?: {
    misconception: string;
    correctConcept: string;
  };
  simplifiedExplanation?: string;
  followUpQuestion?: {
    prompt: string;
    options: { id: string; label: string; text: string; isCorrect: boolean; feedback: string }[];
  };
}

export interface ConceptMasteryItem {
  conceptTag: string;
  status: 'Strong' | 'Practice More' | 'Developing';
  score: number;
}

export interface TopicMasteryRecord {
  topicId: string;
  topic: string;
  title: string;
  subject: string;
  understandingScore: number;
  timeSpentMinutes: number;
  /** ISO-8601 timestamp. Format for display with formatRelativeDate(). */
  completedAt: string;
  concepts: ConceptMasteryItem[];
  detectedMisconceptions: {
    misconception: string;
    correctConcept: string;
  }[];
}

export interface InProgressSession {
  topicId: string;
  title: string;
  topic: string;
  subject: string;
  progressPercent: number;
  currentSectionIndex: number;
  imageKey: ImageKey;
  /** Stored for generated (non-curated) stories so they can be resumed exactly. */
  storySnapshot?: Story;
  /** Answers recorded so far, so resuming does not lose mastery data. */
  progress?: SessionProgress;
}

export interface SessionProgress {
  conceptScores: Record<string, number[]>;
  detectedMisconceptions: { misconception: string; correctConcept: string }[];
  answeredQuestionIds: string[];
  elapsedSeconds: number;
}

export interface StoryGenerationRequest {
  studentName: string;
  classGrade: ClassGrade;
  interests: string[];
  topic: string;
  subject?: string;
  learningObjectives?: string[];
  previousUnderstanding?: number;
  /** Set when the story is for a curriculum topic so mastery records stay linked to it. */
  topicId?: string;
  imageKey?: ImageKey;
  nextTopicId?: string;
}

export interface AnswerEvaluationRequest {
  classGrade: ClassGrade;
  topic: string;
  conceptTag: string;
  questionPrompt: string;
  studentAnswer: string;
  expectedConcept: string;
  currentDifficulty?: 'elementary' | 'standard' | 'advanced';
  priorAnswersSummary?: string;
}

export interface AdaptiveLearningLoopResponse {
  evaluation: EvaluationResult;
  difficultyAdjustment: DifficultyAdjustment;
  adaptiveTransitionSnippet: string;
  source: 'ai' | 'rule_based';
}

/** Shape persisted to localStorage (versioned so it can be migrated later). */
export interface PersistedAppState {
  version: 2;
  profile: StudentProfile;
  inProgress: InProgressSession[];
  mastery: TopicMasteryRecord[];
}
