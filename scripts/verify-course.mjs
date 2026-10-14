import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { access, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const productionDist = path.resolve("dist");
const verificationDist = path.resolve(".verification-dist");
const astroCli = path.resolve("node_modules", "astro", "bin", "astro.mjs");
const errors = [];

const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const componentViewports = [
  { width: 320, height: 568 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

const labelFor = ({ width, height }) => `${width}x${height}`;
const fail = (condition, message) => { if (condition) errors.push(message); };

const fileExists = async (filename) => {
  try { await access(filename); return true; } catch { return false; }
};

const parseHex = (value) => {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const expanded = match[1].length === 3 ? [...match[1]].map((character) => character.repeat(2)).join("") : match[1];
  return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16));
};

const luminance = (rgb) => {
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (first, second) => {
  const firstRgb = parseHex(first);
  const secondRgb = parseHex(second);
  if (!firstRgb || !secondRgb) return 0;
  const firstLuminance = luminance(firstRgb);
  const secondLuminance = luminance(secondRgb);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
};

const monitor = (page, label, allowedOrigin) => {
  page.on("pageerror", (error) => errors.push(`${label} page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label} console error: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${label} HTTP ${response.status()}: ${response.url()}`);
  });
  page.on("requestfailed", (request) => errors.push(`${label} request failed: ${request.url()}`));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== allowedOrigin) {
      errors.push(`${label} made an external runtime request: ${request.url()}`);
    }
  });
};

const checkFocus = async (page, selector, label) => {
  const control = page.locator(selector).first();
  await control.focus();
  const focus = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: Number.parseFloat(style.outlineWidth), color: style.outlineColor };
  });
  fail(!Number.isFinite(focus.width) || focus.width < 2, `${label} has no substantial focus outline`);
  fail(focus.color === "transparent" || focus.color === "rgba(0, 0, 0, 0)", `${label} has a transparent focus outline`);
};

await rm(verificationDist, { recursive: true, force: true });

