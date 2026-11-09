# Reusable components

The starter uses custom Astro components and shared rules in `src/styles/global.css`. Import only the components a course needs. The transferred typography primitives and their full property reference are documented in [`typography.md`](typography.md).

All course components and interactions must use the inherited typography system; do not introduce component-local type scales or font families. Completion tracking must be configured as part of every course build and connected to each required component using the contracts in [`completion-tracking.md`](completion-tracking.md).

## `SectionHeading`

Properties:

- `title` (required string): heading text.
- `intro` (optional string): introductory paragraph.
- `light` (optional boolean, default `false`): light text for dark surfaces.
- `align` (`"left" | "center"`, default `"center"`): text alignment.

```astro
<SectionHeading title="A descriptive heading" intro="A concise introduction." align="left" />
```

## `InfoCallout`

Properties:

- `title` (required string): callout heading.
- `tone` (`"pale" | "slate" | "navy"`, default `"pale"`): surface treatment.
- `icon` (optional boolean, default `true`): shows or hides the decorative icon.
- Default slot: callout body content.

```astro
<InfoCallout title="Remember" tone="slate" icon={false}>
  <p>Concise supporting content.</p>
</InfoCallout>
```

## `ResponsiveTable`

Properties:

- `label` (required string): accessible region label and visually hidden table caption.
- `columns` (required array): `{ key, label }` column definitions.
- `rows` (required array): string values keyed by the column definitions.
- `tone` (`"light" | "dark"`, default `"light"`): surface treatment.
- `id` (optional string): base for the scroll-hint ID. Supply a unique value when labels may repeat.

The table region is keyboard-focusable and scrolls horizontally when its contents are wider than its container.

```astro
<ResponsiveTable
  id="example-table"
  label="Example comparison"
  columns={[{ key: "item", label: "Item" }, { key: "detail", label: "Detail" }]}
  rows={[{ item: "Example", detail: "Description" }]}
/>
```

## `DialogueBlock`

Properties:

- `label` (optional string, default `"Example dialogue"`): accessible group label.
- `speakerA` (required object): `{ label, text }` for the first speaker.
- `speakerB` (required array): the first item is the reply; remaining items appear in the follow-up response area.

```astro
<DialogueBlock
  label="Service conversation"
  speakerA={{ label: "Speaker A", text: "Opening statement." }}
  speakerB={[
    { label: "Speaker B", text: "Initial reply." },
    { label: "Follow-up", text: "Supporting response." },
  ]}
/>
```

## `CourseProgress` and `ExploreGroup`

Pass the validated `courseConfig` to `CourseProgress` from the shared page wrapper. Completion configuration, activity attributes, events, persistence, and examples for sections, videos, questions, matching, accordions, cards and tabs are documented in [`completion-tracking.md`](completion-tracking.md). The Progress panel has no learner-facing reset control.

For every configured lesson, the Progress panel must show its completed/required count and an expanded **Still to do** list built from incomplete required milestone labels. Keep a collapsible **Completed** list with ticks, and show “All required activities completed.” when the lesson has no outstanding requirements. Show a clearly labelled course-wide completed/required count above the lesson summaries. Link outstanding activities through `courseUrl(lesson.path)` and the milestone target ID; focus and highlight same-page targets and restore that focus after cross-lesson navigation. Dispatch `course-progress:reveal-target` for hidden targets. Never grant completion from a checklist link, and never link through a sequentially locked lesson. Keep the panel scrollable and keyboard accessible.

For one-page courses, set `navigationMode: "sections"` and supply `navigationLessons` with unique IDs, learner-facing titles and real section target IDs. The Lessons menu then links to section anchors and highlights the current section while scrolling. `sections` optionally groups Progress activities under named, actionable headings; its `milestoneIds` must cover every configured milestone exactly once. The default lesson mode retains multiple routes, previous/next links, locks and explicit packaged `index.html` navigation. Set `brand.logoTreatment: "transparent"` only when the configured logo has adequate contrast directly on the header colour; the default badge has a white surface.

## Shared theme

Do not hard-code course colours inside components. Configure `courseConfig.theme` and `courseConfig.brand` in `src/data/course-config.ts`; `CourseLayout.astro` maps them to shared custom properties. The values in `src/styles/global.css` are neutral preview defaults. Contrast-check the configured colours against their surfaces; light- and dark-surface focus tokens remain separate.

The Overview/hero gradient must use `--course-accent-strong` and `--course-accent` so it follows the supplied visual-board palette without layout or typography changes. Do not add starter-specific hero accent values.

The Activity progress UI must inherit the supplied visual-board accent through `--course-accent`, including its filled bar and related accent states. Keep the unfilled track neutral, verify readable contrast, and do not introduce a component-specific progress colour.

## Premium course library

All premium components use typed content props, shared typography and `--course-space-*` spacing tokens. They contain no course brand, fixed lesson selector or fixed storage identity. Multiple instances are scoped by their unique `id`.

