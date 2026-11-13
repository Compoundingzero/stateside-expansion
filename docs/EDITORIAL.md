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

`npm run check:sources` checks sources cited by published guides. `node scripts/check-sources.mjs --all` also checks uncited research sources. The check uses public HTTPS only, blocks local/private destinations, verifies each redirect, defaults to two workers (`SOURCE_REVIEW_CONCURRENCY=1..4`), bounds HTML/text/XML source size to 12 MiB and PDFs to 16 MiB and times out requests. It sends no login cookies or private plan data.

The first successful fetch establishes a technical hash baseline; it does not claim substantive review. Subsequent differences create `source-content-changed` queue records with affected rule IDs, canonical paths and mapped tools. Errors create fetch-failure review items. The reviewed source datasets and existing published interpretation remain unchanged. A source returning HTTP 200 can still be an error page; inspect evidence. Binary PDFs may change without a substantive rule change; HTML navigation can also cause false positives. Editorial review decides what matters.

`.github/workflows/source-review.yml` defines a daily 01:37 UTC check and a manual dispatch. It has read-only repository permissions and uploads review evidence; it cannot publish the site. GitHub cache carries the last hash baseline and unresolved queue across runs. Cache eviction or a new repository may require reestablishing a baseline. Artifacts expire after 90 days. Scheduling becomes active only after this workflow is pushed to a repository default branch with Actions enabled; the presence of the file alone is not an active integration.

Daily fetching is an operating policy, not a guarantee of currency. Prioritize volatile money thresholds, fees, tariffs, immigration, employment and court developments for substantive review. Source records carry per-source next-review targets; an HTTP success does not move those dates. A failed fetch or missed target keeps uncertainty visible and can block a new publication batch.

## Inventory and evidence reports

- `node scripts/validate-data.mjs`: structural gates, unique IDs/canonical paths, cited-source/rule resolution, minimum published-guide content and coverage sanity checks. Reciprocal dependency gaps are review notes because a tool may be a valid dependency outside guide JSON.
- `node scripts/report.mjs --write`: exact publication counts, AI-assisted source-review counts, source access status, rule status, independent jurisdiction topic dimensions and candidate overlap. Output is `artifacts/coverage-report.json`.
- `node scripts/editorial.mjs queue`: outstanding source-change items and unreviewed edit proposals.

Near-duplicate review happens before publication: compare query, evidence, practical output and canonical path, not merely wording. Distinct titles alone do not justify a distinct page. Automated structural checks cannot certify originality, applicability, legal correctness or completeness.

## Technical retrieval review

The source checker writes `artifacts/editorial-review-report.md` as well as its JSON evidence and queue. GitHub displays that report in the workflow summary. It separates HTTP access blocks, timeouts, unreadable responses and content-hash changes; none is a legal conclusion. Transient failures receive up to three bounded attempts; access/security challenges are not retried as temporary outages. A long server Retry-After is left for a later run instead of ignored.

The extractor prefers substantive main/article content containing the recorded supporting passage, so empty accessibility landmarks do not hide a real source. If the reviewed passage cannot be located, a review item is opened. Normalization changes create `baseline-migrated` observations rather than pretending the source changed its legal text. No substantive verification date is refreshed by these operations.

Resolve an inspected queue item with a dated decision and evidence reference:

```sh
node scripts/editorial.mjs resolve-source ISSUE_ID --reviewer REVIEWER_ID --date YYYY-MM-DD --evidence EVIDENCE_REFERENCE --decision no-material-change --review-complete
```

Allowed decisions are `retrieval-confirmed`, `no-material-change`, `interpretation-updated`, and `not-a-source-change`. This records a queue resolution only; a rule or guide change still needs the separate reviewed proposal/apply workflow. Resolved history is retained. A new occurrence can open another item; a later successful HTTP response never silently erases an unresolved material review.

## Source-review repair and durable decisions (13 November 2026 UTC)

Hosted run `43316465286` left 57 open items: 37 eCFR/Federal Register passage alerts caused by an HTTP-200 Request Access page and 20 retrieval items, including two retained from earlier observations. The access page is not primary legal text and is now rejected before it can overwrite a technical baseline. eCFR checks use its advertised titles/full-XML API with an explicit title-as-of date and required response compression; Federal Register checks use official full-text XML. The public canonical source URL remains unchanged. Neither API retrieval nor baseline recovery changes substantive verification dates.

