import {readFile,readdir,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {characterEntitiesHtml4} from 'character-entities-html4';
import {editorialHash} from './smb-edit-utils.mjs';
import {searchTitle,semanticSectionIds} from '../src/lib/article-presentation.ts';

const expectedCount=278, concurrency=6;
const sha=value=>createHash('sha256').update(value).digest('hex');
const namedEntities={...characterEntitiesHtml4,apos:"'",NonBreakingSpace:'\u00a0'};
export function decodeHtmlEntities(value){
 return String(value).replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/gi,(entity,name)=>{
  if(name[0]!=='#')return namedEntities[name]??entity;
  const code=name[1]?.toLowerCase()==='x'?parseInt(name.slice(2),16):parseInt(name.slice(1),10);
  return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):'\ufffd';
 });
}
const normalise=value=>String(value).replace(/\s+/gu,' ').trim();
const textContent=html=>normalise(decodeHtmlEntities(html.replace(/<!--[^]*?-->/g,'').replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g,'')));

// This scans the static HTML emitted by Astro. Quoted attributes may contain >.
// Raw-text scripts/styles and comments cannot create fake headings or ID matches.
function htmlElements(html){
 const safe=html.replace(/<!--[^]*?-->/g,'').replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi,'');
 const tags=[],stack=[],voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
 const pattern=/<\/?[a-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/gi;
 for(const match of safe.matchAll(pattern)){
  const tag=/^<(\/?)\s*([\w:-]+)/.exec(match[0]);if(!tag)continue;
  const attrs={};
  if(!tag[1])for(const attr of match[0].slice(tag[0].length).matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){
   const name=attr[1].toLowerCase();if(name!=='/')attrs[name]=decodeHtmlEntities(attr[2]??attr[3]??attr[4]??'');
  }
  const element={name:tag[2].toLowerCase(),closing:Boolean(tag[1]),attrs,start:match.index,end:match.index+match[0].length};
  if(element.closing){
   const index=stack.findLastIndex(open=>open.name===element.name);
   if(index>=0){stack[index].closeStart=element.start;stack.splice(index);}
  }else{
   element.parent=stack.at(-1);if(!voidTags.has(element.name)&&!(/\/\s*>$/).test(match[0]))stack.push(element);
  }
  tags.push(element);
 }
 const opened=name=>tags.filter(tag=>!tag.closing&&tag.name===name);
 const inner=tag=>tag?.closeStart===undefined?'':safe.slice(tag.end,tag.closeStart);
 const children=(tag,name)=>tags.filter(element=>!element.closing&&element.parent===tag&&(!name||element.name===name));
 const descendants=(tag,name)=>tags.filter(element=>!element.closing&&element.start>tag.end&&element.start<tag.closeStart&&(!name||element.name===name));
 return {tags,opened,inner,children,descendants};
}

