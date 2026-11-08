import type { CourseUiStore } from "./course-state";

export function reflectionStorageKey(courseKey: string, activityId: string, state: CourseUiStore): string | null {
  const suffix = `${activityId}-text`;
  if (state.mode === "standalone") return `${courseKey}:${suffix}`;
  if (state.mode === "lms" && state.learnerId) return `${courseKey}:learner:${encodeURIComponent(state.learnerId)}:${suffix}`;
  return null;
}

export function restoreReflection(key: string | null): string {
  if (!key) return "";
  try { return window.localStorage.getItem(key) || ""; } catch { return ""; }
}

export function saveReflection(key: string | null, response: string): boolean {
  if (!key) return false;
  try { window.localStorage.setItem(key, response); return true; } catch { return false; }
}
