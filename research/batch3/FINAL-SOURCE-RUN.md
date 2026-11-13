# Final source sweep procedure and review limits

The frozen publication cohort was captured at 2026-11-13T01:57:23Z: 278 published guides, 290 total guide records, 640 source records and 390 rules. The actual published-guide/tool/site dependency selection contains **591 cited source records**. The other 49 source records are uncited by that public cohort and are not claimed checked. Several source records can refer to one document, including the FDD sections; records, successful requests, documents and substantive legal reviews are different counts.

The active run is under `artifacts/final-source-review/`, seeded from the previous baseline and 153-item queue (152 resolved instances and the open Detroit access item). The input file hashes, source IDs/count and stated post-freeze exceptions are retained in `corpus-manifest.json`; seed copies remain alongside the run output. Raw primary responses stay under ignored `research/raw/batch3/editorial/final-source-review/`.

## Reproducible command

Use Node 24 and a newly created output directory seeded from the last retained baseline and queue. Do not discard an existing unresolved queue just to obtain a clean run. On the managed cloud executor, enable its inherited proxy explicitly:

```sh
NODE_USE_ENV_PROXY=1 \
SOURCE_REVIEW_CONCURRENCY=2 \
SOURCE_REVIEW_DIRECTORY=artifacts/final-source-review \
SOURCE_REVIEW_RAW_DIRECTORY=research/raw/batch3/editorial/final-source-review \
node scripts/check-sources.mjs --write-public-summary --fail-on-fetch-error --fail-on-review-items
```

The command uses the normal public-citation selection. `--all` would include uncited research/held records and is a different scope. Both strict flags are operational alerts; a nonzero result does not decide that a legal rule changed. The public status file is written only after this run completes. The previous dated snapshot is not proof that a new run finished.

Before a focused retry, preserve the complete initial `source-check-results.json`, queue and baseline in an immutable evidence subdirectory. Use a separate retry directory seeded from that full result, or keep the full sweep copy so a later subset cannot masquerade as a complete run. Retry only the observed issue cohort after reading actual error evidence. Do not retry around an access challenge, solve it, change sessions/cookies, weaken source guards or infer no requirement from a failed source.

## Completion checks

1. Verify the completed result count equals 591 and the source-ID set matches the manifest. Keep the actual first sweep time and any later focused retry times separate.
2. Compare final input fingerprints with the original manifest. Record the explicitly authorized NY/Oregon/equipment prose/metadata corrections; those do not change the cited URLs, passages, policy or source cohort. Any later source URL/passage/citation change requires a scoped followup, not a false identical-input claim.
3. Inspect retrieval failures, missing passages and content hashes using the saved actual primary bodies. PDF automatic passage matching is currently null: a successful PDF fetch is not proof that its quoted passage still appears. Read/extract the relevant PDF portions when an alert or new substantive question requires it.
4. Audit normalization-v4 migrations separately. `normalization-migration-audit.json` compares each newly retrieved body under the earlier v4 extraction with its retained v4 hash. Equal rows establish extraction-only migration; unequal rows require actual comparison. This avoids absorbing a real simultaneous text change into a normalizer version bump. The reconstructed v4 extractor was first checked against the previously retained Indiana observation and reproduced its exact hash.
5. Record only genuinely resolved occurrences in `research/batch3/editorial-resolutions.json`, supported by corresponding audit records. Reapply the exact ID/source/reason/hash and creation-before-review timestamp guard. A later identical occurrence must stay open. No source legal-review date is automatically advanced.
6. Preserve unresolved items in the snapshot and report. If a public snapshot combines the full sweep with scoped retries, explicitly name the cohort and separate timestamps; do not label the subset a fresh full sweep. Root handles the final build, Git, hosted workflow verification and deployment.

## Safeguards independently checked

All 152 pre-run decisions have matching audit records and seed queue identities with no duplicate decision identity or creation/review timestamp violation. Existing tests cover later identical ID/hash recurrence, preservation of reviewed content/dates, case-card dependencies, retained passage/qualification changes, official route scope, private-address/URL rejection, public/private snapshot separation and strict exit policy.

The final code review found one concrete maintenance defect: malformed retained queue/baseline JSON was silently treated as empty state. The loader now permits an absent cache but fails on malformed or structurally invalid retained state, preserving unresolved-history integrity. The added regression brings the editorial suite to 24 passing tests. This initialization-only guard was added while the network sweep was running; that run had already loaded the actual valid seed state, whose identities were independently checked. It does not change request selection, source fetching or extraction for that run. The manifest retains the pre-guard checker fingerprint and will record the final fingerprint.

The source checker still detects observations rather than certifying whole legal currency. A technical baseline, an extraction-only migration, a successful HTTP response, and a resolved transport item are not new legal reviews. Current PDF matching and already limited source scope remain explicit. The public source-status counts do not include private evidence or represent continuous availability.

