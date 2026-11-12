# Codex guidance

This repository is a reusable Astro course shell.

## Course-authoring workflow

For every new course, work through the following before implementation:

1. **Discover the inputs.** Inspect the supplied storyboard, mood board and assets. Confirm the explicit `One-scroll` or `Multi-page` format; identify approved learner-facing copy, questions, feedback, interactions, branding, image references and available media. Flag missing required information without inventing learner-facing content.
2. **Consult the foundation.** Read [`docs/components.md`](docs/components.md), [`docs/patterns.md`](docs/patterns.md), [`docs/typography.md`](docs/typography.md), [`docs/course-assets.md`](docs/course-assets.md), [`docs/course-engine.md`](docs/course-engine.md) and [`docs/completion-tracking.md`](docs/completion-tracking.md). Understand each relevant component or pattern's purpose, properties, accessibility and completion behaviour before selecting it.
3. **Make a concise internal plan.** Record the course format, content/page structure, component and pattern choices, theme/media approach, completion requirements and any material input gaps. Make routine implementation decisions within the approved brief without an approval pause.
4. **Compose the course intentionally.** Act as an instructional designer, UX/UI designer and Astro developer: use the mood board to create a coherent visual identity through the established theme, branding, typography, spacing, imagery and approved patterns. Aim for clear hierarchy, deliberate composition, consistent art direction, visual variety, responsive pacing and cohesive styling. Prefer approved implementations over replacements, and never add interactions or copy merely to demonstrate the library.
5. **Treat the demonstration as a capability example, not a template.** Its exact page composition, component order and visual arrangements are not compulsory. Interpret each new storyboard independently; use different approved layouts and combinations where appropriate while preserving the shell, design system, accessibility, navigation, tracking and SCORM compatibility.
6. **Build and review by stage.** Follow the Preview, Review and Release rules below. A successful automated build is not visual approval; compare rendered content with the storyboard and mood board, then report remaining visual, content or live-LMS work.

## Mandatory storyboard copy fidelity

- Use only approved storyboard copy for learner-facing content. Never generate additional introductions, summaries, examples, transitions, activity instructions, questions, answers or feedback. If required copy is missing, ask for it rather than writing it yourself. Existing mandatory shell interface labels remain permitted and retain their required wording.
- Copy every approved learner-facing storyboard passage **verbatim**. Preserve wording, spelling, capitalisation, punctuation, numbers, headings, questions, answer options and feedback. Do not paraphrase, summarise, shorten, polish, correct typos or omit copy without explicit user approval.
- Layout changes, line wrapping and semantic HTML formatting are permitted only when they preserve the content.
- Content enclosed in curly braces `{...}` is non-learner-facing guidance: do not display the braces or their contents. Clearly identified developer/build instructions guide implementation but must not appear as learner-facing copy. Ordinary parentheses `(...)` and square brackets `[...]` are **not** exclusions. If it is unclear whether text is learner copy or an instruction, ask before omitting or rewriting it.
- Generic style rules must not silently remove approved storyboard copy. Place copy unsuitable for a prescribed treatment appropriately elsewhere without changing its wording. Preserve mandatory shell interface wording separately from storyboard copy.
- Do not automatically add learner-facing exploration tally captions such as “X of Y cards/items/steps explored”. Track exploration internally and reflect completion through the established Progress interface. Do not invent these captions during course builds. If approved storyboard copy explicitly contains a conflicting tally, flag the conflict rather than silently changing approved wording.
- Progress menu headings and entries must use approved section/activity names only. Never automatically prepend instructional verbs such as Complete, View, Watch, Explore or Submit.
- Compare rendered learner copy against the storyboard. Account for every learner-facing passage and record permitted exclusions. Report unresolved differences; a successful build alone does not establish verbatim fidelity.

## Mandatory access within an open lesson

- **Never lock or gate content within an accessible lesson. Learners must be able to access every section, activity and interaction item without first completing, answering, exploring or watching another item.** Make every card, tab, process step, carousel item and assessment question directly accessible from the start. The authored step array preserves display order and numbering; `ordered` must not disable later steps.
- Preserve intended display order and Previous/Next controls. Normal click-to-reveal behaviour, answer-dependent feedback, valid-input submission rules and genuine first/last navigation boundaries are permitted. Do not require an answer, correct answer, completed video or explored item to access other content in the lesson.
- Keep access separate from completion: required milestones, valid attempts, watch thresholds and exploration children still need their approved evidence. Merely exposing an item grants no credit. Preserve saved state, resume and earned progress. `completion.sequentialUnlocking` may still gate **between lessons** when configured; it never gates content inside an accessible lesson.
- If an approved storyboard explicitly requires an in-lesson prerequisite, flag the conflict for an approved decision. Do not silently change its copy or implement the internal lock.

