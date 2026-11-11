import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { packageCourse } from "./package-scorm.mjs";
import { extractZip } from "./scorm-zip.mjs";

const run = promisify(execFile);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const scratch = path.resolve(".verification-scorm");
const base = "/lms/player/content/package-123/deep/";
const distEntry = await readFile(path.resolve("dist", "index.html"), "utf8");
const config = JSON.parse(distEntry.match(/<script\b[^>]*data-course-config[^>]*>([\s\S]*?)<\/script>/)?.[1] || "null");
assert(config?.lessons?.length && Array.isArray(config?.completion?.milestones), "Build a configured course before verifying its package.");
const zip = path.resolve("scorm-output", config.package.filename);
const errors = [];
const monitor = (page, label, origin) => {
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${label}: ${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${label}: HTTP ${response.status()} ${response.url()}`); });
  page.on("request", (request) => { const url = new URL(request.url()); if (/^https?:$/.test(url.protocol) && url.origin !== origin) errors.push(`${label}: external request ${url}`); });
};
const fileFor = (route) => route === "/" ? "overview.html" : `${route.slice(1)}index.html`;
const signature = (milestones) => {
  const source = JSON.stringify(milestones.map(({ id, path, type, targetId, requiredItems, threshold, required }) => [id, path, type, targetId, requiredItems || [], threshold ?? null, required]));
  let hash = 0xcbf29ce484222325n;
  for (const character of source) hash = BigInt.asUintN(64, (hash ^ BigInt(character.charCodeAt(0))) * 0x100000001b3n);
  return hash.toString(16).padStart(16, "0");
};
const suspend = (course, omitted = []) => JSON.stringify({
  v: course.completion.storageKey, s: signature(course.completion.milestones),
  c: course.completion.milestones.flatMap((item, index) => omitted.includes(item.id) ? [] : [index]),
  w: Object.fromEntries(course.completion.milestones.flatMap((item, index) => item.type === "watch" && !omitted.includes(item.id) ? [[index, [[0, 100]]]] : [])),
  d: Object.fromEntries(course.completion.milestones.flatMap((item, index) => item.type === "watch" && !omitted.includes(item.id) ? [[index, 100]] : [])),
  e: Object.fromEntries(course.completion.milestones.flatMap((item, index) => item.type === "explore" && !omitted.includes(item.id) ? [[index, item.requiredItems]] : [])), u: {},
});
const seed = (values = {}) => ({ "cmi.core.lesson_status": "not attempted", "cmi.core.lesson_location": "/", "cmi.core.student_id": "verification-learner", "cmi.suspend_data": "", ...values });
const calls = (mock, name) => mock.calls.filter((item) => item[0] === name);
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("__strict_lms_mock")));

// The player state survives child navigation and launcher reopening. It records
// duplicate initialization, calls after finish, and forced write failures.
const installMock = (context, initial, options = {}) => context.addInitScript(({ initial, options }) => {
  const key = "__strict_lms_mock";
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ values: initial, calls: [], invalid: [], active: false, finished: false, error: "0", failElement: options.failElement || "", failInit: options.failInit || 0 }));
  const read = () => JSON.parse(localStorage.getItem(key));
  const write = (s) => localStorage.setItem(key, JSON.stringify(s));
  const call = (name, element, value) => { const s = read(); s.calls.push([name, element, value]); write(s); return s; };
  window.API = {
    LMSInitialize() { const s = call("LMSInitialize"); if (s.active || s.failInit > 0) { if (s.failInit > 0) s.failInit--; else s.invalid.push("Repeated LMSInitialize"); s.error = "101"; write(s); return "false"; } s.active = true; s.finished = false; s.error = "0"; write(s); return "true"; },
    LMSFinish() { const s = call("LMSFinish"); if (!s.active || s.finished) { s.invalid.push("Duplicate LMSFinish"); s.error = "101"; write(s); return "false"; } s.active = false; s.finished = true; s.error = "0"; write(s); return "true"; },
    LMSGetValue(element) { const s = call("LMSGetValue", element); s.error = s.active ? "0" : "301"; write(s); return s.active ? s.values[element] || "" : ""; },
    LMSSetValue(element, value) { const s = call("LMSSetValue", element, value); if (!s.active || s.failElement === element) { if (!s.active) s.invalid.push(`LMSSetValue after finish: ${element}`); s.error = s.active ? "101" : "301"; write(s); return "false"; } s.values[element] = value; s.error = "0"; write(s); return "true"; },
    LMSCommit() { const s = call("LMSCommit"); if (!s.active) s.invalid.push("LMSCommit after finish"); s.error = s.active ? "0" : "301"; write(s); return s.active ? "true" : "false"; },
    LMSGetLastError() { return read().error; }, LMSGetErrorString(code) { return code === "101" ? "General exception" : code === "301" ? "Not initialized" : "No error"; }, LMSGetDiagnostic() { return ""; },
  };
}, { initial, options });

if (process.argv.includes("--check-fixtures")) {
  assert(suspend(config).length <= 4096, "Full milestone fixture exceeds the SCORM 1.2 limit.");
  const evidence = JSON.parse(suspend(config));
  assert(config.completion.milestones.every((item, index) => !item.required || evidence.c.includes(index)), "Full fixture omits required evidence.");
  console.log(`SCORM fixture evidence verified: ${config.lessons.length} lessons, ${config.completion.milestones.length} milestones.`);
  process.exit(0);
}

await rm(scratch, { recursive: true, force: true });
let server;
try {
  const fixtureDist = path.join(scratch, "fixture-build");
  await run(process.execPath, [path.resolve("node_modules/astro/bin/astro.mjs"), "build", "--outDir", fixtureDist], {
    cwd: process.cwd(), env: { ...process.env, COURSE_VERIFY_COMPONENTS: "1", PUBLIC_COURSE_VERIFY: "1" },
  });
  const oneZip = path.join(scratch, "one-scroll.zip");
  const one = await packageCourse({ source: fixtureDist, entryName: "__verify-one-page/index.html", output: oneZip });
  const emptyZip = path.join(scratch, "empty-requirements.zip");
  const empty = await packageCourse({ source: fixtureDist, entryName: "__verify-empty-page/index.html", output: emptyZip });
  const packages = [
    { mode: "lessons", config, zip, extracted: path.join(scratch, "lessons"), base: `${base}lessons/` },
    { mode: "sections", config: one.config, zip: oneZip, extracted: path.join(scratch, "sections"), base: `${base}sections/` },
    { mode: "empty", config: empty.config, zip: emptyZip, extracted: path.join(scratch, "empty"), base: `${base}empty/` },
  ];
  for (const item of packages) {
    const members = await extractZip(item.zip, item.extracted);
    const unique = new Set(members);
    assert(unique.size === members.length && unique.has("imsmanifest.xml") && unique.has("index.html") && unique.has("overview.html") && unique.has("scorm/runtime.js"), `${item.mode} ZIP structure is incomplete.`);
    assert(!members.some((name) => name.startsWith("__verify-")), `${item.mode} ZIP contains verification pages.`);
    for (const lesson of item.config.lessons) assert(unique.has(fileFor(lesson.path)), `${item.mode} package misses ${lesson.path}.`);
    if (item.mode !== "lessons") assert(item.config.lessons.length === 1 && !members.some((name) => /\/index\.html$/.test(name)), "One-scroll package contains extra lesson documents.");
    const manifest = await readFile(path.join(item.extracted, "imsmanifest.xml"), "utf8");
    assert((manifest.match(/adlcp:scormtype="sco"/g) || []).length === 1 && manifest.includes('href="index.html"') && (manifest.match(/<title>Content<\/title>/g) || []).length === 2 && manifest.includes("<schemaversion>1.2</schemaversion>"), `${item.mode} manifest SCO or titles are invalid.`);
    for (const name of members.filter((name) => name !== "imsmanifest.xml")) assert(manifest.includes(`<file href="${name}"/>`), `${item.mode} manifest omits ${name}.`);
    for (const name of members.filter((name) => name.endsWith(".html") || name.endsWith(".css"))) {
      const content = await readFile(path.join(item.extracted, ...name.split("/")), "utf8");
      assert(!/\b(?:href|src|poster|data-image-src)=["']\/(?!\/)/.test(content) && !/url\(\s*["']?\/(?!\/)/.test(content), `${item.mode} has a root-relative package URL in ${name}.`);
      if (name.endsWith(".html")) assert(content.includes("<title>Content</title>"), `${item.mode} browser title is not Content in ${name}.`);
    }
  }

  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
      const item = packages.find((candidate) => pathname.startsWith(candidate.base));
      if (!item || pathname.endsWith("/")) throw new Error("No directory index routing");
      const relative = pathname.slice(item.base.length);
      const file = path.resolve(item.extracted, relative);
      if (!file.startsWith(`${item.extracted}${path.sep}`) || !(await stat(file)).isFile()) throw new Error("Not a packaged file");
      response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      response.end(await readFile(file));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const launch = async (context, item, values = seed(), query = "") => {
    await installMock(context, values);
    const page = await context.newPage();
    monitor(page, `${item.mode} launcher`, origin);
    await page.goto(`${origin}${item.base}index.html${query}`, { waitUntil: "networkidle" });
    await page.frameLocator("#course").locator(".course-page:not([data-access-pending])").waitFor();
    const frame = page.frame({ name: "course" });
    assert(frame && await page.title() === "Content" && await frame.title() === "Content", `${item.mode} launcher or child title changed.`);
    return { page, frame };
  };
  try {
    for (const item of packages.filter((candidate) => candidate.mode !== "empty")) {
      const required = item.config.completion.milestones.filter((milestone) => milestone.required);
      const lastInteraction = item.mode === "sections" ? required.find((milestone) => milestone.id === "fixture-quiz-second") : [...required].reverse().find((milestone) => milestone.type !== "view");
      const context = await browser.newContext();
      const omitted = [...(lastInteraction ? [lastInteraction.id] : []), ...(item.mode === "sections" ? ["fixture-tabs"] : [])];
      const { page, frame } = await launch(context, item, seed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": suspend(item.config, omitted) }));
      const launcherPath = new URL(page.url()).pathname;
      assert(frame.url().endsWith("/overview.html") && calls(await state(page), "LMSInitialize").length === 1, `${item.mode} did not start in the persistent overview.`);
      assert(await frame.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), `${item.mode} overview has broken images.`);
      if (item.mode === "sections") {
        const tabIndex = item.config.completion.milestones.findIndex((milestone) => milestone.id === "fixture-tabs");
        const tabEvidence = async () => JSON.parse((await state(page)).values["cmi.suspend_data"] || "{}").e?.[tabIndex] || [];
        assert(tabIndex >= 0 && (await tabEvidence()).length === 0, "Offscreen initial tab earned packaged exploration credit.");
        await frame.locator("#fixture-tabs [role=tabpanel]:not([hidden])").scrollIntoViewIfNeeded();
        await page.waitForFunction((index) => JSON.parse(JSON.parse(localStorage.getItem("__strict_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[index]?.includes("alpha"), tabIndex);
        assert(JSON.stringify(await tabEvidence()) === JSON.stringify(["alpha"]), "Packaged initial tab did not earn only its visible panel.");
        await frame.locator("#fixture-tabs [data-explore-item=beta][role=tab]").click();
        await page.waitForFunction((index) => JSON.parse(JSON.parse(localStorage.getItem("__strict_lms_mock")).values["cmi.suspend_data"] || "{}").e?.[index]?.includes("beta"), tabIndex);
        assert(JSON.stringify(await tabEvidence()) === JSON.stringify(["alpha", "beta"]), "Packaged later tab did not complete exploration.");
        const saves = calls(await state(page), "LMSCommit").length;
        await frame.evaluate(() => window.dispatchEvent(new CustomEvent("course-progress:explore", { detail: { activityId: "fixture-tabs", itemId: "beta" } })));
        assert(calls(await state(page), "LMSCommit").length === saves, "Duplicate packaged tab event saved again.");
      }
      if (item.mode === "lessons") {
        const next = item.config.lessons[1];
        await frame.locator("[data-next-lesson]").click();
        await frame.waitForURL(`${origin}${item.base}${fileFor(next.path)}`);
        assert(new URL(page.url()).pathname === launcherPath && (await state(page)).values["cmi.core.lesson_location"] === next.path, `Child lesson navigation replaced the launcher or saved a physical route: ${page.url()}, ${(await state(page)).values["cmi.core.lesson_location"]}, expected ${next.path}.`);
        assert(await frame.locator("img").evaluateAll((images) => images.every((image) => !image.complete || image.naturalWidth > 0)), `Nested lesson has broken images: ${JSON.stringify(await frame.locator("img").evaluateAll((images) => images.filter((image) => image.complete && !image.naturalWidth).map((image) => image.src)))}`);
        const backToTop = frame.locator(".footer-inner a");
        assert((await backToTop.getAttribute("href")).endsWith(`${fileFor(next.path)}#top`), "Nested Back to top does not name its current file.");
        await frame.evaluate(() => { window.__documentMarker = 1; });
        await backToTop.click();
        assert(await frame.evaluate(() => window.__documentMarker === 1) && frame.url().endsWith("#top"), "Nested Back to top reloaded or left the learner document.");
        await frame.locator('a[data-lesson-path="/"]').first().click();
        await frame.waitForURL(`${origin}${item.base}overview.html`);
        await frame.locator("[data-progress-trigger]").click();
        const shortcut = frame.locator(`[data-checklist-target="${lastInteraction.targetId}"]`);
        await shortcut.click();
        await frame.waitForURL(new RegExp(`${fileFor(next.path).replaceAll("/", "\\/")}#${lastInteraction.targetId}$`));
        assert(new URL(page.url()).pathname === launcherPath, "Progress shortcut replaced the launcher.");
        await frame.evaluate(() => location.reload());
        await frame.locator(".course-page:not([data-access-pending])").waitFor();
        await frame.evaluate(() => history.back());
        await frame.waitForURL(`${origin}${item.base}overview.html`);
        await frame.evaluate(() => history.forward());
        await frame.waitForURL(new RegExp(`${fileFor(next.path).replaceAll("/", "\\/")}`));
      } else {
        const anchor = frame.locator('[data-course-section="fixture-steps"]');
        await frame.evaluate(() => { window.__documentMarker = 1; });
        await frame.locator(".lessons-toggle").click();
        await anchor.click();
        assert(await frame.evaluate(() => window.__documentMarker === 1) && frame.url().includes("#fixture-steps"), "One-scroll anchor reloaded the learner document.");
        await frame.locator("#fixture-steps [role=tabpanel]:not([hidden])").scrollIntoViewIfNeeded();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem("__strict_lms_mock")).values["cmi.suspend_data"]?.includes('"notice"'));
        await frame.locator("[data-progress-trigger]").click();
        const shortcut = frame.locator(`[data-checklist-target="${lastInteraction.targetId}"]`);
        await shortcut.click();
        assert(await frame.evaluate(() => window.__documentMarker === 1) && frame.url().endsWith(`#${lastInteraction.targetId}`), "One-scroll Progress shortcut reloaded the learner document.");
        await frame.locator(".footer-inner a").click();
        assert(await frame.evaluate(() => window.__documentMarker === 1) && frame.url().endsWith("overview.html#top"), "One-scroll Back to top reloaded the learner document.");
      }
      const before = await state(page);
      assert(calls(before, "LMSInitialize").length === 1 && calls(before, "LMSFinish").length === 0 && before.invalid.length === 0 && before.values["cmi.core.lesson_status"] === "incomplete", `${item.mode} child navigation changed the SCO lifecycle or completed partial evidence.`);
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      await frame.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      const closed = await state(page);
      assert(calls(closed, "LMSFinish").length === 1 && closed.values["cmi.core.exit"] === "suspend" && closed.invalid.length === 0, `${item.mode} launcher did not close cleanly.`);
      const reopened = await context.newPage();
      monitor(reopened, `${item.mode} reopen`, origin);
      await reopened.goto(`${origin}${item.base}index.html`, { waitUntil: "networkidle" });
      await reopened.frameLocator("#course").locator(".course-page:not([data-access-pending])").waitFor();
      assert(calls(await state(reopened), "LMSInitialize").length === 2 && new URL(reopened.url()).pathname === launcherPath, `${item.mode} launcher did not reopen one session.`);
      assert(reopened.frame({ name: "course" })?.url().endsWith(item.mode === "lessons" ? fileFor(item.config.lessons[1].path) : "overview.html"), `${item.mode} did not resume the saved logical route.`);
      await context.close();

      const freshContext = await browser.newContext();
      const fresh = await launch(freshContext, item);
      const freshState = await state(fresh.page);
      assert(freshState.values["cmi.core.lesson_status"] === "incomplete" && calls(freshState, "LMSInitialize").length === 1, `${item.mode} fresh launch was not incomplete.`);
      await freshContext.close();

      const recoveryContext = await browser.newContext();
      const recovery = await launch(recoveryContext, item, seed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": suspend(item.config) }));
      await recovery.page.waitForFunction(() => JSON.parse(localStorage.getItem("__strict_lms_mock")).values["cmi.core.lesson_status"] === "completed");
      assert((await state(recovery.page)).invalid.length === 0, `${item.mode} full evidence recovery made invalid LMS calls.`);
      await recoveryContext.close();

      const finalView = required.find((milestone) => milestone.type === "view");
      if (finalView) {
        const completionContext = await browser.newContext();
        const completion = await launch(completionContext, item, seed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": suspend(item.config, [finalView.id]) }));
        await completion.frame.locator(`#${finalView.targetId}`).scrollIntoViewIfNeeded();
        await completion.page.waitForFunction(() => JSON.parse(localStorage.getItem("__strict_lms_mock")).values["cmi.core.lesson_status"] === "completed");
        assert(calls(await state(completion.page), "LMSCommit").length > 0, `${item.mode} final visible requirement was not committed.`);
        await completionContext.close();
      }

      for (const status of ["completed", "passed"]) {
        const statusContext = await browser.newContext();
        const statusPage = await launch(statusContext, item, seed({ "cmi.core.lesson_status": status, "cmi.suspend_data": suspend(item.config) }));
        await statusPage.page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
        assert((await state(statusPage.page)).values["cmi.core.lesson_status"] === status, `${item.mode} downgraded ${status}.`);
        await statusContext.close();
      }

      const mismatchContext = await browser.newContext();
      const mismatch = JSON.parse(suspend(item.config)); mismatch.s = "0000000000000000";
      const mismatchData = JSON.stringify(mismatch);
      const mismatchPage = await launch(mismatchContext, item, seed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": mismatchData }));
      assert(await mismatchPage.frame.locator("[data-progress-save-error]").isVisible() && (await state(mismatchPage.page)).values["cmi.suspend_data"] === mismatchData, `${item.mode} changed a mismatched LMS record.`);
      await mismatchContext.close();

      const failContext = await browser.newContext();
      await installMock(failContext, seed(), { failInit: 1 });
      const failed = await failContext.newPage();
      await failed.goto(`${origin}${item.base}index.html`, { waitUntil: "networkidle" });
      assert(await failed.locator("#launch-error").isVisible() && !(await failed.locator("#course").getAttribute("src")), `${item.mode} initialization failure was hidden or launched a child.`);
      await failContext.close();

      const directContext = await browser.newContext();
      await installMock(directContext, seed());
      const direct = await directContext.newPage();
      await direct.goto(`${origin}${item.base}overview.html`, { waitUntil: "networkidle" });
      assert(await direct.locator("[data-progress-save-error]").isVisible() && calls(await state(direct), "LMSInitialize").length === 0, `${item.mode} learner page started a second SCO without the launcher.`);
      await directContext.close();

      const writeContext = await browser.newContext();
      await installMock(writeContext, seed(), { failElement: "cmi.suspend_data" });
      const writePage = await writeContext.newPage();
      await writePage.goto(`${origin}${item.base}index.html`, { waitUntil: "networkidle" });
      await writePage.frameLocator("#course").locator(".course-page:not([data-access-pending])").waitFor();
      const writeFrame = writePage.frame({ name: "course" });
      await writeFrame.locator(`#${required.find((milestone) => milestone.type === "view").targetId}`).scrollIntoViewIfNeeded();
      await writeFrame.locator("[data-progress-save-error]").waitFor({ state: "visible" });
      const failedWrite = await state(writePage);
      assert(calls(failedWrite, "LMSSetValue").some((call) => call[1] === "cmi.suspend_data") && failedWrite.values["cmi.core.lesson_status"] !== "completed", `${item.mode} failed save granted completion or was not attempted.`);
      await writeContext.close();

      const lockedRoute = item.config.lessons.at(-1).path;
      for (const bad of ["https://evil.invalid/", "../index.html", "/unknown/"]) {
        const badContext = await browser.newContext();
        const badPage = await launch(badContext, item, seed(), `?module=${encodeURIComponent(bad)}`);
        assert(badPage.frame.url().endsWith("/overview.html") && calls(await state(badPage.page), "LMSInitialize").length === 1, `${item.mode} accepted invalid module query ${bad}.`);
        await badContext.close();
      }
      if (item.config.completion.sequentialUnlocking === true && lockedRoute !== "/") {
        const lockContext = await browser.newContext();
        const locked = await launch(lockContext, item, seed(), `?module=${encodeURIComponent(lockedRoute)}`);
        await locked.frame.waitForURL(`${origin}${item.base}overview.html`);
        assert((await state(locked.page)).values["cmi.core.lesson_status"] === "incomplete", "Requested locked route bypassed unlocking.");
        await lockContext.close();
      }
    }
    const emptyContext = await browser.newContext();
    const emptyLaunch = await launch(emptyContext, packages.find((item) => item.mode === "empty"));
    assert((await state(emptyLaunch.page)).values["cmi.core.lesson_status"] === "incomplete" && (await emptyLaunch.frame.locator("[data-progress-percent]").textContent()) === "0%", "Empty packaged requirements reported completion or nonzero progress.");
    await emptyContext.close();
    assert(errors.filter((error) => !error.includes("LMSInitialize failed") && !error.includes("Invalid or version-mismatched")).length === 0, `Packaged browser errors: ${errors.join("; ")}`);
  } finally { await browser.close(); }
  console.log("Persistent SCORM ZIP verification passed: Multi-page and One-scroll, empty requirements, strict nested hosting, one SCO per launcher, routing, restore, completion, save failure and lifecycle safeguards.");
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
