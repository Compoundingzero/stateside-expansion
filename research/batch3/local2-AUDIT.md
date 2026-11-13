# Bounded local publication audit

Audited 13 November 2026 with AI-assisted source/editorial review; no professional legal review is represented. The audit covers **158 remaining leads: 38 local hubs and 120 city/sector combinations**. Houston and New York City's two already-published hub decisions are outside this remaining-hub batch.

## Handoff and dispositions

| File | Result |
| --- | --- |
| `local2-candidate-decisions.json` | 158 complete dispositions: 142 need research, 14 retire only a repeated map/checklist page concept, two propose narrow publication |
| `local2-guides.json` | Two new scoped guides: `/cities/los-angeles/restaurants/` and `/cities/houston/commercial-laundry/` |
| `local2-market-updates.json` | Two complete conditional market proposals, preserving existing processes and unresolved work |
| `src/data/batch3-local2-sources.json` | Six actual complete relevant official bodies, with saved raw-body hashes and separate fetch/review dates |
| `src/data/batch3-local2-rules.json` | Four scoped source-linked process rules; all fee fields remain null |

No canonical guide, market or candidate inventory is overwritten by these proposals. Root merges accepted records. Proposed industry2 guides are explicitly labelled `reviewed-proposal-pending-integration` where they are not yet identical to canonical published records; they are not silently described as already published.

Every decision retains its original question and practical output. Each records exact local process/municipality/county/boundary evidence where available, cited guide outputs and limits, the separate role of local versus industry sources, the next authority question and unresolved research. An editorial audit date does not refresh existing sources' substantive legal-review dates.

## The 38 hub questions remain open

An existing registration, tax, occupancy or narrow food/fire-service finding does not complete a broader municipal opening map. **All 38 remaining hub leads therefore remain `needs-research`**, with their actual narrow process evidence linked rather than stretched into hub-wide authority. This includes Los Angeles despite the new restaurant proposal; one food branch does not complete that city's broad hub question.

Six intended places have no substantively reviewed market/process record in the register: Bellevue, Tucson, Newark, Jersey City, Arlington and Honolulu. No nearby market or state industry example substitutes for that missing authority. The Arlington lead's own checklist identifies Arlington County, Virginia; the audit preserves a county/address clarification task instead of inventing a separate municipal authority or confusing it with Arlington, Texas.

For the other hubs, the JSON retains the exact existing recorded processes and their source IDs: for example, San Jose's Santa Clara County food takeover review is not a San Jose industrial-maintenance permission; Detroit's named food-service change is not an automotive opening licence; Indianapolis's fire-equipment business/person route is not a general childcare or cleaning authorisation.

## Fourteen repeated page concepts, with legal gaps retained

These are **editorial retirements of a generic map/checklist page concept only**. Each still has `localSectorStatus: not-researched`, a specific next question and unresolved local law. The canonical destination identifies an existing narrow output, not an assertion that its entire original city/sector question is answered. A future materially distinct local decision may earn its own scoped guide after primary research.

| Retired generic combination | Exact existing local output | Separate industry output |
| --- | --- | --- |
| Los Angeles / commercial cleaning | [City tax registration](/cities/los-angeles/business-registration/) | [Account-cluster pilot and customer/employer file](/industries/commercial-cleaning/) |
| San Francisco / IT managed services | [Service activity registration without a shop](/cities/san-francisco/service-business-registration/) | [Access and incident responsibility schedule](/industries/it-services/) |
| Portland / commercial cleaning | [City/county/Metro tax boundaries](/cities/portland/city-county-tax-boundaries/) | [Account-cluster route brief](/industries/commercial-cleaning/) |
| Dallas / commercial cleaning | [Tenant/use occupancy record](/cities/dallas/tenant-certificate-of-occupancy/) | [Customer access, route and employer tasks](/industries/commercial-cleaning/) |
| Orlando / commercial cleaning | [City receipt, use certificate and county receipt](/cities/orlando/business-tax-and-use/) | [Account/site-access work](/industries/commercial-cleaning/) |
| Atlanta / IT managed services | [Location zoning and occupation-tax file](/cities/atlanta/zoning-and-occupation-tax/) | [Access and incident schedule](/industries/it-services/) |
| Charlotte / commercial cleaning | [City zoning versus county building review](/cities/charlotte/city-county-permitting/) | [Customer access and supervision file](/industries/commercial-cleaning/) |
| Raleigh / IT managed services | [Former general licence versus remaining permits](/cities/raleigh/business-license-and-permits/) | [Data/access schedule](/industries/it-services/) |
| Pittsburgh / industrial maintenance | [Outside service crew registration/verification](/cities/pittsburgh/outside-service-registration/) | [Task, host-site safety and response-capacity file](/industries/industrial-maintenance/) |
| Pittsburgh / technical services | [Outside-service city-presence question](/cities/pittsburgh/outside-service-registration/) | [Task and technical decision-authority matrix](/industries/technical-services/) |
| Philadelphia / commercial cleaning | [Outside-business Commercial Activity License question](/cities/philadelphia/commercial-activity-license/) | [Route/customer operating file](/industries/commercial-cleaning/) |
| New York City / commercial cleaning | [CO/TCO/LNO/completion-letter distinction](/cities/new-york-city/) | [Customer-site and employer-task map](/industries/commercial-cleaning/) |
| Houston / industrial maintenance | [Lease-space occupancy path](/cities/houston/) | [Task, host-site and response-capacity evidence](/industries/industrial-maintenance/) |
| Houston / equipment servicing | [Lease-space occupancy path](/cities/houston/) | [Covered host/contractor energy-control interface](/industries/equipment-servicing/) |

