# Source-review queue repair and evidence

AI-assisted editorial source review, 13 November 2026 UTC. No human professional review is represented or required by this operational work. The scope is source-alert triage, preserved applicability and maintenance reliability; it is not transaction-specific legal clearance.

## Original hosted queue

GitHub hosted run 43316465286 supplied 57 open items:37 missing-passage alerts and 20 retrieval alerts, including two retained from earlier observations. The archive is retained under ignored `artifacts/hosted-43316465286/`; original bodies/evidence remain unchanged. Source/code edits and public deployment remain subject to the owner’s normal integration workflow.

All 37 missing-passage alerts were the same HTTP 200 Federal Register/eCFR Request Access page. The page was mistakenly accepted as primary text. The actual legal document had not been fetched. The checker now rejects that interstitial before baseline updates and uses the agencies’ advertised full-text developer routes, recording retrieval URL and primary-text-as-of date separately from the public canonical URL and substantive verification date.

The 20 retrieval items were inspected against actual full official bodies and their relevant conditions. Nineteen recovered at their canonical URLs through ordinary inherited-proxy access or the bounded size adjustment. The Tennessee Consumer Laws index remained unavailable; its narrow agency-resource purpose was replaced with the accessible official Attorney General Protecting Consumers overview. That source’s own new, limited review is dated; the Tennessee guide still explicitly leaves franchise statutory-text coverage unresolved. Tax resources and an agency overview provide no franchise-sales permission.

`editorial-review.json` records each source/issue, actual body hash, supporting passage, review scope and dependent pages/tools. `editorial-resolutions.json` holds the exact-instance decisions. There are 57 original decisions:37 not-a-source-change and 20 retrieval-confirmed. Existing substantive verification dates were preserved except for the expressly replaced and actually read Tennessee agency-resource record.

## New occurrences during verification

The complete rechecks correctly opened new instances rather than recycling old decisions. Nine follow-up items were independently inspected:

- The actual federal 436.6 full-text source recovered after a transient API 429. Pacing and bounded Retry-After handling were added.
- Treaty-page changes were confined to site-navigation entries; complete country-table and footnote text were identical.
- A BOT statement differed only in dynamic search-footer keywords. Its dated statement, actor, amount and scope were unchanged.
- Pennsylvania’s regenerated PDF had identical complete pdftotext output and identical remaining bytes after isolating volatile PDF/XMP timestamps and IDs. No law change was inferred from file metadata.
- Temporary BOT DNS and Tennessee 503 availability events were followed by actual-body retrievals and scope checks.

All nine decisions retain the actual observed instance and timestamp. The checked-in record now contains 66 explicit decisions:57 original plus 9 follow-up items. A later identical-hash event must remain open unless separately reviewed.

## Reliability and safeguards

- Public HTTPS and every redirect remain validated. Credentials, non-443 ports and IP-literal targets are rejected; private/reserved DNS results are rejected.
- Exact reviewed public-host exceptions allow inherited-proxy resolution for `ditjenpen.kemendag.go.id`, `tradeinvest.tl`, `bsp.guam.gov` and `www.bot.or.th` only when local resolution fails. They never override private-address results and are inactive without the inherited proxy.
- The official Colorado title is 7.4 MiB. HTML/text/XML is bounded at 12 MiB and PDFs at 16 MiB; the checker does not accept unlimited bodies.
- Per-document caching avoids repeatedly fetching the same FDD body. Per-host pacing and bounded transient retries respect server Retry-After; a longer delay remains an explicit retrieval issue.
- Normalization v4 handles nested non-content containers and the published State Department copy with all country footnotes. Volatile PDF metadata is excluded from content hashing while raw body hashes are retained. Actual article, country-row, PDF text-stream/page/attachment and other metadata changes still affect hashes.
- Cached resolutions require exact issue/source/reason/hash matches **and** issue.createdAt no later than an actual ISO review timestamp. Missing creation times and date-only resolutions are not applied. Regression tests cover a later identical ID/hash remaining open.
- The CLI resolves the pending occurrence when resolved history has the same ID. It preserves the older evidence/history.
- Case-source dependencies now extend to guides repeating case facts in curated case cards, through `case-connections.json` guide/rule matches.

## Verification and handoff

The editorial test suite has 22 passing tests, including SSRF/public-DNS behavior, CAPTCHA rejection, explicit resolution recurrence, normalization, private-evidence exclusion from public status and case-card propagation. Structural data validation passes; pending other-agent proposals can produce ordinary unmerged dependency review notes.