## Build stages

Explicit user instructions determine the stage; default to **Preview** when no stage is stated.

- **Preview:** Build or refine approved content, branding, interactions and completion configuration. Run the production build and relevant verification without packaging hooks, inspect the rendered course and report remaining issues. Do not generate or verify a SCORM ZIP. Report packaging as `Not run — Preview stage`.
- **Review:** Compare the rendered course with its storyboard and mood board. Check content coverage, responsive layout, accessibility, interactions, progress and resume; fix issues and rerun affected checks. Distinguish automated results from human visual/content approval. Do not generate or verify a ZIP unless the user explicitly requests packaged LMS testing; that request enters Release preparation.
- **Release:** Enter only on an explicit request for packaging, a release candidate or release preparation. Build the latest approved source, package it and run package verification. Report the source commit or working-tree state represented by the ZIP, separate simulated LMS results from live Oracle acceptance and list outstanding live checks. Packaging does not authorise publishing, LMS upload or merging. Learner-facing source changes make the package stale until rebuilt.

### Packaging shortcut

- A direct instruction to **“Package this course”** (case-insensitive, with ordinary punctuation) authorises Release preparation. Quoted examples, discussion of the phrase and questions about it are not instructions to package.
- Package the current course's latest saved source as SCORM 1.2 with the existing `build`, `verify`, `package:scorm` and `verify:scorm` scripts. Preserve approved design, content, completion requirements, tracking, resume and Oracle session handling.
- Confirm the browser and manifest titles are both `Content`; do not silently rewrite approved course identity to make them match. Verify ZIP integrity, root-level `imsmanifest.xml`, the launch path and referenced assets. If a check fails or the title conflicts with approved configuration, report the issue and do not call the package ready.
- Report the ZIP path, source commit or working-tree state, check results and remaining live Oracle acceptance. Simulated LMS checks are not live acceptance. The shortcut does not authorise committing, merging, pushing, publishing or uploading; those actions require separate instructions.

## Course format comes from the storyboard

- Read the storyboard's explicit course-format instruction **before** planning routes or building pages. Record the selected format in `courseConfig.navigationMode` and the build summary. Use the storyboard field `Course format: One-scroll / Multi-page`: `One-scroll` maps to `navigationMode: "sections"`; `Multi-page` maps to `navigationMode: "lessons"`.
- Follow the declared format unless the user explicitly overrides it. Never infer format solely from course length, lesson count, a visual board, a duplicated source project or the shell's demonstration mode. A One-scroll course may contain several logical lessons, all on one continuous page; its Lessons menu links to section anchors and it has no lesson-to-lesson Proceed controls. A Multi-page course uses separate lesson pages, explicit packaged `index.html` links and configured sequential unlocking.
- If the storyboard omits the format or conflicts with itself, check the supplied build brief and explicit user instructions. If they do not resolve it, ask one focused clarification **before format-dependent implementation**. When maintaining an existing course without a new format instruction, preserve its current format.

