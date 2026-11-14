/** Presentation only: these helpers do not classify a transaction or change source-review records. */
export interface ArticleGuide {
  id: string;
  path: string;
  title: string;
  description?: string;
  status?: string;
  family?: string;
  topic?: string;
  jurisdictions?: string[];
  seoTitle?: string;
  relatedPaths?: string[];
  learningPath?: string;
  contentModifiedAt?: string;
  nextStage?: number;
  scenarioType?: string;
  lastReviewed?: string;
  readMinutes?: number;
  sections?: ArticleSection[];
}

export interface ArticleSection {
  heading: string;
  id?: string;
  legacyIndex?: number;
  aliases?: string[];
  paragraphs?: string[];
  bullets?: string[];
  table?: {headers:string[]; rows:string[][]};
  sourceIds?: string[];
  ruleIds?: string[];
  [key: string]: unknown;
}

export interface LearningHub {
  slug: string;
  title: string;
  label: string;
  description: string;
  kind: 'family' | 'topic';
  learningGoal: string;
}

export const learningHubs: readonly LearningHub[] = [
  {slug:'classification',title:'Choose the right U.S. business relationship',label:'Business relationship',kind:'topic',description:'Understand the rights, payments and working arrangements before choosing a franchise, licence or distribution route.',learningGoal:'Prepare a description of the actual relationship, including what each party pays, controls and promises.'},
  {slug:'sales-disclosure',title:'Prepare franchise offers and disclosure',label:'Offers and disclosure',kind:'topic',description:'Read the disclosure subjects, sales-event rules and state filing distinctions that shape a recruitment plan.',learningGoal:'Connect the actual document versions, recipients, offers, payments and filing events on a clear calendar.'},
  {slug:'relationship',title:'Plan relationship changes, renewal and exit',label:'Changes and exit',kind:'topic',description:'Distinguish contract terms from the conditional state or industry rules relevant to changing an established relationship.',learningGoal:'Identify the proposed action and preserve its agreement, reasons, notices and unresolved questions.'},
  {slug:'corporate-tax',title:'Map companies, tax questions and accounts',label:'Companies and tax',kind:'topic',description:'Separate the legal employer, rights seller, taxpayer and owner before choosing a filing or cross-border tax route.',learningGoal:'Build an entity-and-activity map for the particular tax, account or reporting question.'},
  {slug:'immigration',title:'Plan travel, staffing and permission to work',label:'People and mobility',kind:'topic',description:'Separate owning a business, visiting it and carrying out particular work, using the actual people and locations.',learningGoal:'Record who will do each activity, where, when and which permission questions remain open.'},
  {slug:'employment',title:'Prepare to hire, classify and pay a U.S. team',label:'Hiring and pay',kind:'topic',description:'Follow the distinct questions behind worker status, employer accounts, wage budgets and working arrangements.',learningGoal:'Connect each role and worksite to the applicable assessment, payroll inputs and responsible person.'},
  {slug:'products-supply',title:'Prepare products, suppliers and imports',label:'Products and supply',kind:'topic',description:'Examine the actual product, intended use, supply arrangement and shipment before relying on brand approval alone.',learningGoal:'Make a product-and-supplier file showing responsibilities, relevant records and missing checks.'},
  {slug:'premises-opening',title:'Prepare a location and operating permissions',label:'Locations and opening',kind:'topic',description:'Use the exact address, activity and operator to separate business registration, premises and sector-permission questions.',learningGoal:'Create an address-specific list of applications, dependencies, evidence and people responsible.'},
  {slug:'ip-data',title:'Protect and share brand rights, know-how and data',label:'Brand rights and data',kind:'topic',description:'Distinguish ownership, permission, protection and data access before sharing the materials behind your operating system.',learningGoal:'Identify each asset or data flow, the parties involved, the permission relied on and unresolved limits.'},
  {slug:'commercial-feasibility',title:'Test the operating model, support and cash needs',label:'Business feasibility',kind:'topic',description:'Examine whether the proposed team, customer demand, support promises and funding fit the business you will actually operate.',learningGoal:'Separate documented facts from planning assumptions and assign the evidence needed for the next decision.'},
  {slug:'fdd',title:'Read the 23 FDD items',label:'Franchise Disclosure Document',kind:'family',description:'Learn what each numbered Franchise Disclosure Document item explains and how to use it in a real business decision.',learningGoal:'Follow each disclosure subject to the actual document, its conditions and the question your team needs to answer.'},
  {slug:'federal',title:'U.S. expansion rules',label:'U.S. expansion rules',kind:'family',description:'Study specific regulatory and business questions that can arise during a U.S. expansion, with each guide’s jurisdiction and limits stated separately.',learningGoal:'Identify the actual activity and responsible party before applying the named rule or preparing its evidence.'},
  {slug:'state',title:'State guides',label:'State guides',kind:'family',description:'Choose a state to read its researched franchise, business-opportunity, equipment-dealer or other particular question.',learningGoal:'Understand the named state issue without treating one guide as a complete review of the state’s laws.'},
  {slug:'state-issue',title:'State rules in detail',label:'State rules in detail',kind:'family',description:'Work through a particular state rule, including its defined business, factual conditions and practical preparation.',learningGoal:'Match the stated rule to the exact products, workers, relationship or action in your plan.'},
  {slug:'origin',title:'Prepare from your home country',label:'From your home country',kind:'family',description:'Examine specific home-country questions affecting cross-border expansion; each country guide states what it covers and what remains open.',learningGoal:'Prepare the origin-side records or decisions described in the guide, separately from U.S. requirements.'},
  {slug:'territory',title:'U.S. territory guides',label:'U.S. territories',kind:'family',description:'Explore specific territorial business, people and customs distinctions before applying a mainland assumption.',learningGoal:'Record the actual territory, operator, people, products and applicable agency questions.'},
  {slug:'industry',title:'Industry guides',label:'Industry guides',kind:'family',description:'Connect the exact service or product you intend to offer with its researched industry-specific requirements and limits.',learningGoal:'Describe the real tasks, products, people and locations rather than relying on an industry label alone.'},
  {slug:'local',title:'City and local operating guides',label:'City and local guides',kind:'family',description:'Read address- and activity-dependent questions about city, county, premises and sector routes.',learningGoal:'Identify the responsible local authority and the evidence needed for the actual operator and site.'},
  {slug:'case',title:'Documented cases and worked scenarios',label:'Cases and scenarios',kind:'family',description:'Distinguish real proceedings and their stated outcomes from explicitly fictional business exercises.',learningGoal:'Use the record or example to ask a better question without treating an allegation as a finding or a scenario as a forecast.'},
  {slug:'comparison',title:'Compare routes and jurisdictions',label:'Comparisons',kind:'family',description:'Read defined alternatives side by side while keeping each source, jurisdiction, event and unresolved question attached.',learningGoal:'Choose the relevant comparison and identify the facts needed before selecting a route.'},
  {slug:'decision',title:'Expansion planning guides',label:'Planning decisions',kind:'family',description:'Turn a business question into a practical evidence file, operating plan or decision your team can examine.',learningGoal:'Agree what is known, what is assumed, who owns the next task and what remains unresolved.'},
];

