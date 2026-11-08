/** Learner-facing neutral demonstration content. Replace from the approved storyboard. */
export interface TableColumn { key: string; label: string }
export type TableRow = Record<string, string>;

export const courseData = {
  meta: { title: "Purposeful Learning", description: "A premium, reusable Astro course foundation." },
  brand: { label: "Course foundation", homeLabel: "Go to the course overview" },
  lessons: [
    { id: "welcome", path: "/", label: "Welcome" },
    { id: "practice", path: "/topics/practice/", label: "Apply the approach" },
  ],
  navigation: [
    { id: "overview", label: "Overview" },
    { id: "story", label: "A learner’s view" },
    { id: "principles", label: "Principles" },
    { id: "assessment", label: "Check" },
  ],
  hero: { title: "Design learning with purpose", description: "A neutral demonstration of the shared editorial layouts, interactions and progress system available to every new course.", actionLabel: "Explore the approach", image: { src: "/assets/demo/editorial-landscape.svg", alt: "Abstract green and blue landscape with layered shapes" } },
  editorial: { title: "Start with the learner’s next useful action", paragraphs: ["Strong learning experiences make the intended action clear, then give people a meaningful way to practise it.", "The shared course foundation supplies the structure and interaction patterns. Each course still takes its sequence, examples and requirements from its approved storyboard."], media: { src: "/assets/demo/editorial-landscape.svg", alt: "Calm abstract landscape representing a clear learning path" } },
  story: { title: "A learner’s view", paragraphs: ["Meet a neutral learner who needs a course to be useful, easy to navigate and respectful of their time."], portrait: { src: "/assets/demo/portrait-neutral.svg", alt: "Neutral illustrated portrait of a learner" }, quote: "Show me what matters, let me try it, and make my progress easy to understand.", citation: "Neutral learner perspective" },
  principles: { title: "Three principles to explore", intro: "Select every card. Each card is an independent exploration item and restores from saved progress.", cards: [
    { id: "clarity", title: "Clarity", front: "Make the goal and next action visible.", back: "Use direct headings, concise instructions and feedback that explains the next useful step." },
    { id: "rhythm", title: "Rhythm", front: "Alternate reading with purposeful action.", back: "Use interaction when it helps learners decide, practise, compare or reflect." },
    { id: "purpose", title: "Purpose", front: "Track only meaningful requirements.", back: "Completion should reflect the approved learning design rather than navigation or time spent." },
  ] },
  assessment: { title: "Choose the strongest next step", instruction: "Select one response to see feedback.", question: { prompt: "A section contains a critical decision learners must practise. What should the course designer do?", options: ["Add a relevant decision activity with useful feedback", "Add several unrelated interactions", "Mark the section complete when the page opens"], correctIndex: 0, correctFeedback: "That is the strongest choice. The interaction supports the intended decision.", incorrectFeedback: "Review the purpose of the activity, then choose the option tied to the intended decision." } },
  footer: { text: "Return to People Connect to continue" },
  lessonPages: {
    practice: {
      targets: { intro: "practice-intro", explorer: "practice-explorer", steps: "practice-steps", match: "practice-match", reflection: "practice-reflection" },
      title: "Apply the approach",
      introduction: "Explore the three planning lenses, work through the steps, then complete a matching attempt and save a short reflection.",
      explorer: { title: "Explore three planning lenses", intro: "Choose a category and each lens to view its image gallery and practical detail.", categories: [{ id: "prepare", label: "Prepare" }, { id: "engage", label: "Engage" }], items: [
        { id: "plan", categoryId: "prepare", title: "Plan", summary: "Define the learner action and evidence of success before choosing a component.", images: [{ src: "/assets/demo/item-plan.svg", alt: "Illustrated planning board" }, { src: "/assets/demo/editorial-landscape.svg", alt: "Abstract path representing course sequence" }], details: [{ label: "Use when", text: "The learning sequence or requirement is unclear." }, { label: "Design cue", text: "Write the outcome and completion evidence in plain language." }] },
        { id: "discuss", categoryId: "engage", title: "Discuss", summary: "Use realistic perspectives and feedback to help learners test a decision.", images: [{ src: "/assets/demo/item-discuss.svg", alt: "Illustrated conversation bubbles" }, { src: "/assets/demo/portrait-neutral.svg", alt: "Neutral illustrated learner portrait" }], details: [{ label: "Use when", text: "Context or judgement changes the best response." }, { label: "Design cue", text: "Keep dialogue authentic and tied to the approved content." }] },
        { id: "reflect", categoryId: "engage", title: "Reflect", summary: "Invite a concise response when connecting the content to personal practice matters.", images: [{ src: "/assets/demo/item-reflect.svg", alt: "Illustrated reflection light" }, { src: "/assets/demo/editorial-landscape.svg", alt: "Abstract landscape suggesting perspective" }], details: [{ label: "Use when", text: "Learners need to connect an idea to their own work." }, { label: "Design cue", text: "Protect personal text in shared LMS environments." }] },
      ] },
      steps: { title: "Move from brief to build", intro: "Select every step. The number of steps is driven by content, not the component.", items: [
        { id: "notice", title: "Notice", body: "Extract the approved content, sequence, audience and evidence from the storyboard." },
        { id: "decide", title: "Decide", body: "Choose the smallest set of layouts and interactions that supports those requirements." },
        { id: "act", title: "Act", body: "Implement, wire completion, check accessibility and verify the final course behavior." },
      ] },
      match: { title: "Match the need to the pattern", intro: "Complete every selection and submit. A valid attempt counts; feedback supports revision.", prompts: [
        { id: "compare", prompt: "Learners need to compare several detailed options.", answerId: "explorer" },
        { id: "sequence", prompt: "Learners need a short ordered process.", answerId: "steps" },
        { id: "personal", prompt: "Learners need to connect an idea to their work.", answerId: "reflection" },
      ], options: [{ id: "steps", label: "Step group" }, { id: "reflection", label: "Reflection" }, { id: "explorer", label: "Item explorer" }] },
      reflection: { title: "Plan one purposeful choice", prompt: "Which interaction pattern would best support your next course, and why?", instruction: "Your response is stored only where it can be isolated safely for this learner and course." },
    },
  },
} as const;
