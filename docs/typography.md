# Typography system

The starter includes the Quick Course typography primitives without the source showcase, approval metadata or learner-facing specimen content. The implementation is local, static-site friendly and makes no font or runtime requests.

## Defaults and configuration

The shared implementation lives in `src/styles/typography.css`. Do not edit that file for an individual course. Course-wide settings live in `src/styles/course-typography.css` and include local font stacks, body and interface settings, every role size, heading weights and line heights, measures and prose spacing.

The default sans stack is `"Arial Nova", Arial, Helvetica, sans-serif`. No webfont is bundled or fetched. Arial Nova is used when installed; otherwise the browser continues through the local fallback stack. Serif is an explicit editorial option and code uses the local monospace stack.

The override order is predictable:

1. `typography.css` supplies shared component behavior and semantic colour mappings.
2. `course-typography.css` supplies course-wide settings.
3. Component properties select a controlled role, family, measure, weight, tone, layout or surface.
4. A wrapper or component class may override the same `--course-type-*` custom properties for a genuinely local exception.

For a course-wide change, edit `course-typography.css`:

```css
:root {
  --course-type-heading-lg-size: clamp(1.75rem, 3vw, 2.6rem);
  --course-type-heading-lg-weight: 650;
  --course-type-prose-gap: 1.5rem;
}
```

A local exception stays scoped:

```astro
<div class="short-opening">
  <TypeText as="h2" role="heading-lg">A concise section title</TypeText>
</div>

<style>
  .short-opening { --course-type-heading-lg-size: 2rem; }
</style>
```

## Type roles

HTML semantics and visual roles are independent. Choose `as` for the document outline and `role` for presentation. A visually large treatment does not automatically become an `h1`, and a semantic `h3` may use `heading-lg` when the composition calls for it.

| Role | Intended use | Size | Weight | Line height |
| --- | --- | --- | --- | --- |
| `display-xl` | Exceptional, very short display copy | `clamp(2.8rem, 7vw, 6.4rem)` | 700 | 1.06 |
| `display-lg` | Hero or major statement | `clamp(2.25rem, 5vw, 4.7rem)` | 700 | 1.06 |
| `display-md` | Smaller editorial display | `clamp(1.85rem, 3.5vw, 3.2rem)` | 700 | 1.06 |
| `display-gradient` | One short opt-in display phrase | `clamp(2.25rem, 5vw, 4.7rem)` | 750 | 1.06 |
| `heading-xl` | Page/major section visual heading | `clamp(2rem, 3.4vw, 3.25rem)` | 700 | 1.12 |
| `heading-lg` | Section visual heading | `clamp(1.65rem, 2.6vw, 2.35rem)` | 700 | 1.12 |
| `heading-md` | Subsection visual heading | `clamp(1.3rem, 2vw, 1.72rem)` | 650 | 1.12 |
| `heading-sm` | Minor heading or component title | `1.12rem` | 650 | 1.3 |
| `lead` | Short introduction | `clamp(1.12rem, 1.6vw, 1.35rem)` | 400 | 1.55 |
| `body` | Normal instructional reading | `1.125rem` | 400 | 1.55 |
| `body-compact` | Concise secondary context | `0.875rem` | 400 | 1.45 |
| `label` | Labels and compact metadata | `0.875rem` | 650 | 1.45 |
| `eyebrow` | Short contextual label | `0.78rem` | 650 | 1.3 |
| `caption` | Media, figure, source or attribution text | `0.875rem` | 400 | 1.45 |
| `statement` | Short high-impact statement | `clamp(1.9rem, 4.5vw, 4.4rem)` | 750 | 1.06 |
| `statistic` | Standalone value | `clamp(2.4rem, 5.5vw, 5rem)` | 800 | 0.95 |
| `quote` | Inline quote role | `clamp(1.35rem, 2.5vw, 2.2rem)` | 400 | 1.25 |
| `code` | Inline system value or code text | `0.92em` | 400 | 1.55 |

The gradient role has a solid colour fallback plus forced-colour and print fallbacks. Every value in the table is exposed through a course-level custom property where course-wide adjustment is appropriate; compact and spacious layout gaps are configurable there as well.

