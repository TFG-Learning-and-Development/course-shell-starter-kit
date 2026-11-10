import { courseData } from "./course";

export type CompletionType = "view" | "watch" | "submit" | "explore" | "complete" | "optional";

export type CompletionMilestone = {
  id: string;
  label: string;
  type: CompletionType;
  targetId: string;
  path: string;
  required: boolean;
  requiredItems?: string[];
  threshold?: number;
};

// Increment this version when requirements change. Suspend data also carries
// the exact ordered IDs, so accidental reordering cannot reinterpret progress.
export const completionSettings = {
  storageKey: "astro-course-progress:course-shell:v3",
  sequentialUnlocking: true,
} as const;

export const completionMilestones: CompletionMilestone[] = [
  { id: "overview", label: courseData.hero.title, type: "view", targetId: "overview", path: "/", required: true },
  { id: "story", label: courseData.story.title, type: "view", targetId: "story", path: "/", required: true },
  { id: "principles", label: courseData.principles.title, type: "explore", targetId: "principles", path: "/", requiredItems: ["clarity", "rhythm", "purpose"], required: true },
  { id: "assessment", label: courseData.assessment.title, type: "submit", targetId: "assessment", path: "/", required: true },
  { id: "practice-intro", label: courseData.lessonPages.practice.title, type: "view", targetId: "practice-intro", path: "/topics/practice/", required: true },
  { id: "practice-explorer", label: courseData.lessonPages.practice.explorer.title, type: "explore", targetId: "practice-explorer", path: "/topics/practice/", requiredItems: ["plan", "discuss", "reflect"], required: true },
  { id: "practice-steps", label: courseData.lessonPages.practice.steps.title, type: "explore", targetId: "practice-steps", path: "/topics/practice/", requiredItems: ["notice", "decide", "act"], required: true },
  { id: "practice-match", label: courseData.lessonPages.practice.match.title, type: "submit", targetId: "practice-match", path: "/topics/practice/", required: true },
  { id: "practice-reflection", label: courseData.lessonPages.practice.reflection.title, type: "complete", targetId: "practice-reflection", path: "/topics/practice/", required: true },
];