- Keep Astro on the established `7.3.8` baseline unless the user explicitly requests another reviewed migration. The supported Node.js floor is `22.19.0`, matching the pinned dependency tree.
- Reuse the existing Astro, Tailwind, layout, component and interaction foundation.
- Read approved private build materials from `course-inputs/storyboard/`, `course-inputs/moodboard/` and `course-inputs/references/` before authoring. These folders are local and Git-ignored; never commit their client materials or copy them directly into the package. Add only approved learner-facing production assets to `public/assets/`.
- Build every course from its approved storyboard, mood board and supplied assets. The storyboard controls content, sequence and activity requirements; the mood board controls branding, imagery and course-specific composition.
- Compose courses from the premium reusable component library and shared typography/spacing tokens. Choose only patterns that serve the learning design; never insert every available component as a gallery.
- Do not invent completion requirements when the brief is ambiguous. Record the gap and request the missing approved input. Apply the mandatory storyboard copy fidelity rule to all learner-facing content, including when copy is missing.
- Do not redesign the course or replace the component system unless the user explicitly requests it.
- Do not perform general Astro or dependency upgrades unless the user explicitly requests them. Targeted compatible security fixes are allowed after inspecting the audit and dependency paths; explain framework-major or otherwise breaking changes before implementation.
- Keep learner-facing course information in `src/data/course.ts` where practical.
- Give every course, activity, DOM target, package and storage key a unique, course-specific identity.
- Preserve responsive navigation, keyboard access, visible focus states, the skip link and reduced-motion support.
- Keep the starter independent of credentials, analytics, deployment accounts and external runtime services. The SCORM 1.2 bridge uses only the API supplied by the LMS launch window.
- The reusable SCORM 1.2 package reports requirements-based completion. Launch, tab hiding, navigation, scrolling, passive viewing and exit grant no required credit. Required milestones must be deliberate learner evidence: a valid assessment or matching attempt, approved interactive exploration, a watch threshold or explicit completion action. VIEW is optional-only. Confirm and configure each course's required milestones before release; preserve completed and passed LMS status.
- Package SCORM 1.2 with one persistent `index.html` launcher and one SCO. The launcher owns initialization, final save, `exit=suspend`, commit and finish; learner pages run in its named iframe and reuse `window.parent.CourseSCORM`. Children must not initialize or finish the SCO, and late saves must stop when the parent closes. Map logical `/` to `overview.html` and other lesson routes to explicit nested `index.html` files. Store logical routes in `cmi.core.lesson_location`, validate `?module=` against configured routes, and keep the ordinary `dist` build unchanged.
- For an explicitly authorized infrastructure migration, temporary neutral test ZIPs may exercise `package:scorm` and `verify:scorm` in Preview. They are verification artifacts, not a production course package or live LMS acceptance. The normal Preview/Review and direct packaging shortcut rules still apply to course builds.
- Add course-specific assets under `public/assets/`, use descriptive alt text, and remove unused files after checking references.
- Keep the default footer wording exactly `Return to People Connect to continue` for every course. It remains plain static text with no link, control, completion event or LMS action. Set the footer background through the course theme to follow the supplied mood board or design board, and maintain readable contrast; keep the Back to top control unchanged.
- Keep the default header logo-only with an accessible home-link name and a distortion-free logo slot that accepts different aspect ratios. Put Lessons and Progress together at the padded right edge. Lessons opens a dark, internally scrolling overlay below its button, with configured lesson numbers starting at 00, titles, current-lesson highlighting, and lock explanations from the shared unlock state. Keep individual lesson links out of the header row. Preserve package-safe routes, keyboard focus, Escape and outside-click dismissal, and mutual dismissal with Progress on desktop and mobile.
- Choose `navigationMode: "sections"` only for a single-page course with configured section anchors; use `"lessons"` or the default for multiple lesson routes. Keep section links, grouped Progress headings and milestone targets aligned. Preserve the explicit `index.html` helper for packaged multi-page links. Configure white or transparent logo artwork with `brand.logoTreatment` rather than filename checks.
- Present Back to top as the established compact rounded capsule with its upward arrow, subtle border and shadow, restrained hover treatment, and visible keyboard focus. Preserve its footer position, anchor behaviour and reduced-motion handling.
- On mobile, keep the footer in normal page flow and arrange its fixed message and Back to top capsule as a centred vertical column. Use a 16px gap, 24px block padding, 20px inline padding, a 144px minimum height that may grow, centred naturally wrapping message text, and a natural-width capsule with a 44px minimum touch height. Preserve the desktop footer row.
- Run `npm ci`, `npm run build`, `npm run verify` and `npm audit` after dependency changes.

### Component authoring policy

These instructions apply automatically to every course build and every new or adapted component.

- Act as a senior UX/UI designer and Astro developer. Treat the approved shell's visual and interaction quality as the baseline. Use the storyboard for learning purpose, content, sequence, feedback and completion evidence; use the mood board for branding, imagery and course-specific composition while preserving the shared typography.
- Before implementation, map each storyboard activity to a suitable existing component, an adaptation or a new component, with a short reason and its completion trigger. Keep this in working notes or the handover; do not add an approval pause for routine design decisions within the approved brief.
- Reuse a suitable shared component first and adapt it when needed. When the library does not serve the learning purpose, design and implement a new premium reusable component as part of the build. A separate request to create it is not required. Course builds must work from this shell and the supplied inputs without requiring another course repository.
- Choose interactions that serve the learning design. Do not add activities to fill a gallery, force the storyboard into an unsuitable pattern, or invent completion rules. Ask for any missing required learner-facing copy and for missing approved input that materially blocks implementation.

#### Interaction quality requirements