The daily workflow is 01:37 UTC (02:37 CET / 03:37 CEST) with a 35-minute limit. RIS OGD requests use the advertised current-record API and linked XML, verify law/paragraph/document identity, run serially and wait at least two seconds between starts. That timing remains inside its advertised Austrian overnight window. The live HTTP monitor remains a separate 07:55 UTC task.

## Final completion (13 November 2026 UTC)

The complete sweep began at **01:57:23.281 UTC** and finished at **02:03:19.727 UTC**, checking all 591 selected cited-source records for 278 published guides plus public tools/site dependencies. It retrieved 576 and recorded **15 retrieval failures**, zero missing passages and zero content-hash alerts. The strict command exited 1. The original result, queue and baseline remain untouched under `artifacts/final-source-review/`.

A bounded retry beginning at 02:05:32.310 UTC checked only the twelve network/DNS failures, retrieving six. A separate one-record check at 02:08:30.695 UTC retrieved complete official eCFR Part 791 XML after a narrowly scoped readability repair. The part's entire 275-byte XML consists of `PART 791 [RESERVED]`; the repair requires the official full-part route, matching part number and complete reserved-only structure. It does not relax ordinary pages or establish absence of statutory joint-employer liability. Raw-body retention now occurs before extraction, including future HTTP-200 extraction failures.

The twelve-record retry's aggregate results JSON was overwritten by the subsequent one-record check in the same retry directory. Its six successful per-source JSON observations and actual raw bodies remain intact. The completion audit explicitly identifies this limitation; it does not reconstruct per-failure timestamps or headers. The original complete 591-record result is preserved. North Macedonia's separately saved retry error body says “upstream connect error or disconnect/reset before headers” and “connection timeout”; that is evidence about this attempt, not proof of the earlier whole cluster's cause.

The completion audit at **02:14:41.731 UTC** combines the original cohort with those bounded observations: **583 retrieved, eight unresolved retrieval items, 159 durable resolved instances**, zero missing passages and zero content-hash alerts. This is a mixed-time cohort snapshot, not a second full sweep. Both original and completion snapshots are appended to `src/data/editorial-snapshot.json`, preserving historical entries and exposing errors plus affected guide/tool paths on `/coverage/`. `public/source-review-status.json` carries matching scope and separate times. `artifacts/final-source-review-completion/` retains the combined audit, queue and baseline.

| Remaining source | Latest supported observation |
| --- | --- |
| Detroit Restaurants notice | HTTP 403 with the previously observed JavaScript/cookie challenge; no challenge bypass or invented JSON endpoint |
| Oregon ORS 650 | HTTP 403, actual “Forbidden / Access denied” response |
| Albania outward processing | Connection/fetch failure on bounded retry |
| Albania goods entry/exit | Initial DNS failure followed by connection/fetch failure |
| North Macedonia investment amendment | Initial DNS failure followed by HTTP 503 upstream connection timeout |
| Türkiye foreign-investment notice | Local DNS resolution failure |
| Federation of Bosnia and Herzegovina foreign-exchange law | Local DNS resolution failure |
| Federation enacted amendment PDF | Local DNS resolution failure |

No new proxy DNS-host exceptions were added. Prior reviewed bodies and legal dates remain intact; the open technical items do not establish changed law or no requirement. Three recovered PDFs were independently converted with `pdftotext`; the retained supporting passages and immediately relevant conditions were checked. Their automatic PDF passage field remains null rather than pretending the generic fetcher read PDF prose.

## Release-bound normalization audit and hosted older caches

The offline v4 comparison reproduced **378 of 378** prior hashes: 377 full-run migrations plus the recovered Brunei source. Of those, 24 normalized v5 hashes differ because extraction changed. The checked-in `research/batch3/normalization-migration-audit.json` binds only those exact source IDs, old/new versions and old/new hash pairs, with raw hashes and the complete offline audit digest. It establishes extraction-only migration for these observations; it is not a new legal review.

A different normalized hash across versions now opens `source-normalization-review-required` unless that exact pair matches the release audit. An old hosted v2 cache cannot match v4 evidence and stays explicitly unaudited. Identical hashes require no migration exception. The queued item persists even after the technical baseline advances; an explicit dated decision is still required. Reports and public summaries count migrations needing audit separately from detected source-content changes. The new release-bound check was added after the network run, then applied offline to the saved bodies/results; it does not claim the original command used the later guard.

There are **26 passing editorial tests**, including malformed-cache preservation, exact old/new migration binding, old hosted-v2 rejection, reserved-only XML, future identical-issue recurrence and strict exit policy. The final structural validator reports 290 guide records, 278 published, 640 sources, 390 rules, 703 candidates, zero errors and zero review notes. Root must verify the fresh hosted workflow after pushing; the older hosted run did not execute these repairs. The hosted result may correctly remain red for access, transport or unaudited historical-normalization items.

## Hosted verification after deployment: run 43351541720

