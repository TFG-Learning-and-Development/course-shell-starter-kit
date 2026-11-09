# Manager testing guide

This repository is the reusable neutral shell. The default production example is Multi-page; the One-scroll example is a development-only verification fixture. Test a real course against its approved storyboard and configured requirements before release.

## Prepare a local copy

1. Clone the confirmed repository and check out the branch named in the handover. Use Node.js `>=22.19.0` and npm `>=9.6.5`.
2. Run `npm ci`, then `npx playwright install chromium` if browser verification is needed.
3. Run `npm run build` and `npm run verify`. These commands build and test the shell; they do **not** create a SCORM ZIP. Run `npm run dev` to inspect pages locally at `http://localhost:4321/`.

Do not use `npm run package:scorm` for this review unless a separate package build is requested.

## Check both course formats

- **Multi-page (default production example):** open `/`, then use Lessons and the page's previous/next navigation to reach each configured lesson. Confirm locked lessons explain the requirement and unlock only after their required activities are complete. When inspecting a packaged course separately, lesson links must end in explicit `index.html` for Oracle-compatible hosting.
- **One-scroll (verification fixture):** run `npm run verify` for automated coverage. For manual review, start the development server with `COURSE_VERIFY_COMPONENTS=1` and open `/__verify-one-page/`. On Windows PowerShell use `$env:COURSE_VERIFY_COMPONENTS='1'; npm run dev`. Its Lessons menu links to three anchors on one continuous page; it has no between-lesson navigation. Reset that temporary environment variable when done with `Remove-Item Env:COURSE_VERIFY_COMPONENTS`.

The selected format for a real build comes from the storyboard field `Course format: One-scroll / Multi-page` and is recorded in `courseConfig.navigationMode` in `src/data/course-config.ts`. One-scroll maps to `"sections"`; Multi-page maps to `"lessons"`.

## Follow the learner path

At mobile and desktop widths, check the logo, Lessons and Progress panels, keyboard focus, Escape/outside-click dismissal, sticky-header anchor clearance and footer. Progress should list each lesson's required **Still to do** activities and completed activities. An activity link should reach and focus its target without granting credit merely for navigation.

Complete the configured content and interactions: the compact ordered steps should credit each visible step; each assessment answer selection should show feedback immediately and count as a valid attempt even when incorrect. Check question arrows, refresh, Back/Forward and resume. Confirm completion appears only after every required milestone is earned. Use `npm run verify` for the browser and simulated-LMS scenarios, including save failure and restoration; inspect its final output for errors.

## Record an issue

Note the branch/commit, course URL, viewport width, browser, steps taken, expected result, actual result and a screenshot or console error when available. Include whether the issue occurred in standalone browser use, the simulated LMS verifier or a live Oracle launch. Keep learner names and reflection text out of issue reports.

## LMS acceptance boundary

`npm run verify` exercises a stateful **simulated** SCORM 1.2 API. It is not evidence of a live Oracle/People Connect import. After a separately authorised ZIP is built, the live team still needs to test import, launch, lesson navigation, Save and Close, resume and final LMS reporting in Oracle. Record those results separately.
