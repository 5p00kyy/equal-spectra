import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const load = (file) => readFile(path.join(root, file), "utf8");
let html = await load("index.html");
const css = await load("src/styles.css");
const math = await load("src/math.js");
const app = await load("src/app.js");
// The website remains modular. This optional artifact makes just the preview
// portable, so it works from a downloaded file without any local web server.
const exports = [...math.matchAll(/^export (?:const|function) (\w+)/gm)].map(
  (m) => m[1],
);
const wrappedMath =
  "const { " +
  exports.join(", ") +
  " } = (() => {\n" +
  math.replace(/^export /gm, "") +
  "\nreturn { " +
  exports.join(", ") +
  " };\n})();\n";
const withoutImport = app.replace(
  /^import[\s\S]*?from ['"]\.\/math\.js['"];?\s*/m,
  "",
);
if (withoutImport === app)
  throw Error("Expected the app math import; inspect module structure.");
const script = (wrappedMath + withoutImport).replace(
  /<\/script/gi,
  "<\\/script",
);
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="\.\/src\/styles\.css"\s*\/?>/,
  () => "<style>" + css + "</style>",
);
html = html.replace(
  /<script\s+type="module"\s+src="\.\/src\/app\.js"\s*>\s*<\/script>/,
  () => '<script type="module">' + script + "</script>",
);
const embeds = {
  "./assets/witness-pairs.svg": ["image/svg+xml", "assets/witness-pairs.svg"],
  "./assets/equal-mark.svg": ["image/svg+xml", "assets/equal-mark.svg"],
  "./downloads/research-note.pdf": [
    "application/pdf",
    "downloads/research-note.pdf",
  ],
  "./research/note.html": ["text/html", "research/note.html"],
  "./src/math.js": ["text/javascript", "src/math.js"],
  "./test/math.test.js": ["text/javascript", "test/math.test.js"],
  "./research/verify-homometric.js": [
    "text/javascript",
    "research/verify-homometric.js",
  ],
  "./research/verify-risk-amplification.js": [
    "text/javascript",
    "research/verify-risk-amplification.js",
  ],
  "./README.md": ["text/plain", "README.md"],
};
const downloadNames = new Map();
for (const [url, [mime, file]] of Object.entries(embeds)) {
  const encoded = (await readFile(path.join(root, file))).toString("base64");
  const dataUrl = "data:" + mime + ";base64," + encoded;
  downloadNames.set(dataUrl, path.basename(file));
  html = html.replaceAll('"' + url + '"', '"' + dataUrl + '"');
}
// Browsers block some top-level data-URL navigations. Named downloads work
// offline and preserve useful filenames for both the note and source files.
html = html.replace(
  /<a\b([^>]*?)href="(data:[^"]+)"([^>]*)>/g,
  (_, before, url, after) =>
    "<a" +
    before +
    'href="' +
    url +
    '"' +
    after.replace(/\sdownload(?:="[^"]*")?/g, "") +
    ' download="' +
    downloadNames.get(url) +
    '">',
);
// The home link stays in this document, not the containing filesystem folder.
html = html.replace(/(<a\b[^>]*?)href="\.\/"/g, '$1href="#"');
if (/(?:src|href)="\.\//.test(html))
  throw Error("Unembedded relative asset remains in offline preview.");
await mkdir(path.join(root, "dist"), { recursive: true });
await writeFile(path.join(root, "dist/equal-spectra-preview.html"), html);
console.log(
  "Offline preview built: dist/equal-spectra-preview.html (" +
    Buffer.byteLength(html) +
    " bytes)",
);