export function inspectArticleHtml(html,{guide,canonicalOrigin,sourceUrls,baselineFragments=[]},headers=new Headers()){
 const errors=[],doc=htmlElements(html),elements=doc.tags.filter(tag=>!tag.closing);
 const ids=new Map();for(const tag of elements)if(tag.attrs.id)ids.set(tag.attrs.id,(ids.get(tag.attrs.id)||0)+1);
 const h1=doc.opened('h1');
 if(h1.length!==1)errors.push(`Expected one H1; found ${h1.length}`);
 if(h1.length===1&&textContent(doc.inner(h1[0]))!==normalise(guide.title))errors.push('H1 does not match the current article title');
 const answers=elements.filter(tag=>tag.attrs.id==='start-here');
 if(answers.length!==1||answers[0]?.name!=='p'||textContent(doc.inner(answers[0]))!==normalise(guide.learningSummary))errors.push('The visible answer does not match the current article');
 const titles=doc.opened('title');
 if(titles.length!==1||textContent(doc.inner(titles[0]))!==normalise(searchTitle(guide)+' | ELN'))errors.push('Search title does not match current metadata');
 const descriptions=doc.opened('meta').filter(tag=>tag.attrs.name?.toLowerCase()==='description');
 if(descriptions.length!==1||normalise(descriptions[0].attrs.content??'')!==normalise(guide.description))errors.push('Meta description does not match current metadata');
 const canonical=doc.opened('link').filter(tag=>tag.attrs.rel?.toLowerCase().split(/\s+/).includes('canonical'));
 const expectedUrl=new URL(guide.path,canonicalOrigin).href;
 if(canonical.length!==1||canonical[0].attrs.href!==expectedUrl)errors.push('Canonical URL does not match the expected public URL');
 const robots=doc.opened('meta').filter(tag=>/^(?:robots|googlebot|bingbot)$/i.test(tag.attrs.name??'')).map(tag=>tag.attrs.content??'');
 robots.push(headers.get('x-robots-tag')??'');
 if(robots.some(value=>/(?:^|[\s,:;])(?:noindex|none)(?:$|[\s,;])/i.test(value)))errors.push('The page has a noindex directive');
 const anchors=semanticSectionIds(guide.sections??[]);
 const hasClass=(element,name)=>(element.attrs.class??'').split(/\s+/).includes(name);
 const mainSections=elements.filter(element=>hasClass(element,'article-main-section'));
 if(mainSections.length!==anchors.length)errors.push(`Expected ${anchors.length} main sections; found ${mainSections.length}`);
 const compareText=(nodes,values,label)=>{
  if(nodes.length!==values.length)errors.push(`${label}: expected ${values.length} elements; found ${nodes.length}`);
  values.forEach((value,index)=>{if(nodes[index]&&textContent(doc.inner(nodes[index]))!==normalise(value))errors.push(`${label} ${index+1} does not match current article text`);});
 };
 const compareList=(container,values,label)=>{
  const lists=doc.children(container,'ul');
  if(lists.length!==(values.length?1:0))errors.push(`${label}: expected ${values.length?1:0} lists; found ${lists.length}`);
  compareText(lists.flatMap(list=>doc.children(list,'li')),values,label);
 };
 let bodyParagraphs=0,bodyBullets=0,bodyTables=0,bodyTableCells=0;
 anchors.forEach(({section,id},index)=>{
  const node=mainSections[index];
  if(!node||node.name!=='section'||node.attrs.id!==id){errors.push(`Main section ${index+1} is missing or out of order: ${id}`);return;}
  compareText(doc.children(node,'h2'),[section.heading],`${id} heading`);
  const paragraphs=section.paragraphs??[],bullets=section.bullets??[];
  compareText(doc.children(node,'p').filter(paragraph=>!hasClass(paragraph,'section-citations')),paragraphs,`${id} paragraph`);
  compareList(node,bullets,`${id} bullet`);bodyParagraphs+=paragraphs.length;bodyBullets+=bullets.length;
  const tables=doc.descendants(node,'table');
  if(tables.length!==(section.table?1:0))errors.push(`${id}: expected ${section.table?1:0} tables; found ${tables.length}`);
  if(section.table&&tables.length){
   bodyTables++;const table=tables[0],heads=doc.children(table,'thead'),bodies=doc.children(table,'tbody');
   const headerRows=heads.flatMap(head=>doc.children(head,'tr'));
   if(heads.length!==1||headerRows.length!==1)errors.push(`${id}: expected one table header row`);
   compareText(headerRows.flatMap(row=>doc.children(row,'th')),section.table.headers,`${id} table header`);
   if(bodies.length!==1)errors.push(`${id}: expected one table body`);
   const rows=bodies.flatMap(body=>doc.children(body,'tr'));
   if(rows.length!==section.table.rows.length)errors.push(`${id}: expected ${section.table.rows.length} table rows; found ${rows.length}`);
   section.table.rows.forEach((cells,rowIndex)=>{
    compareText(rows[rowIndex]?doc.children(rows[rowIndex],'td'):[],cells,`${id} table row ${rowIndex+1} cell`);bodyTableCells+=cells.length;
   });
   bodyTableCells+=section.table.headers.length;
  }
 });
 const nextSteps=elements.filter(element=>element.attrs.id==='what-to-prepare');
 if(nextSteps.length!==1||nextSteps[0].name!=='section')errors.push('Next step is not a single section');
 else{
  compareText(doc.children(nextSteps[0],'h2'),['Next step'],'Next step heading');
  compareText(doc.children(nextSteps[0],'p'),[guide.practicalOutput],'Next step paragraph');
 }
 const scopes=elements.filter(element=>element.attrs.id==='guide-limits'),limitations=guide.limitations??[];
 if(limitations.length){
  if(scopes.length!==1||scopes[0].name!=='section')errors.push('Scope is not a single section');
  else{compareText(doc.children(scopes[0],'h2'),['Scope'],'Scope heading');compareList(scopes[0],limitations,'Scope item');}
 }else if(scopes.some(element=>element.name==='section'))errors.push('Unexpected Scope section without current limitations');
 const expectedIds=new Set(['start-here','words-to-know','sources','what-to-prepare','guide-limits','official-federal-explanation','detailed-rules','documented-cases','related-preparation',...anchors.flatMap(entry=>[entry.id,...entry.aliases]),...baselineFragments]);
 if(guide.id==='state-employer-payroll-registration')expectedIds.add('choose-jurisdiction');
 for(const id of expectedIds)if(ids.get(id)!==1)errors.push(`Fragment ${id}: expected once; found ${ids.get(id)||0}`);
 for(const[id,count]of ids)if(count>1&&!expectedIds.has(id))errors.push(`Duplicate ID ${id}: found ${count}`);
 const hrefs=new Set(doc.opened('a').map(tag=>{try{return new URL(tag.attrs.href,expectedUrl).href;}catch{return null;}}));
 for(const url of sourceUrls)if(!hrefs.has(new URL(url,expectedUrl).href))errors.push('Missing current source link: '+url);
 return {errors,checks:{h1Count:h1.length,answerCount:answers.length,mainSections:mainSections.length,bodyParagraphs,bodyBullets,bodyTables,bodyTableCells,scopeItems:limitations.length,nextStepParagraphs:nextSteps.length===1?doc.children(nextSteps[0],'p').length:0,expectedFragments:expectedIds.size,sourceLinks:sourceUrls.length,canonical:canonical[0]?.attrs.href??null}};
}

