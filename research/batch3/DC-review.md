# Independent D.C. source-change review

Decision: **content changed, but current cited claims are unchanged**. The exact observed instance can be resolved after this bounded substantive review; it must not be described as unchanged source text or an automatic normalizer-only migration.

Review completed `2026-11-13T02:36:00.549Z` UTC (12 November 2026, America/Los_Angeles). Reviewer: AI-assisted independent source/claim review; no professional legal review. This is an actual substantive review of the stated source and dependent claims, not a human-review requirement.

## Evidence identity

- Source: `b2-west-dc-3904`, official D.C. Law Library §28-3904.
- Queue: `artifacts/hosted-43351541720/editorial-review-queue.json`, issue `4466732f0e3265ea92d5`, reason `source-normalization-review-required`.
- Retained old actual HTML: `research/raw/batch3/editorial/final-source-review/b2-west-dc-3904.html`; raw SHA256 `b0b1d3726367f1b3d23e3dc3723719843dbe82cae33fcba84090f0b024f66678`.
- Retained old complete normalized main text: same filename plus `.normalized.txt`; 16734 characters; SHA256 `2144363a842f1dd7f452e33c538b10783bc0aa18495a804bc9bde9653beafff5`.
- New actual HTML: `research/raw/batch3/editorial/hosted-dc-al-review/b2-west-dc-3904.html`; fetched `2026-11-13T02:29:35.130Z`; raw SHA256 `2e60d4163c35f6ca9db40ad54174b9d1f221be87783c9cbe57a21c00e7ff3579`, matching hosted evidence.
- New complete normalized main text: same filename plus `.normalized.txt`; 16782 characters; SHA256/observed hash `e3a5f32967b9481a733476f2a4e528287d6cdeb723e1025bf47e446617b692de`.

Both complete main bodies, including all operative paragraphs and applicability/editor notes, were read. Actual raw HTML was separately inspected around the addition: the old HTML has no 28-3820 reference; the new HTML contains the bracketed subsection and link. This is a real source-content difference.

## Exact difference

Old subsection(b) ending:

> (18) Violate any provision of Title 12 of the District of Columbia Municipal Regulations; or (19) Violate any provision of § 29-102.01 .

New subsection(b) ending:

> (18) Violate any provision of Title 12 of the District of Columbia Municipal Regulations[;] (19) Violate any provision of § 29-102.01 [; or] [(20)] Violate any provision of § 28-3820 .

A direct equality assertion confirms that everything before this (b)(18) block and everything from `[(c)]` through the end of the main text is identical. The complete subsection(a) is identical. Therefore the difference is confined to the shown punctuation and bracketed (b)(20) reference.

The cited text remains, exactly:

> (5) Misrepresent as to a material fact which has a tendency to mislead;
>
> (7) Fail to state a material fact if such failure tends to mislead;

The surrounding(a) merchant/unfair-practice wording and the existing fiscal-effect applicability notes are also unchanged. No inference is made that the bracketed addition is operative merely because it now appears in the body.

## Official cross-reference read

Only the official body was fetched: https://code.dccouncil.gov/us/dc/council/code/sections/28-3820 . It returned HTTP 200 at `2026-11-13T02:33:27.159841+00:00`, raw SHA256 `246101bf9aa24363009d36c83fa48066f0eca472610ec2be2b7121fb2e213a7e`. Complete saved evidence and metadata are under `research/raw/batch3/planning-dc-review/28-3820.html`, `.txt`, and `manifest.json`.

Its title is **“Prohibition on certain medical lending promotion. [Not Funded]”**. The body says **“Not Funded.”** The applicability note says creation by §3(a)(2) of D.C. Law 26-172 is subject to inclusion of fiscal effect in an approved budget/financial plan and **“Therefore that amendment has not been implemented.”** This corroborates the unchanged fiscal-effect caveat; it does not establish a new B2B franchise obligation or erase (a)(5)/(7). No medical-lending merits or independent budget-certification finding is made here.

## All dependent claims checked

A scan of all canonical source/rule/guide arrays found one directly linked rule and one directly/transitively linked published guide:

1. `b2-west-dc-cppa` in `src/data/batch2-west-rules.json`. Its exact requirement is: “Section 28-3901(a)(7) includes franchises/business opportunities, but consumer, merchant and transaction scope require analysis. Section 28-3904 prohibits covered material misstatements and omissions. Neither CPPA wording nor an operating licence establishes franchise-sales clearance.” All rule fields were read. The28-3904 proposition rests on unchanged(a)(5)/(7); the other propositions have separate unchanged source dependencies. It makes no exhaustive list, medical-lending claim or blanket B2B application conclusion. Its conditional status and interpretation limits remain appropriate.
2. `/states/district-of-columbia/`, guide `b2-west-district-of-columbia` in `src/data/state-guides.json`. All sections, bullets, source/rule links and limitations were read. Its only 28-3904 legal statement is “Section 28-3904 addresses covered material misstatements and omissions.” Its buyer/consumer/merchant/transaction caution and separate operating-licence workstream do not rely on(b)(20). No claim needs a text correction for this observed change.

The source record itself explicitly limits its section to (a)(5)/(7) and applicability notes. Its supporting passage remains exact; its note preserves the 2026 fiscal-effect caveat and disclaims blanket new-2026/B2B application.

The hosted queue also lists the relationship-factsheet, FDD-comparison and launch-planner tools through the source checker's `sales-disclosure` topic map. Their tool definitions, relevant component text and default launch tasks were inspected. They contain no D.C.-specific 28-3904/medical-lending assertion; they continue to collect facts and preserve independent state review. The new (b)(20) does not alter their published legal claim or calculation.

## Scoped resolution proposal

The following is a proposal for the shared resolution owner. `no-material-change` means no material change to the **current cited claims**, not that the underlying statute body is identical. Do not use `not-a-source-change` for this observation.

```json
{
  "issueId": "4466732f0e3265ea92d5",
  "sourceId": "b2-west-dc-3904",
  "reason": "source-normalization-review-required",
  "observedHash": "e3a5f32967b9481a733476f2a4e528287d6cdeb723e1025bf47e446617b692de",
  "reviewer": "AI-assisted independent substantive source/claim review; no professional legal review",
  "reviewedAt": "2026-11-13T02:36:00.549Z",
  "evidence": "research/batch3/DC-review.md",
  "decision": "no-material-change",
  "reviewComplete": true,
  "notes": "Actual source content changed, but current cited claims are unchanged. Both complete retained/current main bodies, all dependent rule/guide text and official §28-3820 were read. The sole change is subsection(b)(18)/(19) punctuation plus bracketed(b)(20) referencing §28-3820; subsection(a), including(a)(5)/(7), and applicability notes are identical. Official §28-3820 is titled Prohibition on certain medical lending promotion [Not Funded] and says creation not implemented. The existing narrow D.C. rule/guide make no medical-lending/new-2026 claim and preserve consumer/merchant/transaction and other-law limits. This resolves only this observed hash/issue, not later changes or full D.C. clearance."
}
```

No canonical source, rule, guide, shared resolution or snapshot was edited. No substantive date is refreshed by this document. The actual review timestamp above may be recorded for this bounded claim review if the resolution owner accepts it; it does not refresh other source/workstream dates or certify full D.C. law. Any baseline acceptance should be tied to this exact reviewed observation/hash, retain the previous evidence/history, and leave later occurrences independently reviewable.
