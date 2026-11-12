# East continuation batch: publication and audit note

Reviewed on 2026-11-12 using AI-assisted source inspection. No professional legal review or transaction clearance is claimed.

Scope: exactly Alabama, Alaska, Arizona, Arkansas, Colorado, Connecticut, Delaware, Florida, Georgia, Idaho, Iowa, Kansas, Kentucky, Louisiana, Maine, Massachusetts, Mississippi and Missouri.

Deliverables:

- `east-guides.json`: 17 narrow published-guide proposals and one unpublished Mississippi draft; 3,587 authored prose words plus tables.
- `east-jurisdictions.json`: complete replacement records for those 18 jurisdictions, preserving existing IDs/slugs. The six independent franchise dimensions contain 3 verified narrow duties, 43 conditional findings and 62 unresolved questions. All 108 dimensions were investigated; unresolved is not evidence of no requirement.
- `src/data/batch2-east-sources.json`: 46 read source records, with fetch dates separate from substantive review. Forty-one have a current/effective source context; three are expressly historical, one is a failed proposal and one concerns a signed future amendment. Do not describe all 46 as current operative legal authorities.
- `src/data/batch2-east-rules.json`: 32 canonical records: 6 verified, 25 conditional and one unresolved. Rules include proposed canonical dependent paths for root's merge.
- `east-audit.json`: source URLs, SHA-256 hashes, short exact supporting passages, provenance and failed fetches. All 46 supporting passages matched the normalized source body and remained at most 25 words. Guide/rule/source references resolve; proposed paths and jurisdiction IDs are unique.

Primary collection attempted 61 URLs: 9 returned HTTP errors. Additional successful responses included a sign-in page, a parked page and a statute-index shell; those were not used as substantive legal authority. Raw HTML/PDF/text belongs under ignored `research/raw/batch2/east/` and is not a new public content collection.

## Material findings and limits

1. **Alabama**: Full SB138 enrolled text has a June 1, 2026 effective date, with official fiscal-note corroboration of enacted Act 2026-591. Explicit exceptions and defined-party/sector scope are preserved. No universal right to close or comprehensive injunction search is claimed.
2. **Arkansas**: Act 847 of 2023 is enacted. Its PDF strikethrough/underline text was visually checked. HB1177 of 2025 died in committee; it is not applied as law. Agreement and renewal dates affect the relationship analysis.
3. **Connecticut**: Current Form CT-BOIA-EX is effective September 30, 2025. It asks mark ownership/assignment/sublicensing questions and says claims are not validated by posting. Older guideline wording is retained as a process-version issue, not silently substituted for the form. Consolidated statutory retrieval failed with 503.
4. **Florida**: Section 559.802 and the agency distinguish discontinued registration documents from the continuing annual pre-offer exemption notice. Location and prospect residence remain distinct triggers. The statute's $100 ceiling is not presented as an established payable fee; the linked packet redirected to sign-in.
5. **Georgia**: The agency's statutory text expressly states currency only through 2006. It is historical evidence, not current numerical legal guidance. The published page instead provides a substantive mark/name evidence task using current Secretary of State explanations and search-scope limits.
6. **Iowa**: Chapter 551A's registered-mark exclusion differs from its franchise exemption from section 551A.3; section 551A.7 consent remains separately addressed. New agreements use section 537A.10 subject to its actual conditions, rather than unqualified Chapter 523H. The official table flags a signed amendment effective January 1, 2027, kept outside current November 2026 operative interpretation.
7. **Kentucky**: Current 40 KAR 12:410 text is effective June 30, 2026, distinct from older/redline text on the same page. A registered-offeror statute says material changes must be notified immediately; the rule specifies fourteen days for registered sellers/exemption-notice offerors. The stricter statutory wording is preserved. Sections 367.816 and 367.819 also differ between thirty business days and thirty calendar days; no single cancellation deadline is calculated or silently chosen. Exemption scope remains separate.
8. **Louisiana**: The location-assistance limb concerns specified vending/display/amusement-device locations, not generic B2B customer-account assistance. The mark wording qualifies one definition limb; bond scope is separately limited by section 51:1822(G), and seller/agent roles differ. A specific real-estate professional rule is separately identified.
9. **Maine**: The full official PDF says current through October 1, 2026 and not officially certified. First face-to-face meeting timing, promotion before registration, limited mark wording, and post-signature avoidance are separately explained. The state's copyright notice is respected by original paraphrase and a short provenance excerpt.
10. **Mississippi**: Official history confirms 2018 SB2805 became law. The current 2026 consolidated official text and later decisions remain unavailable; the guide stays unpublished. Historical ninety-day text is not used as present clearance.
11. **Missouri**: Current section 407.400 scope and section 407.405 notice/exceptions differ from the independent business-opportunity definition and representation/territory rules in sections 409.1000/.1003.
12. **Colorado, Idaho, Kansas and Massachusetts**: Useful narrow operating/people/entity tasks are published without converting those sources into an unsupported statement that no state franchise law applies. Their unresolved franchise dimensions remain explicit.

Independent editorial agent `editorial_inventory` sampled the high-consequence actual source bodies. Its Louisiana scope finding was corrected in the guide and canonical rule, and its final resample reported no further material findings in the sampled claims. It also confirmed the final Kentucky/Iowa spacing repairs. This is an independent AI-assisted editorial sample, not legal professional review.

## Durable authoring workflow

The final JSON files are the reviewable publication input. Helper scripts are authoring aids, not a complete current-law refresh workflow. If regenerating this batch, run `build-east.py`, then `normalize-east-prose.py`, then `finalize-east-prose.py`, then repeat source/excerpt/prose validation and editorial review before merging. Do not publish the intermediate script output: the later passes preserve legal qualifiers and normal English spacing. Literal source quotations, URLs, source IDs and canonical paths stay unchanged during prose repair.

Root owns canonical-path merging, reverse-dependency reconstruction, product checks, Git commits and deployment. This agent has not committed, pushed or deployed any content.
