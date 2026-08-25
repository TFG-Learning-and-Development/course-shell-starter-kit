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
  ".xsd": "application/xml",
  ".xml": "application/xml",
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

try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "laptop", width: 1280, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (error) => errors.push(`${viewport.name} page error: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${viewport.name} console error: ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      errors.push(`${viewport.name} request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
    });

    const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
    if (!response?.ok()) errors.push(`${viewport.name} returned HTTP ${response?.status() ?? "unknown"}`);

    const title = await page.title();
    if (title !== "Adidas Adistar Quick Course") errors.push(`${viewport.name} has unexpected title: ${title}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) errors.push(`${viewport.name} has horizontal page overflow`);

    const flipCards = page.locator(".range-card-toggle");
    if (await flipCards.count() !== 2) errors.push(`${viewport.name} does not render two product flip cards`);
    const expectedCardDetails = [
      ["Adistar Charge", "Recommend when the Customer wants maximum cushioning with a more stable, supported feel for distance running."],
      ["Adistar 4", "Recommend when the Customer wants a cushioned, comfortable shoe for longer easy-paced runs."],
    ];
    const expectedFrontDetails = [
      "Maximum cushioning for longer runs with added stability",
      "Maximum cushioning for longer easy-paced runs",
    ];
    for (let cardIndex = 0; cardIndex < 2; cardIndex += 1) {
      const flipCard = flipCards.nth(cardIndex);
      const initialHeight = await flipCard.evaluate((element) => element.getBoundingClientRect().height);
      const frontText = (await flipCard.locator(".range-card-front").innerText()).replace(/\s+/g, " ");
      const backText = (await flipCard.locator(".range-card-back").innerText()).replace(/\s+/g, " ");
      if (frontText !== expectedFrontDetails[cardIndex]) {
        errors.push(`${viewport.name} card ${cardIndex + 1} has incorrect front-face content`);
      }
      if (frontText.includes(expectedCardDetails[cardIndex][0])) {
        errors.push(`${viewport.name} card ${cardIndex + 1} shows the product name on its front`);
      }
      if (!expectedCardDetails[cardIndex].every((copy) => backText.includes(copy))) {
        errors.push(`${viewport.name} card ${cardIndex + 1} has incorrect back-face content`);
      }
      if (backText.includes(expectedFrontDetails[cardIndex]) || /Customer need/i.test(backText)) {
        errors.push(`${viewport.name} card ${cardIndex + 1} shows Customer Need content on its back`);
      }
      if (await flipCard.getAttribute("aria-pressed") !== "false") errors.push(`${viewport.name} card ${cardIndex + 1} did not start on its front`);
      await flipCard.click();
      if (await flipCard.getAttribute("aria-pressed") !== "true" || !(await flipCard.getAttribute("class"))?.includes("is-flipped")) {
        errors.push(`${viewport.name} card ${cardIndex + 1} did not flip to its back`);
      }
      if (await page.locator('.range-card-toggle[aria-pressed="true"]').count() !== 1) errors.push(`${viewport.name} card ${cardIndex + 1} did not flip independently`);
      const flippedHeight = await flipCard.evaluate((element) => element.getBoundingClientRect().height);
      if (Math.abs(initialHeight - flippedHeight) > 0.5) errors.push(`${viewport.name} card ${cardIndex + 1} changed height when flipped`);
      await flipCard.press("Enter");
      if (await flipCard.getAttribute("aria-pressed") !== "false") errors.push(`${viewport.name} card ${cardIndex + 1} did not flip back with the keyboard`);
    }

    if (await page.locator(".technology-trigger").count() !== 4 || await page.locator(".hotspot").count() !== 4) {
      errors.push(`${viewport.name} does not render four technology controls`);
    }
    const technologyTrigger = page.locator(".technology-trigger").nth(3);
    await technologyTrigger.click();
    if (await technologyTrigger.getAttribute("aria-expanded") !== "true") {
      errors.push(`${viewport.name} technology accordion did not reveal its content`);
    }
    if (await page.locator(".technology-detail:visible").count() !== 1) {
      errors.push(`${viewport.name} technology accordion displayed more than one panel`);
    }

    const branch = page.locator(".branch-ask").nth(1);
    await branch.click();
    if (await branch.getAttribute("aria-pressed") !== "true") {
      errors.push(`${viewport.name} branching scenario did not select a path`);
    }

    await page.locator('.assessment-slide:not(.is-hidden) .assessment-options button[data-correct="false"]').first().click();
    if (!(await page.locator(".assessment-feedback").first().textContent())?.trim()) {
      errors.push(`${viewport.name} assessment feedback did not render after an incorrect answer`);
    }
    await page.locator('.assessment-slide:not(.is-hidden) .assessment-options button[data-correct="true"]').click();
    if (!(await page.locator(".assessment-feedback").first().textContent())?.trim()) {
      errors.push(`${viewport.name} assessment feedback did not render after a correct answer`);
    }
    const expectedCorrectAnswers = [1, 0, 2, 1];
    for (let questionIndex = 0; questionIndex < expectedCorrectAnswers.length; questionIndex += 1) {
      const slide = page.locator(`.assessment-slide[data-question="${questionIndex}"]`);
      const markedCorrect = slide.locator('.assessment-options button[data-correct="true"]');
      if (await markedCorrect.count() !== 1 || Number(await markedCorrect.getAttribute("data-option")) !== expectedCorrectAnswers[questionIndex]) {
        errors.push(`${viewport.name} question ${questionIndex + 1} has incorrect answer logic`);
      }
    }

    if (viewport.name === "mobile") {
      const toggle = page.locator(".nav-toggle");
      await toggle.click();
      if (await toggle.getAttribute("aria-expanded") !== "true" || !(await page.locator(".course-links").isVisible())) {
        errors.push("mobile navigation did not open");
      }
      await toggle.click();
    }

    if (process.env.VERIFY_SCREENSHOTS === "true") {
      await page.screenshot({ path: `.verification-${viewport.name}.png`, fullPage: true });
    }

    await page.close();
  }
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Desktop, laptop, tablet, and mobile course verification passed with no browser, request, or layout errors.");
}
