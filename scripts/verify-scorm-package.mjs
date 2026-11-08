import { createServer } from "node:http";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { extractZip } from "./scorm-zip.mjs";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const distEntry = await readFile(path.resolve("dist", "index.html"), "utf8");
const config = JSON.parse(distEntry.match(/<script\b[^>]*data-course-config[^>]*>([\s\S]*?)<\/script>/)?.[1] || "null");
assert(config?.lessons?.length && Array.isArray(config?.completion?.milestones), "Build a configured course before verifying its package.");
const zip = path.resolve("scorm-output", config.package.filename);
const scratch = path.resolve(".verification-scorm");
const extracted = path.join(scratch, "course");
const base = "/lms/player/content/package-123/deep/";
const fileFor = (route) => `${route.replace(/^\//, "")}index.html`;
const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const errors = [];
const monitor = (page, label, origin) => {
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${label}: ${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${label}: HTTP ${response.status()} ${response.url()}`); });
  page.on("request", (request) => { const url = new URL(request.url()); if (/^https?:$/.test(url.protocol) && url.origin !== origin) errors.push(`${label}: external request ${url}`); });
};

// This simulated player keeps its API state across document navigation. It
// rejects repeated initialization, calls after finish and duplicate finish.
const installMock = (context, initial, options = {}) => context.addInitScript(({ initial, options }) => {
  const key = "__strict_lms_mock";
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ values: initial, calls: [], invalid: [], active: false, finished: false, error: "0", failElement: options.failElement || "", failInit: options.failInit || 0 }));
  const read = () => JSON.parse(localStorage.getItem(key));
  const write = (state) => localStorage.setItem(key, JSON.stringify(state));
  const call = (name, element, value) => { const state = read(); state.calls.push([name, element, value]); write(state); return state; };
  window.API = {
    LMSInitialize() { const s = call("LMSInitialize"); if (s.active || s.failInit > 0) { if (s.failInit > 0) s.failInit--; else s.invalid.push("Repeated LMSInitialize"); s.error = "101"; write(s); return "false"; } s.active = true; s.finished = false; s.error = "0"; write(s); return "true"; },
    LMSFinish() { const s = call("LMSFinish"); if (!s.active || s.finished) { s.invalid.push("Duplicate LMSFinish"); s.error = "101"; write(s); return "false"; } s.active = false; s.finished = true; s.error = "0"; write(s); return "true"; },
    LMSGetValue(element) { const s = call("LMSGetValue", element); s.error = s.active ? "0" : "301"; write(s); return s.active ? s.values[element] || "" : ""; },
    LMSSetValue(element, value) { const s = call("LMSSetValue", element, value); if (!s.active || s.failElement === element) { if (!s.active) s.invalid.push(`LMSSetValue after finish: ${element}`); s.error = s.active ? "101" : "301"; write(s); return "false"; } s.values[element] = value; s.error = "0"; write(s); return "true"; },
    LMSCommit() { const s = call("LMSCommit"); if (!s.active) s.invalid.push("LMSCommit after finish"); s.error = s.active ? "0" : "301"; write(s); return s.active ? "true" : "false"; },
    LMSGetLastError() { return read().error; },
    LMSGetErrorString(code) { return code === "101" ? "General exception" : code === "301" ? "Not initialized" : "No error"; },
    LMSGetDiagnostic() { return ""; },
  };
}, { initial, options });
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("__strict_lms_mock")));
const calls = (mock, name) => mock.calls.filter((item) => item[0] === name);
const seed = (values = {}) => ({
  "cmi.core.lesson_status": "not attempted",
  "cmi.core.lesson_location": "/",
  "cmi.core.student_id": "verification-learner",
  "cmi.suspend_data": "",
  ...values,
});
const milestones = config.completion.milestones;
const signatureSource = JSON.stringify(milestones.map(({ id, path, type, targetId, requiredItems, threshold, required }) => [id, path, type, targetId, requiredItems || [], threshold ?? null, required]));
let signatureHash = 0xcbf29ce484222325n;
for (const character of signatureSource) signatureHash = BigInt.asUintN(64, (signatureHash ^ BigInt(character.charCodeAt(0))) * 0x100000001b3n);
const suspend = (omittedId = "") => JSON.stringify({
  v: config.completion.storageKey,
  s: signatureHash.toString(16).padStart(16, "0"),
  c: milestones.flatMap((item, index) => item.id === omittedId ? [] : [index]),
  w: Object.fromEntries(milestones.flatMap((item, index) => item.type === "watch" ? [[index, [[0, 1]]]] : [])),
  e: Object.fromEntries(milestones.flatMap((item, index) => item.type === "explore" ? [[index, item.requiredItems]] : [])),
  u: {},
});
assert(suspend().length <= 4096, "Full milestone state exceeds the SCORM 1.2 suspend-data limit.");

await rm(scratch, { recursive: true, force: true });
try {
  const files = await extractZip(zip, extracted);
  const members = new Set(files);
  assert(members.size === files.length && members.has("imsmanifest.xml"), "ZIP members are duplicated or missing.");
  for (const lesson of config.lessons) assert(members.has(fileFor(lesson.path)), `Missing configured lesson file ${lesson.path}`);
  assert(!files.some((file) => file.startsWith("__verify-")), "Verification fixture entered ZIP.");
  const manifest = await readFile(path.join(extracted, "imsmanifest.xml"), "utf8");
  assert(manifest.includes("<schemaversion>1.2</schemaversion>") && manifest.includes('adlcp:scormtype="sco"'), "Not a SCORM 1.2 SCO manifest.");
  assert(manifest.includes(`identifier="${escapeXml(config.package.identifier)}"`) && manifest.includes(`<title>${escapeXml(config.package.title)}</title>`) && manifest.includes('href="index.html"'), "Manifest identity, title or launch file differs from configuration.");
  for (const file of files.filter((item) => item !== "imsmanifest.xml")) assert(manifest.includes(`<file href="${escapeXml(file)}"/>`), `Manifest omits ${file}`);
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
      if (!pathname.startsWith(base) || pathname.endsWith("/")) throw new Error("No directory index routing");
      const relative = pathname.slice(base.length);
      const file = path.resolve(extracted, relative);
      if (!file.startsWith(`${extracted}${path.sep}`) || !(await stat(file)).isFile()) throw new Error("Not a packaged file");
      response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      response.end(await readFile(file));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = (route) => `${origin}${base}${fileFor(route)}`;
  const ready = (page) => page.locator(".course-page:not([data-access-pending])").waitFor();
  const browser = await chromium.launch({ headless: true });
  try {
    const routeContext = await browser.newContext();
    await installMock(routeContext, seed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": suspend() }));
    const routePage = await routeContext.newPage();
    monitor(routePage, "configured routes", origin);
    for (const [index, lesson] of config.lessons.entries()) {
      if (index === 0) await routePage.goto(url(lesson.path), { waitUntil: "networkidle" });
      else { await routePage.locator("[data-next-lesson]").click(); await routePage.waitForURL(url(lesson.path)); }
      await ready(routePage);
      assert(routePage.url() === url(lesson.path) && await routePage.title() === config.package.title, `Packaged route did not render: ${lesson.path}`);
      assert(await routePage.evaluate(() => document.styleSheets.length > 0), `CSS did not load on ${lesson.path}`);
      assert(await routePage.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), `Broken image on ${lesson.path}`);
      for (const target of config.lessons) assert((await routePage.locator(`a[data-lesson-path="${target.path}"]`).first().getAttribute("href")) === `${base}${fileFor(target.path)}`, `Lesson link lacks explicit index.html: ${target.path}`);
      if (index === 0 && config.lessons.length > 1) {
        await routePage.evaluate(() => document.querySelector("[data-next-lesson]").addEventListener("click", (event) => event.preventDefault(), { once: true, capture: true }));
        await routePage.locator("[data-next-lesson]").click();
        const canceled = await state(routePage);
        assert(routePage.url() === url(lesson.path) && canceled.active && calls(canceled, "LMSFinish").length === 0, "Canceled lesson navigation closed the LMS session.");
      }
    }
    const afterLinks = await state(routePage);
    assert(calls(afterLinks, "LMSInitialize").length === 1 && calls(afterLinks, "LMSFinish").length === 0 && afterLinks.invalid.length === 0, `Normal lesson links changed the LMS session: ${JSON.stringify(afterLinks.invalid)}`);
    await routePage.reload({ waitUntil: "networkidle" });
    await ready(routePage);
    if (config.lessons.length > 1) {
      await routePage.goBack({ waitUntil: "networkidle" });
      await ready(routePage);
      await routePage.goForward({ waitUntil: "networkidle" });
      await ready(routePage);
    }
    const beforeClose = await state(routePage);
    assert(beforeClose.invalid.length === 0 && beforeClose.active, `Refresh or history made invalid LMS calls: ${JSON.stringify(beforeClose.invalid)}`);
    assert(beforeClose.values["cmi.core.lesson_status"] === "incomplete", "Navigation granted completion.");
    assert(beforeClose.calls.some((call) => call[0] === "LMSCommit"), "Navigation did not commit progress.");
    await routePage.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    const closed = await state(routePage);
    assert(calls(closed, "LMSFinish").length === calls(beforeClose, "LMSFinish").length + 1 && !closed.active && closed.values["cmi.core.exit"] === "suspend", "Save and Close did not suspend and finish exactly once.");
    assert(closed.values["cmi.core.lesson_status"] === "incomplete", "Closure granted completion.");
    const reopened = await routeContext.newPage();
    monitor(reopened, "saved LMS resume", origin);
    await reopened.goto(url(config.lessons[0].path), { waitUntil: "networkidle" });
    await ready(reopened);
    assert(reopened.url() === url(config.lessons.at(-1).path), "Saved lesson location was not restored.");
    const resumed = await state(reopened);
    assert(calls(resumed, "LMSInitialize").length === calls(closed, "LMSInitialize").length + 1 && resumed.invalid.length === 0 && resumed.values["cmi.core.lesson_status"] === "incomplete", "Closed LMS session did not initialize and resume correctly.");
    await routeContext.close();

    const freshContext = await browser.newContext();
    await installMock(freshContext, seed());
    const fresh = await freshContext.newPage();
    monitor(fresh, "fresh LMS launch", origin);
    await fresh.goto(url(config.lessons[0].path), { waitUntil: "networkidle" });
    await ready(fresh);
    const freshState = await state(fresh);
    assert(calls(freshState, "LMSInitialize").length === 1, "Fresh launch did not initialize exactly once.");
    assert(milestones.filter((item) => item.required).length || freshState.values["cmi.core.lesson_status"] !== "completed", "Empty requirements completed the LMS.");
    await freshContext.close();

    const finalMilestone = milestones.find((item) => item.required && item.type === "view") || milestones.filter((item) => item.required).at(-1);
    if (finalMilestone) {
      const completionContext = await browser.newContext();
      await installMock(completionContext, seed({ "cmi.core.lesson_status": "incomplete", "cmi.core.lesson_location": finalMilestone.path, "cmi.suspend_data": suspend(finalMilestone.id) }));
      const completionPage = await completionContext.newPage();
      monitor(completionPage, "final configured requirement", origin);
      await completionPage.goto(url(finalMilestone.path), { waitUntil: "networkidle" });
      await ready(completionPage);
      await completionPage.evaluate(({ targetId, type, id, requiredItems }) => {
        const target = document.getElementById(targetId);
        if (!target) throw new Error(`Missing final requirement target: ${targetId}`);
        if (type === "view") target.scrollIntoView({ block: "center" });
        else if (type === "complete" || type === "optional") window.dispatchEvent(new CustomEvent("course-progress:complete", { detail: { activityId: id } }));
        else if (type === "explore") for (const itemId of requiredItems || []) window.dispatchEvent(new CustomEvent("course-progress:explore", { detail: { activityId: id, itemId } }));
        else if (type === "submit") {
          const form = target instanceof HTMLFormElement ? target : target.querySelector("form");
          if (!form) throw new Error(`Missing final submission form: ${targetId}`);
          const input = form.querySelector("input[data-completion-option]");
          const select = form.querySelector("select[data-completion-option]");
          if (input) input.checked = true;
          else if (select) select.value = select.options[1]?.value || select.options[0]?.value || "";
          else throw new Error(`Missing final submission option: ${targetId}`);
          form.addEventListener("submit", (event) => event.preventDefault(), { once: true });
          form.requestSubmit();
        } else if (type === "watch" && target instanceof HTMLVideoElement) {
          Object.defineProperty(target, "duration", { configurable: true, value: 100 });
          Object.defineProperty(target, "played", { configurable: true, value: { length: 1, start: () => 0, end: () => 100 } });
          target.dispatchEvent(new Event("timeupdate"));
        }
      }, finalMilestone);
      await completionPage.waitForFunction(() => JSON.parse(localStorage.getItem("__strict_lms_mock")).values["cmi.core.lesson_status"] === "completed", null, { timeout: 3000 });
      assert(calls(await state(completionPage), "LMSCommit").length > 0, "Final configured requirement was not committed.");
      await completionContext.close();
    }

    for (const status of ["completed", "passed"]) {
      const context = await browser.newContext();
      await installMock(context, seed({ "cmi.core.lesson_status": status, "cmi.suspend_data": suspend() }));
      const page = await context.newPage();
      monitor(page, `${status} status preservation`, origin);
      await page.goto(url(config.lessons[0].path), { waitUntil: "networkidle" });
      await ready(page);
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      const preserved = await state(page);
      assert(preserved.values["cmi.core.lesson_status"] === status && !preserved.calls.some((call) => call[0] === "LMSSetValue" && call[1] === "cmi.core.lesson_status"), `${status} status was overwritten.`);
      await context.close();
    }

    const mismatchContext = await browser.newContext();
    const mismatched = JSON.parse(suspend()); mismatched.s = "0000000000000000";
    const originalSuspend = JSON.stringify(mismatched);
    await installMock(mismatchContext, seed({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": originalSuspend }));
    const mismatch = await mismatchContext.newPage();
    await mismatch.goto(url(config.lessons[0].path), { waitUntil: "networkidle" });
    await ready(mismatch);
    assert(await mismatch.locator("[data-progress-save-error]").isVisible() && (await state(mismatch)).values["cmi.suspend_data"] === originalSuspend, "Mismatched LMS record was not preserved and reported.");
    await mismatchContext.close();

    const initContext = await browser.newContext();
    await installMock(initContext, seed(), { failInit: 1 });
    const initPage = await initContext.newPage();
    await initPage.goto(url(config.lessons[0].path), { waitUntil: "networkidle" });
    await ready(initPage);
    const initFailed = await state(initPage);
    assert(await initPage.locator("[data-progress-save-error]").isVisible() && !initFailed.active && initFailed.values["cmi.core.lesson_status"] === "not attempted", "Failed initialization was treated as success.");
    await initContext.close();

    const writeContext = await browser.newContext();
    await installMock(writeContext, seed(), { failElement: "cmi.suspend_data" });
    const writePage = await writeContext.newPage();
    await writePage.goto(url(config.lessons[0].path), { waitUntil: "networkidle" });
    await ready(writePage);
    await writePage.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    const failedWrite = await state(writePage);
    assert(failedWrite.calls.some((call) => call[0] === "LMSSetValue" && call[1] === "cmi.suspend_data") && failedWrite.values["cmi.core.lesson_status"] !== "completed", "Failed suspend-data write granted completion or was not attempted.");
    await writeContext.close();

    assert(errors.length === 0, `Packaged browser errors: ${errors.join("; ")}`);
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
  console.log(`Extracted SCORM 1.2 ZIP verified under strict nested file hosting: ${zip}; ${files.length} files, ${config.lessons.length} configured routes, strict LMS navigation, resume, completion and status preservation.`);
} finally { await rm(scratch, { recursive: true, force: true }); }
