# Building a course with the generic engine

The neutral example has two lessons: `/` and `/topics/practice/`. The order comes from `courseData.lessons` in `src/data/course.ts`; `src/data/course-config.ts` turns that list into validated runtime and package configuration. Edit course copy and lesson labels in `course.ts`, milestone requirements and storage version in `course-completion.ts`, and package identifier and filename in `course-config.ts`. Keep the existing theme and shared typography unless an approved course brief calls for scoped changes.

## Choose the storyboard's course format

The storyboard or build brief should state this exact field:

`Course format: One-scroll / Multi-page`

Read the declared choice before planning routes. It is authoritative unless the user explicitly overrides it; course length, lesson count, a mood board, another project and the starter demonstration do not determine format. A One-scroll course may contain multiple logical lessons on one page. If the storyboard omits or contradicts the choice, check the build brief and explicit user instructions; ask one focused question before format-dependent work if still unresolved. For maintenance without a new format instruction, retain the existing format. Record the selected choice in `courseConfig.navigationMode` and the build summary.

| Storyboard choice | `courseConfig.navigationMode` | Page and Lessons-menu behaviour |
| --- | --- | --- |
| One-scroll | `"sections"` | One route; several logical lessons may link to anchors on the same page; no between-lesson controls. |
| Multi-page | `"lessons"` | One route per lesson; same-tab navigation, explicit packaged `index.html` paths and optional sequential unlocking. |

The default is a **multi-page course**. Keep the ordered `courseData.lessons` routes, add a matching `courseData.lessonPages` entry for every route after `/`, and place each milestone on its actual lesson path. The Lessons menu and previous/next links use those routes. `completion.sequentialUnlocking` controls whether later pages are locked. In a package, `courseUrl()` maps logical `/` to learner-facing `overview.html` and later routes to explicit nested `index.html` files; it preserves query strings and hashes. Never link learner navigation to the SCORM launcher `index.html` or rely on directory indexes. Progress shortcuts use the same helper, while the packager rewrites static links and assets against each packaged document.

For a **single scrolling page**, keep one configured lesson at `/`, render the approved sections in `src/pages/index.astro`, and add the following fields to `courseConfig` in `src/data/course-config.ts`:

```ts
navigationMode: "sections",
navigationLessons: [
  { id: "start", title: "Start here", targetId: "intro" },
  { id: "practice", title: "Practise", targetId: "practice" },
],
sections: [
  { id: "intro", label: "Introduction", milestoneIds: ["intro-view"] },
  { id: "practice", label: "Practice", milestoneIds: ["practice-check"] },
],
```

The `targetId` values must be real section IDs on the page. Every milestone, including optional ones, must belong to exactly one Progress section when `sections` is configured. A section link scrolls to content without awarding credit by itself. VIEW is optional-only; EXPLORE and valid-attempt rules provide required evidence. The first lesson remains `/`, and single-page sections do not create extra SCORM routes. The verifier's `SinglePageFixture.astro` is a neutral working example; the normal starter demonstrates multi-page routing.

The package launcher keeps the LMS-owned document open while its iframe changes learner pages. It validates `?module=` against configured logical routes and saves the logical route to `cmi.core.lesson_location`. The parent owns SCORM initialization and finish; child components reuse the parent API and save through the existing progress contract. A parent closing guard permits the final child save before finish and prevents late LMS calls. One-scroll packages contain one learner document with section anchors; Multi-page packages include that overview and each configured lesson document. Package and browser metadata use `Content`; keep approved course identity and learner headings in their separate content fields. See [completion tracking](completion-tracking.md) and [testing](testing.md).

For a compact ordered process, pass `ordered compactVertical` to `StepGroup` and supply each step's unique `id`, optional letter, title and body from the storyboard. The `steps` array determines presentation sequence; `ordered` remains accepted for existing usage and never restricts access. An optional local `panelImage` gives the explanation side an editorial surface. A step earns its EXPLORE child only when its panel is visible; merely navigating to the section does not complete the group. For a series of decisions, use `AssessmentSequence` with an instance ID and uniquely identified questions. Define a separate SUBMIT milestone for each `${instanceId}-${question.id}` form. Each question needs its own prompt, options, correct answer and configured correct and incorrect feedback. Every question is accessible before an answer; an intentional selection shows feedback and records a valid attempt immediately. The counter and arrows only change the visible question. See [`components.md`](components.md) for component properties.

## Add a lesson

