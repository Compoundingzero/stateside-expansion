import test from 'node:test';
import assert from 'node:assert/strict';
import {
  articleBreadcrumbs, breadcrumbSchema, guidesForHub, hubPath, isReferenceGuide,
  latestContentModified, learningHubForGuide, learningHubs, pageSchema,
  publicSitemapEntries, readingLabel, recordedModifiedAt, relatedReading,
  searchTitle, semanticSectionIds, serializeStructuredData,
  type ArticleGuide,
} from '../src/lib/article-presentation';

const makeGuide = (id:string, values:Partial<ArticleGuide> = {}):ArticleGuide => ({
  id, path:'/guides/' + id + '/', title:'Guide ' + id, status:'published',
  family:'federal', topic:'employment', jurisdictions:['Federal'], ...values,
});

test('search title is independent of the visible Article headline and only recorded modifications are emitted', () => {
  const guide = makeGuide('pay', {title:'Who will pay the team?',seoTitle:'U.S. employer payroll accounts',contentModifiedAt:'2026-11-13T03:46:40.738Z'});
  assert.equal(searchTitle(guide), 'U.S. employer payroll accounts');
  const schema = pageSchema({site:new URL('https://example.invalid/'),path:guide.path,title:searchTitle(guide),
    headline:guide.title,description:'A payroll guide.',article:true,contentModifiedAt:guide.contentModifiedAt});
  assert.equal(schema.headline, guide.title);
  assert.equal(schema.dateModified, guide.contentModifiedAt);
  assert.equal(schema.publisher?.name, 'ELN — Enterprise Licensing Network');
  assert.equal(schema.publisher?.['@type'], 'Organization');
  assert.ok(!('author' in schema));
  assert.ok(!('datePublished' in schema));
  assert.ok(!('image' in schema));
  const undated = pageSchema({site:new URL('https://example.invalid/'),path:guide.path,title:guide.title,description:'No recorded modification.',article:true});
  assert.ok(!('dateModified' in undated));
  assert.equal(searchTitle({...guide,seoTitle:'  '}), guide.title);
});

test('structured data preserves its content while preventing a closing script tag in HTML', () => {
  const value = {headline:'An example </script><script>alert(1)</script>',description:'A & B'};
  const serialised = serializeStructuredData(value);
  assert.ok(!serialised.includes('<'));
  assert.deepEqual(JSON.parse(serialised), value);
});

test('breadcrumbs use the same real hierarchy as the article and explicit learning paths select existing hubs', () => {
  const guide = makeGuide('supply', {family:'industry',topic:'products-supply',learningPath:'products-supply'});
  const hub = learningHubForGuide(guide)!;
  assert.equal(hubPath(hub), '/topics/products-supply/');
  const crumbs = articleBreadcrumbs(guide);
  assert.deepEqual(crumbs.map(crumb => crumb.path), ['/', '/guides/', '/topics/products-supply/', guide.path]);
  const schema = breadcrumbSchema(crumbs,new URL('https://example.invalid/'));
  assert.deepEqual(schema.itemListElement.map(item => item.name), crumbs.map(crumb => crumb.name));
  assert.deepEqual(schema.itemListElement.map(item => item.position), [1,2,3,4]);
  assert.equal(schema.itemListElement.at(-1)?.item, 'https://example.invalid' + guide.path);
  assert.equal(learningHubForGuide({...guide,learningPath:undefined})?.slug,'industry');
});

test('semantic section links are unique, respect explicit IDs and preserve unmigrated numbered aliases', () => {
  const sections = [
    {heading:'Café rights'},
    {heading:'Sources'},
    {heading:'Café rights',id:'cafe-rights'},
    {heading:'Section 0'},
    {heading:'2026 rates'},
    {heading:'Café rights'},
  ];
  const before = structuredClone(sections);
  const entries = semanticSectionIds(sections);
  assert.deepEqual(entries.map(entry => entry.legacyId), sections.map((_,index) => 'section-' + index));
  assert.equal(entries[2].id,'cafe-rights');
  assert.notEqual(entries[0].id,entries[2].id);
  assert.equal(new Set(entries.map(entry => entry.id)).size,sections.length);
  assert.ok(entries.every(entry => !/^section-\d+$/.test(entry.id) && entry.id !== 'sources'));
  assert.deepEqual(sections,before);
});

test('inserting a section preserves original numbered meanings through explicit legacy indices', () => {
  const entries = semanticSectionIds([
    {heading:'New explanation'},
    {heading:'Original introduction',legacyIndex:0},
    {heading:'Original conditions',legacyIndex:1,id:'conditions'},
    {heading:'Another new explanation'},
    {heading:'Original outcome',legacyIndex:7},
  ]);
  assert.deepEqual(entries.map(entry => entry.legacyId),[undefined,'section-0','section-1',undefined,'section-7']);
  assert.equal(entries.find(entry => entry.legacyId==='section-1')?.section.heading,'Original conditions');
  assert.equal(entries[2].id,'conditions');
  const reserved = semanticSectionIds([{heading:'Section 7'},{heading:'Prior meaning',legacyIndex:7}]);
  assert.notEqual(reserved[0].id,'section-7');
});

