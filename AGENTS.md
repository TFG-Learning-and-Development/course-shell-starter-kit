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
- Run `npm ci`, `npm run build`, `npm run verify` and `npm audit` after dependency changes.
