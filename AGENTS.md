# Codex guidance

This repository is a reusable Astro course shell.

- Keep Astro on the established `7.3.8` baseline unless the user explicitly requests another reviewed migration. The supported Node.js floor is `22.12.0`.
- Reuse the existing Astro, Tailwind, layout, component and interaction foundation.
- Build every course from its approved storyboard, mood board and supplied assets. The storyboard controls content, sequence and activity requirements; the mood board controls branding, imagery and course-specific composition.
- Compose courses from the premium reusable component library and shared typography/spacing tokens. Choose only patterns that serve the learning design; never insert every available component as a gallery.
- Do not invent learner content, questions, examples or completion requirements when the brief is ambiguous. Record the gap and request the missing approved input.
- Do not redesign the course or replace the component system unless the user explicitly requests it.
- Do not perform general Astro or dependency upgrades unless the user explicitly requests them. Targeted compatible security fixes are allowed after inspecting the audit and dependency paths; explain framework-major or otherwise breaking changes before implementation.
- Keep learner-facing course information in `src/data/course.ts` where practical.
- Give every course, activity, DOM target, package and storage key a unique, course-specific identity.
- Preserve responsive navigation, keyboard access, visible focus states, the skip link and reduced-motion support.
- Keep the starter independent of credentials, analytics, deployment accounts and external runtime services. The SCORM 1.2 bridge uses only the API supplied by the LMS launch window.
- The reusable SCORM 1.2 package reports requirements-based completion. Never complete on launch, tab hiding, navigation or exit. Confirm and configure each course's required milestones before release; preserve completed and passed LMS status.
- Add course-specific assets under `public/assets/`, use descriptive alt text, and remove unused files after checking references.
- Keep the default footer wording exactly `Return to People Connect to continue` for every course. It remains plain static text with no link, control, completion event or LMS action. Set the footer background through the course theme to follow the supplied mood board or design board, and maintain readable contrast; keep the Back to top control unchanged.
- Keep the default header logo-only with an accessible home-link name and a distortion-free logo slot that accepts different aspect ratios. Put Lessons and Progress together at the padded right edge. Lessons opens a dark, internally scrolling overlay below its button, with configured lesson numbers starting at 00, titles, current-lesson highlighting, and lock explanations from the shared unlock state. Keep individual lesson links out of the header row. Preserve package-safe routes, keyboard focus, Escape and outside-click dismissal, and mutual dismissal with Progress on desktop and mobile.
- Present Back to top as the established compact rounded capsule with its upward arrow, subtle border and shadow, restrained hover treatment, and visible keyboard focus. Preserve its footer position, anchor behaviour and reduced-motion handling.
- On mobile, keep the footer in normal page flow and arrange its fixed message and Back to top capsule as a centred vertical column. Use a 16px gap, 24px block padding, 20px inline padding, a 144px minimum height that may grow, centred naturally wrapping message text, and a natural-width capsule with a 44px minimum touch height. Preserve the desktop footer row.
- Run `npm ci`, `npm run build`, `npm run verify` and `npm audit` after dependency changes.

### Component authoring policy

- Act as a senior UX/UI designer and Astro developer during every course build. Start with the storyboard's learning purpose, approved content and required evidence; use the mood board for branding, imagery and course-specific composition.
- Reuse a suitable shared component first. Adapt it when the learning need warrants it. If no component serves the need, create a new premium reusable component; never add an activity merely to use a pattern or populate the gallery.
- A new component must have clear hierarchy, editorial composition where suitable, considered spacing, polished interaction states and restrained motion. Inherit shared typography, spacing, theme and focus tokens rather than adding a competing visual system.
- Support responsive layout, keyboard access, visible focus, readable contrast and reduced motion. Give learners clear instructions, feedback and completion cues where relevant.
- Inset content and navigation consistently with shared spacing tokens; keep controls clear of card borders, dividers and rounded corners. Let content determine height unless a measured transition needs reserved space, constrain prose to a readable measure, and inspect initial plus active/feedback states at desktop and mobile widths before handover.
- Use typed content and configuration props, a unique instance ID, and course-agnostic implementation. Do not embed fixed branding, lesson or item counts, course-specific selectors or storage keys.
- Connect required interactions to the existing tracking and restoration contracts and register only storyboard-approved requirements. Never invent content, questions, feedback or assessment/completion rules when the brief is ambiguous; seek approved direction.
- Document each new reusable component in `docs/components.md` and add a neutral working example with purpose, editable props, completion behavior and usage to the development-only `scripts/fixtures/ComponentFixture.astro` gallery. Keep gallery state isolated from course progress and LMS communication.

