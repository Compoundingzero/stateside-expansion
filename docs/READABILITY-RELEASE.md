# A teaching revision of the published articles

The user found the released articles difficult to understand and asked for the
context and detail a first-year university reader would need. This revision
rewrites all 278 published guides individually. It keeps the audience as owners
and managers of established businesses preparing U.S. expansion, while assuming
no prior U.S. legal training.

Each guide now begins with a plain-English explanation and two to six defined
terms. Its main sections explain the business situation, the rule's meaning,
worked reasoning and concrete next steps. The 23 FDD articles explain the
Franchise Disclosure Document before relying on its acronym and include links
to the FTC overview, Compliance Guide, printable PDF and current Part 436.
The May 2008 guide is identified as explanatory guidance; old monetary and
accounting material was not substituted for the current regulation.

For example, the U.S. Virgin Islands guide previously began with an
'operating-license evidence chain'. It now starts with the difference between
a private brand licence and a government business licence, identifies the local
operator and DLCA, and walks through cleaning versus HVAC work. Item 19 explains
revenue, profit, substantiation and comparison groups, then shows the fictional
manager/royalty calculation in words and a table. Item 15 separates participation,
conditional supervision information and manager restrictions. Item 21 explains
financial-statement periods and the precise limited alternatives rather than
assuming a parent company's resources automatically support a subsidiary.

The shared layout puts teaching before technical records. Native HTML sections
and definitions work without JavaScript. Technical source passages and review
notes are available in expandable details. Mobile readers can jump to sections;
the long payroll reference is labelled as a reference guide and retains all 51
jurisdiction tables and 102 account rows. There remains one forward action.

Integrity verification against commit 980c7a2 confirms all 278 published bodies
changed, all 12 unpublished records stayed identical, and all 58 source, rule,
jurisdiction and case-connection files stayed byte-identical. Guide IDs, routes,
publication status, topic, source links, rule relationships, source-review dates,
scenario labels and planning-stage context were preserved. Only editorial fields
and article modification timestamps changed. No withheld guide was released and
no source/legal review date was automatically refreshed.

Input snapshots, individually authored patches and author quality reports are
in `research/readability/`. Independent FDD review checked all 23 items against
current Part 436 and resolved its specific findings before integration. Article
style is now documented in `ARTICLE-STYLE.md`; the data validator requires the
teaching introduction and terminology for future published guides.

Local validation: build succeeded; all 71 existing Node tests passed. Sixteen
additional read-only browser checks covered eight representative guides at
1440px and 390px with JavaScript disabled. They checked readable introductions,
definitions, native source details, mobile section links, one forward action,
FTC-resource context and preservation of the 51-table payroll reference. No page
overflow was observed; screenshots were inspected. Existing full browser tests
remain required by GitHub CI before Railway deployment.
