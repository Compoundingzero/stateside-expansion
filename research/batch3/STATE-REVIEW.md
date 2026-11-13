# State publication handoff — November 13, 2026

AI-assisted source review; no professional legal review. Five new narrow publications are proposed. All four prior holds remain held. Canonical guide and jurisdiction files were not changed by this work.

## Proposed publications

| Path | Decision and practical output | Important limits |
| --- | --- | --- |
| `/states/california/janitorial-employer-registration/` | Map each provider, franchisee and recipient; prepare entity-specific registration and annual renewal evidence. | This operating registration does not decide franchise sales law or worker classification under another law. |
| `/states/california/janitorial-training-records/` | Calendar new-position and recurring training, verify the provider/content and retain proof. | Covered-worker and successor facts matter; annual registration is a separate cycle. |
| `/states/california/pay-floor-and-manager-duties/` | Check the 2026 state floor and actual local/industry requirements; assess executive duties separately from salary and total employment cost. | The $70,304 annualized figure is arithmetic for one salary component, not an exemption ruling. No 2027 California rate is supplied. |
| `/states/texas/worker-classification-unemployment-tax/` | Prepare a fact-and-evidence assessment under TWC’s unemployment-tax classification guidance. | Twenty factors are not equally weighted votes. No federal tax, FLSA or other-state result is inferred. |
| `/states/new-york/wage-region-and-industry/` | Select actual region, wage order, category and payroll period before costing staff. | Dated 2026 agency posters establish the cited current rates; a 2027 announcement and Governor’s proposal remain distinct. Residential janitor rules are not generalized to commercial cleaners. |

Proposal files: `state-guides.json` (5 new publications and 4 held updates), `state-jurisdictions.json` (4 complete replacements), `state-origins.json` (Laos complete replacement). Data files: `src/data/batch3-state-sources.json` (18) and `src/data/batch3-state-rules.json` (6, all conditional). Eighteen sources comprise 4 primary agency-hosted regulations/orders and 14 official guidance documents. Three U.S. employment topic statuses move from not-researched to conditional; the broad state legal dimensions stay unchanged. Laos commercial feasibility is explicitly unresolved.

## Four held-guide outcomes

1. **California core — blocked.** DFPI application instructions, financial-assurance guidelines and broker materials, Leginfo, and the OAL-authorized Barclays public CCR route return 403 through ordinary retrieval. Long indexed extracts were not used as full text. No guarantee, capital-infusion, fee-deferral, escrow-release or surety terms were invented. A chaptered SB 919 copy was read on LegiScan as a research lead; its operative trigger is §31528, while §31527 concerns disclosure-document contents. Current primary consolidated text and broker workflow remain open. The official November 9, 2026 final Senate budget report records $125,000 for SB 919 IT enhancements. The official May 14 proposal planned July 2027 implementation. These do not establish the exact enacted appropriation date or a live registration workflow, and make an old unfunded-program snippet unsafe as a present conclusion.
2. **Mississippi — draft.** The SOS official code-publisher page and its free Lexis route were read. Lexis returned a public browser/cookie bootstrap, not the current statutory text. Current §§75-24-51–63 and later controlling authority have not been verified. The historical 2018 enacted bill remains identified as historical, and a third-party current-code mirror was not substituted for the missing primary review. A separate motor-vehicle agency statute was retrieved but does not establish general service-franchise law and is not used to release the guide.
3. **Laos — draft.** The official Trade Portal’s Decision 333/BOL of March 7, 2024 and its original 10-page Lao scan were recovered. The first and last pages were visually inspected; the whole scan was not reliably translated. The added source verifies document identity and existence only. The BOL December 2025 file still returns 503, and later implementing/current amendment scope remains unresolved. The January 2026 U.S. ITA country guide is read official context, not operative Lao law. No numerical FX deadline/percentage, lawful netting or goods/services/IP/outward-investment conclusion is published.
4. **OctoClean — blocked.** The complete official September 2023 order again returned 403 through curl and web retrieval. No alternate complete official original or later-order reconciliation was obtained. No final-order terms or actual compliance performance were inferred from indexed excerpts or an enforcement summary.

The original four source blockers were not solved by publishing unrelated state issue pages. The five additions have their own useful decisions and outputs.

## Access and verification evidence

Raw responses and timestamped fetch logs are ignored under `research/raw/batch3/state/`. `state-fetch-counts.json` records 53 standard curl attempts: 37 HTTP 200, 10 HTTP 403, 4 HTTP 404 and 2 HTTP 503. Initial Python urllib attempts and separate web-tool failures are retained separately and are not included in that curl count. Default proxy and TLS settings were preserved; no challenge, login or access control was bypassed.

An HTTP 200 was not treated as a substantive read automatically: the Mississippi Lexis and Texas statutory routes returned browser/application shells. The Lao scan is only partially reviewed. Read source records preserve actual fetch timestamps and hashes separately from the later substantive review time; publication dates without a known exact day remain null with the displayed month recorded in notes. Sources supporting the five published proposals have actual readable bodies.

All 18 supporting excerpts were checked against whitespace-normalized downloaded bodies and are at most 25 words. Source and rule references, proposal uniqueness, reciprocal dependencies and arithmetic checks pass. Global `node scripts/validate-data.mjs` passed with zero errors before root integration; dependency warnings for pending proposals are expected until root merges the guides. A prose sample found no run-together words beyond literal entity names/identifiers. Editorial source sampling was requested; it is not represented as completed independent review.

## Publication gate

Root should merge proposals by canonical path, preserve the four held statuses, then run the global validator and site checks. Coverage replacements preserve all six independent franchise dimensions and do not assert comprehensive employment, state, local or home-country clearance. The five state-issue pages should be related links for relevant broader research candidates, not proof that their entire scope is complete.