- Present approved headings, instructions and content clearly, with a clear next action. Do not shorten or add copy to achieve this. Use editorial image/text composition, appropriate surfaces, restrained gradients and depth where they support the approved design. Give icons a purpose and use consistent image proportions.
- Inherit the shared typography, theme, spacing, radius, focus and motion rules. Keep component-specific styles scoped and driven by tokens. Do not add competing font scales or fixed course colours.
- Put content, feedback and controls inside deliberate padded regions. Keep buttons clear of options, card edges, dividers and rounded corners in every state. Use shared spacing for heading-to-copy, option gaps and action rows; prevent overlap, clipping and controls sitting on the rim of a panel.
- Let real content determine height. Reserve space only for a justified transition or feedback layout. Handle long copy, wrapped labels, different item counts and image aspect ratios without empty fixed-height panels or page-level overflow. Preserve the approved assessment composition.
- Provide consistent initial, hover, selected, focus, disabled, feedback, complete and restored states, plus validation or save-error states where relevant. Make the result and next step understandable without relying only on colour, animation or an icon.
- Support keyboard operation, semantic controls, accessible names and relationships, visible focus, readable contrast, reduced motion and generous touch targets. Stack or wrap layouts and contain necessary internal scrolling before labels or controls become cramped.
- Use typed content/configuration props and unique instance IDs. Keep components independent of course branding, lesson or item counts, selectors for a specific course and storage identities. Multiple instances must operate independently.
- Register only approved required milestones and use the existing tracking, persistence and restoration contracts. Empty rendering, hidden content, navigation, scrolling, passive viewing and restoration must not invent an attempt. Required exploration begins only after the learner deliberately activates an item, then its displayed panel must be genuinely visible. Keep reflection privacy and LMS-attempt isolation intact.
- Apply the deliberate-action and visibility-aware exploration lifecycle to new or adapted tabbed, carousel, process and explorer components. Initial, restored or newly revealed active panels do not earn required credit until the learner acts.
- Use `StepGroup` with `ordered` and `compactVertical` for an approved visible process when appropriate; letters and labels come from the supplied content, and every step remains directly accessible. Use `AssessmentSequence` for an approved series of single-choice questions; every question is reachable before any answer, with a distinct SUBMIT milestone per question. Selecting an answer shows its configured feedback and records a valid attempt; arrows and section links only navigate.

#### Instructional grouping and visual composition

- Keep an approved scenario, its quotation or evidence, learner task and associated assessment together as one coherent instructional sequence. Do not split that sequence into unrelated decorative blocks or insert gallery-style components between its dependent parts.
- Select components for the approved learning purpose and sequence, not to demonstrate the library. Preserve exact storyboard labels, especially navigation labels, and never invent learner-facing transitions, instructions, questions, answers or feedback.
- Treat the mood board as direction for the course composition, not as a request to apply every sample treatment. Establish a consistent vertical rhythm with background-aware section spacing, align content to the shared grid, and use a small cohesive set of section backgrounds and surfaces.
- Use supplied images and icons only where they have a semantic instructional or editorial role. Maintain readable text/background contrast and inspect the actual rendered composition at desktop and mobile widths; resolve cramped spacing, broken alignment, empty fixed-height surfaces and image misuse before handover.

#### Review before handover

- Review the actual course content and assets in the rendered component. Compare all rendered learner copy with the storyboard, account for every passage and record permitted exclusions and unresolved differences. Inspect initial and active/feedback states at narrow mobile, an intermediate width and desktop, including a responsive breakpoint; verify controls and long labels remain inside their padded regions.
- Exercise the learner path with mouse/touch and keyboard as appropriate, including valid and empty input, incorrect attempts, moving between items, refresh/resume and applicable save failures. Check more than one instance and representative minimum and larger item counts when adding a reusable pattern.
- Fix defects found in that review and rerun the relevant checks before handing over. Add meaningful regression coverage for new behaviour and defects such as edge-touching controls, overflow, unintended completion and lost restoration. Preserve the existing build and verification suites.
- Document the component in `docs/components.md` and add a neutral working example to `scripts/fixtures/ComponentFixture.astro` with its purpose, editable props, completion behaviour and usage. Keep gallery state in memory and isolated from real course progress and LMS communication.
- Report which components were reused, adapted or created, what was visually inspected and which checks passed. If browser or visual checks cannot run, identify the unverified areas and leave their review pending; do not describe a successful build alone as visual approval or live LMS acceptance.

## Mandatory course standards

