import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { access, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const dist = path.resolve("dist");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const builtConfig = JSON.parse((await readFile(path.join(dist, "index.html"), "utf8")).match(/<script\b[^>]*data-course-config[^>]*>([\s\S]*?)<\/script>/)?.[1] || "null");
assert(builtConfig?.lessons?.length > 0 && builtConfig?.completion?.milestones && builtConfig?.completion?.storageKey, "Built course configuration is missing lessons or milestones.");
const lessonFile = (route) => path.join(dist, ...route.split("/").filter(Boolean), "index.html");
const fixtureDist = path.resolve(".verification-dist");
const astro = path.resolve("node_modules", "astro", "bin", "astro.mjs");
const exists = async (file) => access(file).then(() => true, () => false);
const errors = [];
const monitor = (page, label, origin) => {
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${label}: ${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${label}: HTTP ${response.status()} ${response.url()}`); });
  page.on("request", (request) => { const url = new URL(request.url()); if (/^https?:$/.test(url.protocol) && url.origin !== origin) errors.push(`${label}: external request ${url}`); });
};
const waitCompleted = (page, id, key = builtConfig.completion.storageKey, timeout = 8000) => page.waitForFunction(({ id, key }) => {
  try { return JSON.parse(localStorage.getItem(key) || "{}").completed?.includes(id); } catch { return false; }
}, { id, key }, { timeout });
const installMockLms = (context, values, withoutNavigationApi = false) => context.addInitScript(({ values, withoutNavigationApi }) => {
  if (withoutNavigationApi) Object.defineProperty(window, "navigation", { configurable: true, value: undefined });
  const key = "__readiness_lms_mock";
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ values, calls: [], errors: [], active: false, finished: false, error: "0", failElement: "" }));
  const read = () => JSON.parse(localStorage.getItem(key));
  const write = (state) => localStorage.setItem(key, JSON.stringify(state));
  const call = (name, element, value) => { const state = read(); state.calls.push([name, element, value]); return state; };
  window.API = {
    LMSInitialize() { const state = call("LMSInitialize"); if (state.active) { state.errors.push("101 repeated initialize"); state.error = "101"; write(state); return "false"; } state.active = true; state.finished = false; state.error = "0"; write(state); return "true"; },
    LMSFinish() { const state = call("LMSFinish"); if (!state.active || state.finished) { state.errors.push("101 duplicate finish"); state.error = "101"; write(state); return "false"; } state.active = false; state.finished = true; state.error = "0"; write(state); return "true"; },
    LMSGetValue(element) { const state = call("LMSGetValue", element); state.error = state.active ? "0" : "301"; write(state); return state.active ? state.values[element] || "" : ""; },
    LMSSetValue(element, value) { const state = call("LMSSetValue", element, value); if (!state.active || state.failElement === element) { state.errors.push(`${state.active ? "101 forced failure" : "301 set after finish"}: ${element}`); state.error = state.active ? "101" : "301"; write(state); return "false"; } state.values[element] = value; state.error = "0"; write(state); return "true"; },
    LMSCommit() { const state = call("LMSCommit"); if (!state.active) state.errors.push("301 commit after finish"); state.error = state.active ? "0" : "301"; write(state); return state.active ? "true" : "false"; },
    LMSGetLastError() { return read().error; }, LMSGetErrorString(code) { return code === "101" ? "General exception" : code === "301" ? "Not initialized" : "No error"; }, LMSGetDiagnostic() { return ""; },
  };
}, { values, withoutNavigationApi });
const lmsState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("__readiness_lms_mock")));
const lmsCalls = (state, name) => state.calls.filter((call) => call[0] === name).length;
const lmsSeed = (extra = {}) => ({ "cmi.core.lesson_status": "not attempted", "cmi.core.lesson_location": "/", "cmi.core.student_id": "readiness-learner", "cmi.suspend_data": "", ...extra });
const suspend = (config, omitted = []) => {
  const milestones = config.completion.milestones;
  const schema = JSON.stringify(milestones.map(({ id, path, type, targetId, requiredItems, threshold, required }) => [id, path, type, targetId, requiredItems || [], threshold ?? null, required]));
  let hash = 0xcbf29ce484222325n;
  for (const character of schema) hash = BigInt.asUintN(64, (hash ^ BigInt(character.charCodeAt(0))) * 0x100000001b3n);
  return JSON.stringify({
    v: config.completion.storageKey, s: hash.toString(16).padStart(16, "0"),
    c: milestones.flatMap((item, index) => omitted.includes(item.id) ? [] : [index]),
    w: Object.fromEntries(milestones.flatMap((item, index) => item.type === "watch" && !omitted.includes(item.id) ? [[index, [[0, 100]]]] : [])),
    d: Object.fromEntries(milestones.flatMap((item, index) => item.type === "watch" && !omitted.includes(item.id) ? [[index, 100]] : [])),
    e: Object.fromEntries(milestones.flatMap((item, index) => item.type === "explore" && !omitted.includes(item.id) ? [[index, item.requiredItems]] : [])),
    u: {},
  });
};
const fixtureConfig = async (route) => {
  const html = await readFile(path.join(fixtureDist, ...route.split("/"), "index.html"), "utf8");
  const value = JSON.parse(html.match(/<script\b[^>]*data-course-progress-config[^>]*>([\s\S]*?)<\/script>/)?.[1] || "null");
  assert(value?.lessons?.length && value?.milestones?.length, `Missing course progress config in ${route}`);
  return { lessons: value.lessons, completion: { storageKey: value.storageKey, milestones: value.milestones, sequentialUnlocking: value.sequentialUnlocking } };
};

for (const lesson of builtConfig.lessons) assert(await exists(lessonFile(lesson.path)), `Missing configured production lesson: ${lesson.path}`);
assert(!(await exists(path.join(dist, "__verify-components", "index.html"))), "Verification fixtures entered the production build.");
await rm(fixtureDist, { recursive: true, force: true });
try {
  await run(process.execPath, [astro, "build", "--outDir", fixtureDist], {
    cwd: process.cwd(), env: { ...process.env, COURSE_VERIFY_COMPONENTS: "1", PUBLIC_COURSE_VERIFY: "1" },
  });
  for (const route of ["__verify-components", "__verify-completion", "__verify-large", "__verify-interactions", "__verify-bad-contract", "__verify-routes", "__verify-routes-unlocked", "__verify-routes-empty", "__verify-nav", "__verify-nav/scenario/review"]) {
    assert(await exists(path.join(fixtureDist, route, "index.html")), `Missing ${route} fixture.`);
  }
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
      let target = path.resolve(fixtureDist, `.${pathname}`);
      if (!target.startsWith(`${fixtureDist}${path.sep}`) && target !== fixtureDist) throw new Error("Invalid path");
      if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
      response.writeHead(200, { "Content-Type": mime[path.extname(target).toLowerCase()] || "application/octet-stream" });
      response.end(await readFile(target));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 375, 768, 1024, 1280, 1366, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      monitor(page, `${width}px`, origin);
      await page.goto(origin, { waitUntil: "networkidle" });
      assert(await page.title() === builtConfig.identity.title, `${width}px browser title changed`);
      assert((await page.locator(".skip-link").count()) === 1, `${width}px skip link missing`);
      assert((await page.locator(".course-links a[data-lesson-path]").count()) === builtConfig.lessons.length, `${width}px configured lesson links missing`);
      assert((await page.locator(".course-links__heading").textContent()) === "Course lessons", `${width}px lessons heading changed`);
      assert((await page.locator("[data-progress-lessons] .course-progress__lesson").count()) === builtConfig.lessons.length, `${width}px progress lesson count changed`);
      assert((await page.locator(".footer-inner > p").textContent()) === "Return to People Connect to continue", `${width}px footer text changed`);
      assert((await page.locator(".footer-inner > p a, .footer-inner > p button, [data-progress-reset]").count()) === 0, `${width}px learner control entered footer or Progress`);
      assert((await page.locator(".footer-inner > a").textContent()).includes("Back to top"), `${width}px Back to top missing`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px horizontal overflow`);
      const type = await page.evaluate(() => ({ size: parseFloat(getComputedStyle(document.body).fontSize), family: getComputedStyle(document.body).fontFamily }));
      assert(Math.abs(type.size - 18) < .1 && type.family.includes("Arial Nova"), `${width}px shared typography changed`);
      const progress = page.locator("[data-progress-trigger]");
      await progress.focus();
      assert(await progress.evaluate((node) => getComputedStyle(node).outlineStyle !== "none"), `${width}px progress focus invisible`);
      await progress.press("Enter");
      assert(await page.locator("[data-progress-panel]").isVisible(), `${width}px progress panel did not open`);
      const lessonRows = page.locator("[data-progress-lesson]");
      for (const lesson of builtConfig.lessons) {
        const row = page.locator(`[data-progress-lesson="${lesson.id}"]`);
        assert((await row.count()) > 0, `${width}px missing progress row for ${lesson.path}`);
      }
      assert((await page.locator("[data-progress-course-count]").textContent()).includes(`of ${builtConfig.completion.milestones.filter((item) => item.required).length} completed`), `${width}px course-wide required count changed`);
      const firstToDo = page.locator('[data-progress-lesson] .course-progress__activity-group').first();
      if (await firstToDo.count()) assert((await firstToDo.locator("h3").textContent()) === "Still to do", `${width}px missing outstanding heading`);
      await page.keyboard.press("Escape");
      assert(!(await page.locator("[data-progress-panel]").isVisible()), `${width}px progress panel did not close`);
      const toggle = page.locator(".lessons-toggle");
      await toggle.press("Enter");
      assert(await page.locator(".course-links").isVisible(), `${width}px Lessons dropdown did not open`);
      assert((await page.locator(".course-links a[data-lesson-path]").count()) >= 1, `${width}px no unlocked lesson link`);
      await progress.click();
      assert(!(await page.locator(".course-links").isVisible()) && await page.locator("[data-progress-panel]").isVisible(), `${width}px Lessons and Progress remained open together`);
      await page.keyboard.press("Escape");
      await toggle.click();
      await page.keyboard.press("Escape");
      assert(!(await page.locator(".course-links").isVisible()) && await toggle.evaluate((node) => document.activeElement === node), `${width}px Lessons Escape/focus failed`);
      if (width <= 375) {
        const footer = await page.locator(".footer-inner").evaluate((node) => {
          const style = getComputedStyle(node); const link = node.querySelector("a");
          return { direction: style.flexDirection, gap: parseFloat(style.gap), top: parseFloat(style.paddingTop), side: parseFloat(style.paddingLeft), height: parseFloat(style.minHeight), linkHeight: link.getBoundingClientRect().height };
        });
        assert(footer.direction === "column" && footer.gap === 16 && footer.top === 24 && footer.side === 20 && footer.height === 144 && footer.linkHeight >= 44, `${width}px footer layout changed`);
      }
      await context.close();
    }

    // Every configured route is checked with a valid completed standalone
    // record. Activity behavior is exercised by the dedicated fixture below.
    const completeState = {
      completed: builtConfig.completion.milestones.map((item) => item.id),
      watchRanges: Object.fromEntries(builtConfig.completion.milestones.filter((item) => item.type === "watch").map((item) => [item.id, [[0, 100]]])),
      watchDurations: Object.fromEntries(builtConfig.completion.milestones.filter((item) => item.type === "watch").map((item) => [item.id, 100])),
      explored: Object.fromEntries(builtConfig.completion.milestones.filter((item) => item.type === "explore").map((item) => [item.id, item.requiredItems])),
      ui: {},
    };
    const context = await browser.newContext();
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: builtConfig.completion.storageKey, value: completeState });
    const page = await context.newPage();
    monitor(page, "configured routes", origin);
    for (const lesson of builtConfig.lessons) {
      await page.goto(`${origin}${lesson.path}`, { waitUntil: "networkidle" });
      assert((await page.locator("[data-course-path]").getAttribute("data-course-path")) === lesson.path, `Configured lesson did not render: ${lesson.path}`);
      assert(!(await page.locator("[data-access-pending]").count()), `Configured lesson remained locked: ${lesson.path}`);
    }
    await context.close();

    // These scenarios use a renamed, nested two-lesson fixture. Production
    // courses are checked above from their own configuration.
    const navConfig = await fixtureConfig("__verify-nav");
    assert(navConfig.lessons.length === 2 && navConfig.lessons[1].path === "/scenario/review/", "Nested navigation fixture is incomplete");
    const navStart = `${origin}/__verify-nav/`;
    const navReview = `${origin}/__verify-nav/scenario/review/`;
    const navPartial = suspend(navConfig, ["fixture-response"]);
    const navigationContext = await browser.newContext();
    await installMockLms(navigationContext, lmsSeed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": navPartial }));
    const lmsPage = await navigationContext.newPage();
    monitor(lmsPage, "simulated LMS navigation", origin);
    await lmsPage.goto(navStart, { waitUntil: "networkidle" });
    await lmsPage.locator("[data-progress-trigger]").click();
    assert((await lmsPage.locator("[data-progress-lesson]").count()) === navConfig.lessons.length &&
      (await lmsPage.locator("[data-progress-lessons]").textContent()).includes(navConfig.lessons[1].label), "Renamed nested lessons did not render from fixture configuration");
    await lmsPage.locator("[data-progress-close]").click();
    await lmsPage.locator("[data-fixture-lesson-link]").click();
    await lmsPage.waitForURL(navReview);
    let mock = await lmsState(lmsPage);
    assert(lmsCalls(mock, "LMSInitialize") === 1 && lmsCalls(mock, "LMSFinish") === 0 && mock.errors.length === 0, "Lesson navigation changed active LMS session");
    await lmsPage.goBack({ waitUntil: "networkidle" });
    mock = await lmsState(lmsPage);
    assert(lmsCalls(mock, "LMSInitialize") === 1 && lmsCalls(mock, "LMSFinish") === 0 && mock.errors.length === 0, "Back navigation finished or reinitialized the LMS session");
    await lmsPage.locator("[data-fixture-top]").click();
    await lmsPage.goto(`${origin}/__verify-components/`, { waitUntil: "networkidle" });
    mock = await lmsState(lmsPage);
    assert(lmsCalls(mock, "LMSFinish") === 1 && mock.values["cmi.core.lesson_status"] === "incomplete" && mock.errors.length === 0, "Same-page hash or actual exit finalized incorrectly");
    await navigationContext.close();

    const fallbackContext = await browser.newContext();
    await installMockLms(fallbackContext, lmsSeed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": navPartial }), true);
    const fallback = await fallbackContext.newPage();
    await fallback.goto(navStart, { waitUntil: "networkidle" });
    await fallback.evaluate(() => {
      const canceled = document.createElement("a");
      canceled.href = "./scenario/review/";
      canceled.addEventListener("click", (event) => event.preventDefault());
      document.body.append(canceled);
      canceled.click();
      const modified = document.createElement("a");
      modified.href = canceled.href;
      modified.target = "_blank";
      modified.addEventListener("click", (event) => event.preventDefault());
      document.body.append(modified);
      modified.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
    });
    await fallback.locator("[data-fixture-top]").click();
    await fallback.goto(`${origin}/__verify-components/`, { waitUntil: "networkidle" });
    mock = await lmsState(fallback);
    assert(lmsCalls(mock, "LMSFinish") === 1 && lmsCalls(mock, "LMSInitialize") === 1 && mock.errors.length === 0, "Fallback retained canceled or hash navigation intent");
    await fallbackContext.close();

    const delayedContext = await browser.newContext();
    await installMockLms(delayedContext, lmsSeed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": navPartial }), true);
    const delayed = await delayedContext.newPage();
    await delayed.goto(navStart, { waitUntil: "networkidle" });
    const commitsBeforeDelay = lmsCalls(await lmsState(delayed), "LMSCommit");
    await delayed.route("**/__verify-nav/scenario/review/", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2300));
      await route.continue();
    });
    const startDelay = Date.now();
    await delayed.locator("[data-fixture-lesson-link]").click();
    await delayed.waitForURL(navReview);
    mock = await lmsState(delayed);
    assert(Date.now() - startDelay >= 2000 && lmsCalls(mock, "LMSInitialize") === 1 && lmsCalls(mock, "LMSFinish") === 0 && lmsCalls(mock, "LMSCommit") > commitsBeforeDelay && mock.errors.length === 0, "Delayed fallback lesson transition failed to commit or changed the active LMS session");
    await delayedContext.close();

    const recoveryContext = await browser.newContext();
    await installMockLms(recoveryContext, lmsSeed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": suspend(navConfig) }));
    const recovery = await recoveryContext.newPage();
    await recovery.goto(navStart, { waitUntil: "networkidle" });
    mock = await lmsState(recovery);
    assert(mock.values["cmi.core.lesson_status"] === "completed" && mock.errors.length === 0, "Fully validated earned LMS record did not recover its status");
    await recoveryContext.close();

    const legacyRecord = JSON.parse(navPartial);
    legacyRecord.u = Object.fromEntries(Array.from({ length: 25 }, (_, index) => [`slot-${index}`, "x".repeat(64)]));
    assert(JSON.stringify(legacyRecord.u).length > 1800 && JSON.stringify(legacyRecord).length < 4096, "Legacy oversized-UI fixture does not cross the intended boundary");
    const legacyContext = await browser.newContext();
    await installMockLms(legacyContext, lmsSeed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": JSON.stringify(legacyRecord) }));
    const legacy = await legacyContext.newPage();
    await legacy.goto(navStart, { waitUntil: "networkidle" });
    assert((await legacy.locator("[data-progress-percent]").textContent()) !== "0%" && (await legacy.locator("[data-progress-save-error]").textContent()).includes("Earned course progress was preserved"), "Legacy optional UI overflow discarded valid earned evidence or hid the repair");
    await legacyContext.close();

    const freshContext = await browser.newContext();
    await installMockLms(freshContext, lmsSeed());
    const fresh = await freshContext.newPage();
    await fresh.goto(navStart, { waitUntil: "networkidle" });
    mock = await lmsState(fresh);
    assert(mock.values["cmi.core.lesson_status"] !== "completed", "Fresh LMS attempt completed without requirements");
    await freshContext.close();

    const interactionConfig = await fixtureConfig("__verify-interactions");
    assert(interactionConfig.lessons.length === 1, "Single-lesson interaction fixture is incomplete");
    const restoredAnswer = JSON.parse(suspend(interactionConfig, ["fixture-assessment", "fixture-knowledge"]));
    restoredAnswer.u = { "fixture-assessment:answer": 1 };
    const answerContext = await browser.newContext();
    await installMockLms(answerContext, lmsSeed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": JSON.stringify(restoredAnswer) }));
    const answerPage = await answerContext.newPage();
    await answerPage.goto(`${origin}/__verify-interactions/`, { waitUntil: "networkidle" });
    const answerMock = await lmsState(answerPage);
    assert((await answerPage.locator("#fixture-assessment input[type=radio]:checked").count()) === 1 &&
      (await answerPage.locator("#fixture-assessment [data-assessment-feedback-copy]").textContent()).includes("Incorrect response.") &&
      !JSON.parse(answerMock.values["cmi.suspend_data"]).c.includes(4), "Restored answer created an unearned new attempt");
    await answerContext.close();

    const attemptContext = await browser.newContext();
    await installMockLms(attemptContext, lmsSeed());
    const attempt = await attemptContext.newPage();
    await attempt.goto(`${origin}/__verify-interactions/`, { waitUntil: "networkidle" });
    await attempt.locator("[data-progress-trigger]").click();
    assert((await attempt.locator("[data-progress-lesson]").count()) === interactionConfig.lessons.length &&
      (await attempt.locator("[data-progress-course-count]").textContent()).includes(`of ${interactionConfig.completion.milestones.filter((item) => item.required).length} completed`), "Single-lesson course summary did not follow configuration");
    await attempt.locator("[data-progress-close]").click();
    await attempt.locator("#fixture-assessment input[type=radio]").last().check();
    const attemptMock = await lmsState(attempt);
    assert(JSON.parse(attemptMock.values["cmi.suspend_data"] || "{}").c?.includes(4) &&
      (await attempt.locator("#fixture-assessment [data-assessment-feedback-copy]").textContent()).includes("Incorrect response.") &&
      !(await attempt.locator("#fixture-knowledge input[type=radio]:checked").count()), "Wrong valid attempt or independent assessment state failed");
    await attemptContext.close();

    const interactionContext = await browser.newContext();
    await installMockLms(interactionContext, lmsSeed());
    const interaction = await interactionContext.newPage();
    monitor(interaction, "simulated LMS interactions", origin);
    await interaction.goto(`${origin}/__verify-interactions/`, { waitUntil: "networkidle" });
    const exploredIds = async (id) => { const saved = (await lmsState(interaction)).values["cmi.suspend_data"]; return JSON.parse(saved || "{}").e?.[id] || []; };
    await interaction.locator("#fixture-steps [role=tabpanel]:not([hidden])").scrollIntoViewIfNeeded();
    await interaction.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[0]?.includes("first"));
    await interaction.locator("#fixture-steps [data-step-next]").click();
    assert(JSON.stringify(await exploredIds(0)) === JSON.stringify(["first", "second"]), "Initial visible step or Next failed to earn every required child after LMS launch");
    await interaction.locator("#fixture-carousel").scrollIntoViewIfNeeded();
    await interaction.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[1]?.includes("one"));
    await interaction.locator("#fixture-carousel [data-carousel-next]").click();
    assert(JSON.stringify(await exploredIds(1)) === JSON.stringify(["one", "two"]), "Tracked carousel initial or next slide failed after LMS launch");
    await interaction.locator("#fixture-tabs").scrollIntoViewIfNeeded();
    await interaction.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[2]?.includes("alpha"));
    await interaction.locator("#fixture-tabs [data-explore-item=beta][role=tab]").click();
    assert(JSON.stringify(await exploredIds(2)) === JSON.stringify(["alpha", "beta"]), "Tracked tabs did not earn the visible initial panel and selected panel");
    await interaction.locator("#fixture-items [data-category-choice=apply]").click();
    assert(JSON.stringify(await exploredIds(3)) === JSON.stringify(["reflect"]), "Explorer credited an unselected item");
    await interaction.reload({ waitUntil: "networkidle" });
    assert(await interaction.locator("#fixture-items [data-explorer-item=reflect]").isVisible() && (await interaction.locator("#fixture-items [data-category-choice=apply]").getAttribute("aria-pressed")) === "true", "Explorer did not restore category and item atomically");
    assert(JSON.stringify(await exploredIds(3)) === JSON.stringify(["reflect"]), "Explorer restoration emitted new exploration");
    assert((await interaction.locator("#fixture-carousel [data-carousel-count]").textContent()) === "2 of 2" && (await interaction.locator("#fixture-tabs [role=tab][aria-selected=true]").getAttribute("data-explore-item")) === "beta", "Carousel or tabs did not restore active content");
    await interactionContext.close();

    const failedSaveContext = await browser.newContext();
    await installMockLms(failedSaveContext, lmsSeed());
    const failedSave = await failedSaveContext.newPage();
    await failedSave.goto(`${origin}/__verify-large/`, { waitUntil: "networkidle" });
    await failedSave.evaluate(() => { const key = "__readiness_lms_mock"; const value = JSON.parse(localStorage.getItem(key)); value.failElement = "cmi.suspend_data"; localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("course-progress:complete", { detail: { activityId: "evidence-0" } })); });
    let failedMock = await lmsState(failedSave);
    assert(!JSON.parse(failedMock.values["cmi.suspend_data"] || "{}").c?.includes(0) && await failedSave.locator("[data-progress-save-error]").isVisible(), "Failed LMS save granted credit or concealed the error");
    await failedSave.evaluate(() => { const key = "__readiness_lms_mock"; const value = JSON.parse(localStorage.getItem(key)); value.failElement = ""; localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("course-progress:complete", { detail: { activityId: "evidence-0" } })); });
    failedMock = await lmsState(failedSave);
    assert(JSON.parse(failedMock.values["cmi.suspend_data"] || "{}").c?.includes(0) && failedMock.values["cmi.core.lesson_status"] !== "completed", "Failed LMS save could not recover without premature completion");
    await failedSaveContext.close();

    const reflectionContext = await browser.newContext();
    await installMockLms(reflectionContext, lmsSeed({ "cmi.core.student_id": "", "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": navPartial }));
    const reflection = await reflectionContext.newPage();
    await reflection.goto(navReview, { waitUntil: "networkidle" });
    await reflection.locator("#fixture-response textarea").fill("Private readiness response sentinel");
    await reflection.locator("#fixture-response button[type=submit]").click();
    const reflectionMock = await lmsState(reflection);
    assert((await reflection.locator("#fixture-response [data-reflection-status]").textContent()).includes("open page only") && !reflectionMock.values["cmi.suspend_data"].includes("Private readiness response sentinel"), "Identity-free reflection leaked text or failed to explain session-only storage");
    await reflectionContext.close();

    const storageContext = await browser.newContext();
    await installMockLms(storageContext, lmsSeed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": navPartial }));
    await storageContext.addInitScript(() => { const nativeSet = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.endsWith("-text")) throw new Error("Private storage unavailable"); return nativeSet.call(this, key, value); }; });
    const storage = await storageContext.newPage();
    await storage.goto(navReview, { waitUntil: "networkidle" });
    await storage.locator("#fixture-response textarea").fill("Browser storage sentinel");
    await storage.locator("#fixture-response button[type=submit]").click();
    assert((await storage.locator("#fixture-response [data-reflection-status]").textContent()).includes("open page only") && !(await lmsState(storage)).values["cmi.suspend_data"].includes("Browser storage sentinel"), "Unavailable browser text storage did not use the private session fallback");
    await storageContext.close();

    const routes = await browser.newPage();
    monitor(routes, "route fixture", origin);
    await routes.goto(`${origin}/__verify-routes/`, { waitUntil: "networkidle" });
    const paths = () => routes.evaluate(() => new Promise((resolve) => {
      window.addEventListener("course-progress:state", (event) => resolve(event.detail.unlockedPaths), { once: true });
      window.dispatchEvent(new Event("course-progress:request-state"));
    }));
    assert(JSON.stringify(await paths()) === JSON.stringify(["/", "/alpha/", "/topics/deep/"]), "Immediate VIEW did not unlock through the requirement-free lesson");
    await waitCompleted(routes, "start-view", "astro-course-progress:route-fixture:v1");
    assert(!(await paths()).includes("/finish/"), "Unfinished interaction unlocked the final lesson");
    await routes.goto(`${origin}/__verify-routes-unlocked/`, { waitUntil: "networkidle" });
    assert((await paths()).length === 4, "Disabled unlocking did not expose every non-numbered route");
    await routes.goto(`${origin}/__verify-routes-empty/`, { waitUntil: "networkidle" });
    assert((await paths()).length === 4 && (await routes.locator("[data-progress-percent]").textContent()) === "0%", "Empty requirements locked or completed a course");
    await routes.close();

    const fixture = await browser.newPage();
    monitor(fixture, "completion fixture", origin);
    await fixture.goto(`${origin}/__verify-completion/`, { waitUntil: "networkidle" });
    await waitCompleted(fixture, "fixture-view", "astro-course-progress:verification-fixture:v1", 500);
    const fixtureState = () => fixture.evaluate(() => JSON.parse(localStorage.getItem("astro-course-progress:verification-fixture:v1") || "{}"));
    assert(!(await fixtureState()).completed?.includes("fixture-later-view"), "Offscreen VIEW completed before viewport entry");
    assert(!(await fixtureState()).completed?.includes("fixture-hidden-view"), "Hidden VIEW completed");
    assert(!(await fixtureState()).completed?.includes("fixture-complete"), "Unfinished interaction completed from VIEW");
    await fixture.locator("#fixture-later-view").evaluate((node) => node.scrollIntoView({ block: "center" }));
    await waitCompleted(fixture, "fixture-later-view", "astro-course-progress:verification-fixture:v1", 700);
    assert(!(await fixtureState()).completed?.includes("fixture-hidden-view"), "Hidden VIEW completed after scrolling");
    await fixture.locator("#fixture-question button").click();
    assert(!(await fixture.evaluate(() => JSON.parse(localStorage.getItem("astro-course-progress:verification-fixture:v1") || "{}").completed?.includes("fixture-question"))), "Empty submission counted");
    await fixture.locator("#fixture-question input").check();
    await fixture.locator("#fixture-question button").click();
    await waitCompleted(fixture, "fixture-question", "astro-course-progress:verification-fixture:v1");
    await fixture.evaluate(() => {
      const video = document.querySelector("#fixture-watch");
      Object.defineProperty(video, "duration", { configurable: true, value: 100 });
      Object.defineProperty(video, "played", { configurable: true, value: { length: 2, start: (i) => i === 0 ? 0 : 30, end: (i) => i === 0 ? 40 : 70 } });
      video.dispatchEvent(new Event("timeupdate"));
    });
    assert(!(await fixture.evaluate(() => JSON.parse(localStorage.getItem("astro-course-progress:verification-fixture:v1") || "{}").completed?.includes("fixture-watch"))), "Overlapping video ranges counted as 80%");
    await fixture.evaluate(() => {
      const video = document.querySelector("#fixture-watch");
      Object.defineProperty(video, "played", { configurable: true, value: { length: 2, start: (i) => i === 0 ? 0 : 40, end: (i) => i === 0 ? 40 : 80 } });
      video.dispatchEvent(new Event("timeupdate"));
    });
    await waitCompleted(fixture, "fixture-watch", "astro-course-progress:verification-fixture:v1");
    await fixture.locator("#fixture-explore [data-explore-trigger]").first().click();
    await fixture.locator("#fixture-explore [data-explore-trigger]").last().click();
    await waitCompleted(fixture, "fixture-explore", "astro-course-progress:verification-fixture:v1");
    await fixture.locator("#fixture-complete").click();
    await waitCompleted(fixture, "fixture-complete", "astro-course-progress:verification-fixture:v1");
    await fixture.reload({ waitUntil: "networkidle" });
    assert((await fixtureState()).completed?.includes("fixture-complete") && !(await fixtureState()).completed?.includes("fixture-hidden-view"), "Standalone activity progress did not restore safely");
    await fixture.close();

    const large = await browser.newPage();
    monitor(large, "large state fixture", origin);
    await large.goto(`${origin}/__verify-large/`, { waitUntil: "networkidle" });
    await large.evaluate(() => {
      for (let index = 0; index < 120; index += 1) window.dispatchEvent(new CustomEvent("course-progress:complete", { detail: { activityId: `evidence-${index}` } }));
      for (let index = 0; index < 23; index += 1) window.dispatchEvent(new CustomEvent("course-progress:test-set-ui", { detail: { key: `slot-${index}`, value: "x".repeat(64) } }));
    });
    const largeKey = "astro-course-progress:large-fixture:v1";
    const largeState = () => large.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), largeKey);
    assert((await largeState()).completed.length === 120 && Object.keys((await largeState()).ui).length === 23, `Large course evidence or valid optional UI failed to save: ${JSON.stringify({ earned: (await largeState()).completed.length, ui: Object.keys((await largeState()).ui).length })}`);
    await large.evaluate(() => window.dispatchEvent(new CustomEvent("course-progress:test-set-ui", { detail: { key: "slot-23", value: "x".repeat(64) } })));
    assert(Object.keys((await largeState()).ui).length === 23 && await large.locator("[data-progress-save-error]").isVisible(), "Oversized optional UI was accepted or not reported");
    await large.reload({ waitUntil: "networkidle" });
    assert((await largeState()).completed.length === 120 && (await large.locator("[data-progress-percent]").textContent()) === "100%", "Large earned state did not restore");
    await large.close();

    const capacityContext = await browser.newContext();
    await installMockLms(capacityContext, lmsSeed());
    const capacity = await capacityContext.newPage();
    await capacity.goto(`${origin}/__verify-large/`, { waitUntil: "networkidle" });
    const capacityResult = await capacity.evaluate(() => {
      const children = [...document.querySelectorAll("#capacity-explore [data-explore-item]")].map((node) => node.dataset.exploreItem);
      children.forEach((itemId) => window.dispatchEvent(new CustomEvent("course-progress:explore", { detail: { activityId: "capacity-explore", itemId } })));
      let dropped = false;
      for (let index = 0; index < 24; index += 1) {
        window.dispatchEvent(new CustomEvent("course-progress:test-set-ui", { detail: { key: `slot-${index}`, value: "x".repeat(64) } }));
        const saved = JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}");
        if (index > 0 && Object.keys(saved.u || {}).length === 0) { dropped = true; break; }
      }
      const saved = JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}");
      return { dropped, explored: saved.e?.[120]?.length, ui: Object.keys(saved.u || {}).length };
    });
    assert(capacityResult.dropped && capacityResult.explored === 38 && capacityResult.ui === 0 && await capacity.locator("[data-progress-save-error]").isVisible(), `LMS capacity handling lost evidence or concealed optional UI removal: ${JSON.stringify(capacityResult)}`);
    await capacityContext.close();

    const components = await browser.newPage();
    monitor(components, "component fixture", origin);
    await components.goto(`${origin}/__verify-components/`, { waitUntil: "networkidle" });
    assert((await components.locator(".responsive-table").count()) > 0, "Shared component fixture is missing");
    assert(await components.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Shared component fixture overflows");
    await components.locator("#gallery-knowledge-check input[type=radio]").first().check();
    assert(await components.locator("#gallery-knowledge-check [data-assessment-feedback]").isVisible(), "Knowledge-check feedback did not appear on selection");
    assert(!(await components.locator("#gallery-assessment input[type=radio]:checked").count()), "Independent assessment instance was changed");
    await components.locator("#gallery-explorer [data-category-choice=apply]").click();
    assert(await components.locator("#gallery-explorer [data-explorer-item=reflect]").isVisible() && (await components.locator("#gallery-explorer [data-item-choice=reflect]").getAttribute("aria-pressed")) === "true", "Explorer category and active item diverged");
    await components.close();
    const badContract = await browser.newPage();
    const contractErrors = [];
    badContract.on("console", (message) => { if (message.type() === "error") contractErrors.push(message.text()); });
    await badContract.goto(`${origin}/__verify-bad-contract/`, { waitUntil: "networkidle" });
    assert(contractErrors.some((message) => message.includes('Unresolved target "missing-view"')) &&
      contractErrors.some((message) => message.includes('SUBMIT target "bad-submit"')) &&
      contractErrors.some((message) => message.includes('EXPLORE target "bad-explore"')) &&
      await badContract.locator("[data-progress-save-error]").isVisible(), "Missing target or activity trigger failed to surface a clear setup error");
    await badContract.close();
    assert(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
  console.log(`Course Chromium verification passed: responsive shell, typography, footer, ${builtConfig.lessons.length} configured routes, ${builtConfig.completion.milestones.length} milestones, immediate VIEW, unlocking variants, large state and capacity boundaries, interaction restore, and strict simulated LMS navigation, recovery, save failure and reflection privacy.`);
} finally { await rm(fixtureDist, { recursive: true, force: true }); }
