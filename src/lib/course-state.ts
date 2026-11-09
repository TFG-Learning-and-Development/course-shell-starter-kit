export type CourseUiStore = {
  mode: "standalone" | "lms" | "failed";
  learnerId: string | null;
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  explored(activityId: string): string[];
  completed(activityId: string): boolean;
};

let resolveReady!: (store: CourseUiStore) => void;
export const courseStateReady = new Promise<CourseUiStore>((resolve) => { resolveReady = resolve; });

export function provideCourseState(store: CourseUiStore) {
  resolveReady(store);
}
