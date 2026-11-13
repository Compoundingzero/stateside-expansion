# ELN continuation release — 12 November 2026

The public brand is **ELN — Enterprise Licensing Network**. The existing GitHub repository, Railway project/service and public hostname remain stable.

## Delivered in this batch

- Interest form: name, company, optional ARR and email. ARR accepts a currency/amount, not recurring or not known.
- Contact form: comments and email. No public operator email or country field is added.
- Private owner board: Interests and Enquiries tabs, New / In progress / Closed lanes, status updates, deletion and authenticated CSV exports.
- One-use owner setup, password sign-in and sign-out. The owner chooses a password through a private fragment-based link. That link is delivered privately and is never stored in the repository, public HTML, analytics or query strings.
- Persistent SQLite storage on one Railway volume, separate from anonymous browser-local expansion plans. Forms do not send any confirmation/marketing emails and do not copy planning inputs into submissions.
- Application retention of 365 days, early owner deletion, no public record/export endpoint, exact-origin mutation checks, bounded input/abuse controls, safe CSV handling and hashed owner credentials/session tokens.
- 75 additional published guides after source/applicability review, including state, territory, origin-country, regulated-sector and real-case work.
- Human-readable source-check summaries, supporting-passage checks, separate baseline migrations, explicit dated review resolutions and public technical-check snapshots.

## Inventory

Historical snapshot for commit `6087c53`; superseded by `RESEARCH-RELEASE.md` and the current `docs/coverage-report.json`. At that release preparation: **175 published guides**, **9 drafts** (7 merged editorial aliases and 2 actual unpublished research guides), **2 blocked guides**, **289 source records**, **177 canonical rules** and **9 planning tools**. All 175 published guides have dated AI-assisted source review; none has professional legal review.

There are 603 outstanding candidate paths after excluding matches to published guides. Candidates never generate public article routes. The register still contains all 50 states and D.C., five separate territories, 70 origins/dependencies and 40 market records. Thirty-six markets have narrowly researched procedures, one has authority-referral evidence only, and three remain blocked. Seventeen origin guides are published; the Lao currency guide remains unpublished because later primary text could not be read.

The state survey remains incomplete by independent dimension. A tax, equipment-dealer, consumer-law or proposed-bill-status guide does not establish the whole state's franchise regime. Mississippi remains draft; California remains blocked. The OctoClean narrative is also blocked. Qargo is now published as a bounded historical complaint/reported-settlement lesson; final-order remedy terms remain unreviewed and are not stated.

## Verification

- 28 calculation, editorial, public-site and submission-service tests pass.
- Eight existing journey/privacy browser tests and eight new intake/owner-board tests pass against a disposable local database.
- The submission tests verify real stored records, one-use setup, history-fragment removal, cookie/privacy boundaries, status persistence, deletion, CSV downloads, mobile fit and failure/retry behavior.
- Dependency audit reports zero vulnerabilities.
- Independent editorial sampling read actual primary bodies and led to corrected NC/SC/Louisiana definition scope, Ohio procedural proof-burden context, Thai trigger dates, and several public-prose fixes. The sampled review is retained in `research/batch2/INDEPENDENT-REVIEW.md`.
- The continuation technical source check visited 247 cited source records; the initial pass established 241 baselines and recorded six retrieval issues. Targeted follow-ups retrieved a large American Samoa PDF after the bounded PDF allowance was expanded. Three public agency pages also responded through the inherited HTTP proxy while local DNS prechecks failed; those are technical access matters, not legal changes. The queue retains unresolved observations and never silently refreshes source-review dates.

CI runs both browser suites against a fresh temporary local database. The test setup token is intentionally disposable and cannot claim a production owner. Live QA must never use the production bootstrap link to create a test owner. After deployment, verify the mounted database and dropped UID through the non-sensitive storage-ready log, then perform a controlled restart and confirm the existing database is retained. Valid records and owner enrollment are tested on a disposable database; do not create a live test owner or leave fictional leads in the production board. Record the actual deployed commit/status and live checks under cloud `artifacts/live-verification.json`.

## Owner access and operations

Open the privately supplied setup link once, choose a password of at least 12 characters, then use `/owner/` for future visits. Sign-in sessions last 12 hours. No public email is required for the single owner account. Anyone without the session receives no submission records or CSV. The owner should manage exported copies with the same purpose and retention discipline.

See `docs/BOARD-STORAGE.md` for the exact volume/mount/permission configuration and deployment assumptions. Preserve the `eln-data` volume; never replace or detach it during an ordinary application update. Runtime initializes storage and drops privileges before accepting HTTP. Builds/predeploy steps do not open the database. This one-instance volume topology can briefly interrupt requests during deployment; it is not a zero-downtime or replicated database design. No backup schedule is configured by this release.

A forgotten owner password requires authorized hosting maintenance. Rotate the bootstrap secret before resetting owner credentials; do not delete or recreate the submissions volume. Never put a setup link, password, session token or real submission data into Git, chat logs shared with others, public URLs or issue bodies.

## Next research work

Finish the independent franchise dimensions and applicability/exception evidence for each jurisdiction; reacquire California and OctoClean official full text; expand current origin evidence and local address/sector overlays; and review the remaining source-access issues. Keep source fetch time, substantive review time and publication time distinct. The next batch must continue to earn publication through distinct evidence and practical utility.
