# Completion tracking

The browser-based completion system is configured in `src/data/course-completion.ts` and rendered by `CourseProgress.astro`. It is independent of navigation highlighting and has no LMS or SCORM connection.

## Mandatory course-build workflow

Configure completion tracking during every course build; no separate tracking request is required. Replace the starter milestones with course-specific requirements derived from the storyboard and the content actually implemented. Do not retain placeholder requirements or configure milestones for content that is absent.

Connect required content, videos and interactions to the appropriate existing behavior: VIEW for qualified section viewing, WATCH for merged unique playback ranges, attempt-based SUBMIT or COMPLETE for questions and submitted activities, and EXPLORE for configured child items. Preserve all approved rules, thresholds, weighting, events, persistence, restoration and reset behavior. Do not add correctness gates, longer dwell times, playback restrictions or other policy changes unless explicitly approved.

Optional resources, navigation links, the fixed footer message and Back to top are excluded from required completion. Before handover, validate unique milestone and target IDs, working targets and triggers, a course-specific versioned storage key, saved progress, restoration and reset.

## Configuration

Each milestone has a unique `id`, learner-facing `label`, supported `type`, unique `targetId`, and explicit `required` boolean. Required milestones are equally weighted; non-required milestones never enter the percentage denominator. A `watch` milestone may set `threshold` from greater than `0` through `1`; the default is `0.8`. Use a course-specific, versioned key such as `astro-course-progress:course-slug:v1`.

Supported types:

- `view`: place `data-completion-id="milestone-id"` on the target. It completes after 900 ms continuously in the central viewport zone (`rootMargin: -38% 0 -38%`).
- `watch`: put both the target `id` and `data-completion-id` on a `<video>`. Merged unique `video.played` ranges must reach the threshold; seeking gaps and replayed ranges do not add credit.
- `submit`: put `data-completion-id` on the activity and `data-completion-option` on answer controls. Any answer selection completes it, regardless of correctness.
- `explore`: put `data-completion-id` and a JSON `data-required-items` array on the group. Dispatch `course-progress:explore` with `{ activityId, itemId }` for each child. The included `ExploreGroup.astro` demonstrates accordion, card and tab variants. Its initially visible first tab is recorded immediately.
- `complete`: put the matching `id` and `data-completion-id` on the target, then dispatch `course-progress:complete` with `{ activityId }` at the approved completion moment.
- `optional`: retained for compatibility with the pilot. Give its target the matching `id` and `data-completion-id`; it has no automatic behaviour and normally uses the same `course-progress:complete` event. Despite the type name, only `required: false` excludes a milestone from progress.

For a standard question, use `submit` and mark each selectable answer with `data-completion-option`. For matching, require at least one real selection in the activity code, then dispatch `course-progress:complete` only when the learner submits. A section uses `view`; a video uses `watch`; accordion, reveal-card, and tab groups use `explore`. Configuration errors for duplicate IDs, duplicate targets, malformed thresholds, or an unversioned storage key fail the build. Unresolved DOM targets report a clear browser console error and never become satisfied.

## Events and restoration

- Send `course-progress:explore` with `{ activityId, itemId }`.
- Send `course-progress:complete` with `{ activityId }`.
- An explore component may send `course-progress:request-restore` with `{ activityId, apply(itemIds) }`.
- The manager emits `course-progress:explore-state` with `{ activityId, itemIds }`, `course-progress:restore-complete` with `{ activityId, complete }`, and `course-progress:reset`.

Progress, merged video ranges, and explored child IDs are stored in `localStorage`. Reset removes only this course's configured key, resets tracked videos, and emits the reset event so interactions can clear their own visual state. Changing the key version intentionally starts a new progress record.

## Known inherited limitations

- VIEW depends on browser intersection timing; background tabs and very short sections can behave differently across browsers.
- WATCH relies on the browser's `played` ranges and media duration metadata. It does not restrict playback speed.
- SUBMIT is intentionally attempt-based, not correctness-based.
- EXPLORE is binary in the percentage even though partial child state is saved.
- The source type named `optional` does not itself make an item optional; `required` controls inclusion.
- Local storage is device-and-browser specific and can be cleared or unavailable.

Future LMS/SCORM work is a separate integration step. It requires confirmed SCORM version, completion rules, launch and manifest requirements, and suspend/resume mapping; this starter contains no LMS calls, manifest, or package.

## Handover readiness

Run and report `npm run build` and `npm run verify`, explicitly including the completion-tracking checks. Describe this implementation as browser tracking persisted in `localStorage`, not LMS or SCORM reporting. If the course has no LMS runtime, reporting connection, manifest, launch wrapper or tested package, record each missing item as outstanding infrastructure rather than implying the course reports completion to an LMS.
