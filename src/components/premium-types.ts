export type PremiumTone = "light" | "soft" | "accent" | "dark";
export type EditorialMedia = { src: string; alt: string; position?: string };
export type AssessmentQuestion = {
  prompt: string;
  options: readonly string[];
  correctIndex?: number;
  correctFeedback: string;
  incorrectFeedback: string;
};
export type ExplorerItem = {
  id: string;
  categoryId?: string;
  title: string;
  summary: string;
  images: readonly EditorialMedia[];
  details: readonly { label: string; text: string }[];
};
export type ExplorerCategory = { id: string; label: string };
