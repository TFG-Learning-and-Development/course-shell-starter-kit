export const typeRoles = [
  "display-xl",
  "display-lg",
  "display-md",
  "display-gradient",
  "heading-xl",
  "heading-lg",
  "heading-md",
  "heading-sm",
  "lead",
  "body",
  "body-compact",
  "label",
  "caption",
  "statement",
  "statistic",
  "quote",
  "code",
] as const;

export type TypeRole = (typeof typeRoles)[number];
export type TextAlignment = "left" | "center";
export type TextMeasure = "narrow" | "standard" | "wide" | "full";
export type TextFamily = "sans" | "serif" | "mono";
export type TextWeight = "light" | "regular" | "medium" | "semibold" | "bold" | "heavy";
export type TextTone = "default" | "muted" | "strong" | "accent" | "primary" | "secondary" | "inverse" | "success" | "warning" | "error";
export type TextSurface = "none" | "default" | "muted" | "primary" | "secondary" | "accent" | "dark" | "light" | "success" | "warning" | "error";
export type TextSpacing = "compact" | "standard" | "spacious";
export type TextBleed = "none" | "viewport";
export type TextLayoutKind = "reading-narrow" | "reading-standard" | "editorial-wide" | "statement" | "two-equal" | "two-main" | "two-aside" | "three" | "split" | "pull-quote" | "band" | "grid" | "steps";
export type TextElement = "div" | "p" | "span" | "section" | "article" | "aside" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
