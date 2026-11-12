# Stateside — U.S. Expansion Desk

A cloud-built reference site and private, browser-local planning workspace for owners of established European and Southeast Asian businesses considering U.S. franchising, licensing and related models.

This repository contains a complete working initial publication batch. It is not the completed 700–1,000-page research programme, a nationwide legal opinion, or transaction clearance. Coverage gaps are part of the product and remain visible.

## Run

Node 24+ and npm are required.

```sh
npm ci
npm run build
npm start
```

Open http://localhost:3000. `PORT` defaults to 3000. `PUBLIC_SITE_URL` must be the real production origin before a production build; Railway's `RAILWAY_PUBLIC_DOMAIN` is used when available. Development uses `npm run dev`.

Public guides are static HTML. Only the planning workspace and tools hydrate React. The production server has no user database, plan API, uploads, tracking or account registration. Optional draft saving is browser-local and off by default. Exports are locally created JSON and an escaped printable brief/PDF view.

## Verification

```sh
npm test
npm run build
npm audit --omit=dev --audit-level=high
# With the production server running and Chromium available:
npx playwright test
node scripts/report.mjs --write
node scripts/check-sources.mjs
```

The browser test configuration uses `/usr/bin/chromium`; set `CHROMIUM_PATH` when different. CI installs Playwright Chromium and sets that variable. Do not run a development server and a production build simultaneously in one checkout.

## Research and editorial workflow

- `src/data/*-guides.json`: canonical content; draft and blocked records generate no article routes.
- `src/data/*-sources.json`: primary evidence, short passages, access and substantive-review dates.
- `src/data/*-rules.json`: shared rule records, applicability, review status, dependencies and limits.
- `states.json`, `origins.json`, `markets.json`: separate geographic and topic coverage.
- `page-candidates.json`: 703 editorial research leads; these are not 703 published pages.
- `tool-definitions.json`: explicit source/rule dependencies for calculations and preparation tools.
- `docs/EDITORIAL.md`: review, source checking, revision and publication commands.
- `docs/GEOGRAPHY.md`: scope convention, researched local boundaries and exact local queue.
- `docs/RELEASE.md`: verification evidence, release scope, remaining dependencies.
- `docs/examples/`: fictional example JSON and printable Expansion Brief.

`node scripts/report.mjs` is the authoritative count report. “Reviewed” means AI-assisted source review, not professional legal review. Fetching a page never updates a substantive verification date. Daily source checks produce a review queue and identify affected pages/tools; they do not publish new interpretations. The workflow requires a pushed default branch and enabled GitHub Actions.

The HTML guide renderer reuses canonical rules and source metadata; the source register links evidence back to dependent guides. Git history preserves every release. Do not rerun research generators without applying their documented reconciliations and checking the current data diff.

## Railway

Create a Railway service from this private GitHub repository and select the `main` branch. `railway.json` selects the supplied multi-stage Dockerfile, `npm start`, `/health` and failure restart settings. Set `PUBLIC_SITE_URL` to the generated Railway domain or custom domain, then deploy/redeploy to build correct canonical URLs and sitemap entries. The runtime image contains only generated public assets and the static server. There are no production secrets to configure for this release.

A deploy is verified only after Railway reports success and the actual public URL passes health, article, tool, sitemap and privacy checks. Do not confuse local preview with a live deployment.

## Release limits

The national register contains all 50 states and D.C., but only the source-checked dimensions are findings. Territories remain a separate unresolved workstream. Local sources cover specific processes, not complete city or sector opening clearance. California and two real-case narratives remain blocked. No professional author/reviewer credentials are claimed. Site operator identity/contact and hosting-log retention details must be supplied before a wider release. See `docs/RELEASE.md` for the exact backlog.
