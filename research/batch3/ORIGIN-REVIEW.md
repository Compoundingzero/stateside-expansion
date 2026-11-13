# Seven European origins — publication handoff

Reviewed November 13, 2026 with AI assistance. No professional legal review is represented. Canonical origin and guide files were not edited. Seven narrow guide proposals, seven conditional rules and seven complete coverage replacements are ready for root review.

| Country and proposed path | Country-specific decision | Evidence and limits |
| --- | --- | --- |
| Sweden — `/from/sweden/` | Establish the buyer’s business use and receiving establishment, then keep the supported SEK box 40 return entry. | Actual Skatteverket English page; property, cleaning, event and other exceptions remain explicit. No U.S. VAT system is invented. |
| Denmark — `/from/denmark/` | Check Danish use of rights, consultancy and related services before omitting Danish VAT; preserve business proof and box C support. | Actual Danish Tax Agency page, including distinct goods-export and services tracks. |
| Norway — `/from/norway/` | Test whether the service is remotely deliverable by its nature, identify the actual foreign recipient and keep address evidence. | Live current-route official handbook, displaying its 2025 edition, reproduces current § 6-22 and explains the 2023 amendment. Historical appeal KMVA 8152 is used only for its invoice/recipient evidence lesson, with the actual final disposition accurately separated from the tax office recommendation. |
| Finland — `/from/finland/` | Establish the receiving fixed establishment and keep the Finnish return entry for qualifying non-EU service sales. | Full Vero English page. Its broad “small business” wording is not interpreted as a turnover exemption. VAT fixed establishment does not decide income-tax permanent establishment. |
| Austria — `/from/austria/` | Identify the third-country business customer and receiving place before copying EU UID/reverse-charge routines. | Actual current RIS § 3a body for the cited paragraphs, current Ministry guidance and WKO’s specific third-country evidence explanation. Broader statutory exceptions are not exhaustively surveyed. |
| Belgium — `/from/belgium/` | Map the Benelux/EU basic mark and office-of-origin route before pursuing international protection. | Complete actual FPS Economy official pages. Madrid designation is distinguished from automatic national protection; no live mark search, filing basis or fee is approved. |
| Switzerland — `/from/switzerland/` | Record the actual U.S. recipient’s relevant Swiss-U.S. certification or another lawful transfer route. | Actual current FDPIC guidance and FOJ adequacy list, plus the official assessment’s scope/certification sections. No specific recipient was checked and other processing duties remain open. |

## Files and exact counts

- `origin-guides.json`: seven proposed published origin guides with country-specific decisions, original explanations, labeled fictional examples and practical outputs.
- `origin-coverage-updates.json`: seven complete origin replacements. Only five narrow VAT topic statuses and two narrow IP/data statuses become conditional. The other 63 topic statuses stay not-researched.
- `src/data/batch3-origin-sources.json`: 15 source records, comprising two primary documents and 13 official guidance records. The primary documents are the actual Austrian statutory text and the actual historical Norwegian appeals decision.
- `src/data/batch3-origin-rules.json`: seven conditional rules; no blanket country clearance.
- `origin-counts.json` and `origin-fetch-counts.json`: machine-readable counts and scope.

These VAT issues occupy the existing corporate-tax topic bucket without claiming corporate-income-tax coverage. Belgium’s trademark issue does not establish privacy coverage; Switzerland’s transfer issue does not establish trademark coverage. Shared U.S. treaty or immigration facts were not counted as home-country research.

## Access and provenance

Twenty standard curl requests produced 16 HTTP 200, three HTTP 503 and one HTTP 404 responses. Three Belgian HTTP 200 responses were challenge pages and were not accepted as substantive reads. The complete two Belgian official pages were subsequently read using ordinary public web-open retrieval; no challenge was bypassed. Austria’s direct current-text and alternate official URLs returned 503, but public web-open returned the actual current page metadata and cited statutory body. Its later tail retrieval failed. The guide establishes only the cited general-rule scope and leaves the full exception survey open.

Three saved web retrieval representations have day-precision fetch dates because the retrieval tool did not expose an exact request timestamp; local preservation times are separately recorded in the raw web log. Their hashes identify the saved readable representation, not original HTML. Other cited sources preserve exact curl timestamps and raw-response hashes. Fetch time and substantive review time remain separate.

The Swiss FOJ page’s U.S. table cell is in its public HTML hydration payload. The cell was decoded from the actual downloaded page and preserved as `swiss-adequacy-table-extract.txt`, with the original page hash retained. The qualified U.S. entry was not inferred from a search excerpt. Its source page is published January 22, 2026 and labels the table as updated September 15, 2024. The April 30, 2024 assessment is explicitly a historical assessment, not the final amendment or a present certification check.

Raw bodies and logs remain ignored under `research/raw/batch3/origin/`. No access control, login or cookie challenge was bypassed.

## Verification and unresolved work

All 15 short supporting excerpts match the saved bodies after whitespace normalization and contain at most 25 words. Guide, section and rule source references, path uniqueness, reciprocal dependencies and coverage-source references pass. The global validator passed with zero errors before canonical integration; warnings for proposed paths are expected until root merges guides. A final readable-English pass repaired date and return-box spacing while preserving literal quotations, URLs and identifiers.

German and Norwegian source interpretation was AI-assisted and is labeled accordingly. The Norwegian 2014 decision’s complete final disposition was read; subsequent appeal status is unverified and no current-case-law clearance is claimed. Broader home-country corporate tax, withholding, transfer pricing, foreign exchange, export controls, immigration and employment remain open unless another published guide independently covers them. Actual transaction, fixed-establishment, customer-use, right-ownership and recipient-certification facts still control application.

Root should merge by canonical path, merge the seven coverage records by ID and run global publication checks. These seven publications can close only their named narrow origin-guide decision, not all origin topics or the separate state franchise research backlog.