## Mandatory course standards

### Theme inheritance

- Theme the Overview/hero accent styling through the shared `--course-accent` and `--course-accent-strong` tokens so every course inherits its supplied visual-board palette automatically. Do not retain hard-coded starter accent colours in the hero or change its approved layout and typography when applying a course theme.
- Configure logos, colours, surfaces and gradients through `courseConfig.theme` and `courseConfig.brand`. Keep course-specific imagery in learner-facing data rather than rewriting component styles.

### Typography

- Every new course must inherit the existing shared typography system through `CourseLayout.astro` and its shared styles.
- Preserve the established semantic heading levels, font families, sizes, weights, line heights and responsive scaling.
- Use the existing typography components, classes and `--course-type-*` tokens when building content and interactions.
- Build single-choice assessments and knowledge checks with the shared `PremiumAssessment` composition: one dark gradient rounded panel, heading and theme-accent rule above a two-column question/answers grid, a light icon question card with feedback beneath it, and large light radio answer cards to the right. Stack the grid and remove its divider on mobile. Selection shows configured feedback immediately and counts as a valid attempt, even when incorrect; restoration and empty rendering do not create attempts. Keep matching and other activity rules separate.
- Do not introduce a competing typography system or change shared typography to match a mood board, design board or other visual reference.
- Apply a specific heading override only when the user explicitly requests it, and scope the override to that heading without changing shared tokens.
- Do not add learner-facing eyebrow content or small contextual labels above headings. Start with the semantic heading and use ordinary introductory copy below it when needed.
- Use shared `--course-space-*`, radius and surface tokens for section spacing, card padding, grid gaps and heading-to-content spacing. Scoped typography overrides are allowed only when the approved design explicitly calls for them and must not change the shared defaults.

### Completion tracking

- Configure completion tracking during every course build; a separate tracking request is not required.
- Theme every course's progress UI through the shared `--course-accent` token so it inherits the supplied visual-board accent automatically. Do not hard-code a separate progress colour; keep the unfilled track neutral and verify readable contrast.
- Replace the starter milestones with course-specific requirements derived from the storyboard and the content actually implemented.
- Connect required content, videos and interactions to the existing VIEW, WATCH, attempt-based SUBMIT or COMPLETE, and EXPLORE triggers as appropriate.
- Preserve the approved tracking rules and defaults: ordinary VIEW content completes immediately on visible viewport entry, WATCH uses unique-range thresholds, SUBMIT and COMPLETE remain attempt-based, EXPLORE requires its children, and milestones retain equal weighting, persistence and restoration. Hidden content never earns VIEW credit. Keep learner-facing Reset Progress absent; activity-level Retry/Clear controls may remain.
- Exclude optional resources, navigation, footer copy and Back to top from required completion.
- Validate unique lesson routes, milestone and target IDs, exploration children, working triggers, a course-specific versioned storage key, browser persistence, LMS suspend/resume and isolation from stale standalone progress. A lesson with no required activities passes through sequential unlocking; an entirely empty requirement set never reports LMS completion.

### Handover readiness

- Include typography and completion-tracking checks in every documented build handover, alongside `npm run build`, `npm run verify`, `npm run package:scorm` and `npm run verify:scorm` results.
- Distinguish standalone browser tracking from the packaged SCORM 1.2 LMS bridge. Extracted-ZIP checks use a simulated LMS; live People Connect import, launch, resume and reporting still require separate acceptance testing.