`TypeText` does not apply a regular-weight class by default, so each role keeps its intended weight. Pass `weight` only for an explicit controlled override.

Native `h1` through `h6` also have complete defaults. The course hero, section heading, callout title, table headings and cells, dialogue labels and body, navigation, buttons and footer are connected to the same tokens.

## Components

Import typography components from `src/components/typography/`.

### `TypeText`

Properties: `as`, `role`, `align`, `measure`, `family`, `weight`, `tone`, `italic` and `class`.

```astro
<TypeText as="h2" role="heading-lg">Choose the safe next action</TypeText>
<TypeText as="p" role="body" measure="narrow">Normal instructional explanation.</TypeText>
<TypeText as="p" role="display-md" family="serif" italic>Optional editorial emphasis.</TypeText>
```

### `TextLayout`

Properties: `as`, `layout`, `surface`, `spacing`, `bleed` and `class`. Layouts are `reading-narrow`, `reading-standard`, `editorial-wide`, `statement`, `two-equal`, `two-main`, `two-aside`, `three`, `split`, `pull-quote`, `band`, `grid` and `steps`. Multi-column layouts stack in source order before their desktop breakpoints.

```astro
<TextLayout layout="split" surface="none" spacing="spacious" as="section">
  <TypeText as="h2" role="heading-xl">A clear section opening</TypeText>
  <div class="qc-text-layout__prose">
    <TypeText role="body">The explanation remains readable and stacks naturally on small screens.</TypeText>
  </div>
</TextLayout>
```

Use `bleed="viewport"` only inside a container when a surface should extend to the viewport edge. The content remains constrained to the wide measure.

### `QuoteBlock`

Properties: `quote`, `citation`, `source`, `variant`, `family` and `surface`. Variants are `standard`, `pull`, `center`, `rule` and `surface`. Quotes default to sans; serif is opt-in.

```astro
<QuoteBlock quote="Keep the required action easy to find." citation="Course principle" variant="rule" />
<QuoteBlock quote="A short editorial aside." family="serif" variant="pull" />
```

### `StatisticBlock`

Properties: `value`, `label`, `detail`, `align` and `surface`. The component uses a semantic definition-list relationship between its value and label.

```astro
<StatisticBlock value="3" label="Checks before continuing" detail="Pause. Check. Continue." align="center" surface="accent" />
```

### `DefinitionList`

Properties: `items` and `variant`. Variants are `stacked`, `split` and `grid`.

```astro
<DefinitionList
  variant="split"
  items={[
    { term: "Hazard", definition: "Something with the potential to cause harm." },
    { term: "Control", definition: "A measure that removes or reduces exposure." },
  ]}
/>
```

## Measures, spacing and surfaces

- Narrow: `42rem`, for detailed reading.
- Standard: `54rem`, for normal course prose.
- Wide: `72rem`, for components, short openings and multi-column composition.
- Prose gap: `1.25rem`.

Surface and tone names map to the shell’s existing `--surface`, `--surface-soft`, `--ink`, `--muted`, `--line`, `--course-accent` and `--course-accent-strong` tokens. The typography layer does not introduce a separate course palette. Success, warning and error remain semantic supporting tokens rather than course-brand colours.

Display and serif treatments are opt-in. Keep long or required reading in sans `body` or `lead`, avoid putting essential information only in an aside or quote, and simplify a layout rather than shrinking or truncating real course copy.

## Portability and verification

The system uses only local system fonts, Astro markup and CSS. It adds no DaisyUI, Iconify, font service, client-side runtime, analytics or LMS behavior. Normal builds contain only the course page; typography specimens are rendered solely by the temporary `COURSE_VERIFY_COMPONENTS=1` fixture used by `npm run verify`.

After changing tokens or composing new typography, run `npm run build` and `npm run verify`. The verifier checks the shell at eight required viewport sizes, the typography/components fixture at mobile, tablet and desktop sizes, a 200% browser-zoom equivalent (a 640 CSS-pixel viewport rendered at 2x scale), responsive columns, role weights, local overrides, font stacks, overflow, clipping, external requests, keyboard focus and runtime errors.