The final cited-source run and dated public snapshot are recorded in `public/source-review-status.json` and ignored `artifacts/batch3-source-review/`. The public file contains counts and the actual technical check time only; it does not advance legal review dates or imply continuous availability/currency. Run `node scripts/check-sources.mjs --write-public-summary` after the final content merge to refresh that snapshot before deployment.

The repaired source workflow must still be verified in a fresh hosted run after root pushes these changes. The old failing hosted run is evidence of the original issue, not proof that the repair has run in GitHub. Source-level legal limits, held guides and unresearched coverage remain separate from transport success.

The bounded Detroit assist recovered the actual 16 July 2025 City Restaurants notice, distinguishing the named BSEED-license removal from the continuing Detroit Health license. Long city guide/certificate pages remained 403; their search excerpts were not counted as reviewed primary bodies. Geography owns the resulting narrow local guide and coverage proposal.

## Final source-route handoff

The 271-record full cohort finished with four new route observations. All four then passed their targeted actual-body checks: Italy ministry through its independently reviewed exact proxy host, Pennsylvania §316 through the current official Act PDF, the dated Tennessee DCA help-center explanation, and the lower-case direct-HTTPS CDSS destination. The checked-in record now preserves 70 reviewed issue instances: 57 original plus 13 follow-up observations. The latest cohort snapshot includes zero unresolved review items and zero current retrieval failures after those explicit followups; it records the earlier full-sweep time and later followup time separately. Root must refresh against the final merged content cohort and verify the new strict GitHub workflow run after pushing. No source substantive-review date was advanced by transport success.


## Expanded 437-source cohort: exact-instance followup

The root sweep beginning 2026-11-13T01:12:25.883Z checked 437 sources for then 222 published guides and produced 82 open observations:78 retrieval failures (75 HTTP 503, two DNS, one 403) and four missing passages. Those exact 82 alerted source records were rechecked; the whole expanded corpus was not rerun by this agent.

The first focused retry retrieved 27 sources and left 55 failures. The next retry, after explicit inherited-proxy configuration and with two workers, retrieved 56 of the remaining 58 records and found all four previously missing passages. The latest bounded two-source check confirms the residual blocks. There are 81 new exact-instance decisions:80 of the original 82 observations plus the Swiss fetch-failure instance opened during the first retry. Earlier 70 decisions remain intact, for 151 resolved items in total. Two original items remain open:

| Source | Actual current observation | Evidence |
| --- | --- | --- |
| `b3-local-detroit-notice` | HTTP 403; “Just a moment” JavaScript/cookie challenge | `research/raw/batch3/editorial/expanded-current-blocks/b3-local-detroit-notice.error.html` |
| `b3-origin-austria-vat-3a-web` | HTTP 503 Myra Security Check asking for human verification; both explicit-proxy Node and curl reproduced it | `research/raw/batch3/editorial/transport-diagnosis/ris-proxy-node.{html,json}`, `ris-paired-curl.{headers,html}` and checker error body |

No challenge was solved or bypassed. The source remains an access uncertainty, with the last actually reviewed content preserved. A 403 or a security-check 503 is not a legal update. The captured 503 does not say remote connection failure; its actual body is a security challenge. No historical body was retained by the older checker for the root run’s 75 HTTP 503 responses, so the historical cause of the whole cluster is not asserted.

Root’s original run explicitly used `NODE_USE_ENV_PROXY=1`. A separate unconfigured Node diagnostic failed to connect directly to DIR, while explicit proxy-enabled Node and ordinary curl returned 200 close together. The useful CLI fix now honors configured inherited proxy variables through Node 24’s built-in dispatcher. It does not explain the already proxy-enabled root run. Per-host pacing, guarded redirects/TLS/public DNS and bounds remain unchanged; two workers are the default and one to four can be configured. Rejected cached title-metadata promises are discarded and regression tested. Failed HTTP responses retain bounded actual text/status/selected headers and optional raw bodies so later transport diagnosis is evidence based; cookies are not copied into diagnostics.

The three ordinary passage mismatches were named HTML quotation/apostrophe entities. Their exact substantive sentences are still present. The Swiss public Nuxt payload contains the table cells omitted from server-rendered text. Bounded declarative extraction retains the whole country table and footnotes; it executes no scripts and ignores configuration strings. The current table is byte-identical after extraction to the prior reviewed table: SHA 256 `22e1ac66bcdf0809d6737a0a81a73199fdf291cac61fdbf80caeddad3016498b`. Normalization v5 and regression tests preserve alerts for changed substantive words or certification qualifications. None of these repairs rewrites source supporting passages, legal interpretations or legal-review dates.

