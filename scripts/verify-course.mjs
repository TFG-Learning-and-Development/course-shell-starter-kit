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

for (const lesson of builtConfig.lessons) assert(await exists(lessonFile(lesson.path)), `Missing configured production lesson: ${lesson.path}`);
assert(!(await exists(path.join(dist, "__verify-components", "index.html"))), "Verification fixtures entered the production build.");
await rm(fixtureDist, { recursive: true, force: true });
try {
  await run(process.execPath, [astro, "build", "--outDir", fixtureDist], {
    cwd: process.cwd(), env: { ...process.env, COURSE_VERIFY_COMPONENTS: "1", PUBLIC_COURSE_VERIFY: "1" },
  });
  for (const route of ["__verify-components", "__verify-completion", "__verify-routes", "__verify-routes-unlocked", "__verify-routes-empty"]) {
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
      assert((await page.locator(".course-links a[data-section-link]").count()) === (await page.locator("[data-nav-section]").count()), `${width}px section links do not match content`);
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
      assert((await page.locator("[data-checklist-items] li").count()) === builtConfig.completion.milestones.filter((item) => item.required && item.path === "/").length, `${width}px configured checklist count changed`);
      await page.keyboard.press("Escape");
      assert(!(await page.locator("[data-progress-panel]").isVisible()), `${width}px progress panel did not close`);
      if (width <= 1280) {
        const toggle = page.locator(".nav-toggle");
        await toggle.press("Enter");
        assert(await page.locator(".course-links").isVisible(), `${width}px mobile lesson disclosure did not open`);
        await toggle.press("Escape");
        assert(!(await page.locator(".course-links").isVisible()), `${width}px mobile lesson disclosure did not close`);
        const sectionLink = page.locator('.course-links a[data-section-link]').first();
        if (await sectionLink.count()) {
          const hash = await sectionLink.getAttribute("href");
          await toggle.click();
          await sectionLink.click();
          assert(new URL(page.url()).hash === hash && !(await page.locator(".course-links").isVisible()), `${width}px section navigation did not work`);
        }
      } else {
        assert(await page.locator(".course-links").isVisible(), "Desktop lesson navigation is hidden");
        const fiveLabelsFit = await page.evaluate(() => {
          const links = document.querySelector(".course-links");
          const logo = document.querySelector(".brand-link").getBoundingClientRect();
          const nav = links.getBoundingClientRect();
          const progress = document.querySelector("[data-progress-trigger]").getBoundingClientRect();
          return logo.right < nav.left && nav.right < progress.left && progress.right <= innerWidth - 12;
        });
        assert(fiveLabelsFit, `${width}px header crowds five realistic lesson labels`);
        const sectionLink = page.locator('.course-links a[data-section-link]').first();
        if (await sectionLink.count()) {
          const hash = await sectionLink.getAttribute("href");
          await sectionLink.click();
          assert(new URL(page.url()).hash === hash, `${width}px section navigation did not work`);
        }
      }
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
      watchRanges: Object.fromEntries(builtConfig.completion.milestones.filter((item) => item.type === "watch").map((item) => [item.id, [[0, 1]]])),
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

    const components = await browser.newPage();
    monitor(components, "component fixture", origin);
    await components.goto(`${origin}/__verify-components/`, { waitUntil: "networkidle" });
    assert((await components.locator(".responsive-table").count()) > 0, "Shared component fixture is missing");
    assert(await components.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Shared component fixture overflows");
    await components.close();
    assert(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
  console.log(`Course browser verification passed: responsive shell, typography, footer, ${builtConfig.lessons.length} configured routes, ${builtConfig.completion.milestones.length} milestones, immediate VIEW, activity fixtures and unlocking variants.`);
} finally { await rm(fixtureDist, { recursive: true, force: true }); }