try {
  fail(!(await fileExists(path.join(productionDist, "index.html"))), "production output is missing; run npm run build before npm run verify");
  fail(await fileExists(path.join(productionDist, "assets", "README.md")), "author asset guidance is present in production output");
  fail(await fileExists(path.join(productionDist, "__verify-components", "index.html")), "verification fixture leaked into production output");

  await execFileAsync(process.execPath, [astroCli, "build", "--outDir", verificationDist], {
    cwd: process.cwd(),
    env: { ...process.env, COURSE_VERIFY_COMPONENTS: "1" },
  });

  fail(!(await fileExists(path.join(verificationDist, "__verify-components", "index.html"))), "component verification route was not generated");
  fail(await fileExists(path.join(verificationDist, "assets", "README.md")), "author asset guidance leaked into the verification build");

  const mimeTypes = {
    ".css": "text/css",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
      let target = path.resolve(verificationDist, `.${pathname}`);
      if (!target.startsWith(`${verificationDist}${path.sep}`) && target !== verificationDist) throw new Error("Invalid path");
      if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
      response.writeHead(200, { "Content-Type": mimeTypes[path.extname(target)] ?? "application/octet-stream" });
      response.end(await readFile(target));
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewport of viewports) {
      const label = labelFor(viewport);
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      monitor(page, label, baseUrl);
      const response = await page.goto(baseUrl, { waitUntil: "networkidle" });

      fail(!response?.ok(), `${label} returned HTTP ${response?.status() ?? "unknown"}`);
      fail((await page.title()) !== "Course title", `${label} metadata title is incorrect`);
      fail((await page.locator("[data-nav-section]").count()) !== 3, `${label} section navigation is incomplete`);
      fail((await page.locator(".skip-link").count()) !== 1, `${label} skip link is missing`);
      fail(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior !== "auto"), `${label} reduced-motion styles are not active`);
      fail(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${label} has horizontal overflow`);
      fail(await page.evaluate(() => Object.keys(localStorage).length > 0 || Object.keys(sessionStorage).length > 0), `${label} writes browser storage`);

      const courseTypography = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const heroHeading = getComputedStyle(document.querySelector(".hero h1"));
        const sectionHeading = getComputedStyle(document.querySelector(".section-heading h2"));
        return {
          bodySize: Number.parseFloat(body.fontSize),
          bodyLineHeight: Number.parseFloat(body.lineHeight),
          family: body.fontFamily,
          heroSize: Number.parseFloat(heroHeading.fontSize),
          sectionSize: Number.parseFloat(sectionHeading.fontSize),
        };
      });
      fail(Math.abs(courseTypography.bodySize - 18) > 0.1, `${label} does not use the 1.125rem course body size`);
      fail(courseTypography.bodyLineHeight < courseTypography.bodySize * 1.5, `${label} course body line height is too tight`);
      fail(!courseTypography.family.includes("Arial Nova"), `${label} does not expose the local Arial Nova fallback stack`);
      fail(courseTypography.heroSize <= courseTypography.sectionSize, `${label} main course display heading does not outrank section headings`);

      const geometry = await page.evaluate(() => {
        const bounds = (selector) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect && { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        };
        const selectors = [".site-header", ".course-nav", ".hero", ".hero-grid", ".content-grid", ".interaction-layout", ".course-footer", ".footer-inner", ".reveal-example"];
        return {
          items: selectors.map((selector) => ({ selector, ...bounds(selector) })),
          header: bounds(".site-header"),
          hero: bounds(".hero"),
          nav: bounds(".course-nav"),
          heroContainer: bounds(".hero .container"),
          footerContainer: bounds(".footer-inner"),
        };
      });
      for (const item of geometry.items) {
        fail(item.left < -1 || item.right > viewport.width + 1, `${label} ${item.selector} is clipped or outside the viewport`);
      }
      fail(Math.abs(geometry.header.bottom - geometry.hero.top) > 1, `${label} has a gap or overlap below the sticky header`);
      fail(Math.abs(geometry.nav.left - geometry.heroContainer.left) > 1 || Math.abs(geometry.nav.left - geometry.footerContainer.left) > 1, `${label} header, content and footer containers are misaligned`);

      await page.keyboard.press("Tab");
      const skipLink = page.locator(".skip-link");
      fail(!(await skipLink.evaluate((element) => element === document.activeElement)) || !(await skipLink.isVisible()), `${label} skip link is not keyboard-visible`);
      await checkFocus(page, ".skip-link", `${label} skip link`);
      await skipLink.press("Enter");
      fail((await page.evaluate(() => location.hash)) !== "#main-content", `${label} skip link did not target main content`);

      const toggle = page.locator(".nav-toggle");
      if (viewport.width <= 768) {
        await checkFocus(page, ".nav-toggle", `${label} mobile navigation control`);
        await toggle.press("Enter");
        fail((await toggle.getAttribute("aria-expanded")) !== "true" || !(await page.locator(".course-links").isVisible()), `${label} mobile navigation did not open`);
        fail((await toggle.locator(".sr-only").textContent()) !== "Close course navigation", `${label} mobile navigation label did not announce its open state`);

        await page.locator('.course-links a[href="#content"]').click();
        fail((await toggle.getAttribute("aria-expanded")) !== "false", `${label} mobile navigation did not close after selection`);
        fail((await page.evaluate(() => location.hash)) !== "#content", `${label} mobile section link did not update the URL`);

        const anchorOffset = await page.evaluate(() => ({
          headerBottom: document.querySelector(".site-header").getBoundingClientRect().bottom,
          targetTop: document.querySelector("#content").getBoundingClientRect().top,
        }));
        fail(anchorOffset.targetTop < anchorOffset.headerBottom - 1, `${label} anchor target is hidden behind the header`);

        await toggle.click();
        await toggle.press("Escape");
        fail((await toggle.getAttribute("aria-expanded")) !== "false", `${label} mobile navigation did not close with Escape`);
        fail(!(await toggle.evaluate((element) => element === document.activeElement)), `${label} mobile navigation did not restore focus after Escape`);

        if (viewport.width === 768) {
          await toggle.click();
          await page.setViewportSize({ width: 1024, height: 768 });
          await page.waitForFunction(() => document.querySelector(".nav-toggle")?.getAttribute("aria-expanded") === "false");
          fail((await toggle.getAttribute("aria-expanded")) !== "false", "mobile navigation retained expanded state after crossing to desktop");
          await page.setViewportSize(viewport);
          fail(await page.locator(".course-links").isVisible(), "mobile navigation remained visible after returning below the breakpoint");
        }
      } else {
        await checkFocus(page, '.course-links a[href="#content"]', `${label} desktop navigation link`);
        await page.locator('.course-links a[href="#content"]').click();
        const anchorOffset = await page.evaluate(() => ({
          headerBottom: document.querySelector(".site-header").getBoundingClientRect().bottom,
          targetTop: document.querySelector("#content").getBoundingClientRect().top,
        }));
        fail(anchorOffset.targetTop < anchorOffset.headerBottom - 1, `${label} anchor target is hidden behind the header`);
      }

      const reveal = page.locator(".reveal-button");
      await checkFocus(page, ".reveal-button", `${label} reveal control`);
      await reveal.press("Enter");
      fail((await reveal.getAttribute("aria-expanded")) !== "true" || !(await page.locator(".reveal-response").isVisible()), `${label} keyboard interaction did not reveal content`);
      fail((await reveal.locator("span:first-child").textContent()) !== "Hide key point", `${label} reveal control did not expose its close label`);
      await reveal.press("Space");
      fail((await reveal.getAttribute("aria-expanded")) !== "false" || await page.locator(".reveal-response").isVisible(), `${label} keyboard interaction did not hide content`);

      await page.locator("#interaction").evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(100);
      fail((await page.locator('.course-links a[aria-current="location"]').getAttribute("href")) !== "#interaction", `${label} final section did not become the active navigation item`);

      const footerLink = page.locator(".footer-inner a");
      await checkFocus(page, ".footer-inner a", `${label} footer link`);
      await footerLink.press("Enter");
      await page.waitForFunction(() => window.scrollY <= 1);
      fail((await page.evaluate(() => window.scrollY)) > 1, `${label} back-to-top control did not return to the document top`);

      if (viewport.width === 1024) {
        const tokens = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          return Object.fromEntries(["--surface", "--ink", "--course-accent-strong", "--focus-on-light", "--focus-on-dark"].map((name) => [name, style.getPropertyValue(name).trim()]));
        });
        fail(contrast(tokens["--focus-on-light"], tokens["--surface"]) < 3, "light-surface focus token has less than 3:1 contrast against the light surface");
        fail(contrast(tokens["--focus-on-dark"], tokens["--ink"]) < 3, "dark-surface focus token has less than 3:1 contrast against the navigation/footer surface");
        fail(contrast(tokens["--focus-on-dark"], tokens["--course-accent-strong"]) < 3, "dark-surface focus token has less than 3:1 contrast against the course accent surface");

        await page.locator('.course-links a[href="#overview"]').evaluate((element) => element.setAttribute("aria-current", "location"));
        const activeStyle = await page.locator('.course-links a[href="#overview"]').evaluate((element) => {
          const style = getComputedStyle(element); return `${style.backgroundColor}|${style.borderBottomColor}`;
        });
        await page.locator('.course-links a[href="#content"]').hover();
        const hoverStyle = await page.locator('.course-links a[href="#content"]').evaluate((element) => {
          const style = getComputedStyle(element); return `${style.backgroundColor}|${style.borderBottomColor}`;
        });
        fail(activeStyle === hoverStyle, "navigation hover and active-section styles are not distinguishable");
      }

      await context.close();
    }

    for (const viewport of componentViewports) {
      const label = `components ${labelFor(viewport)}`;
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      monitor(page, label, baseUrl);
      const response = await page.goto(`${baseUrl}/__verify-components/`, { waitUntil: "networkidle" });

      fail(!response?.ok(), `${label} returned HTTP ${response?.status() ?? "unknown"}`);
      fail(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${label} has horizontal page overflow`);
      fail((await page.locator(".section-heading").count()) !== 2, `${label} did not render SectionHeading variants`);
      fail((await page.locator(".info-callout").count()) !== 3, `${label} did not render InfoCallout variants`);
      fail((await page.locator(".responsive-table").count()) !== 2, `${label} did not render ResponsiveTable variants`);
      fail((await page.locator('.dialogue[role="group"]').count()) !== 1, `${label} did not render the labelled DialogueBlock`);
      fail((await page.locator(".verification-typography .qc-type").count()) < 8, `${label} did not render TypeText role specimens`);
      fail((await page.locator(".verification-typography .qc-text-layout").count()) !== 4, `${label} did not render TextLayout specimens`);
      fail((await page.locator(".verification-typography .qc-quote").count()) !== 2, `${label} did not render QuoteBlock variants`);
      fail((await page.locator(".verification-typography .qc-statistic").count()) !== 1, `${label} did not render StatisticBlock`);
      fail((await page.locator(".verification-typography .qc-definition-list").count()) !== 1, `${label} did not render DefinitionList`);

      const typeRules = await page.evaluate(() => {
        const read = (selector) => getComputedStyle(document.querySelector(selector));
        const body = read("body");
        const roleDefault = read(".verification-role-default");
        const headingMedium = read(".verification-role-heading-md");
        const explicitWeight = read(".verification-role-explicit-weight");
        const localOverride = read(".verification-role-local-override");
        const compactRole = read(".qc-type--body-compact");
        const list = read(".verification-list");
        const defaultQuote = read(".qc-quote--family-sans");
        const serifQuote = read(".qc-quote--family-serif");
        const nativeSizes = [...document.querySelectorAll(".verification-native-headings > *")].map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
        const columns = (selector) => getComputedStyle(document.querySelector(selector)).gridTemplateColumns.split(" ").filter(Boolean).length;
        return {
          bodySize: Number.parseFloat(body.fontSize),
          bodyLineHeight: Number.parseFloat(body.lineHeight),
          bodyFamily: body.fontFamily,
          roleDefaultWeight: roleDefault.fontWeight,
          headingMediumSize: Number.parseFloat(headingMedium.fontSize),
          headingMediumWeight: headingMedium.fontWeight,
          explicitWeight: explicitWeight.fontWeight,
          localOverrideSize: Number.parseFloat(localOverride.fontSize),
          compactSize: Number.parseFloat(compactRole.fontSize),
          listStyle: list.listStyleType,
          defaultQuoteFamily: defaultQuote.fontFamily,
          serifQuoteFamily: serifQuote.fontFamily,
          nativeSizes,
          twoColumns: columns(".qc-text-layout--two-equal"),
          pullQuoteColumns: columns(".qc-text-layout--pull-quote"),
          threeColumns: columns(".qc-text-layout--three"),
        };
      });
      fail(Math.abs(typeRules.bodySize - 18) > 0.1, `${label} body role is not 1.125rem`);
      fail(typeRules.bodyLineHeight < typeRules.bodySize * 1.5, `${label} body role line height is below 1.5`);
      fail(!typeRules.bodyFamily.includes("Arial Nova"), `${label} sans stack does not start with the local Arial Nova option`);
      fail(typeRules.roleDefaultWeight !== "700", `${label} TypeText default weight overrides the heading-large role weight`);
      fail(typeRules.headingMediumWeight !== "650", `${label} heading-medium role weight is incorrect`);
      fail(typeRules.explicitWeight !== "500", `${label} explicit TypeText weight did not override the role weight`);
      fail(Math.abs(typeRules.localOverrideSize - 32) > 0.1 || Math.abs(typeRules.localOverrideSize - typeRules.headingMediumSize) < 1, `${label} scoped size override is missing or leaked`);
      fail(typeRules.listStyle === "none", `${label} native list markers were not restored after the CSS reset`);
      fail(!typeRules.defaultQuoteFamily.includes("Arial Nova"), `${label} QuoteBlock does not default to sans`);
      fail(!typeRules.serifQuoteFamily.includes("Georgia"), `${label} QuoteBlock serif option is unavailable`);
      fail(typeRules.nativeSizes.length !== 6 || typeRules.nativeSizes.some((size, index) => index > 0 && size > typeRules.nativeSizes[index - 1] + 0.1), `${label} native h1-h6 defaults do not form a complete hierarchy`);
      const expectedColumns = viewport.width < 640 ? 1 : 2;
      fail(typeRules.twoColumns !== expectedColumns || typeRules.pullQuoteColumns !== expectedColumns, `${label} two-column typography layouts do not stack responsively`);
      fail(typeRules.threeColumns !== (viewport.width < 960 ? 1 : 3), `${label} three-column typography layout uses the wrong responsive column count`);

      await page.evaluate(() => document.body.classList.add("verification-course-override"));
      await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.body).fontSize) === 20);
      const courseOverride = await page.evaluate(() => {
        const bodySize = Number.parseFloat(getComputedStyle(document.body).fontSize);
        const headingSize = Number.parseFloat(getComputedStyle(document.querySelector(".verification-role-default")).fontSize);
        const compactSize = Number.parseFloat(getComputedStyle(document.querySelector(".qc-type--body-compact")).fontSize);
        return { bodySize, headingSize, compactSize };
      });
      await page.evaluate(() => document.body.classList.remove("verification-course-override"));
      await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.body).fontSize) === 18);
      const restoredBodySize = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.body).fontSize));
      fail(Math.abs(courseOverride.bodySize - 20) > 0.1, `${label} course-wide body-size override produced ${courseOverride.bodySize}px instead of 20px`);
      fail(courseOverride.headingSize <= typeRules.headingMediumSize, `${label} responsive course-wide heading override did not affect its intended role`);
      fail(Math.abs(courseOverride.compactSize - typeRules.compactSize) > 0.1, `${label} course-wide role override changed unrelated compact text`);
      fail(Math.abs(restoredBodySize - 18) > 0.1, `${label} course-wide override did not restore cleanly`);

      const alignments = await page.locator(".section-heading").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).textAlign));
      fail(alignments[0] !== "center" || alignments[1] !== "left", `${label} SectionHeading alignment variants are incorrect`);

      const calloutBackgrounds = await page.locator(".info-callout").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).backgroundColor));
      fail(new Set(calloutBackgrounds).size !== 3, `${label} InfoCallout tone variants are not distinct`);

      for (const table of ["#fixture-table-light", "#fixture-table-dark"]) {
        const region = page.locator(table);
        const containment = await region.evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
          hint: element.getAttribute("aria-describedby"),
        }));
        fail(containment.left < -1 || containment.right > viewport.width + 1, `${label} ${table} escapes its container`);
        fail(!containment.hint || (await page.locator(`#${containment.hint}`).count()) !== 1, `${label} ${table} is not associated with its scroll hint`);
        if (viewport.width === 320) fail(containment.scrollWidth <= containment.clientWidth, `${label} ${table} did not exercise contained horizontal scrolling`);
        await checkFocus(page, table, `${label} ${table}`);
      }

      await checkFocus(page, ".info-callout--navy a", `${label} dark callout link`);

      const dialogue = await page.locator(".dialogue").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const blocks = [...element.children].map((child) => child.getBoundingClientRect());
        const paragraph = element.querySelector("p");
        const style = getComputedStyle(paragraph);
        return {
          left: rect.left,
          right: rect.right,
          overlaps: blocks.some((block, index) => index > 0 && block.top < blocks[index - 1].bottom - 1),
          lineHeight: Number.parseFloat(style.lineHeight),
          fontSize: Number.parseFloat(style.fontSize),
        };
      });
      fail(dialogue.left < -1 || dialogue.right > viewport.width + 1 || dialogue.overlaps, `${label} dialogue is clipped or overlapping`);
      fail(dialogue.lineHeight < dialogue.fontSize * 1.4, `${label} dialogue line spacing is too tight`);

      await context.close();
    }

    const resizeContext = await browser.newContext({ viewport: { width: 640, height: 450 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const resizePage = await resizeContext.newPage();
    monitor(resizePage, "components 200% browser-zoom equivalent", baseUrl);
    const resizeResponse = await resizePage.goto(`${baseUrl}/__verify-components/`, { waitUntil: "networkidle" });
    fail(!resizeResponse?.ok(), `components 200% browser-zoom equivalent returned HTTP ${resizeResponse?.status() ?? "unknown"}`);
    const resized = await resizePage.evaluate(() => ({
      cssWidth: window.innerWidth,
      deviceScaleFactor: window.devicePixelRatio,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      clippedText: [...document.querySelectorAll(".qc-type")].some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
      }),
    }));
    fail(resized.cssWidth !== 640 || resized.deviceScaleFactor !== 2, "200% browser-zoom equivalent did not use the expected 640 CSS-pixel viewport at 2x scale");
    fail(resized.overflow || resized.clippedText, "typography fixture overflows or clips at the 200% browser-zoom equivalent");
    await resizeContext.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
} catch (error) {
  errors.push(`verification setup failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await rm(verificationDist, { recursive: true, force: true });
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Starter verification passed: ${viewports.map(labelFor).join(", ")}; responsive navigation and anchors; active-section and back-to-top behaviour; keyboard and reduced-motion support; theme focus contrast; storage and external-request checks; typography roles and overrides; a 200% browser-zoom equivalent; and reusable component fixtures at ${componentViewports.map(labelFor).join(", ")}.`);
}
