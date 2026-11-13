# Employer account comparison audit

Reviewed in the cloud workspace on 2026-11-13 UTC. AI-assisted primary-source review; no professional legal review.

The proposal is `/us-expansion/state-employer-payroll-registration/`. It is one reference guide with original state-specific account decisions, a preparation workflow and a fictional cross-state hiring example. It does not create 51 repetitive standalone pages. The 51 coverage updates are partial updates only; canonical `states.json` was not edited by this agent.

Final counts: 97 first-party official source records, 51 scoped conditional rules, 51 state/D.C. entries and one guide. Four source records are primary online legal texts; the remainder are official agency guidance, forms or instructions. Every supporting passage is checked verbatim against the normalized downloaded body by `build-employer.py`. The scope locator and notes specify what was substantively read; a large handbook download is not represented as a complete review of every topic within it. Raw HTML/PDF bodies and retrieval logs are ignored under `research/raw/batch3/employer/`.

Withholding cells: 40 conditional, 8 narrowly not applicable, 2 unresolved (Arizona and Michigan), and 1 not researched (Alaska). UI cells: 44 conditional and 7 unresolved (Colorado, Kansas, Nebraska, New Mexico, North Dakota, Ohio and Vermont). Conditional cells establish only their displayed proposition, sometimes an account procedure without a complete coverage determination. The broad coverage updates are conditional employment for all 51 entries and conditional Corporate & tax for 48 entries with a reviewed withholding proposition. All other topics remain untouched. The new detailed subscopes and limits are necessary to interpret those broad labels.

The eight negative personal wage-income-tax cells rely on explicit evidence: Florida DOR; South Dakota DOR; Nevada Constitution; current Texas Constitution; Washington DOR; Tennessee Revenue's dated June 2021 FAQ; New Hampshire's official economic-development salary guidance; and Wyoming Business Council's economic-development guidance. The latter economic sources are identified as such, and their statements are limited to personal wage-income tax rather than other business or payroll taxes. Alaska's attempted DOA/Commerce pages were blocked; no negative Alaska wage-tax conclusion was inferred from that access failure or from a missing tax category.

Important source-specific boundaries retained in the public material:

- California's business registration threshold and its household threshold differ; neither is described as a universal UI contribution test.
- Arkansas's ordinary ten-day UI employer category is distinguished from domestic/agricultural and other categories.
- Connecticut's entity, LLC election and paid-officer discussion is state-specific.
- Massachusetts's $200 statement is explicitly the agency's out-of-state UI category, not a universal allowance or withholding threshold.
- Nevada's $225 statement is explicitly a general UI rule, not a business-tax exemption.
- New Hampshire Emp 303.01 was amended effective June 26, 2026 and covers status and business/workforce transfers as well as first employment.
- Oregon, Washington and Wyoming joint application identifiers do not collapse the separate programs' legal tests.
- A Hawaii withholding page, a Georgia UI FAQ and Iowa UI guidance contain older or internally inconsistent material outside the account propositions used. The disputed annual/form/credit details are excluded and limitations are retained.
- Montana, Tennessee, Michigan, Wisconsin and other portal material establishes its specifically described account/authorization functions, not an unreviewed full UI coverage test.
- Nebraska's current new-employer process remains unresolved: its short One Stop listing is limited and the downloaded expanded guide contains older 2021/2024 sections. No current threshold is fabricated from that material.

Recovery of access did resolve several initial gaps: official `www1.maine.gov` mirrors supplied the full Maine withholding FAQ and ReEmployME guide; Kentucky's January 2026 KUIP FAQ and employer page supplied account instructions; Ohio's official asset CDN supplied its 2026 withholding guide; and Maryland's current Comptroller domain supplied 2026 withholding/CRA guides. A New Mexico HTTP 200 challenge body was not counted as a read handbook. An HTTP 200 without substantive source content is not successful verification.

Texas Legislature provenance deserves special attention. The old `statutes.capitol.texas.gov/Docs/...` routes returned an Angular application shell. Its own linked public application declares `TCASCore=https://tcss.legis.texas.gov/api/` and `FileServerPath=https://tcss.legis.texas.gov/resources`. The public `GetStatute/GetStatute/CN/CN.8/8.24-a/null/null/null/null/null/null/null/htm` request returned the official resource URL. Fetching `https://tcss.legis.texas.gov/resources/CN/htm/CN.8.htm` supplied actual current Article 8, including neighboring November 2025 amendments. The older privately published compilation hosted by the Comptroller and the application shell were not used as the public source for that constitutional proposition.

Source dates remain separate from retrieval and review. Exact publication days were left null for month-only or revision-only dates. The root may use the user's Pacific date for the guide's display review date; UTC fetch timestamps remain unchanged. This batch does not supply annual payroll rates, a full reciprocity/localization inventory, local-tax clearance, corporate income-tax clearance, worker-classification outcomes, wage/hour coverage, work authorization or a complete paid-leave/workers' compensation analysis.
