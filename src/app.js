import {
  ARRAYS,
  LAGS,
  pairs,
  histogram,
  power,
  lostLags,
  risk,
} from "./math.js";

const original = { A: [...ARRAYS.A], B: [...ARRAYS.B] };
const state = { A: new Set(original.A), B: new Set(original.B) };
const byId = (id) => document.getElementById(id);
const svgNS = "http://www.w3.org/2000/svg";
const SAMPLE_COUNT = 769;
let selectedLag = 1;
let plotMode = "intact";
let currentRisk;
const announce = document.createElement("div");
announce.className = "sr-only";
announce.setAttribute("aria-live", "polite");
announce.setAttribute("aria-atomic", "true");
document.body.append(announce);
const asPositions = (key) => [...state[key]].sort((a, b) => a - b);
const samples = (positions) =>
  Array.from({ length: SAMPLE_COUNT }, (_, i) =>
    power(positions, (i / (SAMPLE_COUNT - 1)) * 2 * Math.PI),
  );
const intactSamples = { A: samples(original.A), B: samples(original.B) };

function sensorButton(key, position) {
  const present = state[key].has(position);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sensor " + (present ? "is-present" : "is-missing");
  button.dataset.position = position;
  button.dataset.array = key;
  button.setAttribute("aria-pressed", String(present));
  button.setAttribute(
    "aria-label",
    "Array " +
      key +
      ", position " +
      position +
      ", " +
      (present ? "active. Delete sensor." : "deleted. Restore sensor."),
  );
  const label = document.createElement("span");
  label.className = "sensor-position";
  label.textContent = position;
  button.append(label);
  button.addEventListener("click", () => {
    if (state[key].has(position)) state[key].delete(position);
    else state[key].add(position);
    announce.textContent =
      "Array " +
      key +
      ", position " +
      position +
      (state[key].has(position) ? " restored." : " deleted.");
    render();
  });
  return button;
}

function renderTrack(key) {
  const track = byId("track-" + key.toLowerCase());
  track.replaceChildren();
  original[key].forEach((position, index) => {
    const cell = document.createElement("div");
    cell.style.setProperty("--desktop-col", position + 1);
    cell.style.setProperty("--mobile-col", (index % 4) + 1);
    cell.style.setProperty("--mobile-row", Math.floor(index / 4) + 1);
    cell.append(sensorButton(key, position));
    track.append(cell);
  });
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "arc-layer");
  svg.setAttribute("aria-hidden", "true");
  track.prepend(svg);
  drawArcs(key);
}

function drawArcs(key) {
  const track = byId("track-" + key.toLowerCase());
  const svg = track.querySelector("svg");
  const bounds = track.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  svg.setAttribute("viewBox", "0 0 " + bounds.width + " " + bounds.height);
  svg.replaceChildren();
  track
    .querySelectorAll(".is-witness")
    .forEach((button) => button.classList.remove("is-witness"));
  pairs(asPositions(key), selectedLag).forEach((pair) => {
    const centers = pair.map((position) => {
      const button = track.querySelector('[data-position="' + position + '"]');
      button.classList.add("is-witness");
      const rect = button.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - bounds.left,
        y: rect.top + rect.height / 2 - bounds.top,
      };
    });
    const [a, b] = centers;
    const rise = Math.min(30, Math.max(20, Math.abs(b.x - a.x) * 0.22));
    const path = document.createElementNS(svgNS, "path");
    const crossRow = Math.abs(a.y - b.y) > 5;
    const middleY = (a.y + b.y) / 2;
    // Cross-row pairs pass through the row gutter, not through other sensors.
    path.setAttribute(
      "d",
      "M " +
        a.x +
        " " +
        a.y +
        " C " +
        a.x +
        " " +
        (crossRow ? middleY : a.y - rise) +
        ", " +
        b.x +
        " " +
        (crossRow ? middleY : b.y - rise) +
        ", " +
        b.x +
        " " +
        b.y,
    );
    svg.append(path);
  });
}

