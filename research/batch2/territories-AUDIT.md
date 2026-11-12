# Territory and local continuation audit — 12 November 2026

Reviewer: AI-assisted primary-source review; no professional legal review. These files are proposals until the launch owner merges, validates and publishes them. No Git or Railway mutations were performed by the authoring agent.

## Publication proposal and merge contract

- 14 distinct guide proposals: five territorial hubs, a customs-boundary comparison, two people/staffing guides, and six municipal guides. All are marked published as proposed final state; root owns their actual publication.
- 22 new source records and 18 new scoped rule records are in the automatic src/data batch datasets.
- Five complete territorial jurisdiction replacements retain the existing IDs/slugs; topic cells:25 conditional,24 not-researched,1 unresolved. No territory is fully researched.
- Ten municipal replacements: six contain substantive newly reviewed administrative processes, Chicago contains only a narrow authority/issuance referral finding, and three remain unresearched. Do not count Chicago as a complete application process.
- One canonical source update is proposed separately for existing state-pr-law. Reuse fed-timing and fed-exemptions; do not create duplicate federal disclosures or duplicate Puerto Rico source rows.

Merge research/batch2/territories-guides.json by canonical path; merge territories-jurisdictions.json by jurisdiction ID into states.json and markets-updates.json by market ID into markets.json. Apply territories-source-updates.json by source ID to the existing canonical source file. Do not load proposed jurisdiction/market arrays twice.

All guide-source, guide-rule and rule-source references, path uniqueness and existing replacement identities passed the bounded authoring check. Every rule dependentPath names a proposed guide; root validation should run after merging those proposals.

## Findings and limits

Federal location scope: current 16 CFR §436.2 expressly includes a franchise to be located in the United States or its territories, with exemptions separately. The current eCFR page and the 2026 official CFR part were read. This does not settle separate territorial definitions, filings, relationship laws, tax, immigration or operating licenses.

Customs: current 19 CFR §101.1 defines U.S.customs territory as states, D.C. and Puerto Rico. The published comparison uses that definition only. It does not provide rates, origin classifications, quarantine approval or corporate tax treatment. A 2026 GAO Guam customs report was used as context but no proposal or alternative model in that report is described as enacted law.

Puerto Rico: official Spanish Law75 PDF was read in full. It is a consolidation revised 13 November 2020, with listed amendments through 2000. Published text describes its express dealer/service and termination/impairment/nonrenewal provisions, while keeping actual dealer status, current case law and later amendments unresolved. Article 3B/3C forum/arbitration wording is not published as an absolute rule because controlling federal law/preemption questions were not researched. This is an English AI-assisted summary, not an authorised translation.

Guam: legacy judiciary .org URLs returned 503 and old .gov paths returned 404. The current official Compiler of Laws site at col.guamcourts.gov was discovered and its PDFs were downloaded/read. Corporate Chapter 7 carries an older 2007 compilation footer; service-license Chapter 76 an older 2011 footer; the current general-license Chapter 70 PDF has a 23 December 2025 footer. These are current files served by the official compiler, but no representation is made that every later enactment or case was independently checked. Source fees were not hard-coded as current universal costs. Covered services, employee services, profession/trade routes and statutory exceptions remain separate.

U.S. Virgin Islands: full DLCA operating-license guidance was read, including the difference between initial tax-clearance requirements and renewal confirmation. Some linked agency endpoints are old. A third-party code lead identifies 12A V.I.C. §§130–137, but authoritative full territorial relationship text was not established in this batch; that dimension remains unresolved, with no published notice-period or franchise-definition claim.

CNMI: official 4 CMC §5611 PDF was read with its amendment/source comments; it calls for a business-line/location license, one-year/nontransferable terms, and regulatory fees. Registrar entity document lists are a separate workstream. The full current DOL CW-1 program page was read, including employer, wage, recruitment and certification sequence. No cap allocation, visa approval, individual eligibility or commencement permission is implied. A certification does not replace USCIS permission.

American Samoa: official AG foreign-corporation checklist, Commerce renewal page, LegalAffairs entry/residency pages and relevant business/immigration sections of the official2024 Administrative Code were read. The Secretary’s statute link led to a Fono website exposing only a small shell; the complete current ASCA statutory definitions were not verified there. Possible differences between statutory ownership/residency categories reported in nonofficial leads and the administrative review wording must be resolved against current primary statutory text before classifying an applicant. Published content gives no automatic identity/status test and avoids treating a mainland U.S.visa as territorial approval. Independent Samoa (.ws) sources were discarded as a different country.

