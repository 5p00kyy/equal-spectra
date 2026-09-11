# Equal spectra, unequal failure risk

**Two arrangements. The same power spectrum. Very different ways to break.**

[Explore the interactive site](https://5p00kyy.github.io/equal-spectra/) · [Read the note](downloads/research-note.pdf) · [Report a correction or earlier reference](https://github.com/5p00kyy/equal-spectra/issues)

![Equal Spectra interactive explainer](assets/preview.png)

An interactive mathematical explainer about what pairwise distance counts hide. Click sensors to remove them, inspect the surviving pairs, and explore exact failure probabilities. Static HTML, CSS and JavaScript. No framework, build step, tracking or remote assets.

> **Research status:** AI-assisted exploration; originality unresolved. This is an inspectable construction and educational demonstration, not an announcement of a confirmed new mathematical discovery. Neither human peer review nor proof-assistant formalization has occurred.

## Try the experiment

Requires Node.js 22 or later. No installation or dependencies:

```text
npm start
```

Open http://127.0.0.1:4179. The preview server binds only to loopback and serves an explicit file allowlist.

For a portable preview, run `npm run offline`, then open `dist/equal-spectra-preview.html` directly in a modern browser. The experiment, exact calculator, research PDF and source downloads are embedded in that single file. External scholarly references still require internet access.

## The small example

```text
A = {0, 1, 5, 7, 8, 10, 12}
B = {0, 1, 2, 5, 7,  9, 12}
Protected distances = {1, 2, 3, 4, 5}
```

Both arrays have the same complete positive-distance histogram:

```text
distance:  1  2  3  4  5  6  7  8  9 10 11 12
count:     2  3  2  2  3  1  3  1  1  1  1  1
```

But A's distance-one pairs are (0,1) and (7,8). B's are (0,1) and (1,2). Remove position 1: A retains distance one, B loses it. Equal counts concealed a shared dependency.

A retains all five protected distances after **every** single-sensor deletion. B does not. The smallest destructive deletion counts are 2 and 1, respectively. A destructive failure here means loss of at least one protected pair separation, not a measured direction-finding or hardware failure.

## Beyond the example

For homometric finite integer arrays, the ratio of minimum destructive-deletion counts is at most two. The elementary reason is that a vertex in any positive-lag graph belongs to at most two edges. Separated copies of this example attain the bound.

Make q copies at offsets 0,18,36,... . The full spectra remain identical. Since the nearest cross-block gap is 6, protected-distance graphs are separate copies. Minimum destructive cuts become 2q versus q.

Under independent identical sensor failures with probability p, the average damaged spectra also coincide:

**E[damaged power] = (1-p)² × intact power + p(1-p) × sensor count.**

The probability of losing at least one protected distance can nevertheless differ exponentially as q grows. For each fixed 0 < p < 1, its B/A ratio has qth-root limit

**(p + p² − p³) / (2p − p²)² > 1.**

At p = 0.01:

| Sensors in each array |   A loss probability |  B loss probability |       B/A |
| --------------------- | -------------------: | ------------------: | --------: |
| 7                     |     0.00117322939801 |    0.02038322840599 |     17.37 |
| 14                    |  5.09964704186222e-7 | 2.04116734490999e-4 |    400.26 |
| 21                    | 1.98362629055186e-10 | 2.06005027978686e-6 | 10,385.27 |

These are probabilities, not percentages. **Both absolute risks decrease.** The protected set stays fixed at distances 1 through 5. This is not an optimal hardware design, protection of all distances, equality of phase, or equality of damaged-spectrum distributions.

## Check the work

```text
npm test
npm run verify
```

- [Four-page research note](downloads/research-note.pdf): statements, proofs, assumptions and attribution.
- [Readable note source](research/note.html).
- [Interactive calculation engine](src/math.js): exact integer failure-state probabilities.
- [Engine unit tests](test/math.test.js).
- [Original base verifier](research/verify-homometric.js).
- [Original amplification verifier](research/verify-risk-amplification.js): independent inclusion-exclusion, mask-intersection convolution, and direct enumeration of all 16,384 failures of each 14-sensor array.

Finite computations check examples. The elementary proofs in the note establish the infinite statements. Do not infer originality from a passing test suite.

The seven Node test groups include every one of the 5,000 settings exposed by the explorer. An optional browser regression script, `scripts/browser-check.mjs`, exercises mouse and keyboard controls, responsive layouts, SVG endpoints, source links, empty states and extreme slider values. It requires separately available Playwright and Chromium; the site and mathematical tests do not. Configure `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `PREVIEW_URL` and `QA_OUTPUT` as needed. `AXE_SCRIPT` optionally enables the automated accessibility checks. Chromium runs with its sandbox enabled.

## Prior work and open questions

Homometry, path covers and sensor fragility are established ideas. The bounded literature search did not identify an explicit match for this assembled construction and comparison, but that is weak negative evidence, not proof of novelty. It may be a modest synthesis or an immediate consequence of earlier results. Earlier references, counterexamples and corrections are welcome.

- Liu & Vaidyanathan (2019), _Robustness of Difference Coarrays of Sparse Arrays to Sensor Failures, Part I_. [DOI](https://doi.org/10.1109/TSP.2019.2912882).
- Liu & Vaidyanathan (2020), _Novel algorithms for analyzing the robustness of difference coarrays to sensor failures_. [DOI](https://doi.org/10.1016/j.sigpro.2020.107517).
- Malik, Patwari & Sangeetha (2026), _An Interactive Graphical Tool to Check the Coarray Continuity of Two-Fold Redundant Sparse Arrays Under Single Sensor Failures_. [arXiv](https://arxiv.org/abs/2604.23262).
- Grimm & Baake (2008), _Homometric Point Sets and Inverse Problems_. [arXiv](https://arxiv.org/abs/0808.0094).

## Provenance

An exploration initiated and directed by Spooky ([`@5p00kyy`](https://github.com/5p00kyy)), developed with an AI assistant running in OpenClaw. AI generated the candidate construction, arguments, code, tests and exposition; separate AI sessions challenged the mathematics and searched prior work. Those checks are not human peer review. The project is presented for inspection, correction and learning.

## Publication and licensing

The source repository is [5p00kyy/equal-spectra](https://github.com/5p00kyy/equal-spectra), with the interactive explainer hosted on GitHub Pages. Publication makes the work inspectable; it does not establish originality or peer review.

No reuse license has been assigned. Third-party references retain their own rights.