const hubBySlug = new Map(learningHubs.map(hub => [hub.slug, hub]));
export const hubPath = (hub: LearningHub) => '/topics/' + hub.slug + '/';

export function learningHubForGuide(guide: ArticleGuide): LearningHub | undefined {
  return (guide.learningPath && hubBySlug.get(guide.learningPath))
    || (guide.family && hubBySlug.get(guide.family))
    || (guide.topic && hubBySlug.get(guide.topic))
    || undefined;
}

export function guidesForHub(hub: LearningHub, guides: readonly ArticleGuide[]): ArticleGuide[] {
  return guides.filter(guide => (!guide.status || guide.status === 'published') && (
    guide.learningPath === hub.slug
    || (hub.kind === 'family' ? guide.family === hub.slug : guide.topic === hub.slug)
  )).sort((a, b) => {
    if (hub.slug === 'fdd') {
      const aItem = /^fdd-item-(\d+)$/.exec(a.id);
      const bItem = /^fdd-item-(\d+)$/.exec(b.id);
      if (aItem && bItem) return Number(aItem[1]) - Number(bItem[1]);
    }
    return a.title.localeCompare(b.title, 'en') || a.path.localeCompare(b.path, 'en');
  });
}

export function searchTitle(guide: ArticleGuide): string {
  return guide.seoTitle?.trim() || guide.title;
}

export function isReferenceGuide(guide: Pick<ArticleGuide, 'sections'>): boolean {
  return (guide.sections || []).filter(section => Boolean(section.table)).length >= 20;
}

export function readingLabel(guide: Pick<ArticleGuide, 'sections' | 'readMinutes'>): string {
  return isReferenceGuide(guide) ? 'Reference guide' : String(guide.readMinutes) + ' min read';
}

export const articleFixedIds = [
  'start-here', 'words-to-know', 'sources', 'choose-jurisdiction',
  'what-to-prepare', 'guide-limits', 'official-federal-explanation',
  'detailed-rules', 'documented-cases', 'related-preparation',
] as const;
const reservedIds = new Set<string>(articleFixedIds);
const isStableId = (value:unknown):value is string => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value) && !/^section-\d+$/.test(value);
const isAlias = (value:unknown):value is string => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.:-]*$/.test(value);
const legacyIndexValid = (value:unknown):value is number => Number.isInteger(value) && Number(value) >= 0;

