# Developer quick start

Use this checklist when starting a course from the shell.

1. Clone the repository, create a local feature branch, and confirm Node.js is at least `22.19.0`:

   ```sh
   git switch -c feat/course-name
   node --version
   npm ci
   npx playwright install chromium
   ```

   On Windows, use `npm.cmd` if your shell does not resolve `npm`. If a managed device cannot install Playwright Chromium but has an approved Chromium-based browser, set `COURSE_BROWSER_EXECUTABLE` to its executable path for `npm run verify` and `npm run verify:scorm`.

2. Put the approved storyboard, mood board and private reference materials in [`course-inputs/`](../course-inputs/README.md). These files are ignored and never packaged. Put only approved learner-facing production assets in `public/assets/`.

3. Open the repository in VS Code and ask Codex to read `AGENTS.md` and the supplied inputs before changing learner-facing content. The storyboard controls exact copy, sequence, format and completion requirements; the mood board controls the visual direction and use of supplied imagery.

4. Start the local course and inspect it:

   ```sh
   npm run dev
   ```

   Open `http://localhost:4321/`. The development component gallery is at `/__component-gallery/`.

5. Before handover, run:

   ```sh
   npm run build
   npm run verify
   git diff --check
   ```

   `verify` checks the browser course, persistence, progress and simulated LMS contracts. It is not live LMS acceptance.

6. Only when Release preparation is explicitly authorized, package and verify SCORM 1.2:

   ```sh
   npm run package:scorm
   npm run verify:scorm
   ```

   Test the resulting ZIP in the target LMS for import, launch, navigation, resume, completion reporting and Save/Close. Do not treat package verification as live Oracle/People Connect acceptance.

Keep generated files, private inputs and credentials out of Git. Do not use `git reset --hard`, commit, push, tag, pull or change branches unless that action is explicitly requested.
