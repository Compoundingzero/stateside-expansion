# ELN — Enterprise Licensing Network

A cloud-built reference site and private, browser-local planning workspace for owners of established European and Southeast Asian businesses considering U.S. franchising, licensing and related models.

This repository contains a working ELN reference site, planning workspace, intake forms and private owner board. It is not the completed 700–1,000-page research programme, a nationwide legal opinion, or transaction clearance. Coverage gaps are part of the product and remain visible.

## Run

Node 24+ and npm are required.

```sh
npm ci
npm run build
npm start
```

Open http://localhost:3000. `PORT` defaults to 3000. `PUBLIC_SITE_URL` must be the real production origin before a production build; Railway's `RAILWAY_PUBLIC_DOMAIN` is used when available. Development uses `npm run dev`.

Public guides are static HTML. The anonymous planner remains browser-local with optional saving off by default; its JSON and printable/PDF exports are local. The separate interest/contact forms store their intentionally submitted fields in an authenticated owner-board database. No uploads, tracking integration, marketing automation or server-stored private expansion plans are enabled.

## Verification

```sh
npm run build
npm test
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
- `docs/CONTINUATION-RELEASE.md`: current verification, inventory and backlog.
- `docs/BOARD-STORAGE.md`: private owner access, persistent volume and runtime permissions.
- `docs/RELEASE.md`: historical first-publication record.
- `docs/examples/`: fictional example JSON and printable Expansion Brief.

`node scripts/report.mjs` is the authoritative count report. “Reviewed” means AI-assisted source review, not professional legal review. Fetching a page never updates a substantive verification date. Daily source checks produce a review queue and identify affected pages/tools; they do not publish new interpretations. The workflow requires a pushed default branch and enabled GitHub Actions.

The HTML guide renderer reuses canonical rules and source metadata; the source register links evidence back to dependent guides. Git history preserves every release. Do not rerun research generators without applying their documented reconciliations and checking the current data diff.

## Railway

Create a Railway service from this private GitHub repository and select the `main` branch. `.railway/railway.ts` declares the supplied Dockerfile, `/health`, failure restart settings and CI-gated GitHub deployments. Infrastructure edits require an explicit `railway config plan` and `railway config apply`; see `docs/RAILWAY.md`. Set `PUBLIC_SITE_URL` to the generated Railway domain or custom domain, then deploy/redeploy to build correct canonical URLs and sitemap entries. The runtime image contains generated public assets, the HTTP server and the submission service. A persistent `/data` volume and remotely provisioned `ELN_SETUP_TOKEN` are required for the owner-board rollout; the secret is preserved by IaC and never committed.

A deploy is verified only after Railway reports success and the actual public URL passes health, article, tool, sitemap and privacy checks. Do not confuse local preview with a live deployment.

## Release limits

The national register contains all 50 states and D.C., but only the source-checked dimensions are findings. Territories now have separate, narrowly researched guides; unreviewed dimensions remain open. Local sources cover specific processes, not complete city or sector opening clearance. California and OctoClean remain blocked; Mississippi and Laos remain unpublished. No professional author/reviewer credentials are claimed. Contact and privacy requests use the contact form. The privacy notice describes actual local planning, intentional form collection, owner access and retention. See `docs/CONTINUATION-RELEASE.md` for the exact backlog.

## Local owner-board testing

Copy `.env.example` to an ignored `.env`, set the local origin and generate a fresh random `ELN_SETUP_TOKEN` of at least 32 characters. Keep it out of Git/output. `npm start` loads that local file. Production uses Railway runtime variables and the mounted volume instead. The first owner chooses a password through `/owner/setup/#token=...`; the browser immediately removes the fragment. Subsequent access is `/owner/`.

The additional submission browser suite needs a fresh disposable database and `SUBMISSIONS_E2E_SETUP_TOKEN` matching that local server. It refuses non-local targets. Do not use the production bootstrap secret in tests. CI supplies a clearly marked disposable token and temporary directory automatically.
