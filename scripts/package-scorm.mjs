import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { writeZip } from "./scorm-zip.mjs";

const dist = path.resolve("dist");
const entry = await readFile(path.join(dist, "index.html"), "utf8");
const configText = entry.match(/<script\b[^>]*data-course-config[^>]*>([\s\S]*?)<\/script>/)?.[1];
if (!configText) throw new Error("Build the course before packaging: course configuration is missing from dist/index.html.");
const config = JSON.parse(configText);
const lessons = config.lessons;
const packageConfig = config.package;
const routeFiles = lessons.map(({ path: route }) => `${route.replace(/^\//, "")}index.html`);
if (config.identity.title !== packageConfig.title || packageConfig.launchFile !== "index.html") throw new Error("Browser and manifest titles or launch path do not match.");
if (!/^[a-z][a-z0-9-]*$/.test(packageConfig.identifier) || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/.test(packageConfig.filename)) throw new Error("Unsafe package identity.");

const files = [];
async function collect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) await collect(absolute);
    else if (item.isFile()) files.push(path.relative(dist, absolute).replaceAll(path.sep, "/"));
  }
}
await collect(dist);
if (files.some((name) => name.startsWith("__verify-"))) throw new Error("Verification fixtures must not be packaged.");
for (const file of routeFiles) if (!files.includes(file)) throw new Error(`Configured lesson output is missing: ${file}`);
files.sort();
const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${escapeXml(packageConfig.identifier)}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="course-organization"><organization identifier="course-organization"><title>${escapeXml(packageConfig.title)}</title><item identifier="course-item" identifierref="course-resource"><title>${escapeXml(packageConfig.title)}</title></item></organization></organizations>
  <resources><resource identifier="course-resource" type="webcontent" adlcp:scormtype="sco" href="index.html">
${files.map((name) => `    <file href="${escapeXml(name)}"/>`).join("\n")}
  </resource></resources>
</manifest>
`;
const routes = new Set(lessons.map((lesson) => lesson.path));
const entries = [["imsmanifest.xml", Buffer.from(manifest)]];
for (const name of files) {
  let bytes = await readFile(path.join(dist, ...name.split("/")));
  if (name.endsWith(".html")) {
    const depth = name.split("/").length - 1;
    const prefix = depth ? "../".repeat(depth) : "./";
    const html = bytes.toString("utf8")
      .replace(/<html\b/i, '<html data-scorm-package="true"')
      .replace(/\b(href|src|poster|data-image-src)="\/(?!\/)([^"]*)"/g, (_match, attribute, target) => {
        const logicalRoute = `/${target}`;
        return `${attribute}="${prefix}${attribute === "href" && routes.has(logicalRoute) ? `${target}index.html` : target}"`;
      });
    bytes = Buffer.from(html);
  } else if (name.endsWith(".css")) {
    bytes = Buffer.from(bytes.toString("utf8").replace(/url\((['"]?)\/(?!\/)/g, "url($1../"));
  }
  entries.push([name, bytes]);
}
const output = path.resolve("scorm-output", packageConfig.filename);
await writeZip(output, entries);
console.log(`SCORM 1.2 package: ${output}`);