### Theme inheritance

- Theme the Overview/hero accent styling through the shared `--course-accent` and `--course-accent-strong` tokens so every course inherits its supplied visual-board palette automatically. Do not retain hard-coded starter accent colours in the hero or change its approved layout and typography when applying a course theme.
- Configure logos, colours, surfaces and gradients through `courseConfig.theme` and `courseConfig.brand`. Keep course-specific imagery in learner-facing data rather than rewriting component styles.

### Typography

- System sans-serif is the default for all learner-facing text. Use the shared `--course-type-font-sans` token from `src/styles/course-typography.css` or inherit it from the course layout; controls must inherit the family without resetting their sizes or weights. System fonts may render differently across operating systems.
- Do not add external font services, require laptop font installation or define component-specific text families. An explicitly approved custom font must be licensed, bundled locally as a webfont and fall back to the system stack. Keep intentional monospace code text and functional icon fonts where needed.
- Every new course must inherit the existing shared typography system through `CourseLayout.astro` and its shared styles.
- Preserve the established semantic heading levels, font families, sizes, weights, line heights and responsive scaling.
- Use the existing typography components, classes and `--course-type-*` tokens when building content and interactions.
- Build single-choice assessments and knowledge checks with the shared `PremiumAssessment` composition: one dark gradient rounded panel, heading and theme-accent rule above a two-column question/answers grid, a light icon question card with feedback beneath it, and large light radio answer cards to the right. Stack the grid and remove its divider on mobile. Selection shows configured feedback immediately and counts as a valid attempt, even when incorrect; restoration and empty rendering do not create attempts. Keep matching and other activity rules separate.
- Do not introduce a competing typography system or change shared typography to match a mood board, design board or other visual reference.
- Apply a specific heading override only when the user explicitly requests it, and scope the override to that heading without changing shared tokens.
- Do not use learner-facing eyebrow content or small contextual labels above headings. Start with the semantic heading; place any approved storyboard copy unsuitable for that treatment appropriately below it without changing or omitting the wording. Do not create an introduction unless the storyboard supplies it.
- Use shared `--course-space-*`, radius and surface tokens for section spacing, card padding, grid gaps and heading-to-content spacing. Scoped typography overrides are allowed only when the approved design explicitly calls for them and must not change the shared defaults.

### Completion tracking

- Configure completion tracking during every course build; a separate tracking request is not required.
- Theme every course's progress UI through the shared `--course-accent` token so it inherits the supplied visual-board accent automatically. Do not hard-code a separate progress colour; keep the unfilled track neutral and verify readable contrast.
- Replace the starter milestones with course-specific requirements derived from the storyboard and the content actually implemented.
- Connect required videos and interactions to WATCH, attempt-based SUBMIT or COMPLETE, and deliberate EXPLORE triggers as appropriate. VIEW may only be configured with `required: false`.
- Preserve the approved tracking rules and defaults: WATCH uses unique-range thresholds; SUBMIT and COMPLETE remain valid-attempt based; EXPLORE requires its deliberately activated children to become genuinely visible; milestones retain equal weighting, persistence and restoration. Correctness is required only when an approved activity contract explicitly configures it. Keep learner-facing Reset Progress absent; activity-level Retry/Clear controls may remain.
- Optional VIEW observation checks the target and its ancestors for `hidden`, `display: none`, `content-visibility: hidden` and effective zero opacity; it also rejects computed `visibility: hidden` or `collapse` on the target. It can never contribute to required percentage, unlocking or LMS completion.
- Exclude passive content, scrolling, optional resources, navigation, footer copy and Back to top from required completion.
- Validate unique lesson routes, milestone and target IDs, exploration children, working triggers, a course-specific versioned storage key, browser persistence, LMS suspend/resume and isolation from stale standalone progress. A lesson with no required activities passes through sequential unlocking; an entirely empty requirement set never reports LMS completion.
- Store reflection text only in private browser storage scoped to a known learner, or in memory for the current page when the approved requirement is merely a valid response. Never put learner text in LMS suspend data. Require durable text storage only when the storyboard explicitly calls for it, and explain unavailable storage to the learner.

### Stage-specific handover

- Report the selected stage, source state, typography and completion-tracking checks, visual review performed and remaining issues. In Preview and Review, report SCORM packaging as `Not run — Preview stage` or `Not run — Review stage` respectively. Only Release reports package and extracted-ZIP verification results. Distinguish standalone browser checks, simulated LMS checks and live Oracle/People Connect acceptance.
