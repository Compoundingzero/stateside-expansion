# Reader-first article revision

Audience: owners and managers of established European/Southeast Asian businesses
considering U.S. partner-operated expansion, who have no prior legal training.
Teach at first-year university level: respect their intelligence, assume no
familiarity with U.S. agencies, legal categories, acronyms or franchise documents.

Rewrite every assigned published guide individually, using its actual subject,
current cited rules, conditions, exceptions and examples. Do not generate generic
prefaces from topic labels. Do not alter identifiers or legal evidence through
string replacements. Do not invent new rules, thresholds, approvals or case facts.

For each guide:
1. Explain the business situation and why this issue comes up before naming
   statutes. Tell the reader whose obligation is being discussed.
2. Define jargon before using it. Explain acronyms, legal actors and concepts in
   ordinary words. Translate 'nexus', 'scope', 'release gate', 'evidence chain',
   'workstream', 'cohort', 'substantiation' and similar research shorthand.
3. Explain what the existing rule requires, why the distinction matters and what
   happens in a realistic worked example. Preserve every legally material
   condition/exception, agency boundary and conditional versus established fact.
4. Give a practical next step with a concrete document or question; distinguish
   legal duty from optional business planning. Avoid repeated warning paragraphs.
5. Keep examples fictional unless a documented case is expressly identified.
   Preserve allegations/findings/settlement/proposed-order and collection limits.
6. Aim for enough context to teach, normally 500–900 words for a substantial guide;
   a narrow concept may need less and a comparison more. Do not pad to a count.
   Expand terse examples into actual reasoning, not one-sentence name substitutions.

Write a separate output file with an array of patches. Each patch must contain
id, path, title, description, learningSummary (2–4 introductory sentences),
keyTerms (2–6 objects {term,meaning}), sections, practicalOutput, limitations,
readMinutes. Sections keep paragraph/bullet/table/sourceIds formats. A useful
sequence is the business question → words to know → rule explained → worked
example → what to do. Avoid unnecessary identical headings on every page.
Use only sourceIds already in the assigned guide or its cited rule records.

Keep ALL other original fields immutable: id/path, family, topic, jurisdictions,
status, lastReviewed, reviewStatus, scenarioType, label, sourceIds, ruleIds,
nextStage and evidence metadata. These are clarity edits, not automatic source
reverification. Root will set contentModifiedAt after integration.

The FTC Compliance Guide is May 2008 explanatory guidance, not current law or a
current threshold sheet. Current Part 436 and recorded current threshold sources
control when they differ. Never replace the current $735 exemption with the old
PDF's $500; the payment exemption is distinct from the definition's elements.
Explain federal versus state/territory/operating rules. An FDD is information for
prospective partners, not government approval or a promise of profit.

Do not change canonical src/data files. Save assigned proposals under this
folder and provide a concise coverage/quality report. Root owns integration,
template changes, primary FTC review, validation and deployment.
