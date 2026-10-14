/**
 * Primary editing location for the starter course.
 *
 * Keep learner-facing copy and section labels here. Add course assets under
 * `public/assets/` and reference them with root-relative paths such as
 * `/assets/example-image.jpg`.
 */
export interface TableColumn {
  key: string;
  label: string;
}

export type TableRow = Record<string, string>;

export const courseData = {
  meta: {
    title: "Course title",
    description: "A reusable Astro course starter for new learning content.",
  },
  brand: {
    label: "Course shell",
    homeLabel: "Go to the course overview",
  },
  navigation: [
    { id: "overview", label: "Overview" },
    { id: "content", label: "Content" },
    { id: "interaction", label: "Interaction" },
  ],
  hero: {
    title: "Add your course title here",
    description:
      "Use this neutral shell as the starting point for a focused, accessible learning experience.",
    actionLabel: "Start learning",
  },
  content: {
    title: "Add a clear section heading",
    paragraphs: [
      "Replace this placeholder with concise learning content. Keep each section focused on one idea and use descriptive headings so learners can scan the page easily.",
      "Reusable components are available in the components folder when a new course needs callouts, dialogue, tables or other established patterns.",
    ],
    calloutTitle: "Author note",
    callout:
      "Keep course copy in this data file where practical, and place course-specific media in the public assets folder.",
  },
  interaction: {
    title: "Reveal a key point",
    introduction:
      "This simple disclosure demonstrates the starter’s interaction styling and keyboard behaviour.",
    prompt: "What should a learner take away from this section?",
    actionLabel: "Show key point",
    closeLabel: "Hide key point",
    response:
      "Replace this neutral response with a short summary that reinforces the section’s main learning point.",
  },
  footer: {
    text: "Return to People Connect to continue",
  },
} as const;