function renderReadout(key) {
  const positions = asPositions(key);
  const missing = new Set(lostLags(positions));
  const witnesses = pairs(positions, selectedLag);
  const count = witnesses.length;
  const suffix = key.toLowerCase();
  byId("state-" + suffix).textContent =
    (positions.length === 7 ? "Intact" : "Modified") +
    " · " +
    positions.length +
    " / 7 sensors";
  byId("status-" + suffix).innerHTML = LAGS.map(
    (lag) =>
      '<span class="lag-pill ' +
      (missing.has(lag) ? "is-lost" : "") +
      '">' +
      String(lag).padStart(2, "0") +
      " " +
      (missing.has(lag) ? "missing" : "survives") +
      "</span>",
  ).join("");
  byId("pairs-" + suffix).textContent = count;
  byId("witness-label-" + suffix).textContent =
    "Surviving pairs · distance " + selectedLag;
  const list = byId("witness-pairs-" + suffix);
  list.replaceChildren();
  for (const pair of witnesses) {
    const item = document.createElement("li");
    item.textContent = "(" + pair.join(", ") + ")";
    list.append(item);
  }
  if (!count) {
    const item = document.createElement("li");
    item.className = "no-witnesses";
    item.textContent = "None. This distance is lost.";
    list.append(item);
  }
  return { missing, count };
}

function pathFrom(values, left, right, top, bottom, maximum) {
  return values
    .map(
      (value, i) =>
        (i ? "L" : "M") +
        (left + (i / (values.length - 1)) * (right - left)).toFixed(3) +
        " " +
        (bottom - (value / maximum) * (bottom - top)).toFixed(3),
    )
    .join(" ");
}

function renderHeroPlot() {
  for (const key of ["A", "B"])
    byId("hero-power-" + key.toLowerCase()).setAttribute(
      "d",
      pathFrom(intactSamples[key], 42, 548, 28, 174, 49),
    );
}

function renderHistogram() {
  // This measurement is always of the intact originals, independent of VIEW.
  const counts = { A: histogram(original.A), B: histogram(original.B) };
  const plot = byId("distance-histogram");
  const description =
    "Intact arrays. Complete positive-distance histogram. " +
    counts.A.map(
      (count, i) => "Lag " + (i + 1) + ": A " + count + ", B " + counts.B[i],
    ).join("; ") +
    ".";
  plot.setAttribute("aria-label", description);
  byId("histogram-text").textContent = description;
  plot.innerHTML = counts.A.map((count, i) => {
    const b = counts.B[i];
    return (
      '<div class="histogram-bin" aria-hidden="true"><span class="histogram-count">' +
      count +
      '</span><svg viewBox="0 0 24 64" preserveAspectRatio="none"><path class="histogram-bar-a" d="M5 62V' +
      (62 - count * 18) +
      'H19V62Z"/><path class="histogram-bar-b" d="M5 62V' +
      (62 - b * 18) +
      'H19V62"/></svg><span class="histogram-lag">' +
      (i + 1) +
      "</span></div>"
    );
  }).join("");
}

