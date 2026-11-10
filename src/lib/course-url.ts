// Course data uses logical routes. Packaged navigation points at real HTML
// files because many LMS hosts do not resolve directory URLs.
export function courseUrl(path: string): string {
  const logical = new URL(path, "https://course.invalid");
  if (logical.origin !== "https://course.invalid" || !/^\/(?:[a-z0-9-]+\/)*$/.test(logical.pathname)) throw new Error(`Invalid course route: ${path}`);
  const current = document.querySelector<HTMLElement>("[data-course-path]")?.dataset.coursePath || "/";
  const depth = current.split("/").filter(Boolean).length;
  const root = new URL(depth ? "../".repeat(depth) : "./", window.location.href);
  const relative = logical.pathname.replace(/^\/+/, "");
  const packaged = document.documentElement.dataset.scormPackage === "true";
  const target = new URL(packaged ? (relative ? `${relative}index.html` : "overview.html") : relative, root);
  target.search = logical.search;
  target.hash = logical.hash;
  return `${target.pathname}${target.search}${target.hash}`;
}
