# Deployment and maintenance

The project is a static GitHub Pages site at https://5p00kyy.github.io/equal-spectra/ with source at https://github.com/5p00kyy/equal-spectra.

## Deployment

GitHub Pages publishes the main branch root. `.nojekyll` bypasses Jekyll. The website requires no build step, package installation, remote fonts or analytics. Relative asset paths support the project subdirectory. GitHub Actions checks the mathematics on pushes and pull requests.

Before updating main, run `npm test`, `npm run verify` and the browser regression checks described in README. Inspect desktop/mobile renders, source links, PDF download and both ordinary and extreme calculator states. Keep absolute probabilities visible alongside risk ratios. Verify the Pages deployment and public URL after a push; a successful git push is not deployment evidence.

## Release boundaries

Keep prior-art uncertainty and AI provenance visible. Do not label this a confirmed novel discovery, peer-reviewed paper or validated hardware design. New claims need separate verification and sourcing. Repository publication does not authorize contacting researchers or cross-posting announcements.

No reuse license has been assigned. A separate owner decision can add one later; cited third-party works retain their own rights. Only standalone project files belong in this repository.