The new strict workflow actually ran on deployed commit `b8b5345c5b58d45b069d9f2f04eadbfaa53a2315`. GitHub restored cache `source-review-43316465286`, then checked the same 591-record public citation cohort using direct transport from `2026-11-13T02:21:14.908Z` through `02:25:58.227Z`. It retrieved **537** records and recorded **54 retrieval failures, 57 unaudited normalization items and one passage miss: 112 open observations**. There were zero automated content-hash-change alerts. The command exited 1 as intended; readable summary, cache save and evidence upload all succeeded. The ZIP's SHA256 was independently checked as `0f8e9b2a53cb3a6288773e42d5a3e749342f6fda8e932d3e51ea55419145f999` before extraction. Original files and decoded job log remain under `artifacts/hosted-43351541720/`.

At `02:38:19.574Z`, the exact 57 normalization instances and one passage instance were resolved after actual evidence review. **All 54 original hosted retrieval failures remain open.** The hosted queue therefore has 115 resolved instances (57 retained history plus 58 new decisions), while the independent checked-in durable decision register contains 217 decisions across all runs/environments. Those are separate counts. `artifacts/hosted-43351541720-completion/` holds a separately derived completion; the original 112-item queue/result is unchanged.

Fifty version-2 hashes were reconstructed with the exact committed earlier extractor and relevant passage/selection, and one North Dakota version-1 hash was reconstructed with the original committed algorithm. Current normalized bodies match the hosted observations; raw-body equivalence is recorded separately, including 39 raw PDF hashes directly identical to their old version-2 hashes. These 51 exact source/version/hash bindings were appended to the migration audit. Current-body normalized equality does not certify irrelevant HTML outside the selected primary scope or whole legal currency.

Five further instances received explicit current-source/context review: EPA's changes were a typo, list presentation/conjunctions and an update line; Atlanta's complete text differed only in its view counter; Indiana's complete text differed only in the echoed checker User-Agent. All current dependent claims were read. The two Pennsylvania old raw bodies/hashes were not recoverable; the current complete official §316 and all current dependent claims were explicitly revalidated, preserving 90-day return versus 60-day-from-tender payment and eligibility/category/condition limits. Their decisions say **current-source revalidation; historical identity not established; technical baseline replaced**, rather than pretending the old and new bodies were proved identical. Source substantive-review fields were not automatically changed.

D.C. was a real source-content change, not an extraction-only migration. The new complete section adds bracketed §28-3904(b)(20) and punctuation. Both complete bodies, every dependent claim and the official §28-3820 cross-reference were independently read. The current cited (a)(5)/(7) material-misstatement/omission claims and applicability notes remain identical; the cross-reference itself says **Not Funded / creation not implemented**. The exact item was resolved as **content changed, current cited claims unchanged**, with bounded actual substantive review at `02:36:00.549Z`; this is not general D.C. clearance. `DC-review.md` retains the full evidence and rationale. The completion snapshot separately reports one editorially confirmed text change and zero original automated hash alerts.

The complete hosted Albania extracted body is 5,083 characters; hashing the retained excerpt reproduces the complete normalized hash, so this is not a snippet-only decision. Its actual authorization conditions contain `&euml;`/`&ccedil;` entities. Comparison-only equivalence now locates the existing passage without changing extracted text, raw/content hashes or normalization version 5. A subsequent two-source managed-cloud attempt retrieved the D.C. body but failed to connect to Albania. That separate dated connection observation remains in `artifacts/hosted-43351541720-dc-al-review/`; it is explicitly outside the 54 hosted-failure count and is not described as successful followup HTTP retrieval.

The independent 54-failure audit classifies 35 access/security blocks, 12 generic connection failures with unretained causes, four unreadable responses whose actual hosted bodies were not retained, one Portuguese maintenance response, one unresolved safety/redirect rejection and one Texas missing-resource response. No confirmed parser defect or route fix was established. Four managed-cloud successes do not reconstruct or resolve those original hosted failures. Details are in `hosted-fetch-failure-audit.json` and its three linked audit files.

The diagnostic repair now retains bounded actual HTTP-200 failure previews with full raw SHA256, status, type, size and final URL even without a raw-directory option; it also records redacted nested connection causes and rejected redirect trails/destinations. Failed-source JSON is written separately from earlier success evidence. URL userinfo/query/fragment and inherited proxy credential values are excluded from diagnostics, with bounded samples and regression tests. Public-host/TLS/private-address and redirect guards remain unchanged. These are future evidence improvements; they do not supply missing evidence for the original 54 failures.

The public JSON and compiled coverage history now show both the actual initial hosted 112-item result and the dated 58-resolution/54-open audit, preserving the earlier local 15-then-eight history. The maintenance workflow is correctly red for its outstanding technical queue; application CI/deployment status is a separate check. No new whole-corpus rerun is claimed after the diagnostic patch.

Final focused verification: 29 editorial tests pass; structural validation reports 290 guides, 278 published, 640 sources, 390 rules and 703 candidates, with zero errors and review notes. The new diagnostic capture is covered by focused tests but has not been exercised in a fresh hosted full sweep; no such run is claimed.
