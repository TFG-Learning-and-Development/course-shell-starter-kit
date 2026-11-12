import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { access, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const dist = path.resolve("dist");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const progressNames = async (page) => (await page.locator("[data-progress-completed] a, [data-progress-incomplete] a").allTextContents()).map((text) => text.replace(/^[✓→]\s*/, ""));
const sameNames = (actual, expected) => JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
const assertNoExplorationTally = async (page, selector) => {
  const result = await page.locator(selector).evaluate((root) => ({
    caption: Boolean(root.querySelector("[data-flip-status], [data-explorer-status], [data-step-status]")),
    tally: /\b\d+ of \d+ (?:cards|items|steps) explored\b/i.test(root.textContent || ""),
  }));
  assert(!result.caption && !result.tally, `${selector} rendered an exploration tally or empty caption container`);
};
const builtConfig = JSON.parse((await readFile(path.join(dist, "index.html"), "utf8")).match(/<script\b[^>]*data-course-config[^>]*>([\s\S]*?)<\/script>/)?.[1] || "null");
assert(builtConfig?.lessons?.length > 0 && builtConfig?.completion?.milestones && builtConfig?.completion?.storageKey, "Built course configuration is missing lessons or milestones.");
const approvedDemoNames = ["Three principles to explore", "Choose the strongest next step", "Explore three planning lenses", "Move from brief to build", "Match the need to the pattern", "Plan one purposeful choice"];
assert(JSON.stringify(builtConfig.completion.milestones.map((item) => item.label)) === JSON.stringify(approvedDemoNames), "Progress source labels diverge from the course's rendered activity titles");
assert(!builtConfig.completion.milestones.some((item) => item.required && item.type === "view"), "Passive VIEW milestones must not be required for completion.");
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
  for (const route of ["__verify-components", "__verify-completion", "__verify-large", "__verify-interactions", "__verify-one-page", "__verify-view-lessons", "__verify-view-sections", "__verify-bad-contract", "__verify-routes", "__verify-routes-unlocked", "__verify-routes-empty", "__verify-nav", "__verify-nav/scenario/review"]) {
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
  const browser = await chromium.launch({ headless: true, ...(process.env.COURSE_BROWSER_EXECUTABLE ? { executablePath: process.env.COURSE_BROWSER_EXECUTABLE } : {}) });
  try {
    for (const width of [320, 375, 640, 768, 1024, 1280, 1366, 1440]) {
      // 640 CSS pixels at 2x device scale approximates a 1280px window at 200% zoom.
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: width === 640 ? 2 : 1, reducedMotion: "reduce" });
      const page = await context.newPage();
      monitor(page, `${width}px`, origin);
      await page.goto(origin, { waitUntil: "networkidle" });
      assert(await page.title() === builtConfig.identity.title, `${width}px browser title changed`);
      assert((await page.locator(".skip-link").count()) === 1, `${width}px skip link missing`);
      assert((await page.locator(".course-links a[data-lesson-path]").count()) === builtConfig.lessons.length, `${width}px configured lesson links missing`);
      assert((await page.locator(".course-links__heading").textContent()) === "Course lessons", `${width}px lessons heading changed`);
      assert((await page.locator("[data-progress-completed], [data-progress-incomplete]").count()) === 2, `${width}px progress lists changed`);
      assert((await page.locator(".footer-inner > p").textContent()) === "Return to People Connect to continue", `${width}px footer text changed`);
      assert((await page.locator(".footer-inner > p a, .footer-inner > p button, [data-progress-reset]").count()) === 0, `${width}px learner control entered footer or Progress`);
      assert((await page.locator(".footer-inner > a").textContent()).includes("Back to top"), `${width}px Back to top missing`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px horizontal overflow`);
      const type = await page.evaluate(() => {
        const family = (selector) => getComputedStyle(document.querySelector(selector)).fontFamily;
        return { size: parseFloat(getComputedStyle(document.body).fontSize), family: family("body"),
          roles: ["h1", ".lessons-toggle", "[data-progress-trigger]", ".course-progress", ".footer-inner p", ".premium-assessment__option"]
            .filter((selector) => document.querySelector(selector)).map(family) };
      });
      assert(Math.abs(type.size - 18) < .1 && type.family.startsWith("system-ui") &&
        type.family.includes("Segoe UI") && type.family.includes("Helvetica Neue") &&
        type.roles.every((family) => family === type.family), `${width}px shared system typography changed: ${JSON.stringify(type)}`);
      const progress = page.locator("[data-progress-trigger]");
      await progress.focus();
      assert(await progress.evaluate((node) => getComputedStyle(node).outlineStyle !== "none"), `${width}px progress focus invisible`);
      await progress.press("Enter");
      assert(await page.locator("[data-progress-panel]").isVisible(), `${width}px progress panel did not open`);
      assert(sameNames(await progressNames(page), approvedDemoNames), `${width}px initial Progress entries changed or gained generated instructions`);
      assert((await page.locator(".course-progress__list-group h2").allTextContents()).join("|") === "Completed|Still to do", `${width}px progress list headings changed`);
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
    for (const width of [320, 1280]) {
      for (const phase of ["partial", "complete"]) {
        const completed = phase === "partial" ? ["assessment"] : completeState.completed;
        const saved = { ...completeState, completed, explored: phase === "complete" ? completeState.explored : {} };
        const labelContext = await browser.newContext({ viewport: { width, height: 900 } });
        await labelContext.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: builtConfig.completion.storageKey, value: saved });
        const labelPage = await labelContext.newPage();
        monitor(labelPage, `${width}px ${phase} Progress`, origin);
        await labelPage.goto(origin, { waitUntil: "networkidle" });
        const renderedProgressNames = await progressNames(labelPage);
        assert(sameNames(renderedProgressNames, approvedDemoNames), `${width}px ${phase} Progress labels diverged from approved titles: ${JSON.stringify(renderedProgressNames)}`);
        assert((await labelPage.locator("[data-progress-completed] li").count()) === completed.length, `${width}px ${phase} Progress status changed`);
        await labelPage.reload({ waitUntil: "networkidle" });
        assert(sameNames(await progressNames(labelPage), approvedDemoNames), `${width}px restored ${phase} Progress labels changed`);
        await labelContext.close();
      }
    }

    const starterContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const starter = await starterContext.newPage();
    monitor(starter, "starter deliberate completion", origin);
    await starter.goto(origin, { waitUntil: "networkidle" });
    const starterState = () => starter.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), builtConfig.completion.storageKey);
    assert((await starter.locator("[data-progress-percent]").textContent()) === "0%", "Starter course did not begin at 0% progress");
    await starter.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert(!(await starterState()).completed?.length, "Scrolling earned required starter progress");
    for (const id of ["clarity", "rhythm", "purpose"]) await starter.locator(`#principles [data-flip-id="${id}"]`).click();
    await starter.locator("#assessment input[type=radio]").first().check();
    await starter.goto(`${origin}/topics/practice/`, { waitUntil: "networkidle" });
    await starter.locator("#practice-explorer [data-item-choice=plan]").click();
    await starter.locator("#practice-explorer [data-category-choice=engage]").click();
    await starter.locator("#practice-explorer [data-item-choice=reflect]").click();
    for (const id of ["notice", "decide", "act"]) await starter.locator(`#practice-steps [data-step-id="${id}"]`).click();
    const matching = starter.locator("#practice-match select");
    for (let index = 0; index < await matching.count(); index += 1) await matching.nth(index).selectOption({ index: 1 });
    await starter.locator("#practice-match button[type=submit]").click();
    await starter.locator("#practice-reflection textarea").fill("A deliberate learner action supports useful progress.");
    await starter.locator("#practice-reflection button[type=submit]").click();
    await starter.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "{}").completed?.length === 6, builtConfig.completion.storageKey);
    assert((await starter.locator("[data-progress-percent]").textContent()) === "100%", "Starter course did not reach 100% through its deliberate interactions");
    await starterContext.close();
    const context = await browser.newContext();
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: builtConfig.completion.storageKey, value: completeState });
    const page = await context.newPage();
    monitor(page, "configured routes", origin);
    for (const lesson of builtConfig.lessons) {
      await page.goto(`${origin}${lesson.path}`, { waitUntil: "networkidle" });
      assert((await page.locator("[data-course-path]").getAttribute("data-course-path")) === lesson.path, `Configured lesson did not render: ${lesson.path}`);
      assert(!(await page.locator("[data-access-pending]").count()), `Configured lesson remained locked: ${lesson.path}`);
      assert(await page.evaluate(() => {
        const family = getComputedStyle(document.body).fontFamily;
        return [...document.querySelectorAll("h1, h2, h3, button, input, select, textarea, .footer-inner p")]
          .every((node) => getComputedStyle(node).fontFamily === family);
      }), `Configured lesson uses a conflicting learner-facing font: ${lesson.path}`);
      await page.evaluate(() => {
        document.documentElement.dataset.scormPackage = "true";
        window.dispatchEvent(new Event("course-progress:request-state"));
      });
      const packagedLinks = await page.locator("a[data-lesson-path][href]").evaluateAll((links) => links.map((link) => new URL(link.href).pathname));
      assert(packagedLinks.length > 0 && packagedLinks.every((href) => href.endsWith("/overview.html") || href.endsWith("/index.html")) &&
        packagedLinks.some((href) => href.endsWith("/overview.html")), `Configured lesson links are not explicit learner documents: ${lesson.path}`);
    }
    await context.close();

    const onePageUrl = `${origin}/__verify-one-page/`;
    const onePageConfig = JSON.parse((await readFile(path.join(fixtureDist, "__verify-one-page", "index.html"), "utf8")).match(/<script\b[^>]*data-course-config[^>]*>([\s\S]*?)<\/script>/)?.[1] || "null");
    assert(onePageConfig?.navigationMode === "sections" && onePageConfig.lessons.length === 1 && onePageConfig.navigationLessons.length === 4, "Single-page fixture configuration is incomplete");
    for (const width of [320, 375, 640, 768, 1280]) {
      const singleContext = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: width === 640 ? 2 : 1, reducedMotion: "reduce" });
      const single = await singleContext.newPage();
      monitor(single, `single-page ${width}px`, origin);
      await single.goto(onePageUrl, { waitUntil: "networkidle" });
      assert(await single.evaluate(() => {
        const family = getComputedStyle(document.body).fontFamily;
        return [".step-group__tab", ".step-group__panel", ".assessment-sequence__count", ".premium-assessment__option", ".premium-assessment__feedback"]
          .every((selector) => getComputedStyle(document.querySelector(selector)).fontFamily === family);
      }), `Single-page interactions lost the shared system font at ${width}px`);
      assert(await single.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Single-page fixture overflows at ${width}px`);
      await single.locator(".lessons-toggle").click();
      assert((await single.locator(".course-links a[data-course-section]").count()) === onePageConfig.navigationLessons.length &&
        !(await single.locator(".course-links a[data-lesson-path]").count()) &&
        !(await single.locator(".lesson-navigation").count()), `Section menu or between-lesson controls did not follow One-scroll configuration at ${width}px`);
      assert(await single.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Open section menu overflows at ${width}px`);
      await single.locator('[data-course-section="fixture-quiz"]').focus();
      await single.keyboard.press("Enter");
      await single.waitForFunction(() => location.hash === "#fixture-quiz");
      await single.waitForFunction(() => document.querySelector('[data-course-section="fixture-quiz"]')?.getAttribute("aria-current") === "location");
      assert(await single.evaluate(() => {
        const target = document.getElementById("fixture-quiz");
        const header = document.querySelector(".site-header");
        return Boolean(target && header && target.getBoundingClientRect().top >= header.getBoundingClientRect().height - 2);
      }), `Keyboard Lessons anchor is obscured by the sticky header at ${width}px`);
      await single.locator("[data-progress-trigger]").click();
      assert((await single.locator(".course-progress__list-group").count()) === 2 &&
        (await single.locator("[data-progress-incomplete]").textContent()).includes("Choose the first action"), `Flat Progress activities are missing at ${width}px`);
      assert(sameNames(await progressNames(single), ["Explore a short process", "Choose the first action", "Choose the next action", "Explore the choices"]), `One-scroll Progress activity titles changed at ${width}px`);
      await single.locator('[data-progress-incomplete] [data-checklist-target="fixture-steps"]').click();
      await single.waitForFunction(() => location.hash === "#fixture-steps" && document.activeElement?.closest("#fixture-steps") !== null);
      await singleContext.close();
    }
    const onePageProgress = await fixtureConfig("__verify-one-page");
    const onePageNames = ["Explore a short process", "Choose the first action", "Choose the next action", "Explore the choices"];
    for (const width of [320, 1280]) {
      for (const phase of ["partial", "complete"]) {
        const completed = phase === "partial" ? ["fixture-quiz-first"] : onePageProgress.completion.milestones.map((item) => item.id);
        const saved = { completed, watchRanges: {}, watchDurations: {}, explored: phase === "complete" ? { "fixture-steps": ["notice", "choose", "act"], "fixture-tabs": ["alpha", "beta"] } : {}, ui: {} };
        const labelContext = await browser.newContext({ viewport: { width, height: 900 } });
        await labelContext.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: onePageProgress.completion.storageKey, value: saved });
        const labelPage = await labelContext.newPage();
        monitor(labelPage, `one-scroll ${width}px ${phase} Progress`, origin);
        await labelPage.goto(onePageUrl, { waitUntil: "networkidle" });
        assert(sameNames(await progressNames(labelPage), onePageNames), `One-scroll ${width}px ${phase} Progress labels changed`);
        assert((await labelPage.locator("[data-progress-completed] li").count()) === completed.length, `One-scroll ${width}px ${phase} statuses changed`);
        await labelPage.reload({ waitUntil: "networkidle" });
        assert(sameNames(await progressNames(labelPage), onePageNames), `One-scroll ${width}px restored ${phase} Progress labels changed`);
        await labelContext.close();
      }
    }

    const singleLmsContext = await browser.newContext({ reducedMotion: "reduce" });
    await installMockLms(singleLmsContext, lmsSeed());
    const singleLms = await singleLmsContext.newPage();
    monitor(singleLms, "single-page simulated LMS", origin);
    await singleLms.goto(onePageUrl, { waitUntil: "networkidle" });
    await assertNoExplorationTally(singleLms, "#fixture-steps");
    assert(!(await singleLms.locator('#fixture-steps [data-step-id="act"]').isDisabled()), "One-scroll ordered steps gated the final step");
    await singleLms.locator('#fixture-steps [data-step-id="act"]').click();
    await singleLms.locator('#fixture-steps [role=tabpanel]:not([hidden])').scrollIntoViewIfNeeded();
    await singleLms.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[0]?.includes("act"));
    assert((await singleLms.locator("#fixture-steps [data-step-count]").textContent()) === "Step 3 of 3" &&
      !(await singleLms.locator('#fixture-steps [data-step-id="choose"]').isDisabled()) &&
      !JSON.parse((await lmsState(singleLms)).values["cmi.suspend_data"]).c.includes(0), "Direct final-step access granted completion or blocked another step");
    await singleLms.reload({ waitUntil: "networkidle" });
    assert((await singleLms.locator('#fixture-steps [data-step-id="act"]').getAttribute("aria-selected")) === "true" &&
      !(await singleLms.locator('#fixture-steps [data-step-id="choose"]').isDisabled()) &&
      JSON.parse((await lmsState(singleLms)).values["cmi.suspend_data"]).e[0].includes("act") &&
      !JSON.parse((await lmsState(singleLms)).values["cmi.suspend_data"]).c.includes(0), "One-scroll step access or earned child state did not restore");
    await singleLms.locator("#fixture-quiz [data-question-next]").click();
    assert(await singleLms.locator("#fixture-quiz-second").isVisible() &&
      !JSON.parse((await lmsState(singleLms)).values["cmi.suspend_data"]).c.includes(2), "Later one-scroll question required an earlier answer or earned an empty attempt");
    await singleLms.reload({ waitUntil: "networkidle" });
    assert(await singleLms.locator("#fixture-quiz-second").isVisible() &&
      !JSON.parse((await lmsState(singleLms)).values["cmi.suspend_data"]).c.includes(2), "Later unanswered question did not restore");
    await singleLms.locator("[data-progress-trigger]").click();
    await singleLms.locator('[data-checklist-target="fixture-quiz-second"]').click();
    assert(await singleLms.locator("#fixture-quiz-second").isVisible() &&
      !JSON.parse((await lmsState(singleLms)).values["cmi.suspend_data"]).c.includes(2), "Checklist navigation granted an attempt or failed to reveal a hidden question");
    await singleLms.locator("#fixture-quiz-second input[type=radio]").first().check();
    let singleMock = await lmsState(singleLms);
    assert(JSON.parse(singleMock.values["cmi.suspend_data"]).c.includes(2) &&
      (await singleLms.locator("#fixture-quiz-second [data-feedback-copy]").textContent()).includes("Incorrect response."), "Wrong but valid second answer did not earn immediate attempt credit and feedback");
    await singleLms.locator("[data-question-prev]").click();
    await singleLms.locator("#fixture-quiz-first input[type=radio]").last().check();
    assert(JSON.parse((await lmsState(singleLms)).values["cmi.suspend_data"]).c.includes(1), "First question did not earn its independent attempt");
    await singleLms.locator("#fixture-tabs [role=tabpanel]:not([hidden])").scrollIntoViewIfNeeded();
    await singleLms.locator("#fixture-tabs [data-explore-item=alpha][role=tab]").click();
    await singleLms.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[3]?.includes("alpha"));
    await singleLms.locator("#fixture-tabs [data-explore-item=beta][role=tab]").click();
    await singleLms.locator("#fixture-tabs [data-explore-item=beta][role=tabpanel]").scrollIntoViewIfNeeded();
    await singleLms.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[3]?.includes("beta"));
    await singleLms.locator('#fixture-steps [data-step-id="notice"]').click();
    await singleLms.locator("#fixture-steps [role=tabpanel]:not([hidden])").scrollIntoViewIfNeeded();
    await singleLms.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[0]?.includes("notice"));
    assert(JSON.parse((await lmsState(singleLms)).values["cmi.suspend_data"]).e[0].includes("act") &&
      !JSON.parse((await lmsState(singleLms)).values["cmi.suspend_data"]).c.includes(0) &&
      (await singleLms.locator("#fixture-steps .step-group__check").count()) === 0, "First visible step lost its individual exploration state or restored an obsolete tab checkmark");
    await assertNoExplorationTally(singleLms, "#fixture-steps");
    await singleLms.locator("#fixture-steps [data-step-next]").click();
    await singleLms.locator("#fixture-steps [data-step-next]").click();
    singleMock = await lmsState(singleLms);
    assert(["notice", "choose", "act"].every((id) => JSON.parse(singleMock.values["cmi.suspend_data"]).e[0].includes(id)) &&
      singleMock.values["cmi.core.lesson_status"] === "completed" && singleMock.errors.length === 0, "Ordered exploration or all-required completion failed");
    await assertNoExplorationTally(singleLms, "#fixture-steps");
    await singleLms.reload({ waitUntil: "networkidle" });
    singleMock = await lmsState(singleLms);
    const restoredSingle = { initialized: lmsCalls(singleMock, "LMSInitialize"), finished: lmsCalls(singleMock, "LMSFinish"),
      checked: await singleLms.locator("#fixture-quiz-first input[type=radio]:checked").count(),
      step: await singleLms.locator("#fixture-steps [data-step-count]").textContent(), errors: singleMock.errors };
    assert(restoredSingle.initialized === restoredSingle.finished + 1 && restoredSingle.checked === 1 &&
      restoredSingle.step === "Step 3 of 3" &&
      (await singleLms.locator("#fixture-steps .step-group__check").count()) === 0 &&
      (await singleLms.locator("#fixture-quiz-first [data-feedback-copy]").textContent()).includes("Incorrect response.") &&
      singleMock.active && singleMock.values["cmi.core.lesson_status"] === "completed" &&
      restoredSingle.errors.length === 0, `Single-page LMS refresh lost state or made invalid session calls: ${JSON.stringify(restoredSingle)}`);
    await assertNoExplorationTally(singleLms, "#fixture-steps");
    await singleLmsContext.close();

    // These scenarios use a renamed, nested two-lesson fixture. Production
    // courses are checked above from their own configuration.
    const navConfig = await fixtureConfig("__verify-nav");
    assert(navConfig.lessons.length === 2 && navConfig.lessons[1].path === "/scenario/review/", "Nested navigation fixture is incomplete");
    const navStart = `${origin}/__verify-nav/`;
    const navReview = `${origin}/__verify-nav/scenario/review/`;
    const multiAccessContext = await browser.newContext();
    await installMockLms(multiAccessContext, lmsSeed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": suspend(navConfig, ["fixture-response", "fixture-nav-steps"]) }));
    const multiAccess = await multiAccessContext.newPage();
    monitor(multiAccess, "multi-page in-lesson access", origin);
    await multiAccess.goto(navReview, { waitUntil: "networkidle" });
    assert(!(await multiAccess.locator('#fixture-nav-steps [data-step-id="end"]').isDisabled()), "Multi-page ordered steps gated the final step");
    await multiAccess.locator('#fixture-nav-steps [data-step-id="start"]').focus();
    await multiAccess.keyboard.press("End");
    await multiAccess.locator('#fixture-nav-steps [role=tabpanel]:not([hidden])').scrollIntoViewIfNeeded();
    await multiAccess.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[2]?.includes("end"));
    let multiState = JSON.parse((await lmsState(multiAccess)).values["cmi.suspend_data"]);
    assert((await multiAccess.locator("#fixture-nav-steps [data-step-count]").textContent()) === "Step 3 of 3" &&
      !multiState.c.includes(2) && !multiState.e[2].includes("middle"), "Direct final-step access granted an unearned multi-page completion");
    await multiAccess.reload({ waitUntil: "networkidle" });
    multiState = JSON.parse((await lmsState(multiAccess)).values["cmi.suspend_data"]);
    assert((await multiAccess.locator('#fixture-nav-steps [data-step-id="end"]').getAttribute("aria-selected")) === "true" &&
      !(await multiAccess.locator('#fixture-nav-steps [data-step-id="middle"]').isDisabled()) &&
      multiState.e[2].includes("end") && !multiState.c.includes(2), "Multi-page direct access or partial exploration did not restore");
    await multiAccess.locator('#fixture-nav-steps [data-step-id="start"]').click();
    await multiAccess.locator('#fixture-nav-steps [role=tabpanel]:not([hidden])').scrollIntoViewIfNeeded();
    await multiAccess.locator('#fixture-nav-steps [data-step-id="middle"]').click();
    await multiAccess.locator('#fixture-nav-steps [role=tabpanel]:not([hidden])').scrollIntoViewIfNeeded();
    await multiAccess.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").c?.includes(2));
    multiState = JSON.parse((await lmsState(multiAccess)).values["cmi.suspend_data"]);
    assert(["start", "middle", "end"].every((id) => multiState.e[2].includes(id)) &&
      !multiState.c.includes(1), "Multi-page steps lost exploration requirements or Progress credit");
    await multiAccessContext.close();
    const navPartial = suspend(navConfig, ["fixture-response"]);
    const navigationContext = await browser.newContext();
    await installMockLms(navigationContext, lmsSeed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": navPartial }));
    const lmsPage = await navigationContext.newPage();
    monitor(lmsPage, "simulated LMS navigation", origin);
    await lmsPage.goto(navStart, { waitUntil: "networkidle" });
    await lmsPage.locator("[data-progress-trigger]").click();
    assert((await lmsPage.locator(".course-progress__list-group").count()) === 2 &&
      sameNames(await progressNames(lmsPage), navConfig.completion.milestones.filter((milestone) => milestone.required).map((milestone) => milestone.label)), "Configured Progress activities did not render from fixture configuration");
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
    const visibleContext = await browser.newContext({ viewport: { width: 1280, height: 700 } });
    await installMockLms(visibleContext, lmsSeed());
    const visiblePage = await visibleContext.newPage();
    monitor(visiblePage, "visible panel exploration", origin);
    await visiblePage.goto(`${origin}/__verify-interactions/`, { waitUntil: "networkidle" });
    const visibleEvidence = async (index) => JSON.parse((await lmsState(visiblePage)).values["cmi.suspend_data"] || "{}").e?.[index] || [];
    assert(!(await visibleEvidence(2)).length && !(await visibleEvidence(3)).length, "Offscreen active tabs or explorer items earned exploration");
    await visiblePage.locator("#fixture-tabs").evaluate((root) => { root.parentElement.hidden = true; });
    assert(!(await visibleEvidence(2)).length, "A panel inside a hidden ancestor earned exploration");
    await visiblePage.locator("#fixture-tabs").evaluate((root) => { root.parentElement.style.visibility = "hidden"; root.parentElement.hidden = false; root.querySelector('[role="tabpanel"]')?.scrollIntoView({ behavior: "instant" }); });
    assert(!(await visibleEvidence(2)).length, "A panel inside a visibility-hidden ancestor earned exploration");
    await visiblePage.locator("#fixture-tabs").evaluate((root) => { root.parentElement.style.visibility = ""; });
    await visiblePage.locator("#fixture-tabs [data-explore-item=alpha][role=tab]").click();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[2]?.includes("alpha"));
    assert(JSON.stringify(await visibleEvidence(2)) === JSON.stringify(["alpha"]), "A deliberate visible tab selection did not earn its active panel");
    await visiblePage.locator("#fixture-tabs [data-explore-item=beta][role=tab]").click();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").c?.includes(2));
    assert(JSON.stringify(await visibleEvidence(2)) === JSON.stringify(["alpha", "beta"]), "Selected tab did not complete exploration");
    assert(!(await visibleEvidence(7)).length, "A separate tab instance inherited another instance's child credit");
    await visiblePage.locator("#fixture-nested-tabs").evaluate((root) => { root.style.visibility = "hidden"; root.querySelector('[role="tabpanel"]')?.scrollIntoView({ behavior: "instant" }); });
    assert(!(await visibleEvidence(7)).length, "Nested hidden tab instance earned credit");
    await visiblePage.locator("#fixture-nested-tabs").evaluate((root) => { root.style.visibility = ""; });
    await visiblePage.locator("#fixture-nested-tabs [data-explore-item=alpha][role=tab]").click();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[7]?.includes("alpha"));
    assert(JSON.stringify(await visibleEvidence(7)) === JSON.stringify(["alpha"]), "A deliberate nested tab selection did not earn its child");
    await visiblePage.locator("#fixture-tabs-other [data-explore-item=beta][role=tab]").click();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").c?.includes(7));
    assert(JSON.stringify(await visibleEvidence(2)) === JSON.stringify(["alpha", "beta"]), "Separate tab instance changed the first activity's evidence");
    assert(!JSON.parse((await lmsState(visiblePage)).values["cmi.suspend_data"]).c.some((index) => index === 4 || index === 5), "Displaying tabs created a separate assessment attempt");
    await visiblePage.locator("#fixture-tabs [data-explore-item=beta][role=tab]").click();
    const duplicateCalls = lmsCalls(await lmsState(visiblePage), "LMSCommit");
    await visiblePage.evaluate(() => window.dispatchEvent(new CustomEvent("course-progress:explore", { detail: { activityId: "fixture-tabs", itemId: "beta" } })));
    assert(lmsCalls(await lmsState(visiblePage), "LMSCommit") === duplicateCalls, "Duplicate tab events caused another LMS save");
    await visiblePage.reload({ waitUntil: "networkidle" });
    assert(JSON.stringify(await visibleEvidence(2)) === JSON.stringify(["alpha", "beta"]), "Tab exploration did not survive refresh");
    await visiblePage.locator("#fixture-items [data-explorer-item=plan]").scrollIntoViewIfNeeded();
    await visiblePage.locator("#fixture-items [data-item-choice=plan]").click();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[3]?.includes("plan"));
    assert(JSON.stringify(await visibleEvidence(3)) === JSON.stringify(["plan"]), "A deliberate explorer selection did not earn credit");
    await visiblePage.locator("#fixture-items [data-category-choice=apply]").click();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").c?.includes(3));
    assert(JSON.stringify(await visibleEvidence(3)) === JSON.stringify(["plan", "reflect"]), "Explorer did not complete after both displayed items became visible");
    await visiblePage.locator('#fixture-hotspots [data-feature-control="beta"]').first().evaluate((node) => node.click());
    assert(!(await visibleEvidence(8)).length, "Offscreen hotspot detail earned exploration");
    await visiblePage.locator("#fixture-hotspots").scrollIntoViewIfNeeded();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[8]?.includes("beta"));
    await visiblePage.locator('#fixture-hotspots [data-feature-control="alpha"]').first().click();
    await visiblePage.locator('#fixture-hotspots [data-feature-panel="alpha"]').scrollIntoViewIfNeeded();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").c?.includes(8));
    assert(JSON.stringify(await visibleEvidence(8)) === JSON.stringify(["beta", "alpha"]), "Hotspot detail visibility or child tracking failed");
    await visiblePage.reload({ waitUntil: "networkidle" });
    assert((await visiblePage.locator('#fixture-hotspots [data-feature-control="alpha"]').first().getAttribute("aria-pressed")) === "true" &&
      JSON.stringify(await visibleEvidence(8)) === JSON.stringify(["beta", "alpha"]), "Hotspot selection or exploration did not survive refresh");
    await visiblePage.locator('#fixture-model-choice [data-model-panel]:not([hidden]) [data-model-id="guided"]').evaluate((node) => node.click());
    assert(!(await visibleEvidence(9)).length, "Offscreen model choice earned exploration");
    await visiblePage.locator("#fixture-model-choice").scrollIntoViewIfNeeded();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[9]?.includes("first"));
    await visiblePage.locator('#fixture-model-choice [data-need-control="second"]').click();
    await visiblePage.locator('#fixture-model-choice [data-model-panel]:not([hidden]) [data-model-id="open"]').click();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").c?.includes(9));
    assert(JSON.stringify(await visibleEvidence(9)) === JSON.stringify(["first", "second"]), "Model choice did not credit only visible selected needs");
    await visiblePage.reload({ waitUntil: "networkidle" });
    assert((await visiblePage.locator('#fixture-model-choice [data-model-panel]:not([hidden]) [data-model-id="open"]').getAttribute("aria-pressed")) === "true", "Model choice selection did not survive refresh");
    await visiblePage.locator("#fixture-product-flips").scrollIntoViewIfNeeded();
    await visiblePage.locator('#fixture-product-flips [data-product-card="one"] [data-product-toggle]').click();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[10]?.includes("one"));
    await visiblePage.locator('#fixture-product-flips [data-product-card="two"] [data-product-toggle]').click();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").c?.includes(10));
    await visiblePage.reload({ waitUntil: "networkidle" });
    assert((await visiblePage.locator('#fixture-product-flips [data-product-card="one"] [data-product-toggle]').getAttribute("aria-expanded")) === "true" &&
      JSON.stringify(await visibleEvidence(10)) === JSON.stringify(["one", "two"]), "Product flipcards did not preserve card state and exploration");
    await visiblePage.locator("#fixture-drag-match").scrollIntoViewIfNeeded();
    await visiblePage.locator('#fixture-drag-match [data-answer-id="a"]').click();
    await visiblePage.locator('#fixture-drag-match [data-slot-id="first:one"]').click();
    await visiblePage.locator("#fixture-drag-match [data-match-check]").click();
    assert(!(await visibleEvidence(11)).length && (await visiblePage.locator("#fixture-drag-match [data-match-result]").textContent()).includes("Complete every space."), "Partial drag matching submission earned credit or did not show its configured validation");
    await visiblePage.locator('#fixture-drag-match [data-answer-id="b"]').click();
    await visiblePage.locator('#fixture-drag-match [data-slot-id="first:two"]').click();
    await visiblePage.locator("#fixture-drag-match [data-match-check]").click();
    await visiblePage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").c?.includes(11));
    assert((await visiblePage.locator("#fixture-drag-match [data-match-result]").textContent()).includes("Correct."), "Drag matching did not calculate its configured answer mapping");
    await visibleContext.close();
    const unearnedRecord = JSON.parse(suspend(interactionConfig, interactionConfig.completion.milestones.map((item) => item.id)));
    unearnedRecord.u = { "fixture-tabs:active": "beta" };
    const unearnedContext = await browser.newContext();
    await installMockLms(unearnedContext, lmsSeed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": JSON.stringify(unearnedRecord) }));
    const unearnedPage = await unearnedContext.newPage();
    await unearnedPage.goto(`${origin}/__verify-interactions/`, { waitUntil: "networkidle" });
    assert((await unearnedPage.locator("#fixture-tabs [role=tab][aria-selected=true]").getAttribute("data-explore-item")) === "beta", "Active tab did not restore");
    await unearnedPage.locator("#fixture-tabs [role=tabpanel]:not([hidden])").scrollIntoViewIfNeeded();
    await unearnedPage.locator("#fixture-tabs [data-explore-item=beta][role=tab]").click();
    await unearnedPage.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[2]?.includes("beta"));
    assert(JSON.stringify(JSON.parse((await lmsState(unearnedPage)).values["cmi.suspend_data"]).e[2]) === JSON.stringify(["beta"]), "Restored active tab did not earn only its visible, previously unearned child");
    await unearnedContext.close();
    const directAccessContext = await browser.newContext();
    await installMockLms(directAccessContext, lmsSeed());
    const directAccess = await directAccessContext.newPage();
    monitor(directAccess, "direct interaction access", origin);
    await directAccess.goto(`${origin}/__verify-interactions/`, { waitUntil: "networkidle" });
    await directAccess.locator("#fixture-tabs [data-explore-item=beta][role=tab]").click();
    await directAccess.locator("#fixture-carousel [data-carousel-next]").click();
    await directAccess.locator("#fixture-items [data-category-choice=apply]").click();
    await directAccess.locator("#fixture-items [data-explorer-item=reflect]").scrollIntoViewIfNeeded();
    await directAccess.locator('#fixture-flips [data-flip-id="back"]').click();
    await directAccess.locator('#fixture-product-catalog [data-catalog-category="specialist"]').click();
    await directAccess.locator('#fixture-product-catalog [data-catalog-product-panel="discuss"] [data-catalog-image-src="/assets/demo/editorial-landscape.svg"]').click();
    await directAccess.setViewportSize({ width: 390, height: 800 });
    await directAccess.locator('[data-image-led-range-rail] [data-range-next]').click();
    await directAccess.waitForFunction(() => document.querySelector("#fixture-image-led-range")?.scrollLeft > 0);
    let directState = JSON.parse((await lmsState(directAccess)).values["cmi.suspend_data"]);
    assert((await directAccess.locator("#fixture-tabs [role=tab][aria-selected=true]").getAttribute("data-explore-item")) === "beta" &&
      (await directAccess.locator("#fixture-carousel [data-carousel-count]").textContent()) === "2 of 2" &&
      (await directAccess.locator("#fixture-items [data-item-choice=reflect]").getAttribute("aria-pressed")) === "true" &&
      (await directAccess.locator('#fixture-flips [data-flip-id="back"]').getAttribute("aria-expanded")) === "true" &&
      (await directAccess.locator('#fixture-product-catalog [data-catalog-category="specialist"]').getAttribute("aria-selected")) === "true" &&
      (await directAccess.locator('#fixture-product-catalog [data-catalog-product-panel="discuss"] [data-catalog-image]').getAttribute("src")) === "/assets/demo/editorial-landscape.svg" &&
      await directAccess.locator("#fixture-image-led-range").evaluate((track) => track.scrollLeft > 0) &&
      directState.e[3]?.includes("reflect") &&
      JSON.stringify(directState.e[6]) === JSON.stringify(["back"]) &&
      !directState.c.includes(6), "Later tabs, carousel items, choices or cards required earlier items or granted unearned completion");
    await directAccess.reload({ waitUntil: "networkidle" });
    directState = JSON.parse((await lmsState(directAccess)).values["cmi.suspend_data"]);
    assert((await directAccess.locator("#fixture-tabs [role=tab][aria-selected=true]").getAttribute("data-explore-item")) === "beta" &&
      (await directAccess.locator("#fixture-carousel [data-carousel-count]").textContent()) === "2 of 2" &&
      (await directAccess.locator("#fixture-items [data-item-choice=reflect]").getAttribute("aria-pressed")) === "true" &&
      (await directAccess.locator('#fixture-product-catalog [data-catalog-category="specialist"]').getAttribute("aria-selected")) === "true" &&
      (await directAccess.locator('#fixture-product-catalog [data-catalog-product="discuss"]').getAttribute("aria-pressed")) === "true" &&
      JSON.stringify(directState.e[6]) === JSON.stringify(["back"]) &&
      !(await directAccess.locator('#fixture-flips [data-flip-id="front"]').isDisabled()), "Direct item access or earned evidence did not restore");
    await directAccessContext.close();
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
    assert((await attempt.locator(".course-progress__list-group").count()) === 2 &&
      (await attempt.locator("[data-progress-incomplete] li").count()) === interactionConfig.completion.milestones.filter((item) => item.required).length, "Single-lesson course Progress did not follow configuration");
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
    for (const selector of ["#fixture-steps", "#fixture-items", "#fixture-flips"]) await assertNoExplorationTally(interaction, selector);
    await interaction.locator("#fixture-steps [role=tabpanel]:not([hidden])").scrollIntoViewIfNeeded();
    await interaction.locator("#fixture-steps [data-step-id=first]").click();
    await interaction.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[0]?.includes("first"));
    assert(JSON.stringify(await exploredIds(0)) === JSON.stringify(["first"]), "A deliberate visible step selection did not save its child evidence");
    await assertNoExplorationTally(interaction, "#fixture-steps");
    await interaction.locator("#fixture-steps [data-step-next]").click();
    assert(JSON.stringify(await exploredIds(0)) === JSON.stringify(["first", "second"]) &&
      (await interaction.locator("#fixture-steps [data-step-count]").textContent()) === "Step 2 of 2", "Initial visible step, Next or navigation counter failed after LMS launch");
    await assertNoExplorationTally(interaction, "#fixture-steps");
    await interaction.locator("#fixture-carousel").scrollIntoViewIfNeeded();
    await interaction.locator("#fixture-carousel [data-carousel-next]").click();
    await interaction.locator("#fixture-carousel [data-carousel-prev]").click();
    const carouselEvidence = await exploredIds(1);
    assert(["one", "two"].every((id) => carouselEvidence.includes(id)), "Tracked carousel selections failed after LMS launch");
    await interaction.locator("#fixture-tabs").scrollIntoViewIfNeeded();
    await interaction.locator("#fixture-tabs [data-explore-item=alpha][role=tab]").click();
    await interaction.locator("#fixture-tabs [data-explore-item=beta][role=tab]").click();
    assert(JSON.stringify(await exploredIds(2)) === JSON.stringify(["alpha", "beta"]), "Tracked tabs did not earn deliberate visible selections");
    await interaction.locator("#fixture-items [data-category-choice=apply]").click();
    await interaction.locator("#fixture-items [data-explorer-item=reflect]").scrollIntoViewIfNeeded();
    await interaction.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[3]?.includes("reflect"));
    assert((await exploredIds(3)).includes("reflect"), "Explorer did not credit its visible selected item");
    await assertNoExplorationTally(interaction, "#fixture-items");
    await interaction.locator('#fixture-flips [data-flip-id="front"]').click();
    assert(JSON.stringify(await exploredIds(6)) === JSON.stringify(["front"]) &&
      !JSON.parse((await lmsState(interaction)).values["cmi.suspend_data"]).c.includes(6) &&
      (await interaction.locator('#fixture-flips [data-flip-id="front"]').getAttribute("aria-expanded")) === "true", "First flipped card lost its individual state or completed early");
    await assertNoExplorationTally(interaction, "#fixture-flips");
    await interaction.reload({ waitUntil: "networkidle" });
    assert(await interaction.locator("#fixture-items [data-explorer-item=reflect]").isVisible() && (await interaction.locator("#fixture-items [data-category-choice=apply]").getAttribute("aria-pressed")) === "true", "Explorer did not restore category and item atomically");
    assert((await exploredIds(3)).includes("reflect"), "Explorer restoration lost earned exploration");
    assert(JSON.stringify(await exploredIds(6)) === JSON.stringify(["front"]), "Flipped-card exploration evidence did not restore");
    for (const selector of ["#fixture-steps", "#fixture-items", "#fixture-flips"]) await assertNoExplorationTally(interaction, selector);
    assert((await interaction.locator("#fixture-carousel [data-carousel-count]").textContent()) === "1 of 2" && (await interaction.locator("#fixture-tabs [role=tab][aria-selected=true]").getAttribute("data-explore-item")) === "beta", "Carousel or tabs did not restore active content");
    await interaction.locator("#fixture-items [data-category-choice=prepare]").click();
    await interaction.locator("#fixture-items [data-explorer-item=plan]").scrollIntoViewIfNeeded();
    await interaction.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem("__readiness_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[3]?.includes("plan"));
    await interaction.locator('#fixture-flips [data-flip-id="back"]').click();
    const completedExploration = JSON.parse((await lmsState(interaction)).values["cmi.suspend_data"]);
    assert(JSON.stringify(await exploredIds(3)) === JSON.stringify(["reflect", "plan"]) &&
       JSON.stringify(await exploredIds(6)) === JSON.stringify(["front", "back"]) &&
       completedExploration.c.includes(3) && completedExploration.c.includes(6) &&
       (await interaction.locator("[data-progress-completed] li").count()) === 5, "Completed exploration lost child evidence, credit or Progress summary");
    await assertNoExplorationTally(interaction, "#fixture-items");
    await assertNoExplorationTally(interaction, "#fixture-flips");
    await interaction.reload({ waitUntil: "networkidle" });
    assert(JSON.stringify(await exploredIds(3)) === JSON.stringify(["reflect", "plan"]) &&
      JSON.stringify(await exploredIds(6)) === JSON.stringify(["front", "back"]) &&
      (await interaction.locator("#fixture-items [data-item-choice=plan]").getAttribute("aria-pressed")) === "true", "Completed exploration or selected item did not restore");
    for (const selector of ["#fixture-steps", "#fixture-items", "#fixture-flips"]) await assertNoExplorationTally(interaction, selector);
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
    assert(JSON.stringify(await paths()) === JSON.stringify(["/"]), "Passive viewing unlocked a later lesson");
    await routes.locator("#start-complete").click();
    await waitCompleted(routes, "start-complete", "astro-course-progress:route-fixture:v1");
    assert(JSON.stringify(await paths()) === JSON.stringify(["/", "/alpha/", "/topics/deep/"]), "Explicit completion did not unlock through the requirement-free lesson");
    assert(!(await paths()).includes("/finish/"), "Unfinished interaction unlocked the final lesson");
    await routes.goto(`${origin}/__verify-routes-unlocked/`, { waitUntil: "networkidle" });
    assert((await paths()).length === 4, "Disabled unlocking did not expose every non-numbered route");
    await routes.goto(`${origin}/__verify-routes-empty/`, { waitUntil: "networkidle" });
    assert((await paths()).length === 4 && (await routes.locator("[data-progress-percent]").textContent()) === "0%", "Empty requirements locked or completed a course");
    await routes.close();

    for (const mode of ["lessons", "sections"]) {
      const viewPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      monitor(viewPage, `VIEW visibility ${mode}`, origin);
      await viewPage.goto(`${origin}/__verify-view-${mode}/`, { waitUntil: "networkidle" });
      const viewKey = `astro-course-progress:view-visibility-${mode}:v1`;
      assert(await viewPage.locator("[data-course-config]").evaluate((node) => JSON.parse(node.textContent).navigationMode) === mode, `VIEW fixture did not use ${mode} navigation`);
      assert((await viewPage.locator(`.course-links a[${mode === "sections" ? "data-course-section" : "data-lesson-path"}]`).count()) === 1, `VIEW fixture Lessons menu did not use ${mode} navigation`);
      await waitCompleted(viewPage, "view-visible", viewKey, 500);
      await waitCompleted(viewPage, "view-visible-override", viewKey, 500);
      const viewState = () => viewPage.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), viewKey);
      const hiddenIds = ["hidden-attr", "ancestor-hidden", "display-none", "ancestor-display", "visibility-hidden", "ancestor-visibility", "visibility-collapse", "opacity-zero", "ancestor-opacity", "content-hidden", "ancestor-content", "offscreen"];
      const initiallyEarned = (await viewState()).completed || [];
      assert(hiddenIds.every((id) => !initiallyEarned.includes(`view-${id}`)), `Hidden or offscreen VIEW completed before reveal in ${mode} mode`);
      const initialScroll = await viewPage.evaluate(() => scrollY);
      for (const id of hiddenIds.slice(0, -1)) {
        await viewPage.locator(`#view-${id}`).evaluate((node, kind) => {
          if (kind === "hidden-attr") node.hidden = false;
          else if (kind === "ancestor-hidden") node.parentElement.hidden = false;
          else if (kind === "display-none") node.style.display = "block";
          else if (kind === "ancestor-display") node.parentElement.style.display = "block";
          else if (kind === "visibility-hidden") node.style.visibility = "visible";
          else if (kind === "ancestor-visibility") node.parentElement.classList.remove("view-fixture-hidden");
          else if (kind === "visibility-collapse") node.style.visibility = "visible";
          else if (kind === "opacity-zero") node.style.opacity = "1";
          else if (kind === "ancestor-opacity") node.parentElement.style.opacity = "1";
          else if (kind === "content-hidden") node.style.contentVisibility = "visible";
          else if (kind === "ancestor-content") node.parentElement.style.contentVisibility = "visible";
        }, id);
        await waitCompleted(viewPage, `view-${id}`, viewKey, 700);
        assert(await viewPage.evaluate(() => scrollY) === initialScroll, `VIEW ${id} required a scroll after reveal`);
      }
      const completedBeforeRepeat = (await viewState()).completed;
      assert(hiddenIds.slice(0, -1).every((id) => completedBeforeRepeat.filter((earned) => earned === `view-${id}`).length === 1), `VIEW credit was duplicated in ${mode} mode`);
      await viewPage.evaluate(() => {
        window.__viewCreditEvents = 0;
        window.addEventListener("course-progress:state", () => { window.__viewCreditEvents += 1; });
        const target = document.getElementById("view-opacity-zero");
        target.style.opacity = "0";
        target.style.opacity = "1";
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await viewPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert(await viewPage.evaluate(() => window.__viewCreditEvents) === 0, `Completed VIEW was credited again in ${mode} mode`);
      assert(!(await viewState()).completed.includes("view-offscreen"), `Offscreen VIEW completed in ${mode} mode`);
      await viewPage.locator("#view-offscreen").evaluate((node) => node.scrollIntoView({ block: "center" }));
      await waitCompleted(viewPage, "view-offscreen", viewKey, 500);
      await viewPage.close();
    }

    const fixture = await browser.newPage();
    monitor(fixture, "completion fixture", origin);
    await fixture.goto(`${origin}/__verify-completion/`, { waitUntil: "networkidle" });
    await waitCompleted(fixture, "fixture-view", "astro-course-progress:verification-fixture:v1", 500);
    assert((await progressNames(fixture)).includes("Complete event"), "Legitimate Complete activity title was stripped from outstanding Progress");
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
    assert((await fixture.locator("[data-progress-completed] a").allTextContents()).some((text) => text.includes("Complete event")), "Legitimate Complete activity title changed after completion or restore");
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
    await components.locator('#gallery-reveals [data-reveal-id="two"]').click();
    assert((await components.locator('#gallery-reveals [data-reveal-id="two"]').getAttribute("aria-expanded")) === "true" &&
      (await components.locator('#gallery-reveals [data-reveal-id="one"]').getAttribute("aria-expanded")) === "false", "Later reveal required an earlier item");
    await components.locator('#gallery-flip-cards [data-flip-id="respond"]').click();
    assert((await components.locator('#gallery-flip-cards [data-flip-id="respond"]').getAttribute("aria-expanded")) === "true" &&
      (await components.locator('#gallery-flip-cards [data-flip-id="observe"]').getAttribute("aria-expanded")) === "false", "Later card required an earlier card");
    await components.locator("#gallery-carousel [data-carousel-next]").click();
    assert((await components.locator("#gallery-carousel [data-carousel-count]").textContent()) === "2 of 2", "Later carousel item required the first item");
    await components.locator('#gallery-compact-steps [data-step-id="review"]').click();
    assert((await components.locator('#gallery-compact-steps [data-step-id="review"]').getAttribute("aria-selected")) === "true" &&
      !(await components.locator('#gallery-compact-steps [data-step-id="choose"]').isDisabled()), "Gallery ordered step restricted direct access");
    await components.locator("#gallery-sequence [data-question-next]").click();
    assert(await components.locator("#gallery-sequence-second").isVisible() &&
      !(await components.locator("#gallery-sequence-first input[type=radio]:checked").count()), "Later assessment question required an earlier answer");
    await components.locator("#gallery-sequence [data-question-prev]").click();
    await components.locator("#gallery-knowledge-check input[type=radio]").first().check();
    assert(await components.locator("#gallery-knowledge-check [data-assessment-feedback]").isVisible(), "Knowledge-check feedback did not appear on selection");
    assert(!(await components.locator("#gallery-assessment input[type=radio]:checked").count()), "Independent assessment instance was changed");
    await components.locator("#gallery-sequence-first input[type=radio]").last().check();
    assert((await components.locator("#gallery-sequence-first [data-feedback-copy]").textContent()).includes("Incorrect response.") &&
      !(await components.locator("#gallery-sequence-other-single input[type=radio]:checked").count()) &&
      (await components.locator("#gallery-sequence-other [data-question-count]").textContent()) === "Question 1 of 1", "Repeated assessment sequences shared state or lost the one-question edge case");
    await components.locator("#gallery-explorer [data-category-choice=apply]").click();
    assert(await components.locator("#gallery-explorer [data-explorer-item=reflect]").isVisible() && (await components.locator("#gallery-explorer [data-item-choice=reflect]").getAttribute("aria-pressed")) === "true", "Explorer category and active item diverged");
    await components.close();
    const badContract = await browser.newPage();
    const contractErrors = [];
    badContract.on("console", (message) => { if (message.type() === "error") contractErrors.push(message.text()); });
    await badContract.goto(`${origin}/__verify-bad-contract/`, { waitUntil: "networkidle" });
    assert(contractErrors.some((message) => message.includes('Unresolved target "missing-view"')) &&
      contractErrors.some((message) => message.includes('VIEW milestone "required-view" must be optional')) &&
      contractErrors.some((message) => message.includes('SUBMIT target "bad-submit"')) &&
      contractErrors.some((message) => message.includes('EXPLORE target "bad-explore"')) &&
      await badContract.locator("[data-progress-save-error]").isVisible(), `Missing target or activity trigger failed to surface a clear setup error: ${JSON.stringify(contractErrors)}`);
    await badContract.close();
    assert(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
  console.log(`Course Chromium verification passed: responsive shell, typography, footer, ${builtConfig.lessons.length} configured routes, ${builtConfig.completion.milestones.length} deliberate milestones, passive-progress exclusion, section and multi-page navigation, package-safe lesson links, compact steps, assessment sequence, optional VIEW visibility states, unlocking variants, large state and capacity boundaries, interaction restore, and strict simulated LMS navigation, recovery, save failure and reflection privacy.`);
} finally { await rm(fixtureDist, { recursive: true, force: true }); }
