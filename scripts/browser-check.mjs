import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4179/equal-spectra/";
const out = process.env.QA_OUTPUT || "qa";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  chromiumSandbox: true,
});
const report = { checks: [], screens: [] };
function check(condition, name) {
  assert.ok(condition, name);
  report.checks.push(name);
}
async function change(page, selector, value) {
  await page.locator(selector).fill(String(value));
  await page.locator(selector).dispatchEvent("input");
}
try {
  for (const width of [1440, 390, 360]) {
    const page = await browser.newPage({
      viewport: { width, height: 1000 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const errors = [],
      badResponses = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) badResponses.push(r.url());
    });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator("#track-a button").first().waitFor();
    const brokenAnchors = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="#"]')]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h.length > 1 && !document.getElementById(h.slice(1))),
    );
    check(brokenAnchors.length === 0, width + " section anchors resolve");
    if (width === 1440 && base.startsWith("http")) {
      const links = await page.evaluate(() => [
        ...new Set(
          [...document.querySelectorAll("a[href]")]
            .map((a) => a.href.split("#")[0])
            .filter((h) => h.startsWith(location.origin)),
        ),
      ]);
      for (const url of links) {
        const r = await page.request.get(url);
        check(r.status() === 200, "source link " + url.split("/").pop());
      }
    }
    check(
      (await page.locator("#track-a button").count()) === 7,
      width + " A controls",
    );
    check(
      (await page.locator("#track-b button").count()) === 7,
      width + " B controls",
    );
    const bounds = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      targets: [...document.querySelectorAll(".array-track button")].map(
        (e) => {
          const r = e.getBoundingClientRect();
          return {
            key: e.dataset.array,
            pos: e.dataset.position,
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
          };
        },
      ),
    }));
    check(
      bounds.scroll <= bounds.width,
      width + " no horizontal page overflow",
    );
    check(
      bounds.targets.every((t) => t.w >= 43.9 && t.h >= 43.9),
      width + " 44px sensor targets",
    );
    for (const a of bounds.targets)
      for (const b of bounds.targets)
        if (a.key === b.key && Number(a.pos) < Number(b.pos))
          check(
            !(
              a.x < b.x + b.w - 0.5 &&
              a.x + a.w > b.x + 0.5 &&
              a.y < b.y + b.h - 0.5 &&
              a.y + a.h > b.y + 0.5
            ),
            width + " nonoverlap " + a.key + a.pos + "/" + b.pos,
          );
    const traces = await page
      .locator("#spectrum-plot path")
      .evaluateAll((es) =>
        es.map((e) => ({
          d: e.getAttribute("d"),
          stroke: getComputedStyle(e).stroke,
        })),
      );
    check(
      traces.length >= 2 &&
        traces.every(
          (t) =>
            t.d?.length > 50 && t.stroke !== "none" && !t.d.includes("NaN"),
        ),
      width + " visible computed spectral paths",
    );
    const arcError = await page.evaluate(() => {
      let max = 0;
      for (const track of document.querySelectorAll(".array-track")) {
        const nodes = [...track.querySelectorAll("button")].map((b) => {
          const r = b.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        for (const p of track.querySelectorAll("path"))
          for (const t of [0, p.getTotalLength()]) {
            const v = p.getPointAtLength(t).matrixTransform(p.getScreenCTM());
            max = Math.max(
              max,
              Math.min(...nodes.map((n) => Math.hypot(v.x - n.x, v.y - n.y))),
            );
          }
      }
      return max;
    });
    check(arcError < 1.5, width + " witness arcs terminate at sensor centers");
    await page.locator("#guided-delete").click();
    check(
      (await page.locator("#pairs-a").textContent()) === "1",
      width + " A retains one distance-one pair",
    );
    check(
      (await page.locator("#pairs-b").textContent()) === "0",
      width + " B loses distance one",
    );
    check(
      (await page.locator("#status-b").innerText())
        .toLowerCase()
        .includes("missing"),
      width + " missing distance labelled",
    );
    await page.locator("#reset").click();
    const sensor = page.locator('#track-a button[data-position="0"]');
    await sensor.focus();
    await page.keyboard.press("Enter");
    check(
      (await page
        .locator('#track-a button[data-position="0"]')
        .getAttribute("aria-pressed")) === "false",
      width + " keyboard delete",
    );
    check(
      await page.evaluate(
        () =>
          document.activeElement?.dataset.position === "0" &&
          document.activeElement?.dataset.array === "A",
      ),
      width + " keyboard focus retained",
    );
    await page.keyboard.press("Enter");
    check(
      (await page
        .locator('#track-a button[data-position="0"]')
        .getAttribute("aria-pressed")) === "true",
      width + " keyboard restore",
    );
    await page.locator('[data-lag="4"]').click();
    await page.locator('#track-b button[data-position="5"]').click();
    check(
      (await page.locator("#pairs-b").textContent()) === "0",
      width + " independent lag-four example",
    );
    await page.locator("#reset").click();
    await page.locator('[data-lag="1"]').click();
    for (const button of await page.locator("#track-a button").all())
      await button.click();
    check(
      (await page.locator("#status-a .is-lost").count()) === 5,
      width + " empty array loses all five lags",
    );
    await page.locator("#plot-mode").selectOption("current");
    check(
      !(await page.locator("#spectrum-plot").innerHTML()).includes("NaN"),
      width + " empty spectrum remains finite",
    );
    await page.locator("#reset").click();
    await page.locator("#plot-mode").selectOption("intact");
    const q = 'input[type="range"][max="10"]',
      p = 'input[type="range"][max="500"]';
    await change(page, q, 3);
    await change(page, p, 10);
    check(
      (await page.locator("#risk").innerText())
        .replaceAll(",", "")
        .includes("10385"),
      width + " 21-sensor exact ratio",
    );
    check(
      (await page.locator("#risk-table-body tr").count()) === 10,
      width + " complete ten-point data table",
    );
    check(
      (await page
        .locator('#risk-table-body tr[aria-current="true"] th')
        .textContent()) === "21",
      width + " data table selected point",
    );
    await change(page, q, 10);
    await change(page, p, 1);
    check(
      !/(NaN|Infinity|undefined)/.test(await page.locator("#risk").innerText()),
      width + " tiny-risk endpoint formatting",
    );
    await change(page, p, 500);
    check(
      !/(NaN|Infinity|undefined)/.test(await page.locator("#risk").innerText()),
      width + " 50-percent endpoint",
    );
    await change(page, q, 1);
    await change(page, p, 10);
    await page.screenshot({
      path: path.join(out, "page-" + width + ".png"),
      fullPage: true,
    });
    report.screens.push("page-" + width + ".png");
    await page
      .locator("#experiment")
      .screenshot({ path: path.join(out, "experiment-" + width + ".png") });
    if (width === 1440) {
      await page
        .locator(".hero")
        .screenshot({ path: path.join(out, "hero-desktop.png") });
      await change(page, q, 3);
      await page
        .locator("#risk")
        .screenshot({ path: path.join(out, "risk-desktop.png") });
    }
    check(errors.length === 0, width + " no JS errors: " + errors.join(";"));
    check(
      badResponses.length === 0,
      width + " no failed requests: " + badResponses.join(";"),
    );
    if (process.env.AXE_SCRIPT) {
      await page
        .locator("details")
        .evaluateAll((es) => es.forEach((e) => (e.open = true)));
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        width + " expanded proofs and data stay contained",
      );
      await page.addScriptTag({ path: process.env.AXE_SCRIPT });
      const axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        });
        return r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        }));
      });
      report["axe" + width] = axe;
      check(
        axe.length === 0,
        width + " automated accessibility violations: " + JSON.stringify(axe),
      );
    }
    await page.close();
  }
  const page = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  await page.goto(base);
  check(
    (await page.locator("noscript").innerText()).includes("0, 1, 5"),
    "No-JS core example available",
  );
  await page.close();
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} finally {
  await writeFile(
    path.join(out, "browser-report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
