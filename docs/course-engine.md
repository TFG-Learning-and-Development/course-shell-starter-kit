# Building a course with the generic engine

The neutral example has two lessons: `/` and `/topics/practice/`. The order comes from `courseData.lessons` in `src/data/course.ts`; `src/data/course-config.ts` turns that list into validated runtime and package configuration. Edit course copy and lesson labels in `course.ts`, milestone requirements and storage version in `course-completion.ts`, and package identifier and filename in `course-config.ts`. Keep the existing theme and shared typography unless an approved course brief calls for scoped changes.

## Add a lesson

1. Add `{ id: "review", path: "/review/", label: "Review" }` to `courseData.lessons`.
2. Add a `review` entry to `courseData.lessonPages` with the same fields as the neutral `practice` entry. Give it unique `targets` and real copy. The catch-all Astro route generates `/review/index.html` automatically. A nested path such as `/topics/review/` also works.
3. Add matching milestones in `course-completion.ts`. For example:

   ```ts
   { id: "review-intro", label: "Read the review", type: "view",
     targetId: "review-intro", path: "/review/", required: true }
   ```

4. Increment the storage key version when changing the meaning or order of existing milestones. Set `sequentialUnlocking` to `false` if every lesson should always be available. A lesson with no required milestones passes through unlocking and shows no false 100% score.
5. Set a course-specific `identity.id`, package identifier and ZIP filename. Use a real logo under `public/assets/` if needed and provide descriptive alt text.
6. Run `npm run build`, `npm run verify`, `npm run package:scorm`, and `npm run verify:scorm`. Test the ZIP in the target LMS before handover.

## Reusable Codex prompts

**Build a course from the attached storyboard, mood board and assets:** “Act as a senior UX/UI designer and Astro developer. Build this course in the reusable Astro shell. Treat the storyboard as the approved source for learner content, lesson sequence, questions, activities and completion requirements; use the mood board and supplied assets for branding, imagery, colour, surfaces and course-specific composition. First reuse suitable premium library components; adapt them where appropriate. When no existing component serves the learning purpose, create a new premium reusable component with clear hierarchy, editorial composition, considered spacing, polished states and restrained motion. Every new component must inherit shared typography, spacing and theme tokens; support responsive layout, keyboard access, visible focus, readable contrast and reduced motion; provide clear instructions, feedback and completion cues where relevant; use typed content/configuration props and unique instance IDs; and remain free of fixed branding, lesson/item counts and course-specific storage keys. Document each new component and add a neutral working example to the development-only gallery. Choose only interactions that serve the learning design; do not add patterns to fill a gallery. Configure unique course, package, activity, target and versioned storage identities; register and wire the actual VIEW, WATCH, SUBMIT, COMPLETE and EXPLORE requirements through existing tracking/restoration contracts during the build. Preserve the standard header, Progress UI, lesson navigation, plain People Connect footer, accessibility and SCORM behavior. Do not invent missing content, questions, feedback or completion rules; identify ambiguous brief items and request approved direction.”

**Configure a course:** “Using the storyboard I provide, replace the neutral lesson data with ordered routes and copy. Keep the shared typography, People Connect footer, accessible header and pinned dependencies. Show the proposed lesson and milestone map before implementing it.”

**Audit completion:** “Compare every implemented required activity with `course-completion.ts`. Check target IDs, VIEW/WATCH/SUBMIT/COMPLETE/EXPLORE triggers, optional exclusions, unlock order, storage version and LMS completion criteria. Fix mismatches and run the browser and extracted-ZIP verifiers.”

**Prepare handover:** “Run build, browser verification, SCORM packaging and extracted-ZIP verification. Report typography and completion checks, the ZIP path, and what still requires live People Connect import, launch, resume and reporting tests.”
