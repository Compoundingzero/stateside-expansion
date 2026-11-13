import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('research/readability/manifest.json','utf8'));
const editorial=new Set(['title','description','sections','practicalOutput','limitations','readMinutes','learningSummary','keyTerms','contentModifiedAt']);
const immutable=g=>Object.fromEntries(Object.entries(g).filter(([k])=>!editorial.has(k)));
const data=await readdir('src/data');let modified=0,unpublishedPreserved=0,published=0;
const rows=[];
for(const file of data.filter(f=>f.endsWith('guides.json'))){
 const old=JSON.parse(execFileSync('git',['show',`${manifest.baseCommit}:src/data/${file}`],{encoding:'utf8',maxBuffer:12*1024*1024}));
 const current=JSON.parse(await readFile(`src/data/${file}`,'utf8'));
 if(old.length!==current.length)throw Error(file+': guide inventory changed');
 for(let i=0;i<old.length;i++){
  const a=old[i],b=current[i];
  if(a.id!==b.id||!isDeepStrictEqual(immutable(a),immutable(b)))throw Error(a.id+': source, publication or other immutable metadata changed');
  if(a.status!=='published'){if(!isDeepStrictEqual(a,b))throw Error(a.id+': unpublished record changed');unpublishedPreserved++;continue;}
  published++;
  if(!b.learningSummary?.trim()||!b.keyTerms?.length)throw Error(a.id+': missing teaching introduction/definitions');
  if(isDeepStrictEqual(a.sections,b.sections))throw Error(a.id+': article body was not rewritten');
  modified++;
  rows.push({id:b.id,path:b.path,dataset:file,keyTerms:b.keyTerms.length,sections:b.sections.length,sourceDatesPreserved:a.lastReviewed===b.lastReviewed,sourceIdsPreserved:isDeepStrictEqual(a.sourceIds,b.sourceIds),ruleIdsPreserved:isDeepStrictEqual(a.ruleIds,b.ruleIds),statusPreserved:a.status===b.status});
 }
}
const protectedData=data.filter(f=>f.endsWith('sources.json')||f.endsWith('rules.json')||['states.json','origins.json','markets.json','case-connections.json'].includes(f));
for(const file of protectedData){const before=execFileSync('git',['show',`${manifest.baseCommit}:src/data/${file}`],{maxBuffer:12*1024*1024});const after=await readFile(`src/data/${file}`);if(!before.equals(after))throw Error(file+': source/rule/jurisdiction evidence changed');}
if(modified!==278||published!==278)throw Error('Expected all 278 published articles to be rewritten');
const comparisons=(await Promise.all(data.filter(f=>f.endsWith('guides.json')).map(async f=>JSON.parse(await readFile(`src/data/${f}`,'utf8'))))).flat();
const payroll=comparisons.find(g=>g.id==='state-employer-payroll-registration');
if(payroll.sections.filter(s=>s.table).length!==51||payroll.sections.reduce((n,s)=>n+(s.table?.rows.length??0),0)!==102)throw Error('51-jurisdiction payroll table was abridged');
const result={verifiedAt:new Date().toISOString(),baseCommit:manifest.baseCommit,publishedArticlesRewritten:modified,unpublishedRecordsPreserved:unpublishedPreserved,sourceRuleJurisdictionFilesByteIdentical:protectedData.length,sourceEvidenceAutomaticallyReverified:false,payrollReference:{jurisdictions:51,accountRows:102},rows};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/readability-integrity.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,rows:undefined}));
