import type {
  InProgressSession,
  PersistedAppState,
  StudentProfile,
  TopicMasteryRecord,
} from '../types/story';

const STORAGE_KEY = 'story_teacher_state_v2';
const LEGACY_PROFILE_KEY = 'story_teacher_profile_v1';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isProfile(v: unknown): v is StudentProfile {
  return (
    isObject(v) &&
    typeof v.name === 'string' &&
    typeof v.classGrade === 'number' &&
    v.classGrade >= 3 &&
    v.classGrade <= 10 &&
    Array.isArray(v.interests)
  );
}

export interface LoadedState {
  state: PersistedAppState | null;
  /** True when a valid profile already existed, i.e. the student has been onboarded. */
  hasProfile: boolean;
}

/** Reads and validates persisted state. Corrupt or foreign data is ignored instead of crashing the app. */
export function loadState(): LoadedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isObject(parsed) && parsed.version === 2 && isProfile(parsed.profile)) {
        return {
          hasProfile: true,
          state: {
            version: 2,
            profile: parsed.profile,
            inProgress: Array.isArray(parsed.inProgress) ? (parsed.inProgress as InProgressSession[]) : [],
            mastery: Array.isArray(parsed.mastery) ? (parsed.mastery as TopicMasteryRecord[]) : [],
          },
        };
      }
    }
    // Migrate the old profile-only key.
    const legacy = localStorage.getItem(LEGACY_PROFILE_KEY);
    if (legacy) {
      const profile: unknown = JSON.parse(legacy);
      if (isProfile(profile)) {
        return { hasProfile: true, state: { version: 2, profile, inProgress: [], mastery: [] } };
      }
    }
  } catch {
    // fall through
  }
  return { state: null, hasProfile: false };
}

/** Returns false when the browser refuses the write (private mode, quota exceeded). */
export function saveState(state: PersistedAppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_PROFILE_KEY);
  } catch {
    // ignore
  }
}
