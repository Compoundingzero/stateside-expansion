import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {extractSourceText,retrievalFailureKind,reviewMarkdown,NORMALIZATION_VERSION} from './source-text.mjs';
export function dependencyImpact(sourceId,{guides=[],rules=[],tools=[],pages=[]}={}) {
 const directRules=rules.filter(r=>r.sourceIds?.includes(sourceId));
 const ruleIds=new Set(directRules.map(r=>r.id));
 const guidePaths=guides.filter(g=>g.sourceIds?.includes(sourceId)||g.ruleIds?.some(id=>ruleIds.has(id))).map(g=>g.path);
 const toolPaths=tools.filter(t=>t.sourceIds?.includes(sourceId)||t.ruleIds?.some(id=>ruleIds.has(id))).map(t=>t.path);
 const explicitPaths=directRules.flatMap(r=>r.dependentPaths??[]);
 return {ruleIds:[...ruleIds],paths:[...new Set([...guidePaths,...toolPaths,...pages.filter(p=>p.sourceIds?.includes(sourceId)||p.ruleIds?.some(id=>ruleIds.has(id))).map(p=>p.path),...explicitPaths])],tools:[...new Set([...toolPaths,...explicitPaths.filter(p=>p.startsWith('/tools/'))])]};
}
export function sourceObservation({source,prior,current,fetchedAt,dependencies}) {
 return {sourceId:source.id,fetchedAt,substantiveVerifiedAt:source.substantiveVerifiedAt??null,previousHash:prior?.hash??null,previousNormalizationVersion:prior?.normalizationVersion??1,result:prior?((prior.normalizationVersion??1)!==(current.normalizationVersion??1)?'baseline-migrated':prior.hash!==current.hash?'changed':'unchanged'):'baseline-established',...current,...dependencies};
}
async function main(){
const out=resolve(process.env.SOURCE_REVIEW_DIRECTORY||'artifacts');await mkdir(join(out,'source-evidence'),{recursive:true});
const datasets={};for(const f of (await readdir('src/data')).filter(f=>f.endsWith('.json')))datasets[f]=JSON.parse(await readFile(join('src/data',f),'utf8'));
const records=suffix=>Object.entries(datasets).filter(([f])=>f.endsWith(suffix)).flatMap(([,v])=>v);
const guides=records('guides.json'),rules=records('rules.json'),sources=records('sources.json');
const published=guides.filter(g=>g.status==='published');
const toolDefinitions=datasets['tool-definitions.json']??[];
const sitePages=datasets['site-dependencies.json']??[];
const citedIds=new Set([...published,...toolDefinitions,...sitePages].flatMap(g=>[...(g.sourceIds??[]),...(g.ruleIds??[]).flatMap(id=>rules.find(r=>r.id===id)?.sourceIds??[])]));
const selectedIds=process.argv.flatMap((arg,index)=>arg==='--source'?[process.argv[index+1]]:[]);
for(const id of selectedIds)if(!sources.some(s=>s.id===id))throw Error('Unknown source ID: '+id);
const toCheck=selectedIds.length?sources.filter(s=>selectedIds.includes(s.id)):process.argv.includes('--all')?sources:sources.filter(s=>citedIds.has(s.id));
let baseline={};try{baseline=JSON.parse(await readFile(join(out,'source-baseline.json'),'utf8'))}catch{}
let existing=[];try{existing=JSON.parse(await readFile(join(out,'editorial-review-queue.json'),'utf8'))}catch{}
const history=existing.filter(r=>r.status==='resolved');
const open=existing.filter(r=>r.status!=='resolved');
const privateIP=address=>{
 if(net.isIPv4(address)){const p=address.split('.').map(Number);return p[0]===0||p[0]===10||p[0]===127||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&p[1]===168||p[0]===100&&p[1]>=64&&p[1]<=127||p[0]>=224||p[0]===192&&p[1]===0;}
 const a=address.toLowerCase();return a==='::'||a==='::1'||a.startsWith('fc')||a.startsWith('fd')||/^fe[89ab]/.test(a)||a.startsWith('::ffff:');
};
async function safeURL(raw){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hostname==='localhost'||u.hostname.endsWith('.local')||!u.hostname.includes('.')||net.isIP(u.hostname.replace(/^\[|\]$/g,'')))throw Error('Only public HTTPS source hosts on port 443 are allowed');const ips=await dns.lookup(u.hostname,{all:true});if(!ips.length||ips.some(x=>privateIP(x.address)))throw Error('Source host resolves to a non-public address');return u;}
async function download(raw,source){let u=await safeURL(raw);for(let i=0;i<6;i++){
 const response=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{'User-Agent':'StatesideSourceReview/1.0 (editorial evidence check; no automatic interpretation)'}});
 if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Redirect has no location');u=await safeURL(new URL(location,u).href);continue;}
 if(!response.ok){const retryAfter=response.headers.get('retry-after');await response.body?.cancel();const error=Error('HTTP '+response.status);if(retryAfter){const seconds=Number(retryAfter);error.retryAfterMs=Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(retryAfter)-Date.now());}throw error;}
 const isPdf=/pdf/i.test(response.headers.get('content-type')??'')||u.pathname.toLowerCase().endsWith('.pdf');const cap=(isPdf?16:4)*1024*1024;const length=Number(response.headers.get('content-length'));if(length>cap){await response.body?.cancel();throw Error('Source exceeds '+(isPdf?16:4)+' MiB evidence cap');}
 const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;if(total>cap){throw Error('Source exceeds '+(isPdf?16:4)+' MiB evidence cap');}chunks.push(chunk)}
 const bytes=Buffer.concat(chunks);const type=response.headers.get('content-type')??'';const textLike=/html|text|json|xml/.test(type);let content=bytes;
 let text='',extraction={normalizationVersion:NORMALIZATION_VERSION,supportingPassagePresent:null,selector:'binary'};if(textLike){extraction=extractSourceText(bytes.toString('utf8'),source.supportingPassage??'');text=extraction.text;content=Buffer.from(text);}
 return {url:u.href,status:response.status,type,bytes:bytes.length,hash:createHash('sha256').update(content).digest('hex'),textExcerpt:text.slice(0,16000),normalizationVersion:extraction.normalizationVersion,supportingPassagePresent:extraction.supportingPassagePresent,selector:extraction.selector};
 }throw Error('Too many source redirects');}
