import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {editorialFields,editorialHash,teachingSections,sectionText,countWords} from './smb-edit-utils.mjs';

const directory='research/smb-edit';
const workflow=JSON.parse(await readFile(`${directory}/workflow.json`,'utf8'));
const baseline=JSON.parse(await readFile(`${directory}/input.json`,'utf8'));
const fragments=JSON.parse(await readFile(`${directory}/fragments.json`,'utf8'));
const exceptions=JSON.parse(await readFile(`${directory}/evidence-changes.json`,'utf8').catch(()=>'[]'));
const integrations=JSON.parse(await readFile(`${directory}/source-integrations.json`,'utf8').catch(()=>'[]'));
const questions=JSON.parse(await readFile('research/improvements/manifest.json','utf8')).verificationDependentExpansions;
const sourceOutcomes={};
for(const question of questions){
 const decision=integrations.findLast(i=>i.id===question.id);
 if(!decision||!['source-resolved','scope-resolved','unresolved'].includes(decision.decision))throw Error(`${question.id}: targeted source follow-up is pending`);
 sourceOutcomes[decision.decision]=(sourceOutcomes[decision.decision]||0)+1;
}
const names=await readdir('src/data');
const sha=data=>createHash('sha256').update(data).digest('hex');
const editable=new Set([...editorialFields,'contentModifiedAt','dataset']);
const protectedFields=g=>Object.fromEntries(Object.entries(g).filter(([key])=>!editable.has(key)));
const oldFile=file=>execFileSync('git',['show',`${workflow.baseCommit}:src/data/${file}`],{maxBuffer:20*1024*1024});
const permittedChange=(file,before,after)=>exceptions.some(e=>e.file===file&&e.beforeHash===sha(before)&&e.afterHash===sha(after)&&e.reason?.trim()&&e.decisionFile?.startsWith('research/smb-edit/'));
const all=[];let unpublished=0,evidenceFilesUnchanged=0,evidenceFilesVerified=0;
for(const file of names.filter(f=>f.endsWith('guides.json'))){
 const before=JSON.parse(oldFile(file)),after=JSON.parse(await readFile(`src/data/${file}`,'utf8'));
 if(before.length!==after.length)throw Error(`${file}: inventory changed`);
 for(let i=0;i<before.length;i++){
  const a=before[i],b=after[i];
  if(a.id!==b.id)throw Error(`${file}: article identity changed`);
  if(a.status!=='published'){
   if(!isDeepStrictEqual(a,b))throw Error(`${a.id}: unpublished record changed`);
   unpublished++;continue;
  }
  const expected={...a,sourceIds:[...new Set([...(a.sourceIds||[]),...integrations.filter(i=>i.id===a.id).flatMap(i=>i.sourceIdsAdded||[])])]};
  if(!isDeepStrictEqual(protectedFields(expected),protectedFields(b)))throw Error(`${a.id}: evidence metadata changed without a recorded source decision`);
  all.push(b);
 }
}
for(const file of names.filter(f=>f.endsWith('sources.json')||f.endsWith('rules.json')||['states.json','origins.json','markets.json','case-connections.json'].includes(f))){
 const before=oldFile(file),after=await readFile(`src/data/${file}`);
 if(before.equals(after))evidenceFilesUnchanged++;
 else if(permittedChange(file,before,after))evidenceFilesVerified++;
 else throw Error(`${file}: evidence changed without a recorded source decision`);
}
const current=new Map(all.map(g=>[g.id,g]));
const staticIds=['start-here','words-to-know','sources','choose-jurisdiction','what-to-prepare','guide-limits','official-federal-explanation','detailed-rules','documented-cases','related-preparation'];
let oldBookmarks=0;const metrics=[];
for(const old of baseline){
 const g=current.get(old.id),entry=workflow.articles.find(a=>a.id===old.id);
 if(!g||!entry)throw Error(`${old.id}: missing published article or workflow`);
 const hash=editorialHash(g);
 if(entry.contentHash!==hash||entry.reviewedHash!==hash||entry.review?.decision!=='approved'||!entry.review.notes?.trim())throw Error(`${g.id}: current revision needs an independent review`);
 if(isDeepStrictEqual(teachingSections(g.sections),teachingSections(old.sections))&&g.learningSummary===old.learningSummary)throw Error(`${g.id}: no substantive article edit`);
 const ids=[...staticIds,...g.sections.flatMap(s=>[s.id,...s.aliases||[]])];
 if(new Set(ids).size!==ids.length)throw Error(`${g.id}: duplicate fragment`);
 for(const s of fragments.find(a=>a.id===g.id).sections)for(const id of [s.semanticId,s.legacyId].filter(Boolean)){
  if(!ids.includes(id))throw Error(`${g.id}: lost bookmark ${id}`);oldBookmarks++;
 }
 const visible=[g.learningSummary,sectionText(g),g.practicalOutput,...g.limitations].join(' ');
 if(/Condition to retain|Do not invent|reviewer note|insert (?:source|citation)|TODO|TBD|sourceIds|conditionsRetained|editNote/i.test(visible))throw Error(`${g.id}: public editorial instruction`);
 metrics.push({id:g.id,path:g.path,wordsBefore:countWords([old.learningSummary,sectionText(old),old.practicalOutput,...old.limitations].join(' ')),wordsAfter:countWords(visible),tablesBefore:old.sections.filter(s=>s.table).length,tablesAfter:g.sections.filter(s=>s.table).length,contentHash:hash});
}
if(all.length!==278||baseline.length!==278||workflow.articles.length!==278)throw Error('Published inventory must remain 278 articles');
const payroll=current.get('state-employer-payroll-registration');
const oldPayroll=baseline.find(g=>g.id===payroll.id);
const payrollRows=g=>g.sections.filter(s=>s.table).map(s=>({table:s.table,sourceIds:s.sourceIds,ruleIds:s.ruleIds}));
if(!isDeepStrictEqual(payrollRows(payroll),payrollRows(oldPayroll))||payrollRows(payroll).length!==51)throw Error('Payroll reference tables or source/rule links changed');
const result={verifiedAt:new Date().toISOString(),baseCommit:workflow.baseCommit,articlesEditedAndReviewed:all.length,targetedSourceQuestionsChecked:questions.length,sourceOutcomes,unpublishedRecordsPreserved:unpublished,oldBookmarksPreserved:oldBookmarks,evidenceFilesUnchanged,evidenceFilesVerified,payrollJurisdictions:51,payrollAccountRows:payroll.sections.reduce((n,s)=>n+(s.table?.rows.length||0),0),sourceDatesAutomaticallyRefreshed:false,metrics};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/smb-integrity.json',JSON.stringify(result,null,2)+'\n');
if(process.argv.includes('--advance')){
 for(const article of workflow.articles){article.state='validated';article.validatedHash=article.contentHash;article.validatedAt=result.verifiedAt;}
 await writeFile(`${directory}/workflow.json`,JSON.stringify(workflow,null,2)+'\n');
}
console.log(JSON.stringify({...result,metrics:undefined}));
