import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
export function dependencyImpact(sourceId,{guides=[],rules=[],tools=[]}={}) {
 const directRules=rules.filter(r=>r.sourceIds?.includes(sourceId));
 const ruleIds=new Set(directRules.map(r=>r.id));
 const guidePaths=guides.filter(g=>g.sourceIds?.includes(sourceId)||g.ruleIds?.some(id=>ruleIds.has(id))).map(g=>g.path);
 const toolPaths=tools.filter(t=>t.sourceIds?.includes(sourceId)||t.ruleIds?.some(id=>ruleIds.has(id))).map(t=>t.path);
 const explicitPaths=directRules.flatMap(r=>r.dependentPaths??[]);
 return {ruleIds:[...ruleIds],paths:[...new Set([...guidePaths,...toolPaths,...explicitPaths])],tools:[...new Set([...toolPaths,...explicitPaths.filter(p=>p.startsWith('/tools/'))])]};
}
export function sourceObservation({source,prior,current,fetchedAt,dependencies}) {
 return {sourceId:source.id,fetchedAt,substantiveVerifiedAt:source.substantiveVerifiedAt??null,result:prior?(prior.hash!==current.hash?'changed':'unchanged'):'baseline-established',...current,...dependencies};
}
async function main(){
const out=resolve(process.env.SOURCE_REVIEW_DIRECTORY||'artifacts');await mkdir(join(out,'source-evidence'),{recursive:true});
const datasets={};for(const f of (await readdir('src/data')).filter(f=>f.endsWith('.json')))datasets[f]=JSON.parse(await readFile(join('src/data',f),'utf8'));
const records=suffix=>Object.entries(datasets).filter(([f])=>f.endsWith(suffix)).flatMap(([,v])=>v);
const guides=records('guides.json'),rules=records('rules.json'),sources=records('sources.json');
const published=guides.filter(g=>g.status==='published');
const toolDefinitions=datasets['tool-definitions.json']??[];
const citedIds=new Set([...published,...toolDefinitions].flatMap(g=>[...(g.sourceIds??[]),...(g.ruleIds??[]).flatMap(id=>rules.find(r=>r.id===id)?.sourceIds??[])]));
const toCheck=process.argv.includes('--all')?sources:sources.filter(s=>citedIds.has(s.id));
let baseline={};try{baseline=JSON.parse(await readFile(join(out,'source-baseline.json'),'utf8'))}catch{}
let existing=[];try{existing=JSON.parse(await readFile(join(out,'editorial-review-queue.json'),'utf8'))}catch{}
const open=existing.filter(r=>r.status!=='resolved');
const privateIP=address=>{
 if(net.isIPv4(address)){const p=address.split('.').map(Number);return p[0]===0||p[0]===10||p[0]===127||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&p[1]===168||p[0]===100&&p[1]>=64&&p[1]<=127||p[0]>=224||p[0]===192&&p[1]===0;}
 const a=address.toLowerCase();return a==='::'||a==='::1'||a.startsWith('fc')||a.startsWith('fd')||/^fe[89ab]/.test(a)||a.startsWith('::ffff:');
};
async function safeURL(raw){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hostname==='localhost'||u.hostname.endsWith('.local')||!u.hostname.includes('.')||net.isIP(u.hostname.replace(/^\[|\]$/g,'')))throw Error('Only public HTTPS source hosts on port 443 are allowed');const ips=await dns.lookup(u.hostname,{all:true});if(!ips.length||ips.some(x=>privateIP(x.address)))throw Error('Source host resolves to a non-public address');return u;}
async function download(raw){let u=await safeURL(raw);for(let i=0;i<6;i++){
 const response=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{'User-Agent':'StatesideSourceReview/1.0 (editorial evidence check; no automatic interpretation)'}});
 if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Redirect has no location');u=await safeURL(new URL(location,u).href);continue;}
 if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}
 const cap=4*1024*1024;const length=Number(response.headers.get('content-length'));if(length>cap){await response.body?.cancel();throw Error('Source exceeds 4 MiB evidence cap');}
 const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;if(total>cap){throw Error('Source exceeds 4 MiB evidence cap');}chunks.push(chunk)}
 const bytes=Buffer.concat(chunks);const type=response.headers.get('content-type')??'';const textLike=/html|text|json|xml/.test(type);let content=bytes;
 let text='';if(textLike){text=bytes.toString('utf8');const main=text.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];if(main)text=main;text=text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();content=Buffer.from(text);if(text.length<100)throw Error('Insufficient readable source content');if(/^(access denied|just a moment|request blocked|page not found)/i.test(text))throw Error('Source returned access/error interstitial');}
 return {url:u.href,status:response.status,type,bytes:bytes.length,hash:createHash('sha256').update(content).digest('hex'),textExcerpt:text.slice(0,16000)};
 }throw Error('Too many source redirects');}
