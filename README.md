# astro-course-shell

A neutral, reusable Astro course starter with a premium editorial and interaction library, configurable lessons and themes, requirements-based SCORM 1.2 packaging, responsive navigation, accessible focus states, a skip link and reduced-motion support. The two-lesson demonstration shows representative patterns without turning the course into a component gallery.

The dependency baseline is Astro `7.3.8` with Tailwind CSS `4.2.2` through `@tailwindcss/vite`. Astro 7 uses Vite 8; the installed Tailwind adapter supports that Vite major directly, so no styling migration or compatibility shim is required.

The two `@emnapi` development dependencies satisfy optional WASM compiler runtime peers in Astro 7's dependency graph. Keeping them explicit makes the tested installation reproducible; they are build-tool dependencies and are not shipped as browser code.

## Requirements

- Node.js `>=22.19.0` (successful local checks used Node.js `24.11.1`; the minimum version still needs a direct test)
- npm `>=9.6.5`
- npm package-lock v3 (`package-lock.json` must remain committed)

## Setup and commands

```sh
node --version
npm ci
npx playwright install chromium
npm run dev
npm run build
npm run verify
npm run preview
```

Package commands are reserved for an explicitly requested Release preparation stage: `npm run package:scorm` and `npm run verify:scorm`.

Confirm `node --version` is at least `22.19.0` before setup, then use `npm ci` for a clean, lockfile-exact install. On a fresh Linux CI image, Playwright may also require `npx playwright install --with-deps chromium`. Do not replace the lockfile with a lockfile from another package manager.

The starter runs locally without credentials, environment variables or an LMS connection. A packaged launch uses only the SCORM 1.2 API supplied by its LMS window. Its only external dependencies are the packages recorded in `package-lock.json`; no external runtime services, fonts, images or analytics are used.

Run `npm run dev` and open `http://localhost:4321/__component-gallery/` for the development-only component gallery. It renders the actual shared components with neutral examples. Preview choices and reflection text stay in memory for that page session. The route is excluded from normal production builds and SCORM packages; the verification fixture remains available only to the temporary verifier build.

## File map

- `src/data/course.ts` — primary editing location for metadata, lesson labels and learner-facing copy.
- `src/data/course-config.ts` — typed identity, branding, ordered lessons, unlocking and package metadata with validation.
- `src/data/course-completion.ts` — course-specific milestone requirements and versioned storage key.
- `docs/course-engine.md` — beginner lesson example and reusable Codex prompts.
- `src/pages/index.astro` and `src/pages/[...lesson].astro` — entry content and generated named/nested lesson pages.
- `src/components/CoursePage.astro` — shared responsive header, Progress, navigation and standard footer.
- `src/layouts/CourseLayout.astro` — shared document shell and metadata.
- `src/components/` — reusable presentation components; see [`docs/components.md`](docs/components.md) for properties and examples.
- `src/styles/premium-components.css` — shared spacing, surface, card, layout and interaction treatments inherited by premium components.
- `src/styles/global.css` — neutral theme, responsive layout, focus states and reusable component styles.
- `src/styles/typography.css` — shared Quick Course typography implementation.
- `src/styles/course-typography.css` — course-wide typography settings; see [`docs/typography.md`](docs/typography.md).
- `public/assets/` — course-specific images, downloads and static media; see [`docs/course-assets.md`](docs/course-assets.md).
- `scripts/verify-course.mjs` — production-output, responsive, interaction and verification-fixture checks.
- `scripts/fixtures/ComponentFixture.astro` — development gallery and verification fixture, injected only into local development or the temporary verification build.

## Editing guidance

Start with `src/data/course.ts`, then configure ordered routes and package identity in `src/data/course-config.ts` and real milestone requirements in `src/data/course-completion.ts`. The first lesson uses `/`; later paths may be named and nested, such as `/topics/practice/`. Add a matching `courseData.lessonPages` entry for each additional lesson. Keep every milestone `targetId` in sync with an actual rendered element. Add course-specific assets under `public/assets/`.

Read the storyboard field `Course format: One-scroll / Multi-page` before choosing routes. Set the single format setting, `courseConfig.navigationMode`, to `"sections"` for One-scroll or `"lessons"` for Multi-page. A One-scroll course can have multiple logical lessons on one continuous page: keep one page route at `/` and configure `navigationLessons` with each Lessons-menu title and section `targetId`. Optionally configure `sections` to group required activities under named Progress headings; each milestone must appear in exactly one group. Multi-page retains separate lesson routes, previous/next links, sequential unlocking and package-safe explicit `index.html` links. Preserve the existing format for maintenance unless a new format is requested. See [`docs/course-engine.md`](docs/course-engine.md) for both examples.

