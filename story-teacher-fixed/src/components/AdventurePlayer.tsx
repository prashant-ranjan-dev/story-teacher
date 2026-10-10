import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Story,
  StudentProfile,
  EvaluationResult,
  ConceptMasteryItem,
  TopicMasteryRecord,
  SessionProgress,
  QuestionOption,
} from '../types/story';
import { aiService } from '../services/aiService';
import { shuffleOptions } from '../utils/shuffle';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  HelpCircle,
  Lightbulb,
  Send,
  Sliders,
  Trophy,
} from 'lucide-react';

interface AdventurePlayerProps {
  story: Story;
  profile: StudentProfile;
  initialSectionIndex?: number;
  /** Answers/time from a previous visit, so resuming does not lose mastery data. */
  initialProgress?: SessionProgress;
  onExit: (progressPercent: number, currentSectionIndex: number, progress: SessionProgress) => void;
  onCompleteAdventure: (record: TopicMasteryRecord, nextTopicId?: string) => void;
  onStartAnotherTopic: (topicId: string) => void;
}

type FollowUpOption = { id: string; label: string; text: string; isCorrect: boolean; feedback: string };

const STRONG_THRESHOLD = 78;

function OptionButton({
  option,
  selected,
  disabled,
  onClick,
  size = 'md',
}: {
  option: Pick<QuestionOption, 'label' | 'text' | 'isCorrect'>;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const pad = size === 'lg' ? 'p-4' : size === 'sm' ? 'p-2.5' : 'p-3.5';
  const state = selected
    ? option.isCorrect
      ? 'bg-emerald-50 border-emerald-600 text-slate-900'
      : 'bg-amber-50 border-amber-600 text-slate-900'
    : 'bg-stone-50 border-stone-200/90 hover:bg-stone-100 text-slate-800';
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left ${pad} rounded-xl border text-sm transition-all flex items-start gap-3 cursor-pointer disabled:cursor-default ${state}`}
    >
      <span className="font-mono font-semibold text-xs px-2 py-0.5 rounded bg-white border border-stone-200 text-slate-700 shrink-0 mt-0.5">
        {option.label}
      </span>
      <span className="leading-snug">{option.text}</span>
    </button>
  );
}

export const AdventurePlayer: React.FC<AdventurePlayerProps> = ({
  story,
  profile,
  initialSectionIndex = 0,
  initialProgress,
  onExit,
  onCompleteAdventure,
  onStartAnotherTopic,
}) => {
  const [stage, setStage] = useState<'story' | 'challenge' | 'completed'>('story');
  const [sectionIdx, setSectionIdx] = useState(Math.min(initialSectionIndex, Math.max(0, story.sections.length - 1)));

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [shortAnswerText, setShortAnswerText] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  const [followUpSelectedId, setFollowUpSelectedId] = useState<string | null>(null);
  const [followUpResolved, setFollowUpResolved] = useState(false);

  const [sliderValue, setSliderValue] = useState<number>(15);

  const [challengeIdx, setChallengeIdx] = useState(0);
  const [challengeSelectedId, setChallengeSelectedId] = useState<string | null>(null);
  const [challengeVerified, setChallengeVerified] = useState(false);

  // Starts empty. It used to be pre-filled with fake hibernation scores that leaked into every story's report.
  const [conceptScores, setConceptScores] = useState<Record<string, number[]>>(initialProgress?.conceptScores ?? {});
  const [detectedMisconceptions, setDetectedMisconceptions] = useState<{ misconception: string; correctConcept: string }[]>(
    initialProgress?.detectedMisconceptions ?? []
  );

  // Only a student's FIRST attempt at a question counts, so re-clicking options cannot inflate or deflate scores.
  const answeredRef = useRef<Set<string>>(new Set(initialProgress?.answeredQuestionIds ?? []));
  const startedAtRef = useRef(Date.now());
  const baseSecondsRef = useRef(initialProgress?.elapsedSeconds ?? 0);

  const currentSection = story.sections[sectionIdx];
  const currentQuestion = currentSection?.question;
  const totalSteps = story.sections.length + story.finalChallenge.length;
  const currentStepNumber =
    stage === 'story' ? sectionIdx + 1 : stage === 'challenge' ? story.sections.length + challengeIdx + 1 : totalSteps;
  const progressPercent = Math.min(100, Math.round((currentStepNumber / Math.max(1, totalSteps)) * 100));

  useEffect(() => {
    if (currentSection?.interactiveParameter) setSliderValue(currentSection.interactiveParameter.defaultValue);
  }, [sectionIdx, currentSection]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [sectionIdx, challengeIdx, stage]);

  const storyOptions = useMemo(
    () =>
      currentQuestion?.options
        ? shuffleOptions(currentQuestion.options, `${story.id}:${currentQuestion.id}`, currentQuestion.format === 'true_false')
        : [],
    [currentQuestion, story.id]
  );

  const challengeQuestion = story.finalChallenge[challengeIdx];
  const challengeOptions = useMemo(
    () =>
      challengeQuestion?.options
        ? shuffleOptions(challengeQuestion.options, `${story.id}:${challengeQuestion.id}`, challengeQuestion.format === 'true_false')
        : [],
    [challengeQuestion, story.id]
  );

  const followUpOptions: FollowUpOption[] = useMemo(
    () =>
      evaluationResult?.followUpQuestion?.options
        ? shuffleOptions(evaluationResult.followUpQuestion.options, `${story.id}:${currentQuestion?.id}:fu`)
        : [],
    [evaluationResult, story.id, currentQuestion?.id]
  );

  const recordFirstAttempt = (questionId: string, conceptTag: string, score: number) => {
    if (answeredRef.current.has(questionId)) return;
    answeredRef.current.add(questionId);
    setConceptScores((prev) => ({ ...prev, [conceptTag]: [...(prev[conceptTag] || []), score] }));
  };

  const addMisconception = (m: { misconception: string; correctConcept: string }) =>
    setDetectedMisconceptions((prev) => (prev.some((x) => x.misconception === m.misconception) ? prev : [...prev, m]));

  const resetSectionInteraction = () => {
    setSelectedOptionId(null);
    setShortAnswerText('');
    setEvaluationResult(null);
    setFollowUpSelectedId(null);
    setFollowUpResolved(false);
  };

  const elapsedSeconds = () => baseSecondsRef.current + Math.round((Date.now() - startedAtRef.current) / 1000);

  const snapshot = (): SessionProgress => ({
    conceptScores,
    detectedMisconceptions,
    answeredQuestionIds: Array.from(answeredRef.current),
    elapsedSeconds: elapsedSeconds(),
  });

  const handleSelectStoryOption = (optionId: string) => {
    if (!currentQuestion?.options) return;
    const opt = currentQuestion.options.find((o) => o.id === optionId);
    if (!opt) return;

    setSelectedOptionId(optionId);
    setFollowUpSelectedId(null);
    setFollowUpResolved(false);

    if (opt.isCorrect) {
      recordFirstAttempt(currentQuestion.id, currentQuestion.conceptTag, 95);
      setEvaluationResult({
        status: 'correct',
        headline: 'Great discovery!',
        explanation: opt.feedback,
        conceptTag: currentQuestion.conceptTag,
        scoreDelta: 95,
      });
      return;
    }

    recordFirstAttempt(currentQuestion.id, currentQuestion.conceptTag, 62);
    if (opt.misconceptionTag) {
      addMisconception({ misconception: opt.misconceptionTag, correctConcept: currentQuestion.constructiveExplanation });
    }
    setEvaluationResult({
      status: 'needs_adaptation',
      headline: "Let's look at this another way.",
      explanation: opt.feedback,
      conceptTag: currentQuestion.conceptTag,
      scoreDelta: 62,
      detectedMisconception: opt.misconceptionTag
        ? { misconception: opt.misconceptionTag, correctConcept: currentQuestion.constructiveExplanation }
        : undefined,
      simplifiedExplanation: opt.remedialStory || currentQuestion.constructiveExplanation,
      followUpQuestion: opt.remedialQuestion,
    });
  };

  const handleEvaluateShortAnswer = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentQuestion || !shortAnswerText.trim() || isEvaluating) return;

    setIsEvaluating(true);
    setFollowUpSelectedId(null);
    setFollowUpResolved(false);

    try {
      const result = await aiService.evaluateAnswer(
        {
          classGrade: profile.classGrade,
          topic: story.topic,
          conceptTag: currentQuestion.conceptTag,
          questionPrompt: currentQuestion.prompt,
          studentAnswer: shortAnswerText.trim(),
          expectedConcept: currentQuestion.constructiveExplanation,
        },
        currentQuestion
      );
      recordFirstAttempt(currentQuestion.id, currentQuestion.conceptTag, result.scoreDelta);
      if (result.detectedMisconception) addMisconception(result.detectedMisconception);
      setEvaluationResult(result);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNextSection = () => {
    resetSectionInteraction();
    if (sectionIdx + 1 < story.sections.length) {
      setSectionIdx(sectionIdx + 1);
    } else if (story.finalChallenge.length === 0) {
      setStage('completed'); // previously rendered a blank screen when there was no final challenge
    } else {
      setStage('challenge');
      setChallengeIdx(0);
      setChallengeSelectedId(null);
      setChallengeVerified(false);
    }
  };

  const handleSelectChallengeOption = (optId: string) => {
    if (challengeVerified || !challengeQuestion) return;
    setChallengeSelectedId(optId);
    setChallengeVerified(true);
    const chosen = challengeQuestion.options?.find((o) => o.id === optId);
    if (chosen) recordFirstAttempt(challengeQuestion.id, challengeQuestion.conceptTag, chosen.isCorrect ? 94 : 64);
  };

  const handleNextChallenge = () => {
    if (challengeIdx + 1 < story.finalChallenge.length) {
      setChallengeIdx(challengeIdx + 1);
      setChallengeSelectedId(null);
      setChallengeVerified(false);
    } else {
      setStage('completed');
    }
  };

  const computedConcepts: ConceptMasteryItem[] = Object.entries(conceptScores).map(([conceptTag, scores]) => {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return { conceptTag, score: avg, status: avg >= STRONG_THRESHOLD ? 'Strong' : 'Practice More' };
  });

  // Real value. It used to be hard-coded to 84% for the hibernation lesson regardless of the answers.
  const overallUnderstanding = Math.round(
    computedConcepts.reduce((acc, item) => acc + item.score, 0) / Math.max(1, computedConcepts.length)
  );

  const buildRecord = (): TopicMasteryRecord => ({
    topicId: story.topicId,
    topic: story.topic,
    title: story.title,
    subject: story.subject,
    understandingScore: overallUnderstanding,
    timeSpentMinutes: Math.max(1, Math.round(elapsedSeconds() / 60)), // was hard-coded to 18
    completedAt: new Date().toISOString(),
    concepts: computedConcepts,
    detectedMisconceptions,
  });

  /* ---------------------------- Completed screen ---------------------------- */
  if (stage === 'completed') {
    const masteredList = computedConcepts.filter((c) => c.status === 'Strong');
    const practiceList = computedConcepts.filter((c) => c.status === 'Practice More');

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 md:p-10 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-stone-200/80">
            <div>
              <div className="text-xs font-medium text-emerald-700 mb-1">
                Adventure Complete · {story.subject} · {story.topic}
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Adventure Complete!</h1>
            </div>
            {computedConcepts.length > 0 && (
              <div className="flex items-center gap-4 bg-stone-50 px-4 py-3 rounded-xl border border-stone-200/80">
                <Trophy className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Your Understanding</div>
                  <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                    {story.topic} — {overallUnderstanding}%
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="my-6 flex flex-wrap items-center justify-between gap-4 bg-amber-50/70 border border-amber-200/70 rounded-xl px-5 py-3.5">
            <div className="text-sm text-amber-950 font-medium">
              {profile.classGrade <= 5
                ? `Wonderful exploring, ${profile.name}! You finished “${story.topic}”.`
                : `Milestone reached, ${profile.name}: you completed ${story.subject} · ${story.topic}.`}
            </div>
            <span className="text-xs font-mono font-semibold text-amber-900 tabular-nums">
              {profile.classGrade <= 5 ? '★ Stars added on first completion' : '◆ XP added on first completion'}
            </span>
          </div>

          {computedConcepts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-3">Concept-by-Concept Understanding</h2>
                <div className="space-y-3">
                  {computedConcepts.map((item) => (
                    <div
                      key={item.conceptTag}
                      className="flex items-center justify-between py-2.5 px-3.5 bg-stone-50 rounded-xl border border-stone-200/70"
                    >
                      <span className="text-sm font-medium text-slate-800">{item.conceptTag}</span>
                      <span
                        className={`text-xs font-semibold font-mono tabular-nums ${
                          item.status === 'Strong' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {item.status === 'Strong' ? '● Strong' : '▲ Practice More'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                {masteredList.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-800 mb-2">You Mastered</h3>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {masteredList.map((m) => (
                        <li key={m.conceptTag} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{m.conceptTag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {practiceList.length > 0 && (
                  <div className={masteredList.length > 0 ? 'pt-3 border-t border-stone-200/80' : ''}>
                    <h3 className="text-sm font-semibold text-amber-800 mb-2">Let’s Practice Next</h3>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {practiceList.map((p) => (
                        <li key={p.conceptTag} className="flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>{p.conceptTag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="text-xs font-semibold text-amber-800 mb-1">Your Next Recommended Adventure</div>
              <h3 className="text-xl font-semibold text-slate-900">{story.nextRecommendedAdventure.title}</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">{story.nextRecommendedAdventure.hook}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onCompleteAdventure(buildRecord())}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                Back to Home
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = story.nextRecommendedAdventure.topicId;
                  onCompleteAdventure(buildRecord(), next);
                  onStartAnotherTopic(next);
                }}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-xs"
              >
                <span>Start Next Adventure</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showRealIllustrationBadge =
    story.isAiGenerated && story.coverImageUrl && !story.coverImageUrl.startsWith('data:image/svg');
  const lockedStoryOptions = evaluationResult?.status === 'correct';

  /* ------------------------------- Main player ------------------------------ */
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-4 pb-5 mb-6 border-b border-stone-200/80">
        <button
          type="button"
          onClick={() => onExit(progressPercent, sectionIdx, snapshot())}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Save & Exit Adventure</span>
        </button>

        <div className="text-center hidden sm:block">
          <div className="text-xs text-slate-500">
            {story.subject} · {story.topic} · Class {profile.classGrade}
          </div>
          <div className="text-sm font-semibold text-slate-900">{story.title}</div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-32 sm:w-44 h-2 bg-stone-200 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Adventure progress"
          >
            <div className="h-full bg-amber-700 transition-all duration-200" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums whitespace-nowrap">{progressPercent}%</span>
        </div>
      </div>

      {story.source === 'offline' && stage === 'story' && (
        <div role="status" className="mb-5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          The story creator isn’t reachable right now, so this is a short practice adventure. Try again later for a full story.
        </div>
      )}

      {stage === 'story' && currentSection && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <div className="relative rounded-2xl overflow-hidden border border-stone-200/90 bg-gradient-to-br from-amber-900 via-stone-800 to-slate-900 aspect-16/10 flex flex-col justify-end p-6">
              {story.coverImageUrl && (
                <img
                  src={story.coverImageUrl}
                  alt={`Illustration for ${story.title}`}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
              <div className="relative z-10">
                <div className="text-xs font-medium text-amber-300 mb-1 flex items-center justify-between gap-2">
                  <span>
                    {currentSection.chapterHeading || `Scene ${sectionIdx + 1} of ${story.sections.length}`} · {story.protagonist}
                  </span>
                  {showRealIllustrationBadge && (
                    <span className="text-[10px] font-mono uppercase bg-amber-950/70 text-amber-200 px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap">
                      AI illustration
                    </span>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-semibold text-white">{story.title}</h2>
              </div>
            </div>

            {currentSection.narrative && (
              <div className="bg-white border border-stone-200/90 rounded-2xl p-6 md:p-7 space-y-4">
                {currentSection.chapterHeading && (
                  <div className="text-xs font-semibold text-amber-800 tracking-wide">{currentSection.chapterHeading}</div>
                )}
                {currentSection.narrative.split('\n\n').map((para, i) => (
                  <p key={i} className="text-base text-slate-800 leading-relaxed">
                    {para}
                  </p>
                ))}

                {currentSection.characterDialogue && (
                  <div className="mt-4 pt-4 border-t border-stone-200/70 flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-semibold text-sm shrink-0">
                      {currentSection.characterName?.[0] || '?'}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 mb-0.5">{currentSection.characterName}</div>
                      <p className="text-sm text-slate-700 italic">{currentSection.characterDialogue}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentSection.interactiveParameter &&
              (() => {
                const param = currentSection.interactiveParameter;
                const activeStage =
                  param.stages.find((s) => sliderValue >= s.threshold) || param.stages[param.stages.length - 1];
                return (
                  <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-amber-700 shrink-0" />
                        <h3 className="text-base font-semibold text-slate-900">Interactive Concept Explorer: {param.label}</h3>
                      </div>
                      <span className="text-xs font-mono font-semibold text-amber-900 tabular-nums">
                        {sliderValue}
                        {param.unit}
                      </span>
                    </div>

                    <input
                      type="range"
                      aria-label={param.label}
                      min={param.min}
                      max={param.max}
                      value={sliderValue}
                      onChange={(e) => setSliderValue(Number(e.target.value))}
                      className="w-full accent-amber-700 cursor-pointer"
                    />
                    {/* Captions come from the content; they were hard-coded to hibernation wording ("Deep Winter"...). */}
                    <div className="flex justify-between text-xs text-slate-500 font-mono tabular-nums">
                      <span>
                        {param.minLabel ? `${param.minLabel} ` : ''}({param.min}
                        {param.unit})
                      </span>
                      {param.midLabel && <span>{param.midLabel}</span>}
                      <span>
                        {param.maxLabel ? `${param.maxLabel} ` : ''}({param.max}
                        {param.unit})
                      </span>
                    </div>

                    {activeStage && (
                      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2" aria-live="polite">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{activeStage.stateLabel}</span>
                          <span className="text-xs font-mono font-semibold text-emerald-800 tabular-nums">{activeStage.metricValue}</span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{activeStage.description}</p>
                        <div className="pt-2 border-t border-stone-200/70 text-xs font-mono text-slate-600 tabular-nums">
                          {activeStage.metricLabel}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>

          <div className="lg:col-span-5">
            {currentSection.type === 'question' && currentQuestion ? (
              <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between text-xs text-slate-500 gap-2">
                  <span>Story Check · {currentQuestion.conceptTag}</span>
                  <span className="font-mono whitespace-nowrap">
                    {currentQuestion.format === 'short_answer'
                      ? 'Short Answer'
                      : currentQuestion.format === 'true_false'
                      ? 'True or False'
                      : 'Multiple Choice'}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-slate-900 leading-snug">{currentQuestion.prompt}</h3>

                {currentQuestion.contextHint && (
                  <p className="text-xs text-slate-600 bg-stone-50 p-3 rounded-xl border border-stone-200/60">
                    Hint: {currentQuestion.contextHint}
                  </p>
                )}

                {currentQuestion.format !== 'short_answer' && storyOptions.length > 0 && (
                  <div className="space-y-2.5">
                    {storyOptions.map((opt) => (
                      <OptionButton
                        key={opt.id}
                        option={opt}
                        selected={selectedOptionId === opt.id}
                        disabled={lockedStoryOptions}
                        onClick={() => handleSelectStoryOption(opt.id)}
                      />
                    ))}
                  </div>
                )}

                {currentQuestion.format === 'short_answer' && (
                  <form onSubmit={handleEvaluateShortAnswer} className="space-y-3">
                    <label htmlFor="short-answer" className="sr-only">
                      Your explanation
                    </label>
                    <textarea
                      id="short-answer"
                      rows={3}
                      maxLength={600}
                      value={shortAnswerText}
                      onChange={(e) => setShortAnswerText(e.target.value)}
                      placeholder="Write your explanation in your own words..."
                      className="w-full p-3.5 text-sm bg-stone-50 border border-stone-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white"
                    />

                    {/* Developer shortcut for exercising the adaptive engine; never shown to students. */}
                    {import.meta.env.DEV && (
                      <div className="flex flex-wrap gap-1.5">
                        {story.topicId === 'sci-hibernation' && (
                          <button
                            type="button"
                            onClick={() => setShortAnswerText('Bears hibernate because they are lazy in winter.')}
                            className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-slate-700 cursor-pointer whitespace-nowrap"
                          >
                            [dev] misconception
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShortAnswerText(currentQuestion.sampleIdealAnswer || '')}
                          className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-slate-700 cursor-pointer whitespace-nowrap"
                        >
                          [dev] ideal answer
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isEvaluating || !shortAnswerText.trim()}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <Send className="w-4 h-4 shrink-0" />
                      <span>{isEvaluating ? 'Understanding your answer...' : 'Check My Explanation'}</span>
                    </button>
                  </form>
                )}

                {evaluationResult && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`p-4 rounded-xl border space-y-3 ${
                      evaluationResult.status === 'correct' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/80 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          evaluationResult.status === 'correct' ? 'text-emerald-900' : 'text-amber-900'
                        }`}
                      >
                        {evaluationResult.headline}
                      </span>
                      <span className="text-xs font-mono text-slate-600 text-right">
                        {evaluationResult.difficultyAdjustment === 'stepped_down'
                          ? '▼ Simpler analogy'
                          : evaluationResult.difficultyAdjustment === 'stepped_up'
                          ? '▲ Mastery recognized'
                          : evaluationResult.status === 'correct'
                          ? '● Concept understood'
                          : '◐ Adapting story'}
                      </span>
                    </div>

                    <p className="text-sm text-slate-800 leading-relaxed">{evaluationResult.explanation}</p>

                    {evaluationResult.nextAdaptiveNarrative && (
                      <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs text-slate-800 italic leading-relaxed">
                        <span className="font-semibold text-amber-900 not-italic block mb-0.5">Story Adaptation:</span>
                        “{evaluationResult.nextAdaptiveNarrative}”
                      </div>
                    )}

                    {evaluationResult.simplifiedExplanation && evaluationResult.status !== 'correct' && (
                      <div className="p-3 bg-white/90 rounded-lg border border-amber-200/80 text-xs text-slate-700 space-y-1 leading-relaxed">
                        <div className="font-semibold text-amber-900">Simpler Story View:</div>
                        <p>{evaluationResult.simplifiedExplanation}</p>
                      </div>
                    )}

                    {followUpOptions.length > 0 && !followUpResolved && (
                      <div className="pt-3 border-t border-amber-200/80 space-y-2.5">
                        <div className="text-xs font-semibold text-amber-950">Let’s try a simpler step together:</div>
                        <p className="text-sm font-medium text-slate-900">{evaluationResult.followUpQuestion?.prompt}</p>
                        <div className="space-y-2">
                          {followUpOptions.map((fOpt) => (
                            <OptionButton
                              key={fOpt.id}
                              size="sm"
                              option={fOpt}
                              selected={followUpSelectedId === fOpt.id}
                              onClick={() => {
                                setFollowUpSelectedId(fOpt.id);
                                if (fOpt.isCorrect) {
                                  setConceptScores((prev) => ({
                                    ...prev,
                                    [currentQuestion.conceptTag]: [...(prev[currentQuestion.conceptTag] || []), 85],
                                  }));
                                  setFollowUpResolved(true);
                                }
                              }}
                            />
                          ))}
                        </div>
                        {/* Feedback for the chosen follow-up option was never displayed before. */}
                        {followUpSelectedId && (
                          <p className="text-xs text-slate-800 leading-relaxed">
                            {followUpOptions.find((o) => o.id === followUpSelectedId)?.feedback}
                          </p>
                        )}
                      </div>
                    )}

                    {followUpResolved && followUpSelectedId && (
                      <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                        {followUpOptions.find((o) => o.id === followUpSelectedId)?.feedback}
                      </p>
                    )}

                    {(evaluationResult.status === 'correct' ||
                      evaluationResult.status === 'partially_correct' ||
                      followUpResolved ||
                      followUpOptions.length === 0) && (
                      <button
                        type="button"
                        onClick={handleNextSection}
                        className="w-full mt-2 py-2.5 px-4 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                      >
                        <span>
                          {sectionIdx + 1 < story.sections.length ? 'Continue Adventure' : 'Start Final Knowledge Challenge'}
                        </span>
                        <ArrowRight className="w-4 h-4 shrink-0" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-800">
                  <Compass className="w-4 h-4 shrink-0" />
                  <span>Learning Objectives in Focus</span>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-700">
                  {story.learningObjectives.map((obj, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="font-mono text-xs text-slate-400 mt-0.5">{String(idx + 1).padStart(2, '0')}.</span>
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4 border-t border-stone-200/80 flex items-center justify-between gap-3">
                  {sectionIdx > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        resetSectionInteraction();
                        setSectionIdx(sectionIdx - 1);
                      }}
                      className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-stone-100 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Previous Scene
                    </button>
                  ) : (
                    <div />
                  )}

                  <button
                    type="button"
                    onClick={handleNextSection}
                    className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    <span>{sectionIdx + 1 < story.sections.length ? 'Continue Story' : 'Start Final Knowledge Challenge'}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {stage === 'challenge' && challengeQuestion && (
        <div className="max-w-2xl mx-auto bg-white border border-stone-200/90 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between gap-2 border-b border-stone-200/80 pb-4">
            <div>
              <div className="text-xs font-semibold text-amber-800">
                Final Knowledge Challenge · Question {challengeIdx + 1} of {story.finalChallenge.length}
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mt-0.5">Checking What You Mastered: {challengeQuestion.conceptTag}</h2>
            </div>
            <HelpCircle className="w-6 h-6 text-amber-700 shrink-0" />
          </div>

          <p className="text-base font-medium text-slate-900 leading-relaxed">{challengeQuestion.prompt}</p>

          <div className="space-y-3">
            {challengeOptions.map((opt) => (
              <OptionButton
                key={opt.id}
                size="lg"
                option={opt}
                selected={challengeSelectedId === opt.id}
                disabled={challengeVerified}
                onClick={() => handleSelectChallengeOption(opt.id)}
              />
            ))}
          </div>

          {challengeVerified &&
            (() => {
              const chosen = challengeQuestion.options?.find((o) => o.id === challengeSelectedId);
              if (!chosen) return null;
              return (
                <div
                  role="status"
                  aria-live="polite"
                  className={`p-4 rounded-xl border space-y-2 ${
                    chosen.isCorrect ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/80 border-amber-200'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {chosen.isCorrect ? 'Great discovery!' : "Let's look at this another way."}
                  </div>
                  <p className="text-sm text-slate-700">{chosen.feedback}</p>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleNextChallenge}
                      className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <span>
                        {challengeIdx + 1 < story.finalChallenge.length ? 'Next Question' : 'See My Understanding Profile'}
                      </span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
};