const toolMap={'classification':['relationship-factsheet'],'sales-disclosure':['relationship-factsheet','fdd-comparison','launch-planner'],'corporate-tax':['brand-support-economics','launch-planner'],'immigration':['relationship-factsheet','launch-planner'],'commercial-feasibility':['us-unit-economics','cash-runway','market-comparison'],'premises-opening':['cash-runway','launch-planner'],'employment':['us-unit-economics','launch-planner'],'products-supply':['cash-runway','launch-planner']};
function affected(source){const impact=dependencyImpact(source.id,{guides,rules,tools:toolDefinitions});const ruleRecords=rules.filter(r=>impact.ruleIds.includes(r.id));return {...impact,tools:[...new Set([...impact.tools,...ruleRecords.flatMap(r=>toolMap[r.topic]??[]).map(s=>'/tools/'+s+'/')])]};}
const runAt=new Date().toISOString(),results=[];
function enqueue(entry){if(!open.some(x=>x.sourceId===entry.sourceId&&x.reason===entry.reason&&x.observedHash===entry.observedHash)){open.push({...entry,id:createHash('sha256').update(entry.sourceId+entry.reason+(entry.observedHash??runAt)).digest('hex').slice(0,20),status:'needs-review',createdAt:runAt});}}
let index=0;async function worker(){while(index<toCheck.length){const source=toCheck[index++];const fetchedAt=new Date().toISOString();const deps=affected(source);try{const current=await download(source.url);const prior=baseline[source.id];const changed=!!prior&&prior.hash!==current.hash;const result=sourceObservation({source,prior,current,fetchedAt,dependencies:deps});results.push(result);if(changed)enqueue({sourceId:source.id,reason:'source-content-changed',observedHash:current.hash,previousHash:prior.hash,sourceURL:source.url,...deps,instruction:'Compare against the last substantively reviewed source and dependent interpretations. An HTTP/content change is not a legal conclusion. Preserve last reviewed public content until an editorial decision.'});baseline[source.id]={hash:current.hash,fetchedAt,url:current.url,substantiveVerifiedAt:source.substantiveVerifiedAt??null,previousHash:changed?prior.hash:prior?.previousHash??null};await writeFile(join(out,'source-evidence',source.id.replace(/[^a-z0-9_-]/gi,'_')+'.json'),JSON.stringify(result,null,2)+'\n');}catch(e){const error=String(e.message??e).slice(0,300);results.push({sourceId:source.id,fetchedAt,result:'fetch-failed',error,...deps});enqueue({sourceId:source.id,reason:'source-fetch-failed',sourceURL:source.url,error,...deps,instruction:'Inspect access, redirects and the actual source. Do not treat a failed fetch as no requirement or as repealed law.'});}}}
await Promise.all(Array.from({length:Math.min(4,toCheck.length)},worker));
await writeFile(join(out,'source-baseline.json'),JSON.stringify(baseline,null,2)+'\n');await writeFile(join(out,'editorial-review-queue.json'),JSON.stringify(open,null,2)+'\n');await writeFile(join(out,'source-check-results.json'),JSON.stringify({runAt,policy:'Fetch/change detection only. Substantive verification dates remain unchanged. No public content is republished.',results},null,2)+'\n');
console.log(JSON.stringify({runAt,checked:results.length,baselineEstablished:results.filter(r=>r.result==='baseline-established').length,changed:results.filter(r=>r.result==='changed').length,unchanged:results.filter(r=>r.result==='unchanged').length,failed:results.filter(r=>r.result==='fetch-failed').length,openReviewItems:open.length,output:out}));
if(process.argv.includes('--fail-on-fetch-error')&&results.some(r=>r.result==='fetch-failed'))process.exitCode=1;

}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 if((process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy)&&process.env.NODE_USE_ENV_PROXY!=='1'){
  // Node fetch must opt in to the inherited managed-cloud proxy/CA settings.
  const code=await new Promise((done,reject)=>{const child=spawn(process.execPath,['--use-env-proxy',...process.argv.slice(1)],{env:{...process.env,NODE_USE_ENV_PROXY:'1'},stdio:'inherit'});child.on('error',reject);child.on('exit',code=>done(code??1));});process.exitCode=Number(code);
 }else await main();
}
