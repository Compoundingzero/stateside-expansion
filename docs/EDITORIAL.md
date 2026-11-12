# Editorial operations

The repository is the content administration interface. There is no publicly writable administration endpoint. Datasets, deterministic calculations and browser-local plans are separate. All content in this initial batch received AI-assisted source review only; no professional legal review is claimed.

## Publication states and counting

`src/data/*-guides.json` contains guide records. Only `status: published` is rendered by the public catch-all route or included in its guide sitemap. Drafts and blocked records stay outside the generated guide URLs. Landing pages, tools, filter states and planning screens do not inflate researched-guide counts.

`page-candidates.json` contains **703 editorial research leads**, grouped into 50 federal guides, 51 state/DC hubs, 204 state issue leads, 50 origins, 30 industries, 40 local hubs, 120 selected local/sector leads, 23 FDD items, 70 cases, 50 comparisons and 15 tools. These are proposed questions, not 703 researched pages. A candidate can match a subsequently published canonical path; reports count that overlap separately. Every lead is gated on distinct evidence and useful output. Merge or block candidates whose evidence only duplicates an existing guide. Never publish a jurisdiction/sector cross-product automatically.

An individual source fetch does not establish legal correctness. `fetchedAt` is operational evidence; `substantiveVerifiedAt` records a real review of the proposition. Guide review dates, source review dates and file modification times remain separate. A state franchise-law entry does not establish tax, employment or local-permit coverage. Unknown data is explicit and does not become zero or an absence of obligation.

## Review a proposed edit

1. Read the actual current authority, relevant form, effective date and any contradictory official source. Preserve the supporting passage and source status. Separate a law, procurement condition, lease term, insurer condition and recommended business practice.
2. Make a JSON patch file for one record. Run `node scripts/editorial.mjs propose federal-rules.json RULE_ID /absolute/path/to/patch.json`. This creates a proposal and preserves the before/after versions in `artifacts/editorial/`; it changes no source dataset or deployment.
3. Inspect the proposal, affected guide paths, tool assumptions and limits. Confirm that the proposed interpretation is supported. Proposed/enjoined/superseded material must keep its actual status. Do not represent a historical staff opinion as a current binding rule.
4. After the actual review, run `node scripts/editorial.mjs apply PROPOSAL_UUID --reviewer ACTUAL_REVIEWER_ID --date YYYY-MM-DD --review-complete`. A material unresolved conflict requires explicit treatment; `--accept-material-limits` records that the reviewer accepted a deliberately limited statement. It does not provide legal clearance. Do not invent a reviewer identity or professional qualification.
5. Read the generated `.invalidation.json`, review affected pages and calculations, update reciprocal dependencies, run `npm run build`, appropriate tests and `node scripts/report.mjs --write`, and inspect the actual public pages before committing. A changed source or rule never automatically rewrites or republishes related legal conclusions.

The CLI uses an original-record hash to reject applying a proposal after somebody else changed its source. `.revision.json` retains the reviewed before/after versions. These local files are ignored by Git by default: attach review evidence to the review process or copy approved non-sensitive records to an intentionally tracked location. Do not put private plans in editorial artifacts.

## Source changes and scheduling

`npm run check:sources` checks sources cited by published guides. `node scripts/check-sources.mjs --all` also checks uncited research sources. The check uses public HTTPS only, blocks local/private destinations, verifies each redirect, limits concurrency to four, bounds source size to 4 MiB and times out requests. It sends no login cookies or private plan data.

The first successful fetch establishes a technical hash baseline; it does not claim substantive review. Subsequent differences create `source-content-changed` queue records with affected rule IDs, canonical paths and mapped tools. Errors create fetch-failure review items. The reviewed source datasets and existing published interpretation remain unchanged. A source returning HTTP 200 can still be an error page; inspect evidence. Binary PDFs may change without a substantive rule change; HTML navigation can also cause false positives. Editorial review decides what matters.

`.github/workflows/source-review.yml` defines a daily 07:37 UTC check and a manual dispatch. It has read-only repository permissions and uploads review evidence; it cannot publish the site. GitHub cache carries the last hash baseline and unresolved queue across runs. Cache eviction or a new repository may require reestablishing a baseline. Artifacts expire after 90 days. Scheduling becomes active only after this workflow is pushed to a repository default branch with Actions enabled; the presence of the file alone is not an active integration.

Daily fetching is an operating policy, not a guarantee of currency. Prioritize volatile money thresholds, fees, tariffs, immigration, employment and court developments for substantive review. Source records carry per-source next-review targets; an HTTP success does not move those dates. A failed fetch or missed target keeps uncertainty visible and can block a new publication batch.

## Inventory and evidence reports

- `node scripts/validate-data.mjs`: structural gates, unique IDs/canonical paths, cited-source/rule resolution, minimum published-guide content and coverage sanity checks. Reciprocal dependency gaps are review notes because a tool may be a valid dependency outside guide JSON.
- `node scripts/report.mjs --write`: exact publication counts, AI-assisted source-review counts, source access status, rule status, independent jurisdiction topic dimensions and candidate overlap. Output is `artifacts/coverage-report.json`.
- `node scripts/editorial.mjs queue`: outstanding source-change items and unreviewed edit proposals.

Near-duplicate review happens before publication: compare query, evidence, practical output and canonical path, not merely wording. Distinct titles alone do not justify a distinct page. Automated structural checks cannot certify originality, applicability, legal correctness or completeness.

## Technical retrieval review

The source checker writes `artifacts/editorial-review-report.md` as well as its JSON evidence and queue. GitHub displays that report in the workflow summary. It separates HTTP access blocks, timeouts, unreadable responses and content-hash changes; none is a legal conclusion. Transient failures receive one bounded retry. A long server Retry-After is left for a later run instead of ignored.

The extractor prefers substantive main/article content containing the recorded supporting passage, so empty accessibility landmarks do not hide a real source. If the reviewed passage cannot be located, a review item is opened. Normalization changes create `baseline-migrated` observations rather than pretending the source changed its legal text. No substantive verification date is refreshed by these operations.

Resolve an inspected queue item with a dated decision and evidence reference:

```sh
node scripts/editorial.mjs resolve-source ISSUE_ID --reviewer REVIEWER_ID --date YYYY-MM-DD --evidence EVIDENCE_REFERENCE --decision no-material-change --review-complete
```

Allowed decisions are `retrieval-confirmed`, `no-material-change`, `interpretation-updated`, and `not-a-source-change`. This records a queue resolution only; a rule or guide change still needs the separate reviewed proposal/apply workflow. Resolved history is retained. A new occurrence can open another item; a later successful HTTP response never silently erases an unresolved material review.
