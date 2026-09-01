import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const mimeTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const dist = path.resolve("dist");
let server;
let baseUrl = process.env.COURSE_URL;

if (!baseUrl) {
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
      let target = path.resolve(dist, `.${pathname}`);
      if (!target.startsWith(dist + path.sep) && target !== dist) throw new Error("Invalid path");
      if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
      const content = await readFile(target);
      response.writeHead(200, { "Content-Type": mimeTypes[path.extname(target)] ?? "application/octet-stream" });
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
}

const browser = await chromium.launch({ headless: true });
const errors = [];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "narrow-mobile", width: 320, height: 720 },
];

const monitorPage = (page, label) => {
  page.on("pageerror", (error) => errors.push(`${label} page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label} console error: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    errors.push(`${label} request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
  });
};

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    monitorPage(page, viewport.name);
    const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
    if (!response?.ok()) errors.push(`${viewport.name} returned HTTP ${response?.status() ?? "unknown"}`);
    if (await page.title() !== "Champion at TFG: The Brand Worth Talking About") errors.push(`${viewport.name} has an unexpected title`);
    if (await page.locator("[data-nav-section]").count() !== 6) errors.push(`${viewport.name} does not render all six navigable course sections`);
    if (await page.locator(".heritage-card").count() !== 4) errors.push(`${viewport.name} does not render four heritage cards`);
    if (await page.locator(".conversation-card").count() !== 5) errors.push(`${viewport.name} does not render five Customer conversation cards`);
    const brandPairs = page.locator("[data-brand-pair]");
    if (await brandPairs.count() !== 5 || await page.locator(".match-guide button").count() !== 0) {
      errors.push(`${viewport.name} does not render five static Brand DNA pairs`);
    }
    for (const pair of await brandPairs.all()) {
      const geometry = await pair.evaluate((element) => {
        const value = element.querySelector(".match-value-static")?.getBoundingClientRect();
        const arrow = element.querySelector(".match-arrow")?.getBoundingClientRect();
        const message = element.querySelector(".match-message-static")?.getBoundingClientRect();
        return value && arrow && message ? {
          correctlyOrdered: value.right <= arrow.left + 1 && arrow.right <= message.left + 1,
          verticallyAligned: Math.abs((value.top + value.bottom) / 2 - (message.top + message.bottom) / 2) <= 1,
        } : null;
      });
      if (!geometry?.correctlyOrdered || !geometry.verticallyAligned) {
        errors.push(`${viewport.name} has a misaligned Brand DNA pair`);
        break;
      }
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) errors.push(`${viewport.name} has horizontal page overflow`);

    const videoGeometry = await page.locator(".video-placeholder").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height, viewport: document.documentElement.clientWidth };
    });
    if (videoGeometry.width > videoGeometry.viewport + 1 || Math.abs(videoGeometry.width / videoGeometry.height - 16 / 9) > 0.08) {
      errors.push(`${viewport.name} video placeholder is not responsive at 16:9`);
    }
    const videoSource = page.locator('video source[type="video/mp4"]');
    if (await videoSource.count() !== 1 || !(await videoSource.getAttribute("src"))?.endsWith("/assets/champion/champion-has-arrived-at-tfg.mp4")) {
      errors.push(`${viewport.name} does not include the packaged Champion video source`);
    }
    const legacyPdfLink = page.locator('.heritage-download a[download="Legacy-of-Champions.pdf"]');
    if (
      await legacyPdfLink.count() !== 1
      || (await legacyPdfLink.textContent())?.trim() !== "PDF"
      || !(await legacyPdfLink.getAttribute("href"))?.endsWith("/assets/champion/legacy-of-champions.pdf")
    ) {
      errors.push(`${viewport.name} does not include the linked Legacy of Champions PDF`);
    }

    if (viewport.name.includes("mobile")) {
      const toggle = page.locator(".nav-toggle");
      await toggle.click();
      if (await toggle.getAttribute("aria-expanded") !== "true" || !(await page.locator(".course-links").isVisible())) {
        errors.push(`${viewport.name} navigation did not open`);
      }
      await page.locator('.course-links a[href="#meet-champion"]').click();
      if (await toggle.getAttribute("aria-expanded") !== "false") errors.push(`${viewport.name} navigation did not close after selection`);
    }

    await page.locator("#meet-champion").evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    try {
      await page.waitForFunction(() => document.querySelector('.course-links a[href="#meet-champion"]')?.classList.contains("active"), undefined, { timeout: 2000 });
    } catch {
      errors.push(`${viewport.name} active-section tracking did not select Meet Champion`);
    }

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    if (!(await page.locator(".back-to-top").evaluate((element) => element.classList.contains("is-visible")))) {
      errors.push(`${viewport.name} back-to-top control did not appear after scrolling`);
    }
    await page.locator(".back-to-top").click();
    try {
      await page.waitForFunction(() => window.scrollY === 0, undefined, { timeout: 2000 });
    } catch {
      errors.push(`${viewport.name} back-to-top control did not return to the top`);
    }

    if (viewport.name === "desktop") {
      const heritageTrigger = page.locator(".heritage-trigger").first();
      await heritageTrigger.focus();
      await heritageTrigger.press("Enter");
      if (await heritageTrigger.getAttribute("aria-expanded") !== "true" || !(await page.locator(".heritage-detail").first().isVisible())) {
        errors.push("heritage reveal did not work with the keyboard");
      }
      await page.reload({ waitUntil: "networkidle" });
      if (await page.locator(".heritage-trigger").first().getAttribute("aria-expanded") !== "true") {
        errors.push("heritage reveal state did not persist after reload");
      }

      const progress = await page.evaluate(() => JSON.parse(localStorage.getItem("champion-at-tfg-course-progress-v1") || "{}"));
      if (!progress.revealedHeritage?.includes("1919")) errors.push("persisted Champion heritage state is incomplete");
    }

    await context.close();
  }

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(baseUrl, { waitUntil: "networkidle" });
  const reducedBehavior = await reducedPage.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  if (reducedBehavior !== "auto") errors.push("reduced-motion preference did not disable smooth scrolling");
  await reducedContext.close();

  const lmsContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const lmsPage = await lmsContext.newPage();
  await lmsPage.addInitScript(() => {
    const calls = [];
    const values = {
      "cmi.core.lesson_status": "not attempted",
      "cmi.core.total_time": "0000:00:00.00",
    };
    window.__lmsCalls = calls;
    window.API = {
      LMSInitialize(value) { calls.push(["LMSInitialize", value]); return "true"; },
      LMSGetValue(element) { calls.push(["LMSGetValue", element]); return values[element] ?? ""; },
      LMSSetValue(element, value) { calls.push(["LMSSetValue", element, value]); values[element] = value; return "true"; },
      LMSCommit(value) { calls.push(["LMSCommit", value]); return "true"; },
      LMSFinish(value) { calls.push(["LMSFinish", value]); return "true"; },
    };
  });
  monitorPage(lmsPage, "SCORM");
  await lmsPage.goto(baseUrl, { waitUntil: "networkidle" });
  await lmsPage.evaluate(() => { window.__lmsCalls.length = 0; });
  await lmsPage.locator(".course-return").click();
  const result = await lmsPage.evaluate(() => ({ calls: window.__lmsCalls, hash: window.location.hash }));
  const completedIndex = result.calls.findIndex(
    ([method, element, value]) => method === "LMSSetValue" && element === "cmi.core.lesson_status" && value === "completed",
  );
  const commitIndex = result.calls.findIndex(([method], index) => method === "LMSCommit" && index > completedIndex);
  if (completedIndex < 0) errors.push("Return to People Connect did not set SCORM lesson status to completed");
  if (commitIndex < 0) errors.push("Return to People Connect did not commit the SCORM completion status");
  if (!result.calls.some(([method, element]) => method === "LMSSetValue" && element === "cmi.suspend_data")) {
    errors.push("course progress was not written to SCORM suspend data");
  }
  if (result.hash !== "#top") errors.push("Return to People Connect did not preserve its navigation behavior");
  await lmsContext.close();
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Champion course verification passed: responsive layouts, navigation, reveals, static Brand DNA pairs, persistence, reduced motion, assets, and SCORM completion.");
}
