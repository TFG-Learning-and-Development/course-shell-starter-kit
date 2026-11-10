# Testing guide

This repository is the reusable neutral shell. The default production example is Multi-page; the One-scroll example is a development-only verification fixture. Test a real course against its approved storyboard and configured requirements before release.

Check Progress labels in both outstanding and completed lists at mobile and desktop widths, including after reload. Each entry and configured section heading must match its approved title exactly. Confirm the title remains intact if its first word is also a completion verb; never test this by stripping a prefix.

`npm run verify` exercises active-panel exploration in the interaction, One-scroll and Multi-page fixtures: initial viewport entry without a click, offscreen and ancestor-hidden panels, reveal without scrolling, later selection, completion, refresh, duplicate events and independent activity IDs. Verify a real course's approved item IDs and nested reveal composition in the browser as well.

## Prepare a local copy

1. Clone the confirmed repository and check out the branch named in the handover. Use Node.js `>=22.19.0` and npm `>=9.6.5`.
2. Run `npm ci`, then `npx playwright install chromium` if browser verification is needed.
3. Run `npm run build` and `npm run verify`. These commands build and test the shell; they do **not** create a SCORM ZIP. Run `npm run dev` to inspect pages locally at `http://localhost:4321/`.

## Select the build stage

Explicit user instructions select the stage; default to **Preview**. In Preview, build and run relevant verification without packaging hooks, inspect the rendered course and report remaining issues. Record SCORM packaging as `Not run — Preview stage`.

At every stage, check storyboard copy fidelity against the rendered course: account for every learner-facing passage, compare its wording, spelling, capitalisation, punctuation, numbers, headings, questions, answer options and feedback verbatim, and record permitted exclusions and unresolved differences. A successful build does not prove copy fidelity.

In **Review**, compare the rendered course against its storyboard and mood board. Check content, responsive layout, accessibility, interactions, progress and resume; fix issues and rerun affected checks. Record human visual/content approval separately from automated results, and record SCORM packaging as `Not run — Review stage`.

Enter **Release preparation** only when the user explicitly requests packaging, a release candidate or release preparation. A request for packaged LMS testing also enters this stage. Build the latest approved source, run `npm run package:scorm` and `npm run verify:scorm`, then record the source commit or working-tree state represented by the ZIP. Separate simulated LMS results from outstanding live Oracle acceptance. Packaging does not authorise publishing, LMS upload or merging. Learner-facing edits after packaging make the ZIP stale until rebuilt.

The direct instruction “Package this course” is a [Release preparation shortcut](../AGENTS.md#packaging-shortcut); mentioning it as an example or asking about it is not a packaging request.

## Check both course formats

- **Multi-page (default production example):** open `/`, then use Lessons and the page's previous/next navigation to reach each configured lesson. Confirm locked lessons explain the requirement and unlock only after their required activities are complete. When inspecting a packaged course separately, lesson links must end in explicit `index.html` for Oracle-compatible hosting.
- **One-scroll (verification fixture):** run `npm run verify` for automated coverage. For manual review, start the development server with `COURSE_VERIFY_COMPONENTS=1` and open `/__verify-one-page/`. On Windows PowerShell use `$env:COURSE_VERIFY_COMPONENTS='1'; npm run dev`. Its Lessons menu links to anchors on one continuous page; it has no between-lesson navigation. Reset that temporary environment variable when done with `Remove-Item Env:COURSE_VERIFY_COMPONENTS`.

The selected format for a real build comes from the storyboard field `Course format: One-scroll / Multi-page` and is recorded in `courseConfig.navigationMode` in `src/data/course-config.ts`. One-scroll maps to `"sections"`; Multi-page maps to `"lessons"`.

## Follow the learner path

At mobile and desktop widths, check the logo, Lessons and Progress panels, keyboard focus, Escape/outside-click dismissal, sticky-header anchor clearance and footer. Progress should list each lesson's required **Still to do** activities and completed activities. An activity link should reach and focus its target without granting credit merely for navigation.

Complete the configured content and interactions: the compact ordered steps should credit each visible step; each assessment answer selection should show feedback immediately and count as a valid attempt even when incorrect. Check question arrows, refresh, Back/Forward and resume. Confirm completion appears only after every required milestone is earned. Use `npm run verify` for the browser and simulated-LMS scenarios, including save failure and restoration; inspect its final output for errors.

In both course formats, check a fresh and a restored lesson: open a later card, tab, process step, carousel item and assessment question without completing earlier items. Confirm all are accessible, no unearned milestone appears, and completion still requires approved evidence. Distinguish these in-lesson checks from configured between-lesson unlocking.

## Record an issue

Note the branch/commit, course URL, viewport width, browser, steps taken, expected result, actual result and a screenshot or console error when available. Include whether the issue occurred in standalone browser use, the simulated LMS verifier or a live Oracle launch. Keep learner names and reflection text out of issue reports.

## LMS acceptance boundary

`npm run verify` exercises standalone and direct-API browser behavior. After an authorized package build, `npm run verify:scorm` extracts the actual Multi-page ZIP and creates/extracts a temporary neutral One-scroll fixture ZIP. It serves both from a nested LMS-like path with directory-index routing disabled. Its strict simulated API checks one SCO, `Content` titles, manifest references, assets, parent-owned initialization/finish, route allowlisting, logical resume, navigation, Progress shortcuts, Back to top, iframe tabs, schema mismatch and closure. It cleans its temporary fixture ZIP after the run. An explicitly authorized infrastructure test may run these temporary neutral packages during Preview; this does not package a production course. Neither verifier is live Oracle/People Connect acceptance. The live team must still test import, launch, lesson navigation, Save and Close, resume and final LMS reporting in Oracle.
