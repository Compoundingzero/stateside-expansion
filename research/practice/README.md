# Practice, sector and case editorial batch

Reviewed 12 November 2026 using AI-assisted source reading, not professional legal review.

The canonical datasets are `src/data/case-guides.json`, `industry-guides.json`, `practice-sources.json` and `practice-rules.json`. The build script records the authorship of the original illustrative material and can regenerate those four datasets; shared federal source and rule IDs resolve against the federal datasets. Case narratives and calculations are original work. Government documents are linked rather than republished as public source documents.

## Counts and holds

- 23 published guides: 8 original fictional cases, 2 bounded historical real cases, 7 B2B sector guides and 6 preparation guides.
- 2 merged draft records retained for editorial history; public redirects should lead to the federal canonical guides named by `mergedInto`.
- 2 blocked records: Qargo requires the actual entered signed order plus later docket check; OctoClean requires a readable complete official order plus later-order check.
- 17 practice source records and 5 practice rule records. Federal authorities are reused, not copied as separate competing rules.

The Qargo FTC index still reports Pending and links a proposed order, while the later official December 2024 status report records entry on 17 October 2024. That conflict is preserved. Reading a proposed order is not represented as reading the entered signed order. The Burgerim narrative is limited to the actual 19 January 2024 entity default judgment, and Tower Cleaning to its historical 1996 consent decree; neither is proof of monetary collection or a comprehensive present docket search.

## Evidence handling

`fetch-log.json` records direct-source access outcomes. `snapshot-index.json` records SHA256 and byte lengths for source snapshots retained only in the cloud under ignored `research/raw/practice/`. These raw snapshots are not public website content and are excluded from Git. Sources store exact short passages, section/page references, separate fetch and substantive-review timestamps, limits, next editorial review and access state. A successful fetch alone is not source verification.

Independent agent review confirmed the Burgerim amounts/party scope and reviewed the narrow historical Tower account. Structural validation checked all 27 unique record paths, source/rule references including section references, fictional labelling, publication evidence and numerical typography. No unresolved reference errors were found. The fictional unit calculation yields $0 and the partner-funding example yields a $200,000 gap; operational calculation testing belongs to the planning-tools implementation.

## Backlog

1. Retrieve Qargo entered order and check later procedural documents; compare operative terms before release.
2. Obtain an accessible complete DFPI OctoClean order; do not use search extracts as a substitute.
3. Commission professional review for transaction-specific classification, contracts, employment, product and mobility questions.
4. Add state/local/trade/product specificity to sector routes only after actual activities and locations are chosen.
5. Expand additional B2B real enforcement narratives from complete primary orders and verify procedural posture.
