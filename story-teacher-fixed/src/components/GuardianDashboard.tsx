import React, { useMemo, useState } from 'react';
import { StudentProfile, TopicMasteryRecord, CurriculumTopic } from '../types/story';
import { formatRelativeDate } from '../utils/format';
import { ArrowRight, CheckCircle2, Lightbulb } from 'lucide-react';

interface GuardianDashboardProps {
  profile: StudentProfile;
  masteryHistory: TopicMasteryRecord[];
  /** null when there is nothing left to recommend for this class. */
  recommendedTopic: CurriculumTopic | null;
  onStartRecommended: (topicId: string) => void;
  onSwitchToStudentView: () => void;
}

type SubTab = 'overview' | 'history' | 'progress';

function understandingLabel(avg: number): { text: string; className: string } {
  if (avg >= 85) return { text: '● Excellent conceptual grasp', className: 'text-emerald-700' };
  if (avg >= 70) return { text: '● Solid understanding', className: 'text-emerald-700' };
  if (avg >= 55) return { text: '▲ Developing; some topics need review', className: 'text-amber-700' };
  return { text: '▲ Needs support; revisit recent topics', className: 'text-amber-700' };
}

export const GuardianDashboard: React.FC<GuardianDashboardProps> = ({
  profile,
  masteryHistory,
  recommendedTopic,
  onStartRecommended,
  onSwitchToStudentView,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('overview');

  // Everything here is derived from real completed adventures. The previous version invented a
  // "Hibernation · 84%" record (and a default weak spot) whenever the student had not completed it,
  // so guardians saw progress that never happened.
  const stats = useMemo(() => {
    const allConcepts = masteryHistory.flatMap((h) => h.concepts);
    const unique = (status: 'Strong' | 'Practice More') =>
      Array.from(new Set(allConcepts.filter((c) => c.status === status).map((c) => c.conceptTag)));
    const strong = unique('Strong');
    const practice = unique('Practice More');
    const avg = Math.round(
      masteryHistory.reduce((acc, item) => acc + item.understandingScore, 0) / Math.max(1, masteryHistory.length)
    );
    const minutes = masteryHistory.reduce((acc, item) => acc + item.timeSpentMinutes, 0);
    const subjects = Array.from(new Set(masteryHistory.map((m) => m.subject)));
    return { allConcepts, strong, practice, avg, minutes, subjects };
  }, [masteryHistory]);

  const latest = masteryHistory[0];

  const header = (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-stone-200">
      <div>
        <div className="text-xs font-medium text-slate-500 mb-1">
          Guardian Overview · Class {profile.classGrade} Curriculum Alignment
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">{profile.name}’s Learning Summary</h1>
      </div>

      <div role="tablist" aria-label="Report sections" className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-xl self-start">
        {(
          [
            ['overview', 'Overview'],
            ['history', 'Learning History'],
            ['progress', 'Concept Mastery'],
          ] as [SubTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={subTab === id}
            onClick={() => setSubTab(id)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  if (masteryHistory.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {header}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-8 text-center space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">No completed adventures yet</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Once {profile.name} finishes an adventure, this page shows understanding scores, strengths, topics to
            practise and any misconceptions that were addressed.
          </p>
          {recommendedTopic && (
            <button
              type="button"
              onClick={() => onStartRecommended(recommendedTopic.id)}
              className="mt-2 px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Start “{recommendedTopic.engagingTitle}”</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const label = understandingLabel(stats.avg);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {header}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200/90 rounded-2xl p-5">
          <div className="text-xs text-slate-500 mb-1">Latest Activity · {formatRelativeDate(latest.completedAt)}</div>
          <div className="text-lg font-semibold text-slate-900">{latest.topic}</div>
          <div className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
            {latest.subject} · {latest.timeSpentMinutes} min · {latest.understandingScore}%
          </div>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-5">
          <div className="text-xs text-slate-500 mb-1">Average Understanding</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{stats.avg}%</div>
          <div className={`text-xs mt-1 ${label.className}`}>{label.text}</div>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-5">
          <div className="text-xs text-slate-500 mb-1">Topics Completed</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {masteryHistory.length} {masteryHistory.length === 1 ? 'Topic' : 'Topics'}
          </div>
          <div className="text-xs text-slate-600 mt-1 font-mono tabular-nums">{stats.minutes} minutes active learning</div>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-5">
          <div className="text-xs text-slate-500 mb-1">Needs Practice Focus</div>
          {stats.practice.length > 0 ? (
            <>
              <div className="text-lg font-semibold text-amber-800">{stats.practice[0]}</div>
              <div className="text-xs text-slate-600 mt-1">▲ Worth revisiting</div>
            </>
          ) : (
            <>
              <div className="text-lg font-semibold text-emerald-800">Nothing flagged</div>
              <div className="text-xs text-slate-600 mt-1">All concepts so far are strong</div>
            </>
          )}
        </div>
      </div>

      {subTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Topics Learned & Understanding</h2>
              <span className="text-xs text-slate-500">{stats.subjects.join(' · ')}</span>
            </div>

            <div className="divide-y divide-stone-200/80">
              {masteryHistory.map((item, idx) => (
                <div key={`${item.topicId}-${item.completedAt}-${idx}`} className="py-4 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.topic}</div>
                      <div className="text-xs text-slate-500">
                        {item.title} · {item.subject} · {item.timeSpentMinutes} min · {formatRelativeDate(item.completedAt)}
                      </div>
                    </div>
                    <span
                      className={`text-base font-bold font-mono tabular-nums ${
                        item.understandingScore >= 80 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {item.understandingScore}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.understandingScore >= 80 ? 'bg-emerald-600' : 'bg-amber-600'}`}
                      style={{ width: `${Math.min(100, item.understandingScore)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-emerald-800 mb-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Strong Areas</span>
                </h3>
                {stats.strong.length > 0 ? (
                  <ul className="space-y-2 text-sm text-slate-700">
                    {stats.strong.slice(0, 5).map((area) => (
                      <li key={area} className="flex items-center justify-between py-1 border-b border-stone-100 last:border-0">
                        <span>{area}</span>
                        <span className="text-xs font-mono text-emerald-700">● Mastered</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No concepts are fully mastered yet; that’s normal early on.</p>
                )}
              </div>

              <div className="pt-4 border-t border-stone-200/80">
                <h3 className="text-sm font-semibold text-amber-800 mb-2.5 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 shrink-0" />
                  <span>Needs Practice</span>
                </h3>
                {stats.practice.length > 0 ? (
                  <ul className="space-y-2 text-sm text-slate-700">
                    {stats.practice.slice(0, 5).map((area) => (
                      <li key={area} className="flex items-center justify-between py-1">
                        <span className="font-medium text-slate-900">{area}</span>
                        <span className="text-xs font-mono text-amber-700">▲ Review</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Nothing flagged.</p>
                )}
              </div>
            </div>

            {recommendedTopic && (
              <div className="bg-stone-900 text-white rounded-2xl p-6 space-y-3">
                <div className="text-xs font-medium text-amber-300">Recommended Next</div>
                <h3 className="text-lg font-semibold text-white">{recommendedTopic.engagingTitle}</h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {recommendedTopic.subject} · {recommendedTopic.topic} — {recommendedTopic.hookDescription}
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onStartRecommended(recommendedTopic.id)}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <span>Launch Adventure for {profile.name}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={onSwitchToStudentView}
                    className="px-3 py-2.5 text-xs text-stone-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Return to Student View
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'history' && (
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-slate-900">Detailed Session Log & Misconception Resolution</h2>
          <div className="divide-y divide-stone-200">
            {masteryHistory.map((item, idx) => (
              <div key={`${item.topicId}-${item.completedAt}-${idx}`} className="py-5 first:pt-0 last:pb-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-base font-semibold text-slate-900">{item.title}</span>
                    <div className="text-xs text-slate-500">
                      {item.subject} · {item.topic} · Completed {formatRelativeDate(item.completedAt)} · {item.timeSpentMinutes} min
                    </div>
                  </div>
                  <div className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
                    Understanding: {item.understandingScore}%
                  </div>
                </div>

                {item.detectedMisconceptions.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs space-y-1">
                    <div className="font-semibold text-amber-950">Misconceptions addressed during the story:</div>
                    {item.detectedMisconceptions.map((m, mIdx) => (
                      <div key={mIdx} className="text-slate-700">
                        <span className="font-medium">Initial thought:</span> {m.misconception} →{' '}
                        <span className="font-medium text-emerald-900">Corrected concept:</span> {m.correctConcept}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'progress' && (
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Concept Breakdown (Class {profile.classGrade})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.allConcepts.map((c, idx) => (
              <div
                key={`${c.conceptTag}-${idx}`}
                className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{c.conceptTag}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {c.status === 'Strong' ? 'Showed solid understanding' : 'Suggested for another look'}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className={`text-sm font-bold ${c.status === 'Strong' ? 'text-emerald-700' : 'text-amber-700'}`}>{c.score}%</div>
                  <div className="text-xs text-slate-500">{c.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