Within every accessible lesson, all sections and interaction items are available from the start. `ordered` StepGroup usage never locks later steps, and assessment questions never require earlier answers. Completion still depends on approved evidence; configured sequential unlocking applies only between lesson routes. See [`AGENTS.md`](AGENTS.md#mandatory-access-within-an-open-lesson).

For a real build, treat the approved storyboard as the source for content, sequence, questions and required activities. Copy its learner-facing passages verbatim under the mandatory storyboard copy fidelity rule in [`AGENTS.md`](AGENTS.md); ask for missing required copy. Use the mood board and supplied assets for the course theme, imagery and composition. Select the smallest useful set of premium patterns, register the actual milestones during the build, and use unique course, activity and storage identities. If the brief does not establish a completion requirement, stop and request the approved decision rather than inventing it.

Do not place eyebrow content or small contextual labels above headings. Begin each section with its semantic heading. Place any approved storyboard copy unsuitable for an eyebrow appropriately elsewhere without changing or omitting it; include an introduction only when the storyboard supplies one. The starter intentionally provides no eyebrow data field, component property, typography role or styling.

The default header is logo-only: keep the home link's accessible name, but do not add a visible course-name label beside the logo. The logo slot accepts wide or square image/SVG artwork without stretching. Place Lessons and Progress together at the padded right edge. The Lessons button opens a dark, internally scrolling overlay with configured lesson numbers starting at 00, titles, current-lesson highlighting and lock explanations from the shared unlock state. Do not place individual lesson links in the header row. Preserve package-safe routes, keyboard focus, Escape and outside-click dismissal, and mutual dismissal with Progress on desktop and mobile.

Set `brand.logoTreatment` to `"transparent"` for artwork intended to sit directly on the header colour; the default `"badge"` treatment uses a white logo slot. Choose the treatment explicitly from the supplied artwork and check its contrast. The compact ordered `StepGroup` and one-question-at-a-time `AssessmentSequence` are documented in [`docs/components.md`](docs/components.md) and previewed with neutral content in the development gallery.

The footer sentence is fixed for every course as `Return to People Connect to continue`. Keep it as plain static text: do not turn it into a link or button, attach completion tracking, or add an LMS action. Keep Back to top in its default compact capsule treatment with the upward arrow, keyboard focus, anchor behaviour and reduced-motion support. The footer background is course-specific and should follow the supplied mood board or design board through the theme colour settings, with readable text contrast.

At mobile widths, the footer uses the standard centred vertical layout: a naturally wrapping centred message above the natural-width capsule, separated by `16px`, with `24px` top/bottom padding, `20px` side padding, a `144px` minimum height, and a `44px` minimum capsule touch height. The footer remains in normal page flow and may grow for longer wrapping; tablet and desktop retain the horizontal row.

See [`docs/components.md`](docs/components.md) and [`docs/typography.md`](docs/typography.md) before composing new sections, and [`docs/course-assets.md`](docs/course-assets.md) before adding media.

For local setup and course testing, see [`docs/testing.md`](docs/testing.md).

### Typography

The default learner-facing family is the shared system stack `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`; no font installation or external font service is required. The stack is defined by `--course-type-font-sans` in `src/styles/course-typography.css`, and the actual system font may differ by operating system. Body copy defaults to `1.125rem` with a `1.55` line height, and shared narrow, standard and wide measures are `42rem`, `54rem` and `72rem`.

Every new course must inherit this shared system through `CourseLayout.astro`. Preserve its heading hierarchy, font families, sizes, weights, line heights and responsive scaling, and use the existing typography components, classes and tokens for content and interactions. Do not replace or modify shared typography to match a mood board or design board. A heading-specific override is permitted only when explicitly requested and must remain scoped to that heading. Eyebrow content is not permitted. Full role guidance and examples are in [`docs/typography.md`](docs/typography.md).

### Theme colours

Configure course colours, surfaces and gradients in `courseConfig.theme` and the logo in `courseConfig.brand` in `src/data/course-config.ts`. The layout maps these settings to shared CSS tokens; the `:root` block in `src/styles/global.css` provides neutral defaults for isolated previews. Relevant tokens include:

- `--course-accent` and `--course-accent-strong`
- `--nav-hover-background` and `--nav-hover-indicator`
- `--nav-active-background` and `--nav-active-indicator`
- `--focus-on-light` and `--focus-on-dark`

Hover, active and focus states have separate tokens so they remain distinguishable. Do not assume one accent works on every surface: contrast-check the light- and dark-surface focus colours independently after changing the theme.

The Overview/hero gradient must inherit `--course-accent-strong` and `--course-accent` for every course. Replace those shared tokens from the supplied mood board or design board; do not add hard-coded starter accent colours or alter the approved hero layout and typography as part of theming.

The footer uses `--course-accent` as its background, so update that token from the supplied mood board or design board and confirm the fixed white footer text remains readable. The Activity progress bar and related accent states must use the same shared token for every course; do not add a separate progress colour. Keep the unfilled track neutral and contrast-check the filled state against it.

After editing content, run `npm run build` and relevant verification such as `npm run verify`, then inspect the rendered course. The browser verifier creates and removes a temporary fixture build, exercising responsive widths, lesson navigation, shared components and progress restoration without packaging. See [Build stages](#build-stages) before creating a ZIP.

## Mandatory completion workflow

Completion tracking is part of every course build; it does not require a separate request. Replace the starter milestones in `src/data/course-completion.ts` with course-specific requirements derived from the storyboard and the content actually implemented. Connect required sections, videos and interactions to the existing VIEW, WATCH, attempt-based SUBMIT or COMPLETE, and EXPLORE triggers. Preserve the approved defaults and event contracts.

Optional resources, navigation, the fixed footer message and Back to top must not contribute to required completion. Validate unique lesson routes, milestone and target IDs, exploration children, working triggers, the course-specific versioned storage key, browser restoration and LMS suspend/resume. A lesson with no requirements passes through sequential unlocking; an entirely empty requirement set never completes the LMS. See [`docs/completion-tracking.md`](docs/completion-tracking.md) for the exact contracts.

## Build stages

Explicit user instructions select the stage; otherwise use **Preview**. Report the stage, source state, checks run, typography and completion tracking, visual inspection and remaining issues.

| Stage | Work and handover | SCORM package |
| --- | --- | --- |
| Preview | Build approved content, branding, interactions and completion configuration; run the production build and relevant verification; inspect the rendered course and report issues. | `Not run — Preview stage` |
| Review | Compare the rendered course with its storyboard and mood board; check content, responsive layout, accessibility, interactions, progress and resume; fix issues and rerun affected checks. Separate automated results from human visual/content approval. | `Not run — Review stage`, unless packaged LMS testing is explicitly requested, which enters Release preparation. |
| Release | Only on an explicit request for packaging, a release candidate or release preparation: build the latest approved source, run `npm run package:scorm` and `npm run verify:scorm`, and identify the source commit or working-tree state in the ZIP report. | Report simulated LMS results and outstanding live Oracle/People Connect import, launch, resume and reporting checks. Learner-facing source edits after packaging make the ZIP stale until rebuilt. |

Packaging does not authorise publishing, LMS upload or merging. Standalone use saves browser progress; a packaged launch uses the LMS-provided SCORM 1.2 API.

**Packaging shortcut:** A direct instruction to “Package this course” enters Release preparation; quoted examples or questions about the phrase do not. Follow [AGENTS.md](AGENTS.md#packaging-shortcut), including the `Content` title and ZIP checks. Packaging alone does not authorise a commit, push or upload.

## Hosting assumptions

The default build is a static site in `dist/` intended to be served at a domain root. A static host must serve `dist/index.html` for `/`, each configured lesson's `index.html`, and generated files beneath `dist/_astro/` and `dist/assets/`.

`package:scorm` rewrites built asset links relative to each lesson folder and targets explicit `index.html` lesson files. It packages a single SCO with a manifest derived from configuration. Ordinary non-SCORM subdirectory hosting still needs a reviewed Astro `base` configuration.

## SCORM status

The neutral SCORM 1.2 demonstration package is `scorm-output/Course-Shell-SCORM-1.2.zip`. Before using this shell for a real course, replace the demonstration copy, course identity, package metadata and milestone requirements with approved course-specific values, increment the storage version when requirements change, and test the resulting ZIP in the target LMS. No learner-facing Exit, Finish or Reset Progress control is included.

## Optional WASM packages

With the tested npm release, `npm ls` can label `@img/sharp-wasm32`, `@napi-rs/wasm-runtime` and `@tybys/wasm-util` as extraneous even though the lockfile records them in optional WASM fallback paths. An isolated `npm ci`, production build and browser verification succeed with the current manifests. Treat the labels as dependency-tree diagnostics, not as a reason to remove or upgrade packages without a reproduced build problem.

## Dependency security

Run `npm audit` before team handover and review dependency paths before applying fixes. Compatible security updates are expected; framework-major upgrades require an explicit migration decision and full verification. Do not use `npm audit fix --force` without reviewing the proposed breaking changes.