function renderPlot() {
  const plot = byId("spectrum-plot");
  const width = Math.max(300, Math.round(plot.getBoundingClientRect().width));
  const height = Math.max(220, Math.round(plot.getBoundingClientRect().height));
  const left = 43,
    right = width - 10,
    top = 16,
    bottom = height - 16;
  const values =
    plotMode === "intact"
      ? intactSamples
      : { A: samples(asPositions("A")), B: samples(asPositions("B")) };
  const grid = [0, 12, 24, 36, 49]
    .map((value) => {
      const y = bottom - (value / 49) * (bottom - top);
      return (
        '<line class="plot-grid" x1="' +
        left +
        '" y1="' +
        y +
        '" x2="' +
        right +
        '" y2="' +
        y +
        '"/><text class="plot-tick" x="' +
        (left - 6) +
        '" y="' +
        (y + 4) +
        '" text-anchor="end">' +
        value +
        "</text>"
      );
    })
    .join("");
  const verticals = [0, 0.25, 0.5, 0.75, 1]
    .map(
      (f) =>
        '<line class="plot-grid" x1="' +
        (left + f * (right - left)) +
        '" x2="' +
        (left + f * (right - left)) +
        '" y1="' +
        top +
        '" y2="' +
        bottom +
        '"/>',
    )
    .join("");
  plot.innerHTML =
    '<svg viewBox="0 0 ' +
    width +
    " " +
    height +
    '" aria-hidden="true">' +
    grid +
    verticals +
    '<path class="plot-line plot-a" d="' +
    pathFrom(values.A, left, right, top, bottom, 49) +
    '"/><path class="plot-line plot-b" d="' +
    pathFrom(values.B, left, right, top, bottom, 49) +
    '"/></svg>';
  const label =
    plotMode === "intact"
      ? "Intact power spectra"
      : "Current survivor power spectra";
  byId("plot-label").textContent = label;
  plot.setAttribute(
    "aria-label",
    label +
      ". A solid blue, B dashed vermilion. Angular frequency 0 to 2π. Fixed power scale 0 to 49.",
  );
}

