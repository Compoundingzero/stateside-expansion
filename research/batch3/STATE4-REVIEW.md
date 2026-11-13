# State 4 publication handoff

Prepared 2026-11-13. AI-assisted primary-source review; no professional legal review. Proposals only; root owns canonical merge, publication checks, Git and deployment. Do not rerun `state4-author.py` after integration, because the complete replacement records preserve the canonical snapshot read during authoring.

## Deliverables

- `state4-guides.json`: 14 published proposals, comprising six distinct new guides and eight complete hub replacements.
- `state4-coverage-updates.json`: eight complete jurisdiction replacements, preserving existing employer-registration and unrelated topic fields.
- `state4-candidate-decisions.json`: all 32 assigned candidate decisions, with 23 scoped consolidations and nine explicit research gaps.
- `src/data/batch3-state4-sources.json`: 21 actually read sources, 19 primary and two official guidance. Existing source IDs are reused, including Washington's full statute, Rhode Island's active regulation, and original hub filing sources. No duplicate new source URL.
- `src/data/batch3-state4-rules.json`: 16 conditional rules. No transaction-specific legal result is labelled verified.

The eight proposed franchise matrices retain 11 verified, 27 conditional, nine not-researched and one unresolved dimensions. These are inherited plus newly scoped statuses across 48 independent dimensions, not eight complete state-law clearances.

## New distinct paths

| Path | Decision |
| --- | --- |
| `/states/washington/relationship-change-and-exit/` | Separate termination/cure, nonrenewal compensation, exclusive territory and asset records. |
| `/states/wisconsin/fair-dealership-change-and-exit/` | Independent dealership scope, exclusions and 90-day notice versus ordinary/nonpayment cure. |
| `/states/virginia/contract-law-and-competition-clauses/` | Enacted July 1, 2026 governing-law/retail-competition changes, negotiated-sale exception and SCC amendment instructions. |
| `/states/connecticut/termination-and-premises-notice/` | Independent relationship definition, cause, differentiated notice, premises service and compensation. |
| `/states/florida/investment-and-market-representations/` | Independent 817.416 supply/distribution definition and intentional investment/success/market-capacity claims. |
| `/states/oregon/renewal-and-additional-unit-disclosure/` | Different renewal, added-unit and owner-resale disclosure/change-evidence branches. |

## High-consequence checks

Washington: read actual full current RCW chapter. The pre-expiry termination branch does not promise a 30-day minimum or automatic day-31 termination. It preserves the continuing-cure branch, precise repeated-breach and immediate-ground conditions. One-year nonrenewal notice plus written nonenforcement of a competing covenant concerns the specified goodwill branch; other compensation remains separate. Annual registration renewal is at least 20 calendar days before expiry; material amendments precede further sale.

Wisconsin: read complete four-page certified Chapter 135, updated through November 4, 2026. The official two-page Civil Jury Instruction 2771 and its comment were retrieved in full through public web open. The comment expressly preserves 90-day notice in the nonpayment branch while shortening cure to 10 days; it is an older instruction, not presented as a newly decided case. No full appellate opinion was retrieved, so no independent case holding/history is claimed. Door-to-door, motor-vehicle-capacity and insurance exclusions remain explicit. No broad Chapter 553 definition conclusion.

Virginia: read complete current Chapter 8, complete current exemption regulation and complete April 14, 2026 SCC notice. The notice confirms enacted chapters 553/554 and July 1 effectiveness, FDD/contract changes and the pre-sale amendment branch. The JavaScript chaptered-bill page and unavailable legacy route were not used as substantive evidence. Current Code and agency notice are the actual source chain. The negotiated franchise-sale exception is at a mutually agreed price and no more than two years. No retroactivity conclusion. The statutory 72-hour voidability wording is not substituted for the administrative 14-calendar-day delivery rule. Specific annual exemption routes say 10 business days; general renewal paragraph says 10 days. Both are retained explicitly.

