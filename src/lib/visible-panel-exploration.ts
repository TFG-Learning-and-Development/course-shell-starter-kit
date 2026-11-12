import type { CourseUiStore } from "./course-state";

type Options = {
  root: HTMLElement;
  panels: HTMLElement[];
  activePanel: () => HTMLElement | undefined;
  itemId: (panel: HTMLElement) => string | undefined;
  courseState: CourseUiStore;
};

// Only the displayed panel can earn EXPLORE. Checking ancestors also covers
// panels nested in another tab, accordion, reveal, or animated container.
export function watchVisiblePanelExploration({ root, panels, activePanel, itemId, courseState }: Options) {
  const earned = new Set(courseState.explored(root.id));
  let pendingItemId = "";
  const visiblyRendered = (panel: HTMLElement) => {
    if (!panel.isConnected) return false;
    const visibility = getComputedStyle(panel).visibility;
    if (visibility === "hidden" || visibility === "collapse") return false;
    for (let node: HTMLElement | null = panel; node; node = node.parentElement) {
      if (node.hasAttribute("hidden")) return false;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.contentVisibility === "hidden" || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const check = () => {
    const panel = activePanel();
    if (!panel || !panels.includes(panel) || document.visibilityState !== "visible" || !visiblyRendered(panel)) return;
    const id = itemId(panel);
    if (!id || id !== pendingItemId || earned.has(id)) return;
    const box = panel.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0 || box.right <= 0 || box.left >= innerWidth || box.bottom <= 0 || box.top >= innerHeight) return;
    window.dispatchEvent(new CustomEvent("course-progress:explore", { detail: { activityId: root.id, itemId: id } }));
    pendingItemId = "";
  };
  window.addEventListener("course-progress:explore-state", ((event: CustomEvent<{ activityId: string; itemIds: string[] }>) => {
    if (event.detail.activityId !== root.id) return;
    earned.clear();
    event.detail.itemIds.forEach((id) => earned.add(id));
  }) as EventListener);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(check, { threshold: 0.01 });
    panels.forEach((panel) => observer.observe(panel));
  }
  const attributes = new MutationObserver(check);
  const watched = new Set<HTMLElement>();
  panels.forEach((panel) => {
    for (let node: HTMLElement | null = panel; node; node = node.parentElement) {
      if (watched.has(node)) continue;
      watched.add(node);
      attributes.observe(node, { attributes: true, attributeFilter: ["hidden", "style", "class"] });
    }
  });
  const checkAfterTransition = (event: Event) => {
    if (event.target instanceof Element && panels.some((panel) => (event.target as Element).contains(panel))) check();
  };
  document.addEventListener("transitionend", checkAfterTransition);
  document.addEventListener("transitioncancel", checkAfterTransition);
  document.addEventListener("animationend", checkAfterTransition);
  document.addEventListener("visibilitychange", check);
  return () => {
    const panel = activePanel();
    pendingItemId = panel ? itemId(panel) || "" : "";
    check();
  };
}