1. Add `{ id: "review", path: "/review/", label: "Review" }` to `courseData.lessons`.
2. Add a `review` entry to `courseData.lessonPages` with the same fields as the neutral `practice` entry. Give it unique `targets` and real copy. The catch-all Astro route generates `/review/index.html` automatically. A nested path such as `/topics/review/` also works.
3. Add matching milestones in `course-completion.ts`. For example:

   ```ts
   { id: "review-check", label: "Check the review", type: "submit",
     targetId: "review-check", path: "/review/", required: true }
   ```

4. Increment the storage key version when changing the meaning or order of existing milestones. Set `sequentialUnlocking` to `false` if every lesson should always be available. A lesson with no required milestones passes through unlocking and shows no false 100% score.
5. Set a course-specific `identity.id`, package identifier and ZIP filename. Use a real logo under `public/assets/` if needed and provide descriptive alt text.
6. Default to Preview: run `npm run build` and relevant verification, inspect the rendered course and report `Not run — Preview stage` for SCORM packaging. Follow the [stage rules](../README.md#build-stages); create and verify a ZIP only after an explicit Release preparation request. Live Oracle acceptance remains separate.

## Reusable Codex prompts

The [packaging shortcut](../AGENTS.md#packaging-shortcut) applies when the user directly instructs “Package this course”. It enters Release preparation; a quoted example or question does not. Use the existing scripts and report title, ZIP, source-state and verification results without treating packaging as permission to commit or upload.

**Build a course from the attached storyboard, mood board and assets:** “Read and follow AGENTS.md, especially its course-format, component-authoring, tracking and build-stage requirements. Act as a senior UX/UI designer and Astro developer. First read the storyboard field `Course format: One-scroll / Multi-page`; follow its explicit choice unless the user overrides it. Never infer the format from length, lesson count, a visual board, another project or the demo. Check the brief and user instructions if the field is missing or conflicting; ask one focused question before format-dependent work if still unresolved. Preserve the current format for maintenance without a new format instruction. Record the chosen format in `courseConfig.navigationMode` and the build summary. Build the course from the approved storyboard, mood board and supplied assets. Map the learning activities to suitable shared components, adaptations or new reusable components, with their required completion triggers. Make routine design decisions within the approved brief and proceed with implementation. When the library cannot serve the learning purpose, create the required premium component using the shell's quality standards; a separate request is not needed. Configure unique course, package, activity, target and versioned storage identities, and connect the actual tracking and restoration requirements. Preserve the approved navigation, Progress UI, typography, footer and SCORM behaviour. Default to Preview unless the user explicitly selects Review or Release preparation. Run the production build and relevant verification without packaging hooks, inspect the rendered course and repair defects; report `Not run — Preview stage` for SCORM packaging. In Review, compare the rendered course with the storyboard and mood board, distinguish automated checks from human approval, and do not package unless packaged LMS testing is explicitly requested. Only explicit Release preparation includes building the latest approved source, SCORM packaging and package verification; identify the packaged source state and separate simulated LMS results from live Oracle acceptance. Document new components and add neutral gallery examples. Apply the mandatory storyboard copy fidelity rule in AGENTS.md: preserve every approved learner-facing passage verbatim, omit only permitted guidance, and ask for missing required copy. Do not invent completion requirements; flag material gaps for approved direction. Report changes, verification evidence and remaining visual or live LMS work.”

**Configure a course:** “Using the storyboard I provide, read `Course format: One-scroll / Multi-page` first and set `courseConfig.navigationMode` accordingly. Replace the neutral lesson data with approved content and sequence, using one page with logical lesson anchors or multiple ordered routes as selected. Keep the shared typography, People Connect footer, accessible header and pinned dependencies. Show the proposed lesson and milestone map before implementing it.”

**Audit completion:** “Compare every implemented required activity with `course-completion.ts`. Check target IDs, deliberate WATCH/SUBMIT/COMPLETE/EXPLORE triggers, optional-only VIEW exclusions, unlock order, storage version and LMS completion criteria. Confirm opening, scrolling and passive viewing cannot complete the course. Fix mismatches and run relevant browser verification. Run the extracted-ZIP verifier only during explicitly requested Release preparation.”

**Prepare handover:** “State the user-selected stage, defaulting to Preview. Report the source state, build and relevant verification, typography, completion, visual inspection and remaining issues. Report `Not run — Preview stage` or `Not run — Review stage` for SCORM packaging as applicable. Only in explicitly requested Release preparation, build approved source, package and verify the ZIP, identify its source state and distinguish simulated LMS results from outstanding live Oracle acceptance. Do not treat packaging as permission to publish, upload or merge; mark a ZIP stale after learner-facing source changes.”