No absence of local cleaning, chemicals, wage, privacy, professional, trade, storage, discharge or worksite rules is inferred. The generic map already has a home; the distinct missing legal work has not been marked researched. The remaining **104 sector leads** remain `needs-research` because existing narrow processes/industry material do not supply their actual city/sector authority. Their next questions are differentiated by the 22 sector activities, with exact city-process limits retained in each record.

## Two distinct additions supported by actual authority

### Los Angeles restaurant ownership and modification

The new guide joins four actual county bodies: the complete two-page health-permit application, the purchase-versus-modification instruction, the full plan-check process steps and the county service-jurisdiction description. The form is marked **12/3/25**; that revision marker is retained in notes rather than invented as a publication date.

The guide distinguishes a nontransferable owner/location/activity health record, a purchase without anticipated major permitted construction, and changes to menu/equipment/method requiring applicable review. It separately tracks city planning/building and county food-health decisions and issued opening evidence. The county program's Pasadena, Long Beach and Vernon exclusions remain explicit. It does not promise a numeric fee, expedited review period, all technical design clearance, alcohol, grease/fire/accessibility or full food-worker authority. Historical agency names/contact material in the older page's tail and open-front/window technical issues are not republished as current findings.

### Houston laundry classification and survey routes

The actual Houston Public Works FAQ explicitly distinguishes self-service/commercial **not industrial** laundry, while reserving IWS's permit determination for a facility discharging industrial waste. It also directs a proposed non-domestic sewer discharger to contact IWS and submit a survey for review and next steps. That prospective route applies independently of receiving a survey in the mail.

The separate actual survey page describes a received request as mandatory and explains water-use/discharge facts and batch/continuous flow. The guide therefore keeps prospective contact/survey, any received-notice due date, IWS determination and any required issued/control record as separate evidence. It classifies no actual plant, promises no blanket exemption/unrestricted discharge and publishes no numeric limits/fees/treatment design. Receiving jurisdiction, actual process, state/federal categories, premises and costs remain unresolved.

## Retrieval, verification and independent QA

All six selected sources were retrieved as substantive HTTP 200 raw HTML/PDF bodies and are saved under ignored `research/raw/batch3/local2/`, with fetch metadata in `fetch-local2-urls-1.json`. The public web reader initially encountered LA redirect loops and Houston www-host 403 responses; those attempts are preserved. They were not promoted from search snippets. The actual official admin LA host and non-www Houston Public Works host subsequently returned the complete relevant bodies, with raw hashes. Search-only cottage-food discovery was not promoted into a guide or source finding.

`python3 research/batch3/check-local2-evidence.py` passes: all 158 original questions/outputs and unique dispositions, explicit retirement limits, valid guide/source/rule references, six supporting passages matched, six raw hashes matched, four source-linked rules, two nonempty practical guides and two conditional market updates.

`node scripts/validate-data.mjs` passes with zero errors. Pending-path review notes for proposed guides are expected until integration. The independent federal research agent checked the six actual bodies, two guides, four rules and two market updates. Its useful prospective-survey clarification was incorporated into the Houston guide, rule, source notes, table and market summary. The agent confirmed the final saved state and recorded the source review in `INDEPENDENT-FEDERAL-QA.md`. Process-level source IDs were added to both new market-process objects.