Municipal findings: Pittsburgh registration can include outside firms performing city services; Atlanta connects zoning and occupation-tax applications in separate systems; Miami distinguishes City of Miami use/tax and Miami-Dade receipt processes; Jacksonville explicitly separates CertificateofUse from issuance of the tax receipt; KCMO identifies zoning and sector gates; Baltimore correctly separates city/county Clerk and state-tax questions. Chicago’s Clerk page only establishes where an already-approved license is printed/issued and refers ordinary application review/payment to BACP.

## Exact next research queue

1. **Puerto Rico relationship/filings:** obtain current amendment history and controlling decisions on dealer status, impairment, just cause, remedies and arbitration; then research sales registration/notice/disclosure/advertising dimensions independently. Do not approve an agreement from the statutory summary.
2. **USVI relationship:** obtain authoritative12AConsumerCode franchised-business text and amendments/cases; identify applicability thresholds and any notice/cure/renewal/transfer rules only after that review. Separately verify current DLCA category instructions and board rules for the actual service.
3. **Guam service opening:** confirm current DRT category/application and renewal instructions; identify exact regulated trades, professional credentials, fire/land-use/environmental/health conditions. Verify the entity’s actual activity against statutory exclusions, rather than assuming every remote parent must qualify.
4. **CNMI line/location + people:** obtain current Finance business-license regulations and form; map each line/location; verify employer/job-specific CW1 steps, actual current wage, petition/cap/status facts and opening dependencies. Research territorial dealer/sales rules separately.
5. **American Samoa ownership + work:** obtain authoritative current ASCA 27.02/30.03/41 provisions, later rule changes and agency confirmation of applicant-review category; research exact sponsor/work requirements and any trade permissions before relying on a trainer’s presence.
6. **All five territorial overlays:** select actual island/municipality/village, parcel and sector. Establish land/use/occupancy, construction, accessibility, fire, environmental, sanitary and special-jurisdiction authorities. Investigate employment/tax/customs/product obligations family by family; country/treaty/mainland assumptions do not close them.
7. **San Jose:** official public Finance pages and published flyer returned403 in direct fetch and official-page web fallback. Obtain an accessible official form/code instruction or agency-provided publication before promoting the process. Do not use search snippets as verification.
8. **Detroit:** current official BSEED pages and linked procedure PDF returned403. Obtain accessible current official category, use/occupancy and license instructions. Old procedure snippets are not a published current workflow.
9. **Indianapolis:** official business-license page exposed only a JavaScript shell through direct and web retrieval. Obtain accessible official category-specific text/form or code and confirm Unigov/excluded-municipality boundaries before status change.
10. **Chicago:** read current BACP category, zoning, permit, inspection, fee and renewal rules; current BACP / Business Direct fetches were denied. Clerk role evidence alone does not satisfy those tasks.
11. **Six repaired local markets:** deepen the named process for actual B2B cleaning/facilities/technical services. Each county/special district, professional/trade rule, wage/tax issue and customer-site requirement remains separate. A procurement/insurance condition must not be labelled law.

## Evidence inventory

Raw bodies/PDFs are under ignored research/raw/batch2/territories/. They are working extracts, not published page content. The following records retain the fetched byte hash and a short supporting passage. Fetch time, substantive verification and publication/modified dates are distinct.