Connecticut: ordinary public `prdext3.cga.ct.gov/current/pub/` and `prdext2.cga.ct.gov/current/pub/` mirrors recovered complete actual Chapters 739 and 672c, despite main-host HTTP 503. They match the official 2025 edition. Read the 2026 supplement title index; neither chapter is listed there. This is not a guarantee that all later session laws are exhausted. The current 36b-61(2)(D) text matches the current claim form; former subsection numbering appears in history only. Location assistance is confined to the specified vending/display/amusement devices on third-party premises. Relationship provisions do not state the federal fee element. Ordinary 60-day, abandonment 30-day, specified conviction and real-property nonrenewal six-month branches remain separate. Actual lease notice/service/court requirements are not reduced to ordinary email. Covered non-exempt business-opportunity disclosure uses ten business days, not a federal fourteen-day proxy; registered-opportunity renewal and immediate material-change notice are separate. Actual section 67 earnings-data, inconsistent-claim and Act-compliance-reference provisions support the narrow advertising update.

Rhode Island: read complete definitions, jurisdiction, delivery, general registration and change sections. Read actual active rule in public web open. The statute expressly permits a different duration by rule/order; active 1.4 supplies the 365-day periods. Preserve statutory renewal filing 30 days before expiry and prompt material amendments. Registration exemption is not automatically a delivery exemption. General operating-relationship research remains open.

South Dakota: read complete sections 6, 7, 11, 17, 18 and 26. No ordinary disclosure-update filing under section 7 is separate from annual notice renewal and director-request powers. The seven-day prospect-initiated-negotiation wording in 17(2) does not silently erase the separate materially different signing-terms rule in 26(7). First-class mailing is at least three days before the required delivery date, not three days before signing. Signed receipt retention is three years. Definitions/jurisdiction and exemptions 12–16 were not recovered, so no new classification or exemption conclusion.

Oregon: actual official 2025 general statute sections and complete current administrative Division 325 were read through public web retrieval after direct failures. Renewal conditions are conjunctive; added-unit conditions differ. Resale provisions 0030 and 0040 are displayed as separate texts without claiming to resolve every overlap. Fourteen days covers all proposed agreements and refundable deposits in the ordinary branch. General operating-relationship/sector research remains open.

Florida: read complete actual 2026 section 817.416. Its four-part definition includes substantial basic-goods supply reliance; goods can include articles consumed in an approved service. Intentional misrepresentation and actual civil showing are preserved. Fees are discretionary and reasonable costs mandatory on the stated showing; no recovery forecast or universal termination right. The original annual exemption-notice fee/packet remains an honest unresolved pre-filing task.

## Access and verification accounting

`state4-fetch-counts.json` records 49 direct attempts: 26 HTTP 200, 18 HTTP 503, four HTTP 404 and one HTTP 403. Two HTTP 200 responses are expressly non-substantive: Virginia JavaScript shell and unavailable-document message. Repeated mirrors are access attempts, not 26 distinct verified legal sources. Public web retrieval separately supplied readable Oregon statute/rules, Wisconsin jury instruction and Rhode Island active rule. Three new source records use day-precision retrieval timestamps because the web tool did not supply exact times; direct downloads retain exact UTC times and hashes in ignored raw metadata.

Persistent narrow source blocks: South Dakota definitions/jurisdiction/exemption bodies and Wisconsin Chapter 553 in this session. Connecticut primary bodies and Virginia narrow 2026 changes were recovered through the stated independent official source chains. No blocked source was turned into a published legal claim or a none/zero conclusion.

All 21 new short quotations matched whitespace-normalized actual saved bodies exactly and remain within 25 words each. Guide/rule/source references resolve; no duplicate proposed path or duplicate new source URL. Public prose received an explicit normal-spacing review; identifiers such as `21VAC5-110-75` and the inherited official `ReEmployCT` name are intentional. The first global validator run passed with zero errors. A later concurrent run reported one unrelated industry rule referencing missing source `b3-i2-ca-law 2026`; root was notified. State4's own checks pass; its six proposed new dependent-path review notes are expected before canonical merge.

## State 2 independent peer review

Read actual saved primary bodies underlying Idaho, Colorado, Montana, Wyoming, Alabama, Arizona and Missouri state2 proposals, including the high-consequence operative definitions, exclusions, notices/cures, repurchase and remedy provisions. No material legal-claim blocker found within the guides' stated scopes. Root received concrete inherited typography corrections before this batch began. No state2 file was edited by this agent.