async function loadInventory(cwd){
 const files=(await readdir(resolve(cwd,'src/data'))).filter(file=>/guides\.json$|sources\.json$|rules\.json$/.test(file)).sort();
 const paths=['research/smb-edit/input.json','research/smb-edit/fragments.json','research/smb-edit/workflow.json',...files.map(file=>'src/data/'+file)];
 const snapshots=await Promise.all(paths.map(async path=>({path,raw:await readFile(resolve(cwd,path),'utf8')})));
 const data=new Map(snapshots.map(file=>[file.path,JSON.parse(file.raw)]));
 const all=files.filter(file=>file.endsWith('guides.json')).flatMap(file=>data.get('src/data/'+file));
 return {guides:all.filter(g=>g.status==='published'),baseline:data.get(paths[0]),fragments:data.get(paths[1]),workflow:data.get(paths[2]),
  sources:new Map(files.filter(file=>file.endsWith('sources.json')).flatMap(file=>data.get('src/data/'+file)).map(source=>[source.id,source])),
  rules:new Map(files.filter(file=>file.endsWith('rules.json')).flatMap(file=>data.get('src/data/'+file)).map(rule=>[rule.id,rule])),
  snapshotHash:sha(JSON.stringify(snapshots.map(file=>[file.path,sha(file.raw)])))};
}