The current source corpus contains a 7.4 MiB official Colorado title, so HTML/text/XML retrieval is bounded at 12 MiB; PDFs remain bounded at 16 MiB. Cached per-document fetches avoid repeating one FDD document for every item; source records still check their own supporting passages. Per-host pacing and bounded Retry-After handling reduce avoidable rate-limit failures. A longer Retry-After remains an explicit retrieval issue instead of being ignored.

Source URLs and every redirect must remain public HTTPS on port443 without embedded credentials or IP-literal targets. Local DNS results pointing at private/reserved addresses are rejected. Only five independently reviewed public hosts (`ditjenpen.kemendag.go.id`, `tradeinvest.tl`, `bsp.guam.gov`, `www.bot.or.th`, `www.esteri.it`) may use the inherited managed proxy when local DNS returns a resolution error. This exact-host fallback is unavailable without an inherited proxy and never overrides a private-address result. New hosts need an explicit evidence-backed code review; there is no general DNS bypass.

`research/batch3/editorial-review.json` contains dated AI-assisted decisions, source/retrieval URLs, body hashes, evidence references and applicability limits. `editorial-resolutions.json` is the checked-in persistence record consumed by the checker after restoring the workflow cache. A resolution must match the exact issue ID, source ID, reason and observed hash, and the issue creation timestamp must be no later than the actual ISO review timestamp. A later identical-hash occurrence remains open. Missing creation times and date-only review values do not close cached items. These records retain resolved history and do not change source legal-review dates or automatically publish content.

The inaccessible Tennessee Consumer Laws index was replaced with the accessible official Attorney General Protecting Consumers overview. Its own narrow agency-role source review was actually performed; the citing paragraph and source notes preserve the unresolved Tennessee franchise statutory-text branch. No tax-return FAQ or agency overview establishes franchise-sales permission.

Use `node scripts/check-sources.mjs --write-public-summary` before a reviewed deployment to refresh `public/source-review-status.json`. This public file reports the actual technical run time and counts only, without raw/private evidence. It is a dated snapshot, not a live guarantee or a replacement for source-level substantive dates. Ordinary scheduled runs write their private workflow evidence/report and do not publish the site. After this repair is pushed, verify a fresh hosted run rather than claiming that the earlier failing run tested the repair.

Documented-case source changes also invalidate guides whose curated case cards repeat facts from that case, including matches through `case-connections.json` guide IDs and rule IDs. This extends source traceability to visible repeated case summaries without rewriting their interpretations automatically.

The follow-up full checks also surfaced new instances: temporary availability failures and content hashes changed by treaty-site navigation, BOT popular-search footer words, and Pennsylvania PDF regeneration metadata. These were reviewed as new items, not silently closed by prior records. Normalization version4 handles nested non-content containers, retains the State Department published copy including country footnotes, and hashes PDF bytes without volatile creation/modification/trailer-ID/XMP timestamp/ID metadata. Raw bytes/hashes remain preserved; substantive PDF streams, pages, attachments, author and other fields still affect the hash. The actual Pennsylvania extracted text and all remaining bytes were compared before recording a non-material decision. Changed legal text or a treaty row still opens review.

Scheduled source checks now pass both `--fail-on-fetch-error` and `--fail-on-review-items`: retrieval failures or an unresolved review queue make the workflow visibly fail after evidence/report files are written. Summary, cache and artifact steps still run with `always()`. This is an operational alert, not a legal conclusion; local report-only behavior remains the default.

The subsequent route followups also moved the legacy Pennsylvania section link to the current official Act PDF and corrected CDSS’s mixed-case HTTP-redirecting URL to its published direct-HTTPS destination. Tennessee’s intermittently blocked government overview was finally replaced with its complete official DCA help-center explanation, explicitly dated 18 June 2021 and limited to agency role/resources. The current citation does not claim current franchise statutory text. Full route histories and actual review decisions remain in the checked-in audit.


## Expanded cohort followup (13 November 2026 UTC)