function requestedAliases(sections: readonly ArticleSection[]): string[][] {
  const mapped = sections.some(section => Array.isArray(section.aliases) || legacyIndexValid(section.legacyIndex));
  return sections.map((section,index) => [
    ...(Array.isArray(section.aliases) ? section.aliases.filter(isAlias) : []),
    ...(legacyIndexValid(section.legacyIndex) ? ['section-' + section.legacyIndex] : !mapped ? ['section-' + index] : []),
  ]);
}

/** Validate ownership, while allowing an old alias equal to its own replacement section ID. */
export function sectionAnchorIssues(sections: readonly ArticleSection[]): string[] {
  const issues:string[] = [];
  const owners = new Map<string,number>();
  const claim = (id:string,index:number) => {
    if (reservedIds.has(id)) issues.push('section ' + index + ': fragment ' + id + ' is reserved for the page');
    const previous = owners.get(id);
    if (previous !== undefined && previous !== index) issues.push('section ' + index + ': fragment ' + id + ' already belongs to section ' + previous);
    else owners.set(id,index);
  };
  sections.forEach((section,index) => {
    if (section.id !== undefined) {
      if (!isStableId(section.id)) issues.push('section ' + index + ': invalid stable ID');
      else claim(section.id,index);
    }
    if (section.legacyIndex !== undefined && !legacyIndexValid(section.legacyIndex)) issues.push('section ' + index + ': invalid original section index');
    if (section.aliases !== undefined) {
      if (!Array.isArray(section.aliases) || section.aliases.some(alias=>!isAlias(alias))) issues.push('section ' + index + ': aliases must be valid fragment IDs');
      else if (new Set(section.aliases).size !== section.aliases.length) issues.push('section ' + index + ': duplicate aliases');
    }
  });
  requestedAliases(sections).forEach((aliases,index)=>aliases.forEach(alias=>claim(alias,index)));
  return [...new Set(issues)];
}

export function semanticSectionIds(sections: readonly ArticleSection[]) {
  const oldAliases=requestedAliases(sections);
  const aliasOwners=new Map<string,number>();
  oldAliases.forEach((aliases,index)=>aliases.forEach(alias=>{
    if (!reservedIds.has(alias) && !aliasOwners.has(alias)) aliasOwners.set(alias,index);
  }));
  const used = new Set<string>(reservedIds);
  const explicitIds = new Set(sections.map(section=>section.id).filter(isStableId));
  const entries=sections.map((section,index)=>{
    const explicit=isStableId(section.id)?section.id:'';
    const heading=section.heading.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const base=explicit||(heading&&/^[a-z]/.test(heading)?heading:'guide-'+(heading||'section'));
    let id=base;let suffix=2;
    while(used.has(id)||/^section-\d+$/.test(id)||(!explicit&&explicitIds.has(id))||(aliasOwners.has(id)&&aliasOwners.get(id)!==index))id=base+'-'+suffix++;
    used.add(id);
    return {section,id,index};
  });
  const aliasUsed=new Set<string>([...reservedIds,...entries.map(entry=>entry.id)]);
  return entries.map(entry=>{
    const aliases=oldAliases[entry.index].filter(alias=>{
      if(aliasUsed.has(alias))return false;
      aliasUsed.add(alias);return true;
    });
    return {...entry,aliases,legacyId:aliases.find(alias=>/^section-\d+$/.test(alias))};
  });
}

export interface ToolLink {
  slug: string;
  name: string;
  description?: string;
  stage?: number;
}
export interface RelatedLink {
  path: string;
  title: string;
  description?: string;
  kind: 'guide' | 'tool';
}

