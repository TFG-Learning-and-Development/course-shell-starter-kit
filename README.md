# astro-course-shell

A neutral, reusable Astro course starter with responsive section navigation, accessible focus states, a skip link, reduced-motion support and one example interaction.

The dependency baseline is Astro `7.3.8` with Tailwind CSS `4.2.2` through `@tailwindcss/vite`. Astro 7 uses Vite 8; the installed Tailwind adapter supports that Vite major directly, so no styling migration or compatibility shim is required.

The two `@emnapi` development dependencies satisfy optional WASM compiler runtime peers in Astro 7's dependency graph. Keeping them explicit makes the tested installation reproducible; they are build-tool dependencies and are not shipped as browser code.

## Requirements

- Node.js `>=22.12.0` (tested with Node.js `24.11.1`)
- npm `>=9.6.5`
- npm package-lock v3 (`package-lock.json` must remain committed)

## Setup and commands

```sh
npm ci
npx playwright install chromium
npm run dev
npm run build
npm run verify
npm run preview
```

Use `npm ci` for a clean, lockfile-exact install. On a fresh Linux CI image, Playwright may also require `npx playwright install --with-deps chromium`. Do not replace the lockfile with a lockfile from another package manager.

The starter runs locally without credentials, environment variables or an LMS connection. Its only external dependencies are the packages recorded in `package-lock.json`; no external runtime services, fonts, images or analytics are used.

## File map

- `src/data/course.ts` — primary editing location for metadata, navigation labels and learner-facing copy.
- `src/pages/index.astro` — starter-page structure and client-side navigation/interaction behaviour.
- `src/layouts/CourseLayout.astro` — shared document shell and metadata.
- `src/components/` — reusable presentation components; see [`docs/components.md`](docs/components.md) for properties and examples.
- `src/styles/global.css` — neutral theme, responsive layout, focus states and reusable component styles.
- `src/styles/typography.css` — shared Quick Course typography implementation.
- `src/styles/course-typography.css` — course-wide typography settings; see [`docs/typography.md`](docs/typography.md).
- `public/assets/` — course-specific images, downloads and static media; see [`docs/course-assets.md`](docs/course-assets.md).
- `scripts/verify-course.mjs` — production-output, responsive, interaction and verification-fixture checks.
- `scripts/fixtures/ComponentFixture.astro` — verification-only component page; it is injected only into the temporary verification build.

## Editing guidance

Start with `src/data/course.ts`. Keep each navigation `id` in sync with the corresponding section ID in `src/pages/index.astro`. Keep stable layout and interaction behaviour in the existing page and components, and add course-specific assets under `public/assets/`.

Do not add eyebrow content or small contextual labels above headings. Begin each section with its semantic heading, followed by an optional introduction when useful; the starter intentionally provides no eyebrow data field, component property, typography role or styling.

The default header is logo-only: keep the home link's accessible name, but do not add a visible course-name label beside the logo. The logo slot accepts wide or square image/SVG artwork without stretching. Preserve the header order—logo, flexible space, navigation links, then Progress at the padded right edge—and retain the early mobile breakpoint so at least five realistic link labels move into the disclosure before they wrap or crowd adjacent controls.

The footer sentence is fixed for every course as `Return to People Connect to continue`. Keep it as plain static text: do not turn it into a link or button, attach completion tracking, or add an LMS action. Keep Back to top in its default compact capsule treatment with the upward arrow, keyboard focus, anchor behaviour and reduced-motion support. The footer background is course-specific and should follow the supplied mood board or design board through the theme colour settings, with readable text contrast.

At mobile widths, the footer uses the standard centred vertical layout: a naturally wrapping centred message above the natural-width capsule, separated by `16px`, with `24px` top/bottom padding, `20px` side padding, a `144px` minimum height, and a `44px` minimum capsule touch height. The footer remains in normal page flow and may grow for longer wrapping; tablet and desktop retain the horizontal row.

See [`docs/components.md`](docs/components.md) and [`docs/typography.md`](docs/typography.md) before composing new sections, and [`docs/course-assets.md`](docs/course-assets.md) before adding media.

### Typography

