export type CompletionType = "view" | "watch" | "submit" | "explore" | "complete" | "optional";

export type CompletionMilestone = {
  id: string;
  label: string;
  type: CompletionType;
  targetId: string;
  required: boolean;
  threshold?: number;
};

export const completionSettings = {
  storageKey: "astro-course-progress:course-shell:v1",
};

// Keep tracking configuration separate from learner-facing copy. Only
// milestones that exist on the starter page belong in this active list.
export const completionMilestones: CompletionMilestone[] = [
  { id: "overview", label: "Course overview", type: "view", targetId: "overview", required: true },
  { id: "content", label: "Course content", type: "view", targetId: "content", required: true },
  { id: "interaction", label: "Reveal interaction", type: "complete", targetId: "interaction", required: true },
];

const completionTypes = new Set<CompletionType>(["view", "watch", "submit", "explore", "complete", "optional"]);

export function validateCompletionConfiguration(milestones: CompletionMilestone[], storageKey: string) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const targetIds = new Set<string>();

  if (!/^astro-course-progress:[a-z0-9-]+:v\d+(?:\.\d+)*$/i.test(storageKey)) {
    errors.push(`Storage key "${storageKey}" must be course-specific and versioned.`);
  }

  milestones.forEach((milestone, index) => {
    const location = `Milestone ${index + 1}`;
    if (!milestone.id.trim()) errors.push(`${location} has no id.`);
    if (!milestone.label.trim()) errors.push(`${location} has no label.`);
    if (!milestone.targetId.trim()) errors.push(`${location} has no targetId.`);
    if (!completionTypes.has(milestone.type)) errors.push(`${location} has an unsupported type.`);
    if (typeof milestone.required !== "boolean") errors.push(`${location} must declare required as a boolean.`);
    if (ids.has(milestone.id)) errors.push(`Duplicate completion id "${milestone.id}".`);
    if (targetIds.has(milestone.targetId)) errors.push(`Duplicate completion target "${milestone.targetId}".`);
    if (milestone.threshold !== undefined && (milestone.type !== "watch" || !Number.isFinite(milestone.threshold) || milestone.threshold <= 0 || milestone.threshold > 1)) {
      errors.push(`${location} has an invalid watch threshold.`);
    }
    ids.add(milestone.id);
    targetIds.add(milestone.targetId);
  });

  if (errors.length) throw new Error(`Invalid completion configuration:\n- ${errors.join("\n- ")}`);
}

validateCompletionConfiguration(completionMilestones, completionSettings.storageKey);
