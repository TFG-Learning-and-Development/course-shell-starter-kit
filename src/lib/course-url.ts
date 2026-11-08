// Course data uses logical routes. Packaged navigation points at real HTML
// files because many LMS hosts do not resolve directory URLs.
export function courseUrl(path: string): string {
  const current = document.querySelector<HTMLElement>("[data-course-path]")?.dataset.coursePath || "/";
  const depth = current.split("/").filter(Boolean).length;
  const root = new URL(depth ? "../".repeat(depth) : "./", window.location.href);
  const relative = path.replace(/^\/+/, "");
  const packaged = document.documentElement.dataset.scormPackage === "true";
  const target = new URL(packaged ? `${relative}index.html` : relative, root);
  return `${target.pathname}${target.search}${target.hash}`;
}