Actual raw bodies are retained in ignored `expanded-82-retry` and `expanded-proxy-retry` directories; the prior sweep/results/queue were copied before each mutation. `expanded-review-contexts.json` records the relevant actual passages; all 80 recovered original source records contain them, including independently extracted PDF passages. The tracked JSON audit records each issue ID, creation/review timestamp, original reason/hash, actual retrieval/raw hash, relevant context and dependent pages/tools. The checked-in resolution timestamp guard remains active, so a later identical-hash occurrence cannot be closed by an earlier decision.

The public snapshot now states 437 source records, two current retrieval failures, zero missing passages, two open review items and 151 resolved instances, with the original sweep and focused-followup times separate. It is explicitly a mixed-time snapshot of that cohort, not the final merged site. Root will run the final whole published corpus. All 22 editorial tests pass; structural data validation is performed by root after integration. No source legal-review date was advanced merely for transport success.


### Latest bounded official-route recovery

The RIS access observation was subsequently resolved through its documented, keyless Open Government Data API. The API returned exactly one current UStG §3a record for law 10004873 as of 13 November 2026, with an explicitly linked official XML rendition, NOR40263525. The entire XML section and the receiving-establishment sentence were read and match the cited scope. The checker preserves the human-facing canonical source URL, queries the version date and validates law, paragraph, document identity and the official linked XML before fetching it. RIS API/XML requests are serialized and paced at least two seconds apart. This is the advertised machine interface; no security challenge was solved or bypassed, and the source’s substantive-review date is preserved.

The durable total is now 152 resolved instances, with only the original Detroit access observation still open. The bounded Detroit check found no JSON/RSS counterpart exposed by the actually read notice or official search results. No endpoint was invented or URL variants cycled. The existing narrow notice text remains reviewed evidence, but the automated canonical fetch still receives its JavaScript/cookie challenge. The public snapshot remains the earlier 437-source cohort with separate focused-followup times, now one current retrieval failure, zero missing passages and one open item. Root must still check the final merged corpus. The editorial suite has 23 passing tests.

The scheduled source run moved to 01:37 UTC, within the advertised RIS OGD overnight window in both CET and CEST. The scoped law/paragraph query uses the explicit current query date; a new version produces a new linked XML body/hash for review.

## Final 591-record cohort and bounded followups

The complete final sweep began at 2026-11-13T01:57:23.281Z and finished at 02:03:19.727Z: 591 cited source records for 278 published guides plus public tool/site dependencies, 576 successful retrievals, 15 retrieval issues, zero missing passages and zero content-hash alerts. Its actual strict exit was 1. Forty-nine uncited records in the 640-record source inventory were outside this check; held guides and other unresolved legal work remain separate.

A twelve-record network-only retry at 02:05:32.310Z recovered Brunei BEDB, Hungary NAV's 2026 invoice PDF, Romania OSIM's FAQ, Bulgaria's dual-use export service, Serbia NBS's foreign-exchange-law PDF and Moldova NBM's law translation. Actual supporting contexts were inspected; all three recovered PDFs were independently converted with `pdftotext`. A separate one-record check at 02:08:30.695Z recovered official reserved Part 791 XML after a narrowly validated short-document extraction repair. Reserved regulatory text does not establish absence of statutory joint-employer liability. Seven exact-instance technical decisions were added without advancing legal-review dates, bringing the durable total to **159 resolved instances**.

The completion snapshot at 02:14:41.731Z covers the same mixed-time cohort: **583 retrieved and eight open retrieval items**. Detroit and Oregon remain HTTP 403; Albania's two records remain connection failures; North Macedonia's retry returned HTTP 503 with an actual upstream connection-timeout body; Türkiye and the two Federation foreign-exchange records remain local DNS failures. No broad DNS exception, challenge bypass, cookie/session change or synthetic primary body was used. The original full sweep's 15 failures remain visible in the preserved result and coverage snapshot. The followup is not presented as another full sweep or legal-currency certification.

The twelve-record retry's aggregate JSON was overwritten by its later one-record check. Its six successful per-source observations and raw bodies remain intact; the completion audit labels the derived remaining-error observations and does not invent per-failure times/headers. The original 591-record result/queue/baseline are unchanged. See `FINAL-SOURCE-RUN.md` for the exact procedure, limits and remaining-source table.

Normalization-v4 re-extraction reproduced all 378 prior hashes (377 full-sweep migrations plus Brunei). The checked-in migration audit binds the 24 changed old/new hash pairs to their exact source and versions. Different unbound versions/hashes now require an explicit normalization-review item; an older hosted v2 cache cannot be silently approved by v4 evidence. No legal dates move automatically. The checker suite has 26 passing tests; structural validation has zero errors and review notes. Fresh hosted verification is still required after root pushes.