function validatedArticles(inventory){
 const {guides,baseline,fragments,workflow,sources,rules}=inventory,errors=[];
 for(const[label,rows]of [['published guides',guides],['baseline guides',baseline],['workflow articles',workflow.articles],['baseline fragment records',fragments]]){
  if(rows.length!==expectedCount||new Set(rows.map(row=>row.id)).size!==expectedCount)errors.push(`Expected exactly ${expectedCount} unique ${label}`);
 }
 const ids=new Set(baseline.map(g=>g.id)),ledger=new Map(workflow.articles.map(entry=>[entry.id,entry])),fragmentMap=new Map(fragments.map(entry=>[entry.id,entry]));
 const articles=guides.map(guide=>{
  const hash=editorialHash(guide),entry=ledger.get(guide.id),old=baseline.find(g=>g.id===guide.id),prior=fragmentMap.get(guide.id);
  if(!ids.has(guide.id)||!old||old.path!==guide.path||entry?.path!==guide.path||prior?.path!==guide.path)errors.push(`${guide.id}: published identity does not match the fixed inventory`);
  if(!/^\/(?!\/)(?!api(?:\/|$)|owner(?:\/|$))[^?#]*\/$/.test(guide.path))errors.push(`${guide.id}: invalid public article path`);
  if(!entry||!['validated','live-verified'].includes(entry.state)||entry.contentHash!==hash||entry.validatedHash!==hash||entry.reviewedHash!==hash||entry.review?.reviewedHash!==hash||entry.review?.decision!=='approved'||!entry.review?.notes?.trim()||!entry.review?.reviewer?.trim())errors.push(`${guide.id}: current content lacks a matching independent review and validated hash`);
  const sourceIds=new Set([...(guide.sourceIds??[]),...(guide.sections??[]).flatMap(section=>section.sourceIds??[]),...(guide.ruleIds??[]).flatMap(id=>rules.get(id)?.sourceIds??[])]);
  for(const id of guide.ruleIds??[])if(!rules.has(id))errors.push(`${guide.id}: unknown rule ${id}`);
  for(const id of sourceIds)if(!sources.get(id)?.url)errors.push(`${guide.id}: unknown source ${id}`);
  return {guide,contentHash:hash,validatedHash:entry?.validatedHash,reviewedHash:entry?.reviewedHash,sourceUrls:[...new Set([...sourceIds].map(id=>sources.get(id)?.url).filter(Boolean))],baselineFragments:(prior?.sections??[]).flatMap(section=>[section.semanticId,section.legacyId].filter(Boolean))};
 });
 if(workflow.articles.some(entry=>!ids.has(entry.id))||fragments.some(entry=>!ids.has(entry.id)))errors.push('Workflow or fragment inventory contains an unexpected article');
 return {articles,errors};
}

function siteOrigin(value){
 const url=new URL(value);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Use an http(s) site origin without credentials, path, query or fragment');
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.protocol!=='https:'&&!local)throw Error('A remote origin must use HTTPS');
 return {url:url.origin,local};
}
async function atomicJson(path,value){
 await mkdir(dirname(path),{recursive:true});const temporary=path+'.'+process.pid+'.tmp';
 await writeFile(temporary,JSON.stringify(value,null,2)+'\n');await rename(temporary,path);
}

export async function verifyPublishedArticles({cwd=process.cwd(),origin='http://localhost:3000',canonicalOrigin=origin,advance=false,fetchImpl=fetch,onProgress=()=>{}}={}){
 const target=siteOrigin(origin),canonical=siteOrigin(canonicalOrigin);
 if(target.url!==canonical.url&&!target.local)throw Error('A remote verification must use its own canonical origin');
 if(advance&&(target.local||target.url!==canonical.url||!target.url.startsWith('https://')))throw Error('Workflow advancement requires the actual released HTTPS origin, not a local preview');
 const startedAt=new Date().toISOString(),inventory=await loadInventory(cwd),preflight=validatedArticles(inventory);
 const result={startedAt,origin:target.url,canonicalOrigin:canonical.url,expectedArticles:expectedCount,concurrency,snapshotHash:inventory.snapshotHash,allPassed:false,workflowAdvanced:false,errors:preflight.errors,results:[]};
 if(!result.errors.length){
  let next=0,completed=0;
  await Promise.all(Array.from({length:concurrency},async()=>{
   while(next<preflight.articles.length){
    const item=preflight.articles[next++],url=new URL(item.guide.path,target.url).href;
    const page={id:item.guide.id,path:item.guide.path,url,contentHash:item.contentHash,validatedHash:item.validatedHash,reviewedHash:item.reviewedHash,checkedAt:new Date().toISOString(),errors:[]};
    try{
     const response=await fetchImpl(url,{method:'GET',redirect:'manual',cache:'no-store',headers:{Accept:'text/html','User-Agent':'ELN-publication-verification/1.0'},signal:AbortSignal.timeout(25000)});
     page.status=response.status;
     if(response.status!==200){page.errors.push('Expected HTTP200; received '+response.status);await response.body?.cancel();}
     else{
      const html=await response.text();page.htmlHash=sha(html);
      if(!/\btext\/html\b/i.test(response.headers.get('content-type')??''))page.errors.push('Response is not HTML');
      const check=inspectArticleHtml(html,{...item,canonicalOrigin:canonical.url},response.headers);page.errors.push(...check.errors);page.checks=check.checks;
     }
    }catch(error){page.errors.push(error instanceof Error?error.message:String(error));}
    page.passed=page.errors.length===0;result.results.push(page);completed++;
    if(completed%25===0||completed===preflight.articles.length)onProgress({completed,total:preflight.articles.length,failed:result.results.filter(page=>!page.passed).length});
   }
  }));
  result.results.sort((a,b)=>a.path.localeCompare(b.path));
  if((await loadInventory(cwd)).snapshotHash!==inventory.snapshotHash)result.errors.push('Local articles, evidence, fragments or workflow changed during verification; run again against one fixed revision');
 }
 result.completedAt=new Date().toISOString();
 result.allPassed=!result.errors.length&&result.results.length===expectedCount&&result.results.every(page=>page.passed);
 if(advance&&result.allPassed){
  for(const entry of inventory.workflow.articles)Object.assign(entry,{state:'live-verified',liveVerifiedHash:entry.contentHash,liveVerifiedAt:result.completedAt,liveVerifiedOrigin:target.url});
  await atomicJson(resolve(cwd,'research/smb-edit/workflow.json'),inventory.workflow);result.workflowAdvanced=true;
 }
 await atomicJson(resolve(cwd,'artifacts/smb-live-verification.json'),result);
 return result;
}

async function main(){
 const args=process.argv.slice(2),options={};
 for(let index=0;index<args.length;index++){
  const arg=args[index];
  if(arg==='--advance')options.advance=true;
  else if(['--origin','--canonical-origin'].includes(arg)){
   if(!args[index+1]||args[index+1].startsWith('--'))throw Error(arg+' requires a site origin');
   options[arg==='--origin'?'origin':'canonicalOrigin']=args[++index];
  }else throw Error('Use [--origin https://released-site] [--canonical-origin URL for local preview] [--advance]');
 }
 if(options.advance&&!options.origin)throw Error('--advance requires the explicit released --origin');
 const result=await verifyPublishedArticles({...options,onProgress:progress=>console.log(JSON.stringify(progress))});
 console.log(JSON.stringify({origin:result.origin,articles:result.results.length,passed:result.results.filter(page=>page.passed).length,allPassed:result.allPassed,workflowAdvanced:result.workflowAdvanced,artifact:'artifacts/smb-live-verification.json',errors:result.errors}));
 if(!result.allPassed)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
