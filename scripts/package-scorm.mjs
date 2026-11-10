import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeZip } from "./scorm-zip.mjs";

const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const routeFile = (route) => route === "/" ? "overview.html" : `${route.slice(1)}index.html`;
const sourceFile = (route) => `${route.slice(1)}index.html`;

async function collect(directory, root, files = []) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) await collect(absolute, root, files);
    else if (item.isFile()) files.push(path.relative(root, absolute).replaceAll(path.sep, "/"));
  }
  return files;
}

// Package local URLs against each output member's real directory. Preserve
// query/hash text and leave protocol, data, and external URLs alone.
function rewriteHtml(html, name, routes) {
  const depth = name.split("/").length - 1;
  const prefix = depth ? "../".repeat(depth) : "./";
  const local = (value, attribute) => {
    if (attribute === "href" && value.startsWith("#")) return `${prefix}${name}${value}`;
    if (!value.startsWith("/") || value.startsWith("//")) return value;
    const match = value.match(/^([^?#]*)(.*)$/s);
    const pathname = match?.[1] || value;
    const suffix = match?.[2] || "";
    const file = attribute === "href" && routes.has(pathname) ? routeFile(pathname) : pathname.slice(1);
    return `${prefix}${file}${suffix}`;
  };
  const rewritten = html
    .replace(/<html\b/i, '<html data-scorm-package="true"')
    .replace(/<title>[^<]*<\/title>/i, "<title>Content</title>")
    .replace(/\b(href|src|poster|data-image-src|srcset)=(['"])(.*?)\2/gs, (full, attribute, quote, value) => {
      if (attribute === "srcset") {
        return `${attribute}=${quote}${value.split(",").map((part) => part.replace(/^(\s*)\/(?!\/)(\S*)/, (_all, space, target) => `${space}${local(`/${target}`, attribute)}`)).join(",")}${quote}`;
      }
      return `${attribute}=${quote}${local(value, attribute)}${quote}`;
    })
    .replace(/url\((\s*['"]?)\/(?!\/)([^)'"\s]+)(['"]?\s*)\)/g, (_all, before, target, after) => `url(${before}${prefix}${target}${after})`);
  if (!/<title>Content<\/title>/i.test(rewritten)) throw new Error(`Missing browser title in ${name}.`);
  return rewritten;
}

export async function packageCourse({ source = path.resolve("dist"), entryName = "index.html", output } = {}) {
  const entry = await readFile(path.join(source, ...entryName.split("/")), "utf8");
  const configText = entry.match(/<script\b[^>]*data-course-config[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!configText) throw new Error("Build the course before packaging: course configuration is missing from the entry HTML.");
  const config = JSON.parse(configText);
  const lessons = config.lessons;
  const packageConfig = config.package;
  if (!Array.isArray(lessons) || !lessons.length || lessons[0].path !== "/") throw new Error("Configured lesson routes are invalid.");
  if (config.navigationMode === "sections" && lessons.length !== 1) throw new Error("A One-scroll package must have one learner document.");
  if (packageConfig.title !== "Content" || packageConfig.launchFile !== "index.html") throw new Error("SCORM browser and manifest metadata must use Content and index.html.");
  if (!/^[a-z][a-z0-9-]*$/.test(packageConfig.identifier) || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/.test(packageConfig.filename)) throw new Error("Unsafe package identity.");
  const allFiles = await collect(source, source);
  const fixture = entryName !== "index.html";
  const sourceFiles = fixture ? allFiles.filter((name) => name === entryName || (!name.startsWith("__verify-") && !name.endsWith(".html"))) : allFiles;
  if (!fixture && sourceFiles.some((name) => name.startsWith("__verify-"))) throw new Error("Verification fixtures must not be packaged.");
  const sourceSet = new Set(sourceFiles);
  for (const lesson of lessons) {
    const file = lesson.path === "/" ? entryName : sourceFile(lesson.path);
    if (!sourceSet.has(file)) throw new Error(`Configured lesson output is missing: ${file}`);
  }
  const reserved = new Set(["imsmanifest.xml", "overview.html", "scorm/runtime.js"]);
  if (sourceFiles.some((name) => reserved.has(name)) || (fixture && sourceSet.has("index.html"))) throw new Error("A generated SCORM output path conflicts with a source file.");
  const routes = new Map(lessons.map((lesson) => [lesson.path, routeFile(lesson.path)]));
  const outputFiles = new Map();
  for (const name of sourceFiles) {
    const destination = name === entryName ? "overview.html" : name;
    if (outputFiles.has(destination)) throw new Error(`Duplicate package output: ${destination}`);
    let bytes = await readFile(path.join(source, ...name.split("/")));
    if (destination.endsWith(".html")) bytes = Buffer.from(rewriteHtml(bytes.toString("utf8"), destination, routes));
    else if (destination.endsWith(".css")) {
      const prefix = "../".repeat(destination.split("/").length - 1);
      bytes = Buffer.from(bytes.toString("utf8").replace(/url\((\s*['"]?)\/(?!\/)([^)'"\s]+)(['"]?\s*)\)/g, (_all, before, target, after) => `url(${before}${prefix}${target}${after})`));
    }
    outputFiles.set(destination, bytes);
  }
  const launcher = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Content</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}#course{display:block;width:100%;height:100%;border:0}#launch-error{position:absolute;inset:0;z-index:1;padding:2rem;background:#fff;color:#17232b;font:1rem system-ui,sans-serif}</style></head><body><p id="launch-error" role="alert" hidden>LMS progress is unavailable. Reopen the course from your learning platform before continuing.</p><iframe id="course" name="course" title="Course content"></iframe><script type="application/json" data-launch-config>${JSON.stringify({ routes: [...routes] }).replaceAll("<", "\\u003c")}</script><script src="./scorm/runtime.js" defer></script></body></html>`;
  outputFiles.set("index.html", Buffer.from(launcher));
  outputFiles.set("scorm/runtime.js", await readFile(path.resolve("scripts/scorm-launcher-runtime.js")));
  const names = [...outputFiles.keys()].sort();
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>\n<manifest identifier="${escapeXml(packageConfig.identifier)}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">\n  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>\n  <organizations default="course-organization"><organization identifier="course-organization"><title>Content</title><item identifier="course-item" identifierref="course-resource"><title>Content</title></item></organization></organizations>\n  <resources><resource identifier="course-resource" type="webcontent" adlcp:scormtype="sco" href="index.html">\n${names.map((name) => `    <file href="${escapeXml(name)}"/>`).join("\n")}\n  </resource></resources>\n</manifest>\n`;
  const filename = output || path.resolve("scorm-output", packageConfig.filename);
  await writeZip(filename, [["imsmanifest.xml", Buffer.from(manifest)], ...names.map((name) => [name, outputFiles.get(name)])]);
  return { filename, config, files: names };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await packageCourse();
  console.log(`SCORM 1.2 package: ${result.filename}`);
}
