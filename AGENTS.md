# Codex guidance

This repository is a reusable Astro course shell.

- Keep Astro on the established `7.3.8` baseline unless the user explicitly requests another reviewed migration. The supported Node.js floor is `22.12.0`.
- Reuse the existing Astro, Tailwind, layout, component and interaction foundation.
- Do not redesign the course or replace the component system unless the user explicitly requests it.
- Do not perform general Astro or dependency upgrades unless the user explicitly requests them. Targeted compatible security fixes are allowed after inspecting the audit and dependency paths; explain framework-major or otherwise breaking changes before implementation.
- Keep learner-facing course information in `src/data/course.ts` where practical.
- Preserve responsive navigation, keyboard access, visible focus states, the skip link and reduced-motion support.
- Keep the starter independent of credentials, analytics, deployment accounts and LMS services.
- Treat SCORM as pending. Do not add completion rules, LMS calls, manifests or packages without confirmed requirements.
- Add course-specific assets under `public/assets/`, use descriptive alt text, and remove unused files after checking references.
- Keep the default footer wording exactly `Return to People Connect to continue` for every course. It remains plain static text with no link, control, completion event or LMS action. Set the footer background through the course theme to follow the supplied mood board or design board, and maintain readable contrast; keep the Back to top control unchanged.
- Keep the default header logo-only with an accessible home-link name and a distortion-free logo slot that accepts different aspect ratios. Use the wide responsive header pattern: logo, flexible space, navigation links, then Progress at the padded right edge. Support at least five realistic navigation labels and collapse to the mobile disclosure before they wrap, overlap or crowd adjacent controls.
- Present Back to top as the established compact rounded capsule with its upward arrow, subtle border and shadow, restrained hover treatment, and visible keyboard focus. Preserve its footer position, anchor behaviour and reduced-motion handling.
- On mobile, keep the footer in normal page flow and arrange its fixed message and Back to top capsule as a centred vertical column. Use a 16px gap, 24px block padding, 20px inline padding, a 144px minimum height that may grow, centred naturally wrapping message text, and a natural-width capsule with a 44px minimum touch height. Preserve the desktop footer row.
- Run `npm ci`, `npm run build`, `npm run verify` and `npm audit` after dependency changes.

## Mandatory course standards

### Theme inheritance

- Theme the Overview/hero accent styling through the shared `--course-accent` and `--course-accent-strong` tokens so every course inherits its supplied visual-board palette automatically. Do not retain hard-coded starter accent colours in the hero or change its approved layout and typography when applying a course theme.

### Typography

- Every new course must inherit the existing shared typography system through `CourseLayout.astro` and its shared styles.
- Preserve the established semantic heading levels, font families, sizes, weights, line heights and responsive scaling.
- Use the existing typography components, classes and `--course-type-*` tokens when building content and interactions.
- Do not introduce a competing typography system or change shared typography to match a mood board, design board or other visual reference.
- Apply a specific heading override only when the user explicitly requests it, and scope the override to that heading without changing shared tokens.
- Do not add learner-facing eyebrow content or small contextual labels above headings. Start with the semantic heading and use ordinary introductory copy below it when needed.

### Completion tracking

- Configure completion tracking during every course build; a separate tracking request is not required.
- Theme every course's progress UI through the shared `--course-accent` token so it inherits the supplied visual-board accent automatically. Do not hard-code a separate progress colour; keep the unfilled track neutral and verify readable contrast.
- Replace the starter milestones with course-specific requirements derived from the storyboard and the content actually implemented.
- Connect required content, videos and interactions to the existing VIEW, WATCH, attempt-based SUBMIT or COMPLETE, and EXPLORE triggers as appropriate.
- Preserve the approved tracking rules and defaults, including VIEW dwell behavior, WATCH unique-range thresholds, attempt-based completion, EXPLORE completion, equal weighting, persistence, restoration and reset.
- Exclude optional resources, navigation, footer copy and Back to top from required completion.
- Validate unique milestone and target IDs, working targets and triggers, a course-specific versioned storage key, persistence and restoration.

### Handover readiness

- Include typography and completion-tracking checks in every documented build handover, alongside `npm run build` and `npm run verify` results.
- Describe the included completion system as browser tracking only. Do not represent it as LMS or SCORM reporting.
- Report any missing LMS runtime, LMS reporting, manifest, launch wrapper or SCORM packaging infrastructure as outstanding work.
