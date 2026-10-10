import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CurriculumTopic,
  InProgressSession,
  SessionProgress,
  Story,
  StudentProfile,
  TopicMasteryRecord,
} from './types/story';
import {
  CURRICULUM_TOPICS,
  DEMO_MASTERY_HISTORY,
  DEMO_STUDENT_PROFILE,
  INITIAL_STUDENT_PROFILE,
  getCuratedStoryForTopic,
} from './data/curriculumData';
import { aiService, TopicNotAllowedError } from './services/aiService';
import { OnboardingModal } from './components/OnboardingModal';
import { AdventurePlayer } from './components/AdventurePlayer';
import { GuardianDashboard } from './components/GuardianDashboard';
import { loadState, saveState } from './utils/storage';
import { daysBetweenKeys, formatRelativeDate, localDateKey } from './utils/format';
import { ArrowRight, Compass, X } from 'lucide-react';

type ActiveTab = 'home' | 'explore' | 'progress' | 'guardian';

const TABS: { id: ActiveTab; label: string; short: string }[] = [
  { id: 'home', label: 'Home', short: 'Home' },
  { id: 'explore', label: 'Explore', short: 'Explore' },
  { id: 'progress', label: 'My Progress', short: 'My Progress' },
  { id: 'guardian', label: 'Guardian View', short: 'Guardian' },
];

const SUBJECTS = ['All', 'Science', 'Mathematics', 'Social Science', 'English'];
const GENERATION_STEPS = [
  'Creating your adventure...',
  'Finding the perfect story...',
  'Preparing your challenges...',
  'Almost ready...',
];
const QUICK_QUESTIONS = ['Why do volcanoes erupt?', 'How do airplanes stay in the sky?', 'Why is the ocean salty?'];
const XP_PER_TOPIC = 120;
const STARS_PER_TOPIC = 3;

function TopicCard({ topic, cta, onStart }: { topic: CurriculumTopic; cta: string; onStart: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onStart}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onStart();
        }
      }}
      className="group bg-white border border-stone-200/90 hover:border-stone-300 focus-visible:ring-2 focus-visible:ring-amber-600 focus:outline-none rounded-2xl overflow-hidden flex flex-col justify-between transition-all cursor-pointer"
    >
      <div className="p-5 space-y-2">
        <h3 className="text-lg font-semibold text-slate-900 group-hover:text-amber-800 transition-colors leading-snug">
          {topic.engagingTitle}
        </h3>
        <div className="text-xs font-medium text-amber-800">
          {topic.topic} · {topic.subject} ({topic.domain})
        </div>
        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed pt-1">{topic.hookDescription}</p>
      </div>
      <div className="px-5 py-3.5 border-t border-stone-100 flex items-center justify-between text-xs text-slate-500">
        <span className="font-mono tabular-nums">{topic.estimatedMinutes} min</span>
        <span className="font-semibold text-slate-900 group-hover:text-amber-800 flex items-center gap-1">
          <span>{cta}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
}

