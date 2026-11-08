import { courseData } from "./course";
import { completionMilestones, completionSettings, type CompletionMilestone } from "./course-completion";

export type CourseLesson = { id: string; path: string; label: string };
export type CourseTheme = {
  colors: { ink: string; muted: string; accent: string; accentStrong: string; surface: string; surfaceSoft: string; footer: string };
  surfaces: { muted: string; strong: string };
  gradients: { soft: string; strong: string };
};
export type CourseConfig = {
  identity: { id: string; title: string; description: string };
  brand: { homeLabel: string; logoSrc?: string; logoAlt?: string };
  theme: CourseTheme;
  lessons: CourseLesson[];
  completion: { storageKey: string; sequentialUnlocking: boolean; milestones: CompletionMilestone[] };
  package: { identifier: string; filename: string; launchFile: "index.html"; title: string };
};

export const defaultCourseTheme: CourseTheme = {
  colors: { ink: "#17232b", muted: "#52616a", accent: "#3b8278", accentStrong: "#285b61", surface: "#ffffff", surfaceSoft: "#edf2f1", footer: "#285b61" },
  surfaces: { muted: "#edf2f1", strong: "#17232b" },
  gradients: { soft: "linear-gradient(135deg, #f5f8f7, #dcebe7)", strong: "linear-gradient(135deg, #285b61, #17232b)" },
};

export const courseConfig: CourseConfig = {
  identity: { id: "course-shell", title: courseData.meta.title, description: courseData.meta.description },
  brand: { homeLabel: courseData.brand.homeLabel, logoSrc: "/assets/demo/brand-mark.svg", logoAlt: "Neutral course foundation" },
  theme: defaultCourseTheme,
  lessons: courseData.lessons.map((lesson) => ({ ...lesson })),
  completion: { ...completionSettings, milestones: completionMilestones },
  package: { identifier: "course-shell-scorm-12", filename: "Course-Shell-SCORM-1.2.zip", launchFile: "index.html", title: courseData.meta.title },
};

export function validateCourseConfig(config: CourseConfig): void {
  const errors: string[] = [];
  const idPattern = /^[a-z][a-z0-9-]*$/;
  const routePattern = /^\/(?:[a-z0-9-]+\/)*$/;
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) errors.push(`${label} must be unique.`);
  };
  if (!idPattern.test(config.identity.id)) errors.push("Course identity must be a URL-safe slug.");
  if (!config.identity.title.trim() || !config.package.title.trim()) errors.push("Course and package titles are required.");
  if (!config.brand.homeLabel.trim()) errors.push("An accessible home-link name is required.");
  if (config.brand.logoSrc && (!config.brand.logoSrc.startsWith("/assets/") || !config.brand.logoAlt)) errors.push("A logo needs an asset path and alt text.");
  if (!Object.values(config.theme.colors).every((value) => value.trim()) || !Object.values(config.theme.surfaces).every((value) => value.trim()) || !Object.values(config.theme.gradients).every((value) => value.trim())) errors.push("Theme colours, surfaces and gradients are required.");
  if (!config.lessons.length || config.lessons[0]?.path !== "/") errors.push("The first lesson must use the / route.");
  unique(config.lessons.map((lesson) => lesson.id), "Lesson IDs");
  unique(config.lessons.map((lesson) => lesson.path), "Lesson routes");
  for (const lesson of config.lessons) {
    if (!idPattern.test(lesson.id) || !routePattern.test(lesson.path) || !lesson.label.trim()) errors.push(`Invalid lesson: ${lesson.id}.`);
  }
  if (config.lessons.some((lesson) => lesson.path.startsWith("/__verify-"))) errors.push("Verification routes are reserved.");
  const key = `astro-course-progress:${config.identity.id}:v`;
  if (!config.completion.storageKey.startsWith(key) || !/^\d+(?:\.\d+)*$/.test(config.completion.storageKey.slice(key.length))) errors.push("Storage key must contain the course slug and a version.");
  if (!idPattern.test(config.package.identifier) || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/.test(config.package.filename) || config.package.launchFile !== "index.html") errors.push("Invalid SCORM package identity.");
  unique(config.completion.milestones.map((item) => item.id), "Milestone IDs");
  unique(config.completion.milestones.map((item) => item.targetId), "Milestone targets");
  const types = new Set(["view", "watch", "submit", "explore", "complete", "optional"]);
  for (const item of config.completion.milestones) {
    if (!idPattern.test(item.id) || !idPattern.test(item.targetId) || !item.label.trim() || !types.has(item.type) || typeof item.required !== "boolean") errors.push(`Invalid milestone: ${item.id}.`);
    if (!config.lessons.some((lesson) => lesson.path === item.path)) errors.push(`Unknown milestone route: ${item.id}.`);
    if (item.type === "explore") {
      if (!item.requiredItems?.length || new Set(item.requiredItems).size !== item.requiredItems.length || item.requiredItems.some((id) => !idPattern.test(id))) errors.push(`Invalid exploration children: ${item.id}.`);
    } else if (item.requiredItems) errors.push(`Only exploration milestones may declare children: ${item.id}.`);
    if (item.threshold !== undefined && (item.type !== "watch" || !Number.isFinite(item.threshold) || item.threshold <= 0 || item.threshold > 1)) errors.push(`Invalid watch threshold: ${item.id}.`);
  }
  if (errors.length) throw new Error(`Invalid course configuration:\n- ${errors.join("\n- ")}`);
}

validateCourseConfig(courseConfig);