The subsequent 437-source sweep (222 guides published at its start) left 82 observations: 78 retrieval failures and four missing passages. Only those alerted source records were rechecked. Eighty original observations and one new Swiss fetch-failure occurrence were resolved with actual HTTP-200 bodies, retained passages and dated exact-instance decisions. The checked-in record now contains 151 resolved instances. Two source-access items remain open: Detroit’s Restaurants notice returns HTTP403 with a JavaScript/cookie challenge; Austria’s RIS VAT §3a page returns HTTP503 with a Myra human-verification page. Neither is treated as repealed law, no requirement, or a successfully retrieved legal body.

The original 437-source run explicitly enabled `NODE_USE_ENV_PROXY=1`. A later unconfigured standalone diagnostic separately found Node fetch ignoring inherited proxy variables; the checker now calls Node24’s built-in `http.setGlobalProxyFromEnv()` when such variables exist. That configuration repair does not establish the historical cause of the original HTTP503 cluster. Close explicit-proxy Node/curl checks both returned200 for the California DIR source, and both returned the same security-check503 for RIS. The checker records bounded failed-response text/status/selected headers and optional raw error evidence, excludes cookies, and stops retries on detected access/security challenges. Rejected shared eCFR title-metadata promises are discarded so later attempts can recover. All URL, DNS, redirect and TLS guards remain in place.

Normalization v5 decodes named typographic apostrophe/quotation/dash entities and reads only bounded declarative table content from public `__NUXT_DATA__` JSON, without executing scripts or accepting arbitrary configuration strings as prose. The Indiana, Idaho and Finland passages were present with encoded punctuation. The complete Swiss adequacy table, including the U.S. certification qualification and safeguard footnotes, is identical to the earlier actually reviewed table. Regression checks retain substantive-word and qualification-change detection. Raw body hashes and legal-review dates are preserved.

There are 22 passing editorial tests. The current public status file explicitly describes the earlier 437-source cohort plus the later 82-source followups, with separate times; it is not a new full sweep of the subsequently expanded corpus. Root must refresh it after the final content merge. The two open access blocks continue to fail strict scheduled checks while evidence, cache and reports remain retained.


### Latest bounded official-route recovery

The RIS access observation was subsequently resolved through its documented, keyless Open Government Data API. The API returned exactly one current UStG §3a record for law 10004873 as of 13 November 2026, with an explicitly linked official XML rendition, NOR40263525. The entire XML section and the receiving-establishment sentence were read and match the cited scope. The checker preserves the human-facing canonical source URL, queries the version date and validates law, paragraph, document identity and the official linked XML before fetching it. RIS API/XML requests are serialized and paced at least two seconds apart. This is the advertised machine interface; no security challenge was solved or bypassed, and the source’s substantive-review date is preserved.

The durable total is now 152 resolved instances, with only the original Detroit access observation still open. The bounded Detroit check found no JSON/RSS counterpart exposed by the actually read notice or official search results. No endpoint was invented or URL variants cycled. The existing narrow notice text remains reviewed evidence, but the automated canonical fetch still receives its JavaScript/cookie challenge. The public snapshot remains the earlier 437-source cohort with separate focused-followup times, now one current retrieval failure, zero missing passages and one open item. Root must still check the final merged corpus. The editorial suite has 23 passing tests.

The daily workflow runs at 01:37 UTC (02:37 CET / 03:37 CEST), leaving the 35-minute job limit inside the RIS OGD service’s advertised overnight window in both seasons. Its API and linked XML requests share a serial two-second queue; the source checker does not perform a RIS bulk download.

## Final release source-maintenance snapshot

At 2026-11-13T01:57:23.281Z, the final whole-corpus selection checked 591 cited source records for 278 published guides plus public tools/site dependencies. It completed at 02:03:19.727Z with 576 successful retrievals, 15 retrieval issues, zero missing passages and zero content-hash alerts; strict exit was 1. The other 49 records in the 640-source inventory were uncited by that cohort and are outside the check. Separate bounded followups recovered seven alerted records. The dated completion audit at 02:14:41.731Z therefore retains eight open retrieval items and 159 resolved instances. It preserves the original 15-failure history and does not claim another full sweep.

The eight open items are Detroit and Oregon HTTP 403 responses, two Albania connection failures, a North Macedonia HTTP 503 upstream timeout, and local DNS failures for Türkiye and two Federation of Bosnia and Herzegovina sources. No new DNS exception was added. Successful transport did not advance source legal-review dates. The actual Part 791 full XML is a complete short reserved-only part; its structural readability exception is restricted to that official API route, matching part number and reserved-only document. Ordinary short pages remain rejected.