|Source ID|Official URL|SHA-256|
|---|---|---|
|b2-territories-customs-boundary|https://www.ecfr.gov/current/title-19/chapter-I/part-101/section-101.1|6c171a2be9dd823f6e35bce3960350738219fe45b2de3e4f7ab653e058ef2f61|
|b2-territories-guam-foreign|https://col.guamcourts.gov/sites/default/files/18gc007.pdf|6cf2b61436593dcacb144e77a16e5d4e0c33f0de5862d2dc6133fdcf5ad40a37|
|b2-territories-guam-license|https://col.guamcourts.gov/sites/default/files/11gc070.pdf|663dfd193beefac9a5e770d65c7b2b77825a3700c68578b8a314b972244ab6ce|
|b2-territories-guam-service|https://col.guamcourts.gov/sites/default/files/11gc076.pdf|15922b590282c0d6423d4c7e2dc50b18553add6ee9c6e8af022673aa7cf02c66|
|b2-territories-guam-blpc|https://bsp.guam.gov/blpc/|ed25aa509052d62f2666e9db8d73192c78d8a0e62c641c8a31369c3484db924a|
|b2-territories-usvi-licensing|https://www.dlca.vi.gov/businesslicense/steps.htm|ccb6f660c4d44e9aa1df154cad26f751f3789cc4b9449dd99db558116146c47f|
|b2-territories-cnmi-5611|https://cnmilaw.gov/docs/cmc_section/T4/5611.pdf|c5133b364da84bcc98d1fe1c85bbd82c588ee2cbe2e4042d98e18e24f67bc141|
|b2-territories-cnmi-registrar|https://registrar.cnmi.gov/resources/|eed752acb4bee109adbfbe4eea1159b29fa80e0ae2522ff40b781b06f82bb679|
|b2-territories-cnmi-cw1|https://www.dol.gov/agencies/eta/foreign-labor/programs/cw-1|1c74aa666ccea93e4e8a2db72beb0b97240ffdb5e837098daf228728104f489b|
|b2-territories-as-foreign|https://legalaffairs.as.gov/_files/ugd/dba42c_72df88fe75484235959fc0137fbd5d46.pdf|fbc41b9253c379c17fe9a704446fea7ecfa170c0201caeccb927eb20845ac07c|
|b2-territories-as-license-renewal|https://doc.as.gov/applyforbusinesslicense|d01725b9e78ddff483b91354fdaf63170355ebb331e4d02a3d36577355ef0ba4|
|b2-territories-as-commission|https://www.osas.as/_files/ugd/4c56eb_4230571f871d4c7590fbe5ae9b1f771b.pdf|85bcdfd81ff63c3b60c06bfd124803e4566ef7564f5430f2e41dfeed5ccce18e|
|b2-territories-as-entry|https://legalaffairs.as.gov/visa-entry|bb86ad50d9e09cb1048aedb43cdbc5d6fcb3039dc4b98308b00d973cfc597aeb|
|b2-territories-as-residence|https://legalaffairs.as.gov/residency-classification-2-0|3b60d5adaaa420fd4d2d635f771adb450b92dfb233b6a624b66e40303320969d|
|b2-territories-local-pittsburgh|https://www.pittsburghpa.gov/City-Government/Finance-Budget/New-Business-Registration|e36793d5249d2d51994b2dbd1275ac5ff92cc3c3dba5878ca9e23fd2834b6bbe|
|b2-territories-local-atlanta|https://www.atl311.com/en-us/knowledgearticle/?code=KB0012728|2c2dac7c246be1d3f9a1f4f23077faab107df21311ac33d58fcfd4e9fbce602b|
|b2-territories-local-miami|https://www.miami.gov/Business-Licenses/Business-Licensing/Get-a-Business-Tax-Receipt-BTR|88452216df2ce1fca74e8848c7ee902053f4ff0a2cdda1993b32310462c8740e|
|b2-territories-local-jacksonville|https://taxcollector.jacksonville.gov/taxes/local-business-tax|d4b123a3b56336d8d04fcb12f916813bfae1247e33c31d680e8f6c066e3f2aa9|
|b2-territories-local-kansas-city|https://bizcare.kcmo.gov/biz-reg-guide|c1d3f6cd575fba1828263fb15c5435faab61a9cd2fca6ae11358d3e3c4475545|
|b2-territories-local-baltimore|https://interactive.marylandtaxes.gov/webapps/comptrollercra/help/Help8.htm|eba817b01a9e6b7c26d3afc2487576f048170d47bc84bbe1642ea49a5f7f1f8c|
|b2-territories-baltimore-clerk|https://www.marylandcomptroller.gov/businesses/new-business/circuit-court-clerks.html|ce9951ab6c6a27afa2b2568c1e1a8ab422e28730e3c3b8314e5d1181e4954f4c|
|b2-territories-chicago-clerk-role|https://www.chicityclerk.com/business-licenses|7d0758e5a10581afc57d4ab587384ecaf4f3bda47792e1dd7302c836feb0449c|

The canonical Puerto Rico update also carries its fetched hash. No failed fetch is recorded as substantive verification, zero fee or no requirement.
