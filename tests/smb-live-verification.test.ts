import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {editorialHash} from '../scripts/smb-edit-utils.mjs';
import {decodeHtmlEntities,inspectArticleHtml,verifyPublishedArticles} from '../scripts/verify-smb-live.mjs';

const guide=(index=0)=>({id:'fixture-'+index,path:'/articles/fixture-'+index+'/',status:'published',title:'Owner & operator <choice> '+index,seoTitle:'Search & choice '+index,description:'A "quoted" description & explanation.',learningSummary:'Use the actual owner’s terms & ask what changed.',sections:[{id:'owner-decision',heading:'Owner decision',paragraphs:['An explanation.','The owner’s second condition & exception.'],bullets:['A required fact.','A different qualifying condition.'],table:{headers:['Event','Period'],rows:[['Actual receipt','10 business days'],['Payment','14 calendar days']]},aliases:['old-heading','section-0'],sourceIds:['fixture-source']}],sourceIds:['fixture-source'],ruleIds:[],practicalOutput:'Choose the actual terms.',limitations:['The example is limited.','Actual dates and conditions still matter.'],keyTerms:[],relatedPaths:[]});
const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function html(g=guide(),origin='https://example.invalid'){
 const source='<a href="https://authority.example.invalid/rule?a=1&amp;b=2">Official source</a>';
 const sections=g.sections.map(s=>'<section class="anchor-section article-main-section" id="'+s.id+'">'+s.aliases.map(id=>'<span id="'+id+'"></span>').join('')+'<h2>'+escape(s.heading)+'</h2>'+s.paragraphs.map(p=>'<p>'+escape(p)+'</p>').join('')+'<ul>'+s.bullets.map(b=>'<li>'+escape(b)+'</li>').join('')+'</ul><div class="table-wrap"><table><thead><tr>'+s.table.headers.map(h=>'<th scope="col">'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+s.table.rows.map(row=>'<tr>'+row.map(cell=>'<td>'+escape(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><p class="meta section-citations">Sources: '+source+'</p></section>').join('');
 return '<!doctype html><html><head><title>'+escape(g.seoTitle)+' | ELN</title><meta name="description" content="'+escape(g.description)+'"><link rel="canonical" href="'+origin+g.path+'"></head><body><script>const trap="<h1 id=trap>not a heading</h1>";</script><!--<h1>not a heading</h1>--><h1>'+escape(g.title)+'</h1><p id="start-here">'+escape(g.learningSummary)+'</p>'+sections+'<section id="guide-limits"><h2>Scope</h2><ul>'+g.limitations.map(item=>'<li>'+escape(item)+'</li>').join('')+'</ul></section><section id="what-to-prepare"><h2>Next step</h2><p>'+escape(g.practicalOutput)+'</p></section>'+['words-to-know','sources','official-federal-explanation','detailed-rules','documented-cases','related-preparation'].map(id=>'<span id="'+id+'"></span>').join('')+source+'</body></html>';
}
const expected=(g=guide())=>({guide:g,canonicalOrigin:'https://example.invalid',sourceUrls:['https://authority.example.invalid/rule?a=1&b=2'],baselineFragments:['old-heading','section-0']});

test('HTML comparison decodes entities once, ignores raw-text traps and checks real headings, metadata and bookmarks',()=>{
 assert.equal(decodeHtmlEntities('&amp; &#x2019; &#169; &eacute; &amp;lt;'),'& ’ © é &lt;');
 const result=inspectArticleHtml(html(),expected());assert.deepEqual(result.errors,[]);assert.equal(result.checks.h1Count,1);
 const literal={...guide(),title:'A literal &amp; token',description:'The literal &quot; text stays literal.'};
 assert.deepEqual(inspectArticleHtml(html(literal),expected(literal)).errors,[]);
 const quoted={...guide(),description:'A > marker in a quoted attribute'};
 assert.deepEqual(inspectArticleHtml(html(quoted),expected(quoted)).errors,[]);
});

test('stale answers, duplicate fragments/headings, false canonicals, missing citations and noindex cannot pass',()=>{
 const original=html();
 const cases=[
  [original.replace(escape(guide().learningSummary),'A stale answer.'),'answer'],
  [original.replace('</body>','<h1>Extra title</h1></body>'),'one H1'],
  [original.replace('</body>','<span id="section-0"></span></body>'),'Fragment section-0'],
  [original.replace('https://example.invalid'+guide().path,'https://other.example.invalid'+guide().path),'Canonical'],
  [original.replaceAll('https://authority.example.invalid/rule?a=1&amp;b=2','https://authority.example.invalid/other'),'source link'],
  [original.replace('</head>','<meta name="googlebot" content="noindex, follow"></head>'),'noindex'],
 ];
 for(const[body,message]of cases)assert.ok(inspectArticleHtml(body,expected()).errors.some((error:string)=>error.includes(message)),message);
 assert.ok(inspectArticleHtml(original,expected(),new Headers({'X-Robots-Tag':'none'})).errors.some((error:string)=>error.includes('noindex')));
});

test('current answer, metadata and IDs cannot hide stale or incomplete section, table, next-step or scope text',()=>{
 const original=html(),g=guide();
 const cases=[
  [original.replace('<h2>Owner decision</h2>','<h2>Old question</h2>'),'owner-decision heading'],
  [original.replace('<p>An explanation.</p>','<p>The previous paragraph.</p>'),'owner-decision paragraph'],
  [original.replace('<p>An explanation.</p>',''),'owner-decision paragraph'],
  [original.replace('<p>An explanation.</p>','<p>An explanation.</p><p>Extra old instruction.</p>'),'owner-decision paragraph'],
  [original.replace('<li>A required fact.</li>','<li>An obsolete requirement.</li>'),'owner-decision bullet'],
  [original.replace('<th scope="col">Period</th>','<th scope="col">Old period</th>'),'table header'],
  [original.replace('<td>10 business days</td>','<td>10 calendar days</td>'),'table row 1 cell'],
  [original.replace('<tr><td>Payment</td><td>14 calendar days</td></tr>',''),'table rows'],
  [original.replace('<p>'+g.practicalOutput+'</p>','<p>Prepare the old file.</p>'),'Next step paragraph'],
  [original.replace('<li>The example is limited.</li>','<li>An older scope claim.</li>'),'Scope item'],
  [original.replace('<li>Actual dates and conditions still matter.</li>',''),'Scope item'],
 ];
 for(const[body,message]of cases){
  const result=inspectArticleHtml(body,expected());
  assert.ok(result.errors.some((error:string)=>error.includes(message)),message);
  assert.ok(!result.errors.some((error:string)=>/visible answer|metadata|Fragment|H1/.test(error)),message+' should fail on body content itself');
 }
 const successful=inspectArticleHtml(original,expected());
 assert.deepEqual(successful.errors,[]);
 assert.deepEqual({sections:successful.checks.mainSections,paragraphs:successful.checks.bodyParagraphs,bullets:successful.checks.bodyBullets,tables:successful.checks.bodyTables,cells:successful.checks.bodyTableCells,scope:successful.checks.scopeItems,nextStep:successful.checks.nextStepParagraphs},{sections:1,paragraphs:2,bullets:2,tables:1,cells:6,scope:2,nextStep:1});
});

type Fixture={directory:string;guides:ReturnType<typeof guide>[];workflow:any;write:(path:string,data:unknown)=>Promise<void>;read:(path:string)=>Promise<any>};
async function fixture(run:(fixture:Fixture)=>Promise<void>){
 const directory=await mkdtemp(join(tmpdir(),'eln-smb-live-'));
 const write=async(path:string,data:unknown)=>writeFile(join(directory,path),JSON.stringify(data,null,2)+'\n');
 const read=async(path:string)=>JSON.parse(await readFile(join(directory,path),'utf8'));
 try{
  await mkdir(join(directory,'src/data'),{recursive:true});await mkdir(join(directory,'research/smb-edit'),{recursive:true});
  const guides=Array.from({length:278},(_,index)=>guide(index));
  const workflow={articles:guides.map(g=>{const hash=editorialHash(g);return{id:g.id,path:g.path,state:'validated',contentHash:hash,validatedHash:hash,reviewedHash:hash,review:{decision:'approved',reviewedHash:hash,notes:'Read the actual current example.',reviewer:'independent-fixture-reviewer'}};})};
  await write('src/data/fixture-guides.json',guides);
  await write('src/data/fixture-sources.json',[{id:'fixture-source',url:'https://authority.example.invalid/rule?a=1&b=2'}]);
  await write('src/data/fixture-rules.json',[]);
  await write('research/smb-edit/input.json',guides);
  await write('research/smb-edit/fragments.json',guides.map(g=>({id:g.id,path:g.path,sections:[{semanticId:'old-heading',legacyId:'section-0'}]})));
  await write('research/smb-edit/workflow.json',workflow);
  await run({directory,guides,workflow,write,read});
 }finally{await rm(directory,{recursive:true,force:true});}
}
const mockFetch=(guides:ReturnType<typeof guide>[],origin='https://example.invalid')=>async(url:string)=>new Response(html(guides.find(g=>g.path===new URL(url).pathname),origin),{headers:{'content-type':'text/html; charset=utf-8'}});

test('a stale validation hash or missing published record stops before any request',async()=>fixture(async f=>{
 f.workflow.articles[7].validatedHash='stale';await f.write('research/smb-edit/workflow.json',f.workflow);
 let requests=0;
 const result=await verifyPublishedArticles({cwd:f.directory,origin:'https://example.invalid',fetchImpl:async()=>{requests++;throw Error('Must not request');}});
 assert.equal(result.allPassed,false);assert.equal(requests,0);assert.ok(result.errors.some((error:string)=>error.includes('fixture-7')));
 assert.equal((await f.read('artifacts/smb-live-verification.json')).snapshotHash,result.snapshotHash);
 await f.write('src/data/fixture-guides.json',f.guides.slice(1));
 const incomplete=await verifyPublishedArticles({cwd:f.directory,origin:'https://example.invalid',fetchImpl:async()=>{requests++;throw Error('Must not request');}});
 assert.ok(incomplete.errors.some((error:string)=>error.includes('278 unique published')));assert.equal(requests,0);
}));

test('all 278 are GET-only, use at most six concurrent requests and preview leaves workflow unchanged',async()=>fixture(async f=>{
 const before=await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8');
 let active=0,maximum=0,requests=0;const fetchPage=mockFetch(f.guides);
 const result=await verifyPublishedArticles({cwd:f.directory,origin:'https://example.invalid',fetchImpl:async(url:string,options:any)=>{
  assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');active++;requests++;maximum=Math.max(maximum,active);
  await new Promise(resolve=>setTimeout(resolve,1));const response=await fetchPage(url);active--;return response;
 }});
 assert.equal(result.allPassed,true,JSON.stringify(result.errors));assert.equal(requests,278);assert.equal(maximum,6);
 assert.equal(result.results.length,278);assert.ok(result.results.every((row:any)=>row.contentHash===row.validatedHash&&row.passed&&row.htmlHash));
 assert.equal(result.workflowAdvanced,false);assert.equal(await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8'),before);
}));

test('one bad HTTP response or changed local revision prevents advancement of every article',async()=>fixture(async f=>{
 const before=await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8'),fetchPage=mockFetch(f.guides);
 const failed=await verifyPublishedArticles({cwd:f.directory,origin:'https://example.invalid',advance:true,fetchImpl:async(url:string)=>new URL(url).pathname===f.guides[2].path?new Response('',{status:503}):fetchPage(url)});
 assert.equal(failed.allPassed,false);assert.equal(failed.workflowAdvanced,false);assert.equal(failed.results.length,278);
 assert.equal(await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8'),before);
 let changed=false;
 const raced=await verifyPublishedArticles({cwd:f.directory,origin:'https://example.invalid',advance:true,fetchImpl:async(url:string)=>{
  if(!changed){changed=true;await f.write('src/data/fixture-sources.json',[{id:'fixture-source',url:'https://authority.example.invalid/changed'}]);}
  return fetchPage(url);
 }});
 assert.equal(raced.allPassed,false);assert.ok(raced.errors.some((error:string)=>error.includes('changed during verification')));
 assert.equal(await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8'),before);
}));

test('successful explicit released-origin verification advances exactly the hashes checked, while local advance is rejected',async()=>fixture(async f=>{
 await assert.rejects(()=>verifyPublishedArticles({cwd:f.directory,advance:true,fetchImpl:mockFetch(f.guides)}),/actual released HTTPS origin/);
 const result=await verifyPublishedArticles({cwd:f.directory,origin:'https://example.invalid',advance:true,fetchImpl:mockFetch(f.guides)});
 assert.equal(result.allPassed,true);assert.equal(result.workflowAdvanced,true);
 const ledger=await f.read('research/smb-edit/workflow.json');
 assert.ok(ledger.articles.every((entry:any)=>entry.state==='live-verified'&&entry.liveVerifiedHash===entry.contentHash&&entry.liveVerifiedOrigin==='https://example.invalid'&&entry.liveVerifiedAt===result.completedAt));
}));

test('a selected workflow supports fixed inventories below or above 278 without weakening identity/hash/count guards',async()=>{
 for(const count of [3,281])await fixture(async f=>{
  const selected='research/next-release';await mkdir(join(f.directory,selected),{recursive:true});
  const guides=Array.from({length:count},(_,index)=>guide(index));
  const workflow={expectedArticleCount:count,articles:guides.map(g=>{const hash=editorialHash(g);return{id:g.id,path:g.path,state:'validated',contentHash:hash,validatedHash:hash,reviewedHash:hash,review:{decision:'approved',reviewedHash:hash,notes:'Read the complete current fixture.',reviewer:'independent-fixture-reviewer'}};})};
  const fragments=guides.map(g=>({id:g.id,path:g.path,sections:[{semanticId:'old-heading',legacyId:'section-0'}]}));
  await f.write('src/data/fixture-guides.json',guides);await f.write(selected+'/input.json',guides);await f.write(selected+'/fragments.json',fragments);await f.write(selected+'/workflow.json',workflow);
  const legacyBefore=await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8');
  const result=await verifyPublishedArticles({cwd:f.directory,workflowDir:selected,origin:'https://example.invalid',advance:true,fetchImpl:mockFetch(guides)});
  assert.equal(result.allPassed,true,JSON.stringify(result.errors));assert.equal(result.results.length,count);assert.equal(result.expectedArticles,count);assert.equal(result.artifact,'artifacts/next-release-live-verification.json');
  assert.ok((await f.read(selected+'/workflow.json')).articles.every((entry:any)=>entry.state==='live-verified'));
  assert.equal(await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8'),legacyBefore);
  assert.equal((await f.read(result.artifact)).results.length,count);
  let requests=0;
  for(const broken of ['count','identity','hash']){
   const ledger=structuredClone(workflow),baseline=structuredClone(guides),oldFragments=structuredClone(fragments);
   if(broken==='count')oldFragments.pop();
   if(broken==='identity')baseline[0].path='/wrong-fixed-path/';
   if(broken==='hash')ledger.articles[0].validatedHash='stale';
   await f.write(selected+'/input.json',baseline);await f.write(selected+'/fragments.json',oldFragments);await f.write(selected+'/workflow.json',ledger);
   const failed=await verifyPublishedArticles({cwd:f.directory,workflowDir:selected,origin:'https://example.invalid',advance:true,fetchImpl:async()=>{requests++;throw Error('Must not request');}});
   assert.equal(failed.allPassed,false,broken);assert.equal(failed.workflowAdvanced,false);assert.equal(requests,0);
  }
 });
});