`src/data/editorial-snapshot.json` is the retained-history dataset used by `/coverage/`; append a precisely scoped current snapshot there as well as refreshing `public/source-review-status.json`. The coverage page shows both the initial full-sweep issues and the dated mixed-time completion issues with affected guide/tool paths. A public JSON refresh alone does not update this compiled coverage history.

The release's v4-to-v5 migration audit reproduced all 378 retained v4 hashes from the current actual bodies. `research/batch3/normalization-migration-audit.json` binds the 24 differing v5 hash pairs to exact source IDs and versions. An unbound differing-hash migration now creates `source-normalization-review-required`; it is neither silently unchanged text nor a detected legal change. Older hosted v2 caches do not match v4 evidence. Identical normalized hashes need no exception. Unresolved migration items persist in the queue after baseline advancement and fail the strict workflow until a dated evidence-backed decision exists.

Missing caches can establish new technical baselines. Malformed retained baseline/queue state now fails explicitly rather than dropping unresolved history. Raw-body evidence is retained before extraction when configured, so an unreadable HTTP-200 source can be diagnosed. The current editorial suite has 26 passing tests; structural validation reports zero errors and review notes. See `research/batch3/FINAL-SOURCE-RUN.md` for exact run counts, migration evidence, input fingerprints and retry-aggregate retention limits. Root must verify the fresh hosted run after pushing; open access/transport or unaudited historical-normalization items may correctly leave it red.

## Verified hosted strict workflow and retained queue

Hosted source run [43351541720](https://github.com/Compoundingzero/stateside-expansion/actions/runs/43351541720) actually executed on release `b8b5345` after deployment. Its 591-record full check began at 2026-11-13T02:21:14.908Z and completed at 02:25:58.227Z: 537 retrieved, 54 retrieval failures, 57 normalization items and one passage miss, for 112 open observations. Strict exit was 1; summary, cache save and evidence artifact steps all succeeded. The original output remains immutable under `artifacts/hosted-43351541720/`.

Dated AI-assisted review at 02:38:19.574Z resolved those exact 57 normalization instances and the passage miss. All 54 original hosted retrieval failures remain open; four later managed-cloud successes do not prove what the missing hosted response bodies contained. The durable register now contains 217 decisions across environments; this particular hosted queue contains 115 resolved instances. The earlier local eight open observations remain preserved as dated local history. The current public snapshot explicitly distinguishes these scopes.

Fifty older v2 hashes and one original v1 hash were exactly reconstructed and narrowly bound in the migration audit. Five historical exceptions received current-source/context revalidation, with the two Pennsylvania old raw/text identities explicitly unestablished. D.C. had one actual section-body change: independent review confirmed its added bracketed subsection does not alter the cited (a)(5)/(7) claims or unchanged applicability notes. Its resolution means **content changed, current cited claims unchanged**, not identical source text or full D.C. legal clearance. Existing source substantive dates remain unchanged.

Albanian `&euml;`/`&ccedil;` equivalence is restricted to passage comparison; actual extracted text, hashes and normalization version 5 stay intact. Future HTTP-200 extraction failures now retain a bounded actual preview and full raw hash without requiring a raw-directory setting. Nested connection causes and rejected redirects retain sanitized diagnostic evidence; credentials, URL userinfo/query/fragment and private plan data are excluded. These repairs do not weaken network guards or retroactively resolve the 54 original failures. See `FINAL-SOURCE-RUN.md`, `hosted-normalization-review.json`, `hosted-fetch-failure-audit.json` and `DC-review.md` for exact evidence, review scopes and remaining uncertainties.

The final focused editorial suite has 29 passing tests, including comparison-only Albanian entities with unchanged hashes, bounded HTTP-200 failure evidence and redacted nested connection/redirect diagnostics. Structural validation remains at zero errors and review notes. The diagnostic changes have not yet run as a fresh hosted check; they improve future evidence capture and do not turn the existing failed source workflow green.

## Articles for readers new to U.S. rules

The reader-first article standard is now `ARTICLE-STYLE.md`. The user asked for
more context, definitions and teaching at first-year university level, rather
than condensed research notes. The published-article revision covers all 278
existing guides, with individually authored explanations, terminology and worked
reasoning. Source evidence and dates remain separate from editorial revision dates.
