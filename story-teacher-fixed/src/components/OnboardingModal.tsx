import React, { useEffect, useRef, useState } from 'react';
import { ClassGrade, StudentProfile } from '../types/story';
import { Compass, ArrowRight, Check } from 'lucide-react';

interface OnboardingModalProps {
  profile: StudentProfile;
  onSaveProfile: (updated: StudentProfile) => void;
  onClose?: () => void;
  /** true = dismissible dialog over the app; false = full-page first-run screen. */
  isModal?: boolean;
}

// "Adventure" was a default interest but had no chip, so it could never be toggled off.
const INTEREST_OPTIONS = ['Animals', 'Space', 'Earth', 'Adventure', 'Sports', 'Art', 'Science', 'Maths', 'History', 'Technology'];
const CLASS_OPTIONS: ClassGrade[] = [3, 4, 5, 6, 7, 8, 9, 10];
const NAME_MAX = 40;

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ profile, onSaveProfile, onClose, isModal = false }) => {
  const [name, setName] = useState(profile.name);
  const [classGrade, setClassGrade] = useState<ClassGrade>(profile.classGrade || 5);
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    if (!isModal || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModal, onClose]);

  const toggleInterest = (item: string) =>
    setInterests((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSaveProfile({
      ...profile,
      name: trimmed.slice(0, NAME_MAX),
      classGrade,
      interests: interests.length > 0 ? interests : ['Animals', 'Space'],
    });
    onClose?.();
  };

  const card = (
    <div
      role={isModal ? 'dialog' : undefined}
      aria-modal={isModal ? true : undefined}
      aria-labelledby="onboarding-title"
      className="bg-white border border-stone-200/90 rounded-2xl p-6 md:p-8 w-full max-w-xl shadow-sm"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-amber-800 tracking-wide">
          Explorer Profile · Personalized Learning Companion
        </span>
        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-900 px-2 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            Close
          </button>
        )}
      </div>

      <h1 id="onboarding-title" className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">
        {isModal ? 'Your explorer profile' : 'Let’s get to know you!'}
      </h1>
      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
        Story Teacher uses your class and interests to adapt vocabulary, story depth, and curriculum adventures.
        Your profile is saved only on this device.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="student-name" className="block text-sm font-semibold text-slate-800 mb-2">
            What’s your name?
          </label>
          <input
            ref={nameRef}
            id="student-name"
            type="text"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            autoComplete="given-name"
            required
            className="w-full px-4 py-2.5 text-base bg-stone-50 border border-stone-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white transition-all"
          />
        </div>

        <fieldset>
          <legend className="block text-sm font-semibold text-slate-800 mb-2">Which class are you in?</legend>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {CLASS_OPTIONS.map((grade) => {
              const isSelected = classGrade === grade;
              return (
                <button
                  key={grade}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setClassGrade(grade)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected ? 'bg-slate-900 text-white shadow-xs' : 'bg-stone-100 text-slate-700 hover:bg-stone-200/80'
                  }`}
                >
                  Class {grade}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {classGrade <= 5
              ? `Class ${classGrade} Mode: Warm storytelling, clear cause-and-effect, and star milestones.`
              : `Class ${classGrade} Mode: Deeper terminology, analytical reasoning, and XP mastery tracking.`}
          </p>
        </fieldset>

        <fieldset>
          <legend className="block text-sm font-semibold text-slate-800 mb-2">
            What do you enjoy learning about? <span className="font-normal text-slate-500">(Select any)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => {
              const active = interests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleInterest(interest)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    active ? 'bg-amber-700 text-white shadow-xs' : 'bg-stone-100 text-slate-700 hover:bg-stone-200/75'
                  }`}
                >
                  {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  <span>{interest}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Compass className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Every concept has a story.</span>
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-xs"
          >
            <span>{isModal ? 'Save' : 'Let’s Start Exploring'}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </form>
    </div>
  );

  return isModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      {card}
    </div>
  ) : (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">{card}</div>
  );
};