function SubjectFilter({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-xl overflow-x-auto">
      {SUBJECTS.map((subj) => (
        <button
          key={subj}
          type="button"
          aria-pressed={value === subj}
          onClick={() => onChange(subj)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            value === subj ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {subj}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const demoMode = useMemo(() => new URLSearchParams(window.location.search).get('demo') === '1', []);
  const initial = useMemo(() => loadState(), []);

  const [profile, setProfile] = useState<StudentProfile>(
    demoMode ? DEMO_STUDENT_PROFILE : initial.state?.profile ?? INITIAL_STUDENT_PROFILE
  );
  const [inProgressList, setInProgressList] = useState<InProgressSession[]>(demoMode ? [] : initial.state?.inProgress ?? []);
  const [masteryHistory, setMasteryHistory] = useState<TopicMasteryRecord[]>(
    demoMode ? DEMO_MASTERY_HISTORY : initial.state?.mastery ?? []
  );
  const [needsOnboarding, setNeedsOnboarding] = useState(!demoMode && !initial.hasProfile);

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [curiosityQuery, setCuriosityQuery] = useState('');
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [activeStoryStartIdx, setActiveStoryStartIdx] = useState(0);
  const [activeProgress, setActiveProgress] = useState<SessionProgress | undefined>(undefined);
  const [runId, setRunId] = useState(0);
  const generatedStories = useRef(new Map<string, Story>());

  // Persist everything (not just the profile). Demo mode never touches real saved data.
  useEffect(() => {
    if (demoMode || needsOnboarding) return;
    const ok = saveState({ version: 2, profile, inProgress: inProgressList, mastery: masteryHistory });
    if (!ok) setNotice('Your progress could not be saved on this device (browser storage is full or blocked).');
  }, [demoMode, needsOnboarding, profile, inProgressList, masteryHistory]);

  useEffect(() => {
    if (!isGeneratingStory) return;
    const timer = setInterval(() => setLoadingStepIdx((p) => (p + 1) % GENERATION_STEPS.length), 900);
    return () => clearInterval(timer);
  }, [isGeneratingStory]);

  const completedIds = useMemo(() => masteryHistory.map((m) => m.topicId), [masteryHistory]);
  const classTopics = useMemo(() => CURRICULUM_TOPICS.filter((t) => t.classGrades.includes(profile.classGrade)), [profile.classGrade]);

  // Recommendations respect the student's class (the old code could recommend a Class 5 lesson to a Class 8 student).
  const todaysRecommendedTopic = useMemo(() => {
    const last = masteryHistory[0];
    const lastTopic = last && CURRICULUM_TOPICS.find((t) => t.id === last.topicId);
    const successor = lastTopic?.nextRecommendedTopicId
      ? classTopics.find((t) => t.id === lastTopic.nextRecommendedTopicId && !completedIds.includes(t.id))
      : undefined;
    return successor ?? classTopics.find((t) => !completedIds.includes(t.id)) ?? classTopics[0] ?? null;
  }, [classTopics, completedIds, masteryHistory]);

  const guardianRecommendedTopic = useMemo(() => {
    const unfinished = classTopics.find((t) => !completedIds.includes(t.id));
    if (unfinished) return unfinished;
    const weakest = [...masteryHistory].sort((a, b) => a.understandingScore - b.understandingScore)[0];
    return (weakest && classTopics.find((t) => t.id === weakest.topicId)) || null;
  }, [classTopics, completedIds, masteryHistory]);

  const launchStory = (story: Story, startIdx = 0, progress?: SessionProgress) => {
    setActiveStoryStartIdx(startIdx);
    setActiveProgress(progress);
    setRunId((n) => n + 1); // forces a fresh AdventurePlayer, so stage/scores never leak between stories
    setActiveStory(story);
  };

  const handleSaveProfile = (updated: StudentProfile) => {
    setProfile(updated);
    setNeedsOnboarding(false);
  };

  const handleStartCurriculumTopic = async (topicId: string, session?: InProgressSession) => {
    if (isGeneratingStory) return;
    setNotice(null);

    // Resume exactly what the student was playing (custom stories used to resume as an unrelated hibernation stub).
    if (session?.storySnapshot) {
      launchStory(session.storySnapshot, session.currentSectionIndex, session.progress);
      return;
    }

    const curated = getCuratedStoryForTopic(topicId, profile.classGrade, profile.name);
    if (curated) {
      launchStory(curated, session?.currentSectionIndex ?? 0, session?.progress);
      return;
    }

    const topic = CURRICULUM_TOPICS.find((t) => t.id === topicId);
    if (!topic) {
      setNotice('That adventure could not be found.');
      return;
    }

    const cacheKey = `${topicId}:${profile.classGrade}:${profile.name}`;
    const cached = generatedStories.current.get(cacheKey);
    if (cached) {
      launchStory(cached);
      return;
    }

    setIsGeneratingStory(true);
    setLoadingStepIdx(0);
    try {
      // Topics without a hand-written story are generated from their curriculum objectives.
      const story = await aiService.generateStory({
        studentName: profile.name,
        classGrade: profile.classGrade,
        interests: profile.interests,
        topic: topic.topic,
        subject: topic.subject,
        learningObjectives: topic.learningObjectives.map((o) => o.text),
        topicId: topic.id,
        imageKey: topic.imageKey,
        nextTopicId: topic.nextRecommendedTopicId,
      });
      const normalized: Story = { ...story, title: story.source === 'offline' ? topic.engagingTitle : story.title };
      generatedStories.current.set(cacheKey, normalized);
      launchStory(normalized);
    } catch {
      setNotice('We could not prepare that adventure. Please try again.');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleCreateCustomAdventure = async (e?: React.FormEvent, presetTopic?: string) => {
    e?.preventDefault();
    const query = (presetTopic ?? curiosityQuery).trim();
    if (!query || isGeneratingStory) return;

    setNotice(null);
    setIsGeneratingStory(true);
    setLoadingStepIdx(0);
    try {
      const generated = await aiService.generateStory({
        studentName: profile.name,
        classGrade: profile.classGrade,
        interests: profile.interests,
        topic: query,
      });
      setCuriosityQuery('');
      launchStory(generated);
    } catch (err) {
      setNotice(err instanceof TopicNotAllowedError ? err.message : 'Something went wrong creating your adventure. Please try again.');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleExitAdventure = (progressPercent: number, currentSectionIndex: number, progress?: SessionProgress) => {
    if (activeStory) {
      setInProgressList((prev) => [
        {
          topicId: activeStory.topicId,
          title: activeStory.title,
          topic: activeStory.topic,
          subject: activeStory.subject,
          progressPercent,
          currentSectionIndex,
          imageKey: activeStory.imageKey,
          storySnapshot: activeStory,
          progress,
        },
        ...prev.filter((item) => item.topicId !== activeStory.topicId),
      ]);
    }
    setActiveStory(null);
  };

  const handleCompleteAdventure = (record: TopicMasteryRecord, nextTopicId?: string) => {
    const isFirstCompletion = !masteryHistory.some((m) => m.topicId === record.topicId);
    setMasteryHistory((prev) => [record, ...prev.filter((item) => item.topicId !== record.topicId)]);
    setInProgressList((prev) => prev.filter((item) => item.topicId !== record.topicId));

    // Rewards are granted once per topic (replaying used to farm +120 XP every time), via a functional
    // update so rapid completions can't overwrite each other with a stale profile.
    setProfile((prev) => {
      const today = localDateKey();
      let streak = prev.streakDays;
      if (prev.lastActiveDate !== today) {
        streak = prev.lastActiveDate && daysBetweenKeys(prev.lastActiveDate, today) === 1 ? prev.streakDays + 1 : 1;
      }
      return {
        ...prev,
        xp: prev.xp + (isFirstCompletion ? XP_PER_TOPIC : 0),
        stars: prev.stars + (isFirstCompletion ? STARS_PER_TOPIC : 0),
        streakDays: streak,
        lastActiveDate: today,
      };
    });

    if (!nextTopicId) {
      setActiveStory(null);
      setActiveTab('home');
    }
  };

  if (needsOnboarding) {
    return <OnboardingModal profile={profile} onSaveProfile={handleSaveProfile} />;
  }

  if (isGeneratingStory) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6">
        <div role="status" aria-live="polite" className="max-w-md w-full bg-white border border-stone-200/90 rounded-2xl p-8 text-center space-y-5 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <Compass className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-amber-800">Class {profile.classGrade} · {profile.name}’s adventure</div>
            <h2 className="text-xl font-semibold text-slate-900">{GENERATION_STEPS[loadingStepIdx]}</h2>
            <p className="text-sm text-slate-600">
              Tailoring vocabulary, story characters, and interactive checks to Class {profile.classGrade}. This can take up to two minutes.
            </p>
          </div>
          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-700 transition-all duration-300"
              style={{ width: `${((loadingStepIdx + 1) / GENERATION_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (activeStory) {
    return (
      <div className="min-h-screen bg-[#FAF8F5]">
        <AdventurePlayer
          key={`${activeStory.id}:${runId}`}
          story={activeStory}
          profile={profile}
          initialSectionIndex={activeStoryStartIdx}
          initialProgress={activeProgress}
          onExit={handleExitAdventure}
          onCompleteAdventure={handleCompleteAdventure}
          onStartAnotherTopic={(topicId) => void handleStartCurriculumTopic(topicId)}
        />
      </div>
    );
  }

  const filteredExploreTopics =
    selectedSubjectFilter === 'All' ? classTopics : classTopics.filter((t) => t.subject === selectedSubjectFilter);

  const emptyExplore = (
    <div className="bg-white border border-stone-200/90 rounded-2xl p-8 text-center text-sm text-slate-600">
      {classTopics.length === 0
        ? `There are no ready-made adventures for Class ${profile.classGrade} yet.`
        : `No ${selectedSubjectFilter} adventures for Class ${profile.classGrade} yet.`}{' '}
      You can still ask any question on the Home tab and Story Teacher will create one for you.
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 flex flex-col">
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-xs border-b border-stone-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="text-xl font-bold tracking-tight text-slate-900 font-serif-display whitespace-nowrap cursor-pointer"
          >
            Story Teacher
          </button>

          <nav aria-label="Main" className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`py-1 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-amber-700 decoration-2'
                    : 'hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-stone-200/75 hover:bg-stone-300/70 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            Hi {profile.name} · Class {profile.classGrade}
          </button>
        </div>

        <nav aria-label="Main (mobile)" className="flex md:hidden items-center justify-around pt-2.5 mt-2.5 border-t border-stone-200/70 text-xs font-medium text-slate-600">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={`py-1 whitespace-nowrap cursor-pointer ${activeTab === tab.id ? 'text-amber-800 font-semibold' : ''}`}
            >
              {tab.short}
            </button>
          ))}
        </nav>
      </header>

      {notice && (
        <div role="alert" className="max-w-6xl w-full mx-auto mt-4 px-4 sm:px-6">
          <div className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-950 text-sm rounded-xl px-4 py-3">
            <span>{notice}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)} className="shrink-0 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {activeTab === 'home' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-12">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-amber-800 mb-1">
                  Every concept has a story · Personalized for Class {profile.classGrade}
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Hi {profile.name}! Ready for today’s discovery?</h1>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-600 font-mono tabular-nums">
                {profile.classGrade <= 5 ? <span>★ {profile.stars} Stars Collected</span> : <span>◆ {profile.xp} XP Earned</span>}
                <span aria-hidden="true">·</span>
                <span>{profile.streakDays}-Day Curiosity Streak</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="text-amber-800 hover:underline font-sans font-medium cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>
            </div>

            {todaysRecommendedTopic && (
              <section aria-labelledby="todays-adventure-heading">
                <div className="relative rounded-2xl overflow-hidden border border-stone-200/90 bg-gradient-to-br from-stone-900 via-amber-950 to-slate-900 shadow-xs text-white p-6 sm:p-10">
                  <div className="max-w-2xl space-y-4">
                    <div className="text-xs font-medium text-amber-300 tracking-wide">
                      Your Adventure Today · Recommended for Class {profile.classGrade}
                    </div>
                    <h2 id="todays-adventure-heading" className="text-2xl sm:text-4xl font-semibold text-white leading-tight">
                      {todaysRecommendedTopic.engagingTitle}
                    </h2>
                    <div className="text-sm font-medium text-stone-300">
                      {todaysRecommendedTopic.subject} — {todaysRecommendedTopic.topic} · {todaysRecommendedTopic.estimatedMinutes} min interactive story
                    </div>
                    <p className="text-sm sm:text-base text-stone-300 leading-relaxed max-w-xl pt-1">{todaysRecommendedTopic.hookDescription}</p>
                    <div className="pt-3 flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={() => void handleStartCurriculumTopic(todaysRecommendedTopic.id)}
                        className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer whitespace-nowrap shadow-xs"
                      >
                        <span>Start Adventure</span>
                        <ArrowRight className="w-4 h-4 shrink-0" />
                      </button>
                      {profile.interests.length > 0 && (
                        <span className="text-xs text-stone-400">Adapted to your interests in {profile.interests.slice(0, 2).join(' & ')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {inProgressList.length > 0 && (
              <section aria-labelledby="continue-learning-heading" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 id="continue-learning-heading" className="text-xl font-semibold text-slate-900">Continue Learning</h2>
                  <span className="text-xs text-slate-500">Pick up right where you left off</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {inProgressList.map((session) => (
                    <div
                      key={session.topicId}
                      className="bg-white border border-stone-200/90 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
                    >
                      <div className="space-y-2 flex-1 w-full">
                        <div className="text-xs text-slate-500">{session.subject} — {session.topic}</div>
                        <h3 className="text-lg font-semibold text-slate-900">{session.title}</h3>
                        <div className="flex items-center gap-3 pt-1">
                          <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-700 rounded-full" style={{ width: `${session.progressPercent}%` }} />
                          </div>
                          <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                            {session.progressPercent}% Complete
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleStartCurriculumTopic(session.topicId, session)}
                        className="px-4 py-2.5 bg-stone-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span>Continue</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="explore-subjects-heading" className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 id="explore-subjects-heading" className="text-xl font-semibold text-slate-900">Explore Curriculum Adventures</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Story quests mapped to Class {profile.classGrade} learning objectives</p>
                </div>
                <SubjectFilter value={selectedSubjectFilter} onChange={setSelectedSubjectFilter} />
              </div>

              {filteredExploreTopics.length === 0 ? (
                emptyExplore
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredExploreTopics.slice(0, 6).map((topic) => (
                    <TopicCard key={topic.id} topic={topic} cta="Explore" onStart={() => void handleStartCurriculumTopic(topic.id)} />
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="curious-heading" className="pt-4">
              <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8">
                <div className="max-w-2xl space-y-4">
                  <div className="text-xs font-semibold text-amber-800">Curious About Something? · Open-Ended Discovery</div>
                  <h2 id="curious-heading" className="text-2xl font-semibold text-slate-900">What do you want to discover today?</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Ask any question you are curious about. Story Teacher knows you’re in Class {profile.classGrade} and will craft an interactive adventure just for you.
                  </p>

                  <form onSubmit={(e) => void handleCreateCustomAdventure(e)} className="flex flex-col sm:flex-row gap-3 pt-1">
                    <label htmlFor="curiosity" className="sr-only">Your question</label>
                    <input
                      id="curiosity"
                      type="text"
                      value={curiosityQuery}
                      maxLength={200}
                      onChange={(e) => setCuriosityQuery(e.target.value)}
                      placeholder="Why do volcanoes erupt?"
                      className="flex-1 px-4 py-3 text-sm bg-stone-50 border border-stone-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white"
                    />
                    <button
                      type="submit"
                      disabled={!curiosityQuery.trim()}
                      className="px-5 py-3 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
                    >
                      <span>Create Adventure</span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>
                  </form>

                  <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-500">
                    <span>Try a quick curiosity quest:</span>
                    {QUICK_QUESTIONS.map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => void handleCreateCustomAdventure(undefined, sample)}
                        className="text-slate-700 hover:text-amber-800 underline underline-offset-4 cursor-pointer whitespace-nowrap"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'explore' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-stone-200">
              <div>
                <div className="text-xs font-medium text-amber-800 mb-1">Class {profile.classGrade} Curriculum Explorer</div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Explore by Subject & Domain</h1>
              </div>
              <SubjectFilter value={selectedSubjectFilter} onChange={setSelectedSubjectFilter} />
            </div>

            {filteredExploreTopics.length === 0 ? (
              emptyExplore
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExploreTopics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} cta="Start Adventure" onStart={() => void handleStartCurriculumTopic(topic.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-stone-200">
              <div>
                <div className="text-xs font-medium text-amber-800 mb-1">Understanding Engine · Topic-Level Mastery</div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">{profile.name}’s Learning Journey</h1>
              </div>
              <div className="text-sm font-mono font-semibold text-slate-800 tabular-nums">
                {profile.classGrade <= 5 ? `★ ${profile.stars} Stars` : `◆ ${profile.xp} XP`} · {masteryHistory.length}{' '}
                {masteryHistory.length === 1 ? 'Adventure' : 'Adventures'} Completed
              </div>
            </div>

            {masteryHistory.length === 0 ? (
              <div className="bg-white border border-stone-200/90 rounded-2xl p-8 text-center text-sm text-slate-600">
                Finish your first adventure and your understanding scores will show up here.
              </div>
            ) : (
              <div className="space-y-6">
                {masteryHistory.map((record, idx) => (
                  <div key={`${record.topicId}-${record.completedAt}-${idx}`} className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-4">
                      <div>
                        <div className="text-xs text-slate-500">
                          {record.subject} · {record.topic} · {formatRelativeDate(record.completedAt)}
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900">{record.title}</h2>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-xs text-slate-500">Understanding</div>
                        <div className="text-xl font-bold text-emerald-700">{record.understandingScore}%</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {record.concepts.map((c) => (
                        <div key={c.conceptTag} className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-800">{c.conceptTag}</span>
                          <span className={`text-xs font-mono font-semibold whitespace-nowrap ${c.status === 'Strong' ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {c.status === 'Strong' ? '● Strong' : '▲ Practice More'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'guardian' && (
          <GuardianDashboard
            profile={profile}
            masteryHistory={masteryHistory}
            recommendedTopic={guardianRecommendedTopic}
            onStartRecommended={(topicId) => void handleStartCurriculumTopic(topicId)}
            onSwitchToStudentView={() => setActiveTab('home')}
          />
        )}
      </main>

      <footer className="border-t border-stone-200/80 py-6 px-4 sm:px-8 mt-16 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>Story Teacher — Every concept has a story.{demoMode && ' (Demo data)'}</div>
          <div>Discover → Experience → Interact → Understand → Adapt → Learn</div>
        </div>
      </footer>

      {showProfileModal && (
        <OnboardingModal profile={profile} onSaveProfile={handleSaveProfile} onClose={() => setShowProfileModal(false)} isModal />
      )}
    </div>
  );
}

export default App;