The local default is `"Arial Nova", Arial, Helvetica, sans-serif`; no webfont is loaded. Body copy defaults to `1.125rem` with a `1.55` line height, and shared narrow, standard and wide measures are `42rem`, `54rem` and `72rem`.

Every new course must inherit this shared system through `CourseLayout.astro`. Preserve its heading hierarchy, font families, sizes, weights, line heights and responsive scaling, and use the existing typography components, classes and tokens for content and interactions. Do not replace or modify shared typography to match a mood board or design board. A heading-specific override is permitted only when explicitly requested and must remain scoped to that heading. Eyebrow content is not permitted. Full role guidance and examples are in [`docs/typography.md`](docs/typography.md).

### Theme colours

Configure course colours in the `:root` block at the top of `src/styles/global.css`:

- `--course-accent` and `--course-accent-strong`
- `--nav-hover-background` and `--nav-hover-indicator`
- `--nav-active-background` and `--nav-active-indicator`
- `--focus-on-light` and `--focus-on-dark`

Hover, active and focus states have separate tokens so they remain distinguishable. Do not assume one accent works on every surface: contrast-check the light- and dark-surface focus colours independently after changing the theme.

The footer uses `--course-accent` as its background, so update that token from the supplied mood board or design board and confirm the fixed white footer text remains readable.

After editing content, run `npm run build` and `npm run verify`. The verifier creates and removes a temporary component-fixture build, exercises the documented desktop, tablet and mobile sizes, and checks navigation, keyboard interactions, component containment, storage isolation, failed resources, console errors and horizontal overflow.

## Mandatory completion workflow

Completion tracking is part of every course build; it does not require a separate request. Replace the starter milestones in `src/data/course-completion.ts` with course-specific requirements derived from the storyboard and the content actually implemented. Connect required sections, videos and interactions to the existing VIEW, WATCH, attempt-based SUBMIT or COMPLETE, and EXPLORE triggers. Preserve the approved defaults and event contracts.

Optional resources, navigation, the fixed footer message and Back to top must not contribute to required completion. Before handover, validate unique milestone and target IDs, working targets and triggers, the course-specific versioned storage key, saved progress, restoration and reset. See [`docs/completion-tracking.md`](docs/completion-tracking.md) for the exact contracts.

## Build handover requirements

Every handover must report `npm run build` and `npm run verify`, including the typography and completion-tracking checks. State clearly that the included progress system is browser-based tracking stored in `localStorage`, not LMS or SCORM reporting. If an LMS runtime, reporting connection, manifest, launch wrapper or SCORM package has not been implemented and tested, list it as outstanding infrastructure.

## Hosting assumptions

The default build is a static site in `dist/` intended to be served at a domain root. Astro's generated CSS URL and the documented course-asset URLs are root-relative. A basic static host must serve `dist/index.html` for `/` and the generated files beneath `dist/_astro/` and `dist/assets/`.

Subdirectory hosting requires a reviewed Astro `base` configuration and corresponding asset references. Future SCORM packaging must also establish the LMS launch path, relative-asset strategy, manifest requirements and target LMS behaviour. The current output has not been tested as a ZIP or SCORM package and should not be described as package-compatible.

## SCORM status

SCORM integration is pending. The starter contains browser-local completion rules and persisted progress, but no LMS runtime, LMS reporting connection, manifest, launch wrapper or packaging command. Confirm the target SCORM version, LMS requirements, completion criteria and suspend-data strategy before adding that separate integration.

## Optional WASM packages

With the tested npm release, `npm ls` can label `@img/sharp-wasm32`, `@napi-rs/wasm-runtime` and `@tybys/wasm-util` as extraneous even though the lockfile records them in optional WASM fallback paths. An isolated `npm ci`, production build and browser verification succeed with the current manifests. Treat the labels as dependency-tree diagnostics, not as a reason to remove or upgrade packages without a reproduced build problem.

## Dependency security

Run `npm audit` before team handover and review dependency paths before applying fixes. Compatible security updates are expected; framework-major upgrades require an explicit migration decision and full verification. Do not use `npm audit fix --force` without reviewing the proposed breaking changes.