For every new or adapted interaction, inset the content and its navigation from the card border with the same shared spacing tokens. Keep Previous/Next controls, counts, submit actions and feedback in deliberate padded rows with clearance from dividers and rounded corners. Let the content set the component height; reserve space only when an interaction needs it to prevent a disruptive transition. Constrain explanatory paragraphs to the shared reading measure. Check selected, hover, keyboard focus and disabled states for contrast and clarity, then inspect both the initial and feedback/revealed states at desktop and mobile widths. On mobile, wrap or internally scroll selectors before labels become cramped; never allow controls to clip or cause page-level overflow. Keep the approved `PremiumAssessment` composition intact when applying these standards.

- `EditorialSplit`: image/text composition with `title`, `paragraphs`, `media`, optional `reverse`, `tone` and VIEW `completionId`.
- `PortraitQuote`: portrait, supporting paragraphs, quote and optional citation.
- `PremiumAssessment`: the default single-choice assessment and knowledge-check pattern. Pass a unique `id`, semantic `title`, the approved learner instruction and typed `question` with verbatim storyboard options and feedback. If required instruction or feedback copy is missing, ask for it. The component uses one dark gradient rounded panel, heading and theme-accent rule, a light icon question card and feedback in the left column, and large clickable radio cards in the right column, separated by a subtle desktop divider. It stacks without the divider on mobile. A deliberate selection shows feedback and internally submits a valid attempt immediately, including an incorrect choice; empty rendering and restoration do not create an attempt. The chosen answer and its feedback restore through shared course state. Configure its milestone as `submit`; do not add a separate Submit button or reuse this selection rule for matching.
- `AssessmentSequence`: the same approved question/answer composition for one question at a time. Pass `id`, `title`, optional `intro` and `instruction`, and typed `questions` with unique IDs, titles, prompts, two or more options, `correctIndex`, `correctFeedback` and `incorrectFeedback`; `shuffleOptions` is optional and defaults to `false`. Form targets use `${id}-${question.id}`. Register one SUBMIT milestone per question. A selected answer shows its feedback and records a valid attempt immediately, including a wrong choice. The counter and arrow buttons only navigate. Answers and the active question restore independently per instance, without creating new attempts.
- `FlipCards` and `RevealGroup`: variable-length exploration sets. Configure `requiredItems` from their item IDs.
- `CourseCarousel`: variable-length image/copy sequence; set `tracked` only when every slide is an approved requirement.
- `StepGroup`: keyboard-operable tabs plus previous/next controls, restoration and child exploration events. Its initially selected step earns credit only after the panel is visible; navigating through every step then satisfies the configured children. Optional `ordered` and `compactVertical` props display an ordered vertical process. Each step supplies a unique `id`, title and body, with an optional data-driven letter; `panelImage` accepts an optional local image path for the explanation surface. The component does not assume an acronym or fixed number of steps.
- `ItemExplorer`: optional categories, variable item choices, per-item image galleries and detail lists. Selecting an item dispatches its exploration event.
- `MatchingActivity`: variable prompts/options, persistent selections and valid-attempt submission feedback. Configure its milestone as `submit`.
- `ReflectionActivity`: saves text only to course- and activity-specific browser storage; LMS text is learner-isolated when an LMS learner ID exists. A valid save dispatches `complete`.

The neutral learner demonstration uses a representative subset in `src/pages/`. Additional examples are in `scripts/fixtures/ComponentFixture.astro`, injected only into local development and temporary verification builds and excluded from course completion.

Run `npm run dev` and open `http://localhost:4321/__component-gallery/` to try the actual shared components. The gallery uses neutral content, fixture-only in-memory state and no LMS or course progress bridge. It is excluded from production and SCORM builds. `ReflectionActivity` accepts `storageMode="memory"` for this preview only; course use keeps the default course/learner-isolated browser storage.

For each new course, act as a senior UX/UI designer and Astro developer. Reuse or adapt a suitable library component first. Create a new premium reusable component when the storyboard's learning purpose needs a pattern the library cannot provide. Follow the approved visual quality with clear hierarchy, considered spacing, polished states and restrained motion; inherit the shared type, spacing and theme tokens. Provide responsive behavior, keyboard access, visible focus, readable contrast, reduced-motion support and clearly presented approved learner instructions, feedback and completion cues where relevant. Use typed content/configuration props and unique instance IDs. Keep branding, counts, selectors and storage identities out of the component. Wire approved requirements to the existing tracking/restoration contracts, document the component here and add a neutral working example to the development gallery. Apply the mandatory storyboard copy fidelity rule in [`AGENTS.md`](../AGENTS.md); ask for missing required copy or completion rules instead of inventing them.

Configure branding and surfaces in `courseConfig.theme`, the logo in `courseConfig.brand`, and imagery in `courseData`. Deliberate typography overrides should set shared `--course-type-*` properties on one scoped wrapper; do not add a component-local font scale.

## Typography primitives

`TypeText`, `TextLayout`, `QuoteBlock`, `StatisticBlock` and `DefinitionList` live in `src/components/typography/`. Use them for semantic type roles and controlled text composition rather than adding one-off font sizes to a course component. Configure the course scale in `src/styles/course-typography.css`; see [`typography.md`](typography.md) for the role table, variants, examples and override hierarchy.