function render() {
  const focused = document.activeElement;
  const sensorFocus = focused?.matches("button.sensor")
    ? { key: focused.dataset.array, position: focused.dataset.position }
    : null;
  renderTrack("A");
  renderTrack("B");
  byId("selected-lag-label").innerHTML =
    "SELECTED LAG <strong>" +
    String(selectedLag).padStart(2, "0") +
    "</strong>";
  const a = renderReadout("A"),
    b = renderReadout("B");
  const intact = state.A.size === 7 && state.B.size === 7;
  byId("live-note").textContent = intact
    ? "Equal intact distance counts hide different shared dependencies."
    : "Lag " +
      selectedLag +
      ": A has " +
      a.count +
      " surviving " +
      (a.count === 1 ? "pair" : "pairs") +
      "; B has " +
      b.count +
      ". " +
      (a.count && b.count
        ? "This lag survives in both."
        : !a.count && !b.count
          ? "This lag is missing in both."
          : "This lag is missing in " + (!a.count ? "A" : "B") + " only.");
  document.querySelectorAll("[data-lag]").forEach((button) => {
    const selected = Number(button.dataset.lag) === selectedLag;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  renderPlot();
  if (sensorFocus)
    byId("track-" + sensorFocus.key.toLowerCase())
      .querySelector('[data-position="' + sensorFocus.position + '"]')
      .focus({ preventScroll: true });
}

const probabilityText = (value) =>
  value < 0.0001
    ? value.toExponential(5)
    : Number(value.toPrecision(6)).toString();
function readableRisk(value) {
  if (value >= 0.01)
    return "≈ " + (100 * value).toPrecision(4) + "% probability";
  const inverse = 1 / value;
  const count =
    inverse < 1e6
      ? Math.round(inverse).toLocaleString("en-US")
      : inverse < 1e12
        ? (inverse / (inverse < 1e9 ? 1e6 : 1e9)).toPrecision(3) +
          (inverse < 1e9 ? " million" : " billion")
        : inverse.toExponential(3);
  return "≈ 1 in " + count;
}

function renderRiskPlot(series, q) {
  const plot = byId("risk-plot");
  const width = Math.max(300, Math.round(plot.getBoundingClientRect().width));
  const height = 310,
    left = 49,
    right = width - 15,
    top = 19,
    bottom = 262;
  const minLog = Math.floor(
    Math.log10(Math.min(...series.flatMap((r) => [r.riskA, r.riskB]))),
  );
  const step = Math.max(1, Math.ceil(-minLog / 5));
  const floor = -step * Math.ceil(-minLog / step);
  const y = (value) => top + (Math.log10(value) / floor) * (bottom - top);
  const x = (index) => left + (index / 9) * (right - left);
  let grid = "";
  for (let exponent = 0; exponent >= floor; exponent -= step) {
    const yy = top + (exponent / floor) * (bottom - top);
    grid +=
      '<line class="plot-grid" x1="' +
      left +
      '" x2="' +
      right +
      '" y1="' +
      yy +
      '" y2="' +
      yy +
      '"/><text class="plot-tick" x="' +
      (left - 7) +
      '" y="' +
      (yy + 4) +
      '" text-anchor="end">' +
      (exponent === 0 ? "1" : "1e" + exponent) +
      "</text>";
  }
  const ticks = series
    .map(
      (_, i) =>
        '<text class="plot-tick" x="' +
        x(i) +
        '" y="283" text-anchor="middle">' +
        7 * (i + 1) +
        "</text>",
    )
    .join("");
  const line = (key) =>
    series.map((r, i) => (i ? "L" : "M") + x(i) + " " + y(r[key])).join(" ");
  const selected = series[q - 1];
  plot.innerHTML =
    '<svg viewBox="0 0 ' +
    width +
    " " +
    height +
    '" aria-hidden="true">' +
    grid +
    '<line class="selected-q" x1="' +
    x(q - 1) +
    '" x2="' +
    x(q - 1) +
    '" y1="' +
    top +
    '" y2="' +
    bottom +
    '"/>' +
    '<path class="plot-line plot-a" d="' +
    line("riskA") +
    '"/><path class="plot-line plot-b" d="' +
    line("riskB") +
    '"/><circle class="risk-dot-a" cx="' +
    x(q - 1) +
    '" cy="' +
    y(selected.riskA) +
    '" r="4"/><circle class="risk-dot-b" cx="' +
    x(q - 1) +
    '" cy="' +
    y(selected.riskB) +
    '" r="4"/>' +
    ticks +
    '<text class="plot-tick" x="' +
    (left + right) / 2 +
    '" y="306" text-anchor="middle">Sensor count per array</text></svg>';
  plot.setAttribute(
    "aria-label",
    "Loss probability on a shared logarithmic scale, from 1 to 1e" +
      floor +
      ", for 7 to 70 sensors. Selected " +
      q * 7 +
      " sensors: A " +
      probabilityText(selected.riskA) +
      ", B " +
      probabilityText(selected.riskB) +
      ". Both risks fall as sensor count increases.",
  );
}

function renderRisk() {
  const q = Number(byId("risk-q").value),
    pPermille = Number(byId("risk-p").value);
  const series = Array.from({ length: 10 }, (_, i) => risk(i + 1, pPermille));
  const result = series[q - 1];
  currentRisk = {
    q,
    sensorsPerArray: 7 * q,
    pPermille,
    protectedLags: [...LAGS],
    blockSpacing: 18,
    probabilityMeaning:
      "Loss of at least one protected lag under iid sensor failures, starting intact",
    ...result,
  };
  byId("q-output").textContent =
    q + (q === 1 ? " block" : " blocks") + " · " + 7 * q + " sensors per array";
  byId("p-output").textContent = (pPermille / 10).toFixed(1) + "%";
  byId("risk-q").setAttribute(
    "aria-valuetext",
    q + " blocks, " + 7 * q + " sensors per array",
  );
  byId("risk-p").setAttribute(
    "aria-valuetext",
    (pPermille / 10).toFixed(1) + " percent per-sensor failure probability",
  );
  for (const key of ["a", "b"]) {
    const value = result[key === "a" ? "riskA" : "riskB"];
    byId("risk-" + key).textContent = probabilityText(value);
    byId("risk-" + key + "-readable").textContent = readableRisk(value);
    byId("exact-" + key).textContent =
      result[key === "a" ? "numeratorA" : "numeratorB"];
  }
  byId("risk-ratio").textContent =
    (result.ratio < 1e7
      ? result.ratio.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : result.ratio.toExponential(3)) + "×";
  byId("exact-denominator").textContent = result.denominator;
  byId("block-cuts").textContent = "A: " + 2 * q + " · B: " + q;
  byId("block-tolerance").textContent =
    "A: " + (2 * q - 1) + " · B: " + (q - 1);
  byId("block-diagram").innerHTML = Array.from(
    { length: q },
    (_, i) =>
      '<span class="mini-block"><b>7 sensors</b><small>+' +
      18 * i +
      "</small></span>",
  ).join('<span class="block-gap" aria-hidden="true">6</span>');
  byId("block-diagram").setAttribute(
    "aria-label",
    q +
      " blocks of seven sensors at offsets " +
      Array.from({ length: q }, (_, i) => 18 * i).join(", ") +
      ". Nearest inter-block gap 6 integer units.",
  );
  byId("risk-table-caption").textContent =
    "All probabilities at " +
    (pPermille / 10).toFixed(1) +
    "% per-sensor failure. Values are probabilities, not percentages; the selected sensor count is highlighted.";
  byId("risk-table-body").innerHTML = series
    .map(
      (row, i) =>
        "<tr" +
        (i + 1 === q ? ' aria-current="true"' : "") +
        '><th scope="row">' +
        7 * (i + 1) +
        "</th><td>" +
        probabilityText(row.riskA) +
        "</td><td>" +
        probabilityText(row.riskB) +
        "</td><td>" +
        (row.ratio < 1e7
          ? row.ratio.toLocaleString("en-US", { maximumFractionDigits: 2 })
          : row.ratio.toExponential(3)) +
        "×</td></tr>",
    )
    .join("");
  renderRiskPlot(series, q);
}

document.querySelectorAll("[data-lag]").forEach((button) =>
  button.addEventListener("click", () => {
    selectedLag = Number(button.dataset.lag);
    announce.textContent = "Protected distance " + selectedLag + " selected.";
    render();
  }),
);
byId("guided-delete").addEventListener("click", () => {
  for (const key of ["A", "B"])
    state[key] = new Set(original[key].filter((position) => position !== 1));
  selectedLag = 1;
  announce.textContent =
    "Both arrays restored, then position 1 deleted from each. Lag 1 selected. A retains one witness pair; B has none.";
  render();
});
byId("reset").addEventListener("click", () => {
  for (const key of ["A", "B"]) state[key] = new Set(original[key]);
  announce.textContent = "Both arrays restored to their intact state.";
  render();
});
byId("plot-mode").addEventListener("change", (event) => {
  plotMode = event.target.value;
  renderPlot();
});
byId("risk-q").addEventListener("input", renderRisk);
byId("risk-p").addEventListener("input", renderRisk);
let riskAnnouncement;
function announceRisk() {
  clearTimeout(riskAnnouncement);
  riskAnnouncement = setTimeout(() => {
    announce.textContent =
      "Risk comparison for " +
      currentRisk.sensorsPerArray +
      " sensors per array. A: " +
      probabilityText(currentRisk.riskA) +
      ". B: " +
      probabilityText(currentRisk.riskB) +
      ".";
  }, 300);
}
byId("risk-q").addEventListener("change", announceRisk);
byId("risk-p").addEventListener("change", announceRisk);
byId("risk-preset").addEventListener("click", () => {
  byId("risk-q").value = 3;
  renderRisk();
  announceRisk();
});
byId("download-risk").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(currentRisk, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download =
    "equal-spectra-q" +
    currentRisk.q +
    "-p" +
    currentRisk.pPermille +
    "-permille.json";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
let resizeFrame;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    drawArcs("A");
    drawArcs("B");
    renderPlot();
    renderRisk();
  });
});
renderHeroPlot();
renderHistogram();
render();
renderRisk();
