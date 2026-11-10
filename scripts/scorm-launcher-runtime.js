// Runs only in the persistent, LMS-owned index.html. Child documents use the
// CourseSCORM contract and retain the shell's existing progress save logic.
(() => {
  const config = JSON.parse(document.querySelector('[data-launch-config]')?.textContent || "null");
  const frame = document.getElementById("course");
  const error = document.getElementById("launch-error");
  if (!config || !frame || !error) return;

  const routes = new Map(config.routes);
  const files = new Map([...routes].map(([route, file]) => [new URL(file, location.href).pathname, route]));
  let api = null;
  let state = "failed";
  let finalSave = null;
  const fail = (detail) => {
    console.error(`[scorm-launcher] ${detail}`);
    error.hidden = false;
  };
  const findApi = () => {
    const visited = new Set();
    for (const startingWindow of [window, window.opener]) {
      let current = startingWindow;
      for (let depth = 0; current && depth < 20 && !visited.has(current); depth += 1) {
        visited.add(current);
        try {
          if (current.API) return current.API;
          if (current === current.parent) break;
          current = current.parent;
        } catch { break; }
      }
    }
    return null;
  };
  const get = (key) => {
    const value = api.LMSGetValue(key);
    return api.LMSGetLastError() === "0" ? value : null;
  };
  const set = (key, value) => api.LMSSetValue(key, value) === "true";
  const commit = () => api.LMSCommit("") === "true";
  const runtime = {
    get api() { return api; },
    get state() { return state; },
    registerFinalSave(callback) { if (state === "ready") finalSave = callback; },
  };
  window.CourseSCORM = runtime;

  api = findApi();
  if (!api) { fail("LMS API unavailable."); return; }
  let status = get("cmi.core.lesson_status");
  if (status === null) {
    if (api.LMSInitialize("") !== "true") { fail("LMSInitialize failed."); return; }
    status = get("cmi.core.lesson_status");
  }
  const savedRoute = get("cmi.core.lesson_location");
  if (status === null || savedRoute === null || get("cmi.suspend_data") === null) { fail("Required LMS values could not be read."); return; }
  if (["", "not attempted", "browsed"].includes(status) && (!set("cmi.core.lesson_status", "incomplete") || !commit())) {
    fail("Initial LMS status could not be saved.");
    return;
  }
  state = "ready";

  const requested = new URL(location.href).searchParams.getAll("module");
  // A query target must exactly match a configured logical route. Never use
  // it as a URL, path fragment, or iframe source directly.
  const initialRoute = requested.length === 1 && routes.has(requested[0]) ? requested[0]
    : requested.length ? "/" : routes.has(savedRoute) ? savedRoute : "/";
  const updateModule = (route) => {
    const url = new URL(location.href);
    url.searchParams.set("module", route);
    history.replaceState(null, "", url);
  };
  frame.addEventListener("load", () => {
    if (state !== "ready") return;
    let route = null;
    try {
      const child = new URL(frame.contentWindow.location.href);
      if (child.origin === location.origin) route = files.get(child.pathname) || null;
    } catch { /* An external frame is not a course route. */ }
    if (!route) {
      fail("Child navigated outside configured course files.");
      frame.src = new URL(routes.get("/"), location.href).href;
      return;
    }
    updateModule(route);
    if (!set("cmi.core.lesson_location", route) || !commit()) fail("Learner location could not be saved.");
  });
  updateModule(initialRoute);
  frame.src = new URL(routes.get(initialRoute), location.href).href;

  const close = () => {
    if (state !== "ready") return;
    try { finalSave?.(); } catch (cause) { console.error("[scorm-launcher] Final child save failed.", cause); }
    state = "closing";
    if (!set("cmi.core.exit", "suspend")) fail("LMS exit could not be saved.");
    if (!commit()) fail("Final LMS commit failed.");
    api.LMSFinish("");
    state = "finished";
  };
  window.addEventListener("pagehide", close);
  window.addEventListener("beforeunload", close);
})();