function internalPath(path: unknown): string | undefined {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[?#\\]/.test(path)) return undefined;
  return path.endsWith('/') ? path : path + '/';
}

export function relatedReading(
  guide: ArticleGuide, guides: readonly ArticleGuide[], tools: readonly ToolLink[] = [], limit = 2,
): RelatedLink[] {
  const maximum = Math.min(3, Math.max(0, Math.floor(limit)));
  const available = new Map<string, RelatedLink>();
  for (const candidate of guides) {
    if (candidate.status && candidate.status !== 'published') continue;
    available.set(candidate.path, {path:candidate.path, title:candidate.title, description:candidate.description, kind:'guide'});
  }
  for (const tool of tools) {
    const path = '/tools/' + tool.slug + '/';
    available.set(path, {path, title:tool.name, description:tool.description, kind:'tool'});
  }
  if (Array.isArray(guide.relatedPaths)) {
    const seen = new Set([guide.path]);
    return guide.relatedPaths.flatMap(path => {
      const canonical = internalPath(path);
      const match = canonical && available.get(canonical);
      if (!match || seen.has(match.path)) return [];
      seen.add(match.path);
      return [match];
    }).slice(0, maximum);
  }
  const broadPlaces=new Set(['federal','u.s. federal','united states','u.s.','all']);
  const specificJurisdictions = (guide.jurisdictions || []).filter(place => !broadPlaces.has(place.trim().toLowerCase()));
  const thisItem = /^fdd-item-(\d+)$/.exec(guide.id);
  return guides.filter(candidate => candidate.id !== guide.id && (!candidate.status || candidate.status === 'published'))
    .map(candidate => {
      const sameTopic = Boolean(guide.topic && candidate.topic === guide.topic);
      const samePlace = specificJurisdictions.some(place => candidate.jurisdictions?.includes(place));
      const sameLearning = Boolean(guide.learningPath && candidate.learningPath === guide.learningPath);
      const otherItem = /^fdd-item-(\d+)$/.exec(candidate.id);
      const itemScore = thisItem && otherItem ? Math.max(1, 12 - Math.abs(Number(thisItem[1]) - Number(otherItem[1]))) : 0;
      const score = (sameTopic ? 10 : 0) + (samePlace ? 14 : 0) + (sameLearning ? 8 : 0) + itemScore;
      return {candidate, score};
    }).filter(({score}) => score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.path.localeCompare(b.candidate.path, 'en'))
    .slice(0, maximum)
    .map(({candidate}) => available.get(candidate.path)!);
}

/** Use only a recorded content modification; never substitute retrieval, review or build time. */
export function recordedModifiedAt(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return undefined;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return undefined;
  const date = value.slice(0, 10);
  if (new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) return undefined;
  return value;
}

export function latestContentModified(guides: readonly ArticleGuide[]): string | undefined {
  return guides.map(guide => recordedModifiedAt(guide.contentModifiedAt)).filter((value):value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a) || b.localeCompare(a))[0];
}

export interface Breadcrumb {
  name: string;
  path: string;
}

export function articleBreadcrumbs(guide: ArticleGuide): Breadcrumb[] {
  const hub = learningHubForGuide(guide);
  return [
    {name:'Home', path:'/'},
    {name:'Field guides', path:'/guides/'},
    ...(hub ? [{name:hub.label, path:hubPath(hub)}] : []),
    {name:guide.title, path:guide.path},
  ];
}

export function pageSchema(options: {
  site: URL; path: string; title: string; description: string;
  article?: boolean; headline?: string; contentModifiedAt?: string;
}) {
  const {site, path, title, description, article = false} = options;
  const canonical = new URL(path, site).href;
  const name = article ? options.headline || title : title;
  const modified = recordedModifiedAt(options.contentModifiedAt);
  return {
    '@context':'https://schema.org', '@type':article ? 'Article' : 'WebPage',
    '@id':canonical + (article ? '#article' : '#webpage'),
    name, ...(article ? {headline:name, mainEntityOfPage:{'@type':'WebPage','@id':canonical}} : {}),
    description, url:canonical,
    isPartOf:{'@type':'WebSite','@id':new URL('/#website', site).href, name:'ELN — Enterprise Licensing Network', url:site.href},
    ...(article ? {publisher:{'@type':'Organization',name:'ELN — Enterprise Licensing Network',url:site.href}} : {}),
    ...(modified ? {dateModified:modified} : {}),
  };
}

export function breadcrumbSchema(breadcrumbs: readonly Breadcrumb[], site: URL) {
  return {
    '@context':'https://schema.org', '@type':'BreadcrumbList',
    itemListElement:breadcrumbs.map((crumb, index) => ({
      '@type':'ListItem', position:index + 1, name:crumb.name, item:new URL(crumb.path, site).href,
    })),
  };
}

export const serializeStructuredData = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c');

export interface SitemapEntry {path:string; lastmod?:string}
export function publicSitemapEntries(guides: readonly ArticleGuide[], tools: readonly ToolLink[] = []): SitemapEntry[] {
  const publicGuides = guides.filter(guide => (!guide.status || guide.status === 'published') && !/^\/(?:owner|api|plan)(?:\/|$)/.test(guide.path));
  const entries: SitemapEntry[] = [
    ...['/','/guides/','/tools/','/coverage/','/methodology/','/privacy/','/sources/','/interest/','/contact/'].map(path => ({path})),
    ...tools.map(tool => ({path:'/tools/' + tool.slug + '/'})),
    ...learningHubs.map(hub => ({path:hubPath(hub),lastmod:latestContentModified(guidesForHub(hub, publicGuides))})),
    ...publicGuides.map(guide => ({
      path:guide.path, lastmod:recordedModifiedAt(guide.contentModifiedAt),
    })),
  ];
  const index = entries.find(entry => entry.path === '/guides/');
  if (index) index.lastmod = latestContentModified(publicGuides);
  return [...new Map(entries.map(entry => [entry.path, entry])).values()];
}