test('curated reading preserves order, includes known tools and does not pad or accept unrecognised destinations', () => {
  const a = makeGuide('a');
  const b = makeGuide('b');
  const hidden = makeGuide('hidden',{status:'unpublished'});
  const current = {...a,relatedPaths:[b.path,'/tools/cash-runway/',b.path,a.path,hidden.path,'https://outside.invalid/','//outside.invalid/','/missing/']};
  const result = relatedReading(current,[a,b,hidden],[{slug:'cash-runway',name:'Cash runway'}]);
  assert.deepEqual(result.map(item => item.path),[b.path,'/tools/cash-runway/']);
  assert.deepEqual(result.map(item => item.kind),['guide','tool']);
  assert.deepEqual(relatedReading({...a,relatedPaths:[]},[a,b]),[]);
});

test('fallback reading is deterministic, scores actual shared subjects and never relies on file order', () => {
  const current = makeGuide('current',{jurisdictions:['Texas']});
  const samePlace = makeGuide('tx',{jurisdictions:['Texas'],topic:'classification'});
  const sameTopic = makeGuide('payroll');
  const irrelevant = makeGuide('tax',{topic:'corporate-tax'});
  const choices = [irrelevant,sameTopic,current,samePlace];
  const forward = relatedReading(current,choices);
  const reverse = relatedReading(current,[...choices].reverse());
  assert.deepEqual(forward,reverse);
  assert.deepEqual(forward.map(item => item.path),[samePlace.path,sameTopic.path]);
  assert.ok(!forward.some(item => item.path===irrelevant.path));
  const generic=makeGuide('generic',{jurisdictions:['U.S. federal']});
  const unrelated=makeGuide('unrelated',{jurisdictions:['U.S. federal'],topic:'corporate-tax'});
  assert.deepEqual(relatedReading(generic,[unrelated]),[]);
});

test('hubs have real topic/family membership, exclude held records and order FDD items numerically', () => {
  assert.equal(new Set(learningHubs.map(hub => hub.slug)).size,learningHubs.length);
  const hub = learningHubs.find(hub => hub.slug==='fdd')!;
  const records = [10,2,1].map(number => makeGuide('fdd-item-' + number,{family:'fdd'}));
  records.push(makeGuide('held',{family:'fdd',status:'held'}));
  assert.deepEqual(guidesForHub(hub,records).map(guide => guide.id),['fdd-item-1','fdd-item-2','fdd-item-10']);
  const other = makeGuide('mixed',{topic:'employment',learningPath:'ip-data'});
  assert.equal(guidesForHub(learningHubs.find(hub=>hub.slug==='ip-data')!,[other]).length,1);
  assert.equal(guidesForHub(learningHubs.find(hub=>hub.slug==='employment')!,[other]).length,1);
});

test('modification dates and sitemap lastmod derive only from public recorded content changes', () => {
  assert.equal(recordedModifiedAt('2026-02-30'),undefined);
  assert.equal(recordedModifiedAt('not a date'),undefined);
  assert.equal(recordedModifiedAt('2026-11-13'),'2026-11-13');
  const old = makeGuide('old',{contentModifiedAt:'2026-11-12T10:00:00Z'});
  const current = makeGuide('new',{contentModifiedAt:'2026-11-13T03:46:40.738Z'});
  const undated = makeGuide('undated');
  const hidden = makeGuide('hidden',{status:'held',contentModifiedAt:'2026-11-13T04:00:00Z'});
  const privateGuide = makeGuide('private',{path:'/owner/',contentModifiedAt:'2026-11-13T04:10:00Z'});
  const entries = publicSitemapEntries([old,current,undated,hidden,privateGuide],[{slug:'cash-runway',name:'Cash runway'}]);
  assert.equal(latestContentModified([old,current,undated]),current.contentModifiedAt);
  assert.equal(entries.find(entry=>entry.path===current.path)?.lastmod,current.contentModifiedAt);
  assert.equal(entries.find(entry=>entry.path===undated.path)?.lastmod,undefined);
  assert.equal(entries.find(entry=>entry.path==='/topics/employment/')?.lastmod,current.contentModifiedAt);
  assert.equal(entries.find(entry=>entry.path==='/guides/')?.lastmod,current.contentModifiedAt);
  assert.equal(entries.find(entry=>entry.path==='/')?.lastmod,undefined);
  assert.ok(entries.some(entry=>entry.path==='/tools/cash-runway/'));
  assert.ok(!entries.some(entry=>entry.path===hidden.path || /^\/(?:plan|owner|api)(?:\/|$)/.test(entry.path)));
});

test('reference labels retain ordinary reading times and recognise table-based reference articles', () => {
  const table = {heading:'State',table:{headers:['Account','Route'],rows:[['A','B']]}};
  const reference = {sections:Array.from({length:51},()=>table),readMinutes:44};
  assert.equal(isReferenceGuide(reference),true);
  assert.equal(readingLabel(reference),'Reference guide');
  assert.equal(readingLabel({sections:[table],readMinutes:5}),'5 min read');
});
