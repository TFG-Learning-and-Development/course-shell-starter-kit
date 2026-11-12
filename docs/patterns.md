# Reusable design patterns

Design patterns capture a proven composition and its visual rules. They are not a requirement to use a particular interaction or completion rule. Use approved storyboard copy, media and completion requirements when placing a pattern in a course.

## Product catalog explorer

**Purpose.** Help a learner compare a small, related collection and then focus on one option in enough depth to support a recommendation, product conversation or informed choice.

**Visual characteristics.** The composition moves from broad to specific: category tabs, a compact product switcher, then a single deep-dive product panel. The panel pairs a dark, generous media stage with a bright editorial detail column. A small customer-context card breaks up the facts, while a full-width dark proof band carries the final technical fact or recommendation cue. The contrast between the media stage, light details and proof band is the defining rhythm; it should not feel like a dense specification table.

**When to use it.** Use for a compact catalogue whose items need comparison and richer explanation: product ranges, service tiers, equipment, ingredients, tools or role-based offers. It works best with two to five categories and one to four options per category.

**When not to use it.** Do not use it for a long inventory, one-off product mention, primarily sequential instruction or a choice that must be assessed. Use `ItemExplorer` when the simpler shared explorer is sufficient, `ResponsiveTable` for comparison-first data, and an approved assessment component for scored decisions.

**Required content and media.** Supply approved category and product names; one concise lead; a clear main image for every product; two or three short structured detail pairs; and one or two proof items. Add a customer/profile image and recommendation context only where it makes the recommendation clearer. Provide descriptive alt text for every image. Alternative views are optional and should represent a genuinely useful angle or context, not decorative duplication.

**Responsive behaviour.** Tabs wrap into an even grid, the product switcher wraps before labels become cramped, and the media/detail columns stack below 48rem. The proof band also becomes a single column. Keep image stages contained and let the product detail determine its height; do not force equal card heights or allow page-level horizontal scrolling.

**What Codex may adapt.** Category count, product count, tab labels, image aspect treatment, the presence of profile context, number of detail/proof items, section backdrop, course accent and supplied type tokens may change to suit the approved visual board. The pattern has no default completion; configure only approved deliberate EXPLORE evidence where required. VIEW may be optional, never required.

**Keep consistent.** Preserve the broad-to-specific reading order, one focused product at a time, strong media/detail contrast, a readable detail column, a visibly separate proof band, semantic button/tab states, keyboard navigation, visible focus and reduced-motion handling. Keep navigation separate from deep-dive content, and never use selection to block access to other products.

**Implementation.** [`ProductCatalogPattern.astro`](../src/components/ProductCatalogPattern.astro) is a neutral, data-driven reference implementation for this composition. It persists the selected category/product but deliberately emits no completion evidence; alternate image views are session-only. Its Gallery example is development-only.

**Original source.** Adapted from `on-footwear/src/components/ProductExplorer.astro` and `on-footwear/src/styles/product-explorer.css`.

## Editorial denim composition

**Purpose.** Give one product, person, material or hero object an editorial moment before its supporting story. The composition is especially effective when the visual subject carries as much meaning as the copy.

**Visual characteristics.** A tall visual subject is deliberately offset to one side of a dark, textured or tonal panel. The concise copy column sits beside it rather than below it, with a quiet vertical construction cue and an optional rounded callout. The asymmetry, generous crop and light-on-dark contrast are the defining qualities—not denim imagery, a particular texture or metal rivets.

**When to use it.** Use at the beginning of a product story, to introduce an iconic design feature, or to give an emotionally important visual subject space. It is best for one focal image and two short paragraphs.

**When not to use it.** Do not use it for multiple comparable products, long instructional copy, data-heavy facts or a generic page hero that already performs this role. Do not add decorative imagery where there is no meaningful visual subject.

**Required content and media.** Provide one high-quality portrait, cutout or detail image with a deliberate crop; a concise heading and one or two approved paragraphs; and an optional contextual backdrop or short callout. The subject image needs clear contrast against the selected surface. Decorative construction marks remain non-semantic.

**Responsive behaviour.** The desktop layout keeps subject and copy side-by-side. Below 48rem, the image becomes a contained top stage and the copy becomes a full-width lower panel; the seam remains decorative and never obscures copy. Keep the image crop intentional at both sizes.

**What Codex may adapt.** Media crop, backdrop treatment, panel tone, callout presence, accent colour, copy length and shared typography tokens may follow the course visual board. The component does not create completion evidence.

**Keep consistent.** Preserve one unmistakable focal subject, the offset editorial balance, strong readable contrast, restrained decoration and clear semantic source order. Do not turn the seam, texture or callout into branding copied from the original course.

**Implementation.** [`EditorialOverlayFeature.astro`](../src/components/EditorialOverlayFeature.astro) is the neutral reference implementation. Its Gallery example is development-only.

**Original source.** Adapted from `g-star-arc-denim/src/pages/index.astro` (`arc-introduction`) and `g-star-arc-denim/src/styles/arc-denim.css`.

## Image-led range rail

**Purpose.** Let learners browse a small visual range while retaining the spatial feeling of adjacent alternatives. It works well where the image, silhouette or finish is central to the comparison.

**Visual characteristics.** A horizontal rail presents tall, image-first cards with a dark legibility gradient and concise text over the image. A partial next card, visible scrollbar and compact arrow controls signal horizontal continuation. The cards should feel like a range, not like a grid forced into a narrow viewport.

**When to use it.** Use for a compact set of related options where visual comparison matters: product variants, styles, finishes, destinations or curated examples. Three to seven items is usually enough.

**When not to use it.** Do not use it where users must compare dense factual information, where all items need to be visible at once, or when imagery is weak or unavailable. Prefer `ResponsiveTable`, `ProductCatalogPattern` or the existing `ProductFlipcards` interaction when those better serve the learning goal.

**Required content and media.** Supply a descriptive label, one clear image per item, a short title and summary, and an optional short decision/detail cue. Images should tolerate a tall crop and leave enough calm area for the text overlay. Provide accessible previous/next labels.

**Responsive behaviour.** The rail remains horizontal at all widths, reducing card width to approximately 82% of the viewport on mobile so the next card stays visible. It uses scroll snap, keyboard-focusable scrolling, arrow controls and reduced-motion-aware scrolling.

**What Codex may adapt.** Card count, image crop, card height, overlay strength, accent colour, supporting detail and whether the rail sits on a light or dark surrounding section may follow the visual board. The rail deliberately has no completion contract.

**Keep consistent.** Preserve the image-first hierarchy, readable overlay contrast, visible continuation affordance, one-card scrolling rhythm and natural horizontal touch scrolling. Do not convert it into a cramped multi-column grid on mobile.

**Implementation.** [`ImageLedRangeRail.astro`](../src/components/ImageLedRangeRail.astro) is the neutral reference implementation. Its Gallery example is development-only.

**Original source.** Adapted from `dreame-product-range/src/components/ProductFlipcards.astro` (`range-shell--rail`, whole-card rail treatment) and `dreame-product-range/src/pages/lessons/robot-vacuums.astro`.