const toolMap={'classification':['relationship-factsheet'],'sales-disclosure':['relationship-factsheet','fdd-comparison','launch-planner'],'corporate-tax':['brand-support-economics','launch-planner'],'immigration':['relationship-factsheet','launch-planner'],'commercial-feasibility':['us-unit-economics','cash-runway','market-comparison'],'premises-opening':['cash-runway','launch-planner'],'employment':['us-unit-economics','launch-planner'],'products-supply':['cash-runway','launch-planner']};
function affected(source){const impact=dependencyImpact(source.id,{guides,rules,tools:toolDefinitions,pages:sitePages});const ruleRecords=rules.filter(r=>impact.ruleIds.includes(r.id));return {...impact,tools:[...new Set([...impact.tools,...ruleRecords.flatMap(r=>toolMap[r.topic]??[]).map(s=>'/tools/'+s+'/')])]};}
const runAt=new Date().toISOString(),results=[];
function enqueue(entry){if(!open.some(x=>x.sourceId===entry.sourceId&&x.reason===entry.reason&&x.observedHash===entry.observedHash)){open.push({...entry,id:createHash('sha256').update(entry.sourceId+entry.reason+(entry.observedHash??runAt)).digest('hex').slice(0,20),status:'needs-review',createdAt:runAt});}}
let index=0;async function worker(){while(index<toCheck.length){const source=toCheck[index++];const fetchedAt=new Date().toISOString();const deps=affected(source);try{let current;for(let attempt=0;attempt<2;attempt++){try{current=await download(source.url,source);break;}catch(error){if(attempt===1||!(/HTTP (408|429|500|502|503|504)|timeout|timed out|aborted|ECONNRESET/i.test(String(error?.message??error)))||(error.retryAfterMs??0)>2000)throw error;await new Promise(resolve=>setTimeout(resolve,Math.max(500,error.retryAfterMs??0)));}}const prior=baseline[source.id];const changed=!!prior&&(prior.normalizationVersion??1)===(current.normalizationVersion??1)&&prior.hash!==current.hash;const result=sourceObservation({source,prior,current,fetchedAt,dependencies:deps});results.push(result);if(changed)enqueue({sourceId:source.id,reason:'source-content-changed',observedHash:current.hash,previousHash:prior.hash,sourceURL:source.url,...deps,instruction:'Compare against the last substantively reviewed source and dependent interpretations. An HTTP/content change is not a legal conclusion. Preserve last reviewed public content until an editorial decision.'});if(current.supportingPassagePresent===false)enqueue({sourceId:source.id,reason:'supporting-passage-not-found',observedHash:current.hash,sourceURL:source.url,...deps,instruction:'The previously recorded excerpt was not located in the fetched text. Inspect layout, source version and applicability before changing any interpretation.'});baseline[source.id]={normalizationVersion:current.normalizationVersion,hash:current.hash,fetchedAt,url:current.url,substantiveVerifiedAt:source.substantiveVerifiedAt??null,previousHash:prior&&((prior.normalizationVersion??1)!==(current.normalizationVersion??1)||changed)?prior.hash:prior?.previousHash??null};await writeFile(join(out,'source-evidence',source.id.replace(/[^a-z0-9_-]/gi,'_')+'.json'),JSON.stringify(result,null,2)+'\n');}catch(e){const error=String(e.message??e).slice(0,300);results.push({sourceId:source.id,fetchedAt,result:'fetch-failed',failureKind:retrievalFailureKind(e),error,...deps});enqueue({sourceId:source.id,reason:'source-fetch-failed',sourceURL:source.url,failureKind:retrievalFailureKind(e),error,...deps,instruction:'Inspect access, redirects and the actual source. Do not treat a failed fetch as no requirement or as repealed law.'});}}}
await Promise.all(Array.from({length:Math.min(4,toCheck.length)},worker));
await writeFile(join(out,'source-baseline.json'),JSON.stringify(baseline,null,2)+'\n');await writeFile(join(out,'editorial-review-queue.json'),JSON.stringify([...history,...open],null,2)+'\n');await writeFile(join(out,'source-check-results.json'),JSON.stringify({runAt,policy:'Fetch/change detection only. Substantive verification dates remain unchanged. No public content is republished.',results},null,2)+'\n');
await writeFile(join(out,'editorial-review-report.md'),reviewMarkdown({runAt,results,queue:open}));
console.log(JSON.stringify({runAt,checked:results.length,baselineEstablished:results.filter(r=>r.result==='baseline-established').length,baselineMigrated:results.filter(r=>r.result==='baseline-migrated').length,changed:results.filter(r=>r.result==='changed').length,unchanged:results.filter(r=>r.result==='unchanged').length,failed:results.filter(r=>r.result==='fetch-failed').length,openReviewItems:open.length,output:out}));
if(process.argv.includes('--fail-on-fetch-error')&&results.some(r=>r.result==='fetch-failed'))process.exitCode=1;

}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 if((process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy)&&process.env.NODE_USE_ENV_PROXY!=='1'){
  // Node fetch must opt in to the inherited managed-cloud proxy/CA settings.
  const code=await new Promise((done,reject)=>{const child=spawn(process.execPath,['--use-env-proxy',...process.argv.slice(1)],{env:{...process.env,NODE_USE_ENV_PROXY:'1'},stdio:'inherit'});child.on('error',reject);child.on('exit',code=>done(code??1));});process.exitCode=Number(code);
 }else await main();
}
