import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {editorialHash} from './smb-edit-utils.mjs';
import {semanticSectionIds} from '../src/lib/article-presentation.ts';

const root='research/next-release';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const write=async(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const workflow=await read(`${root}/workflow.json`);
const baseline=await read(`${root}/baseline-guides.json`);
if(workflow.publicationBaselineFile&&!/^research\/[a-z0-9/_-]+\.json$/.test(workflow.publicationBaselineFile))throw Error('Invalid publication baseline path');
const publicationBaseline=workflow.publicationBaselineFile?await read(workflow.publicationBaselineFile):null;
if(publicationBaseline&&(!Number.isFinite(Date.parse(publicationBaseline.createdAt))||!Array.isArray(publicationBaseline.articles)||!publicationBaseline.articles.length||publicationBaseline.articles.some(g=>!g.id||!g.path||!/^\/[a-z0-9/-]+\/$/.test(g.path)||!/^[a-f0-9]{64}$/.test(g.contentHash)||!Array.isArray(g.anchors)||g.anchors.some(a=>typeof a!=='string'||!a))||new Set(publicationBaseline.articles.map(g=>g.id)).size!==publicationBaseline.articles.length||new Set(publicationBaseline.articles.map(g=>g.path)).size!==publicationBaseline.articles.length))throw Error('Invalid publication baseline snapshot');
const baselineRecordIds=await read(`${root}/baseline-record-ids.json`);
const protectedRecordIds=kind=>new Set([...(baselineRecordIds[kind]||[]),...(publicationBaseline?.recordIds?.[kind]||[])]);
const files=(await readdir('src/data')).filter(f=>f.endsWith('.json'));
const data=new Map(await Promise.all(files.map(async file=>[file,await read('src/data/'+file)])));
const rows=kind=>[...data].filter(([file])=>file.endsWith(kind+'.json')).flatMap(([,records])=>records);
const find=(kind,id)=>[...data].find(([file,records])=>file.endsWith(kind+'.json')&&Array.isArray(records)&&records.some(r=>r.id===id));
const [action='status',file,...args]=process.argv.slice(2);
const changed=new Set();
const filename=(name,kind)=>{const clean=name.replace(/^src\/data\//,'');if(!/^[a-z0-9-]+\.json$/.test(clean)||!clean.endsWith(kind+'.json'))throw Error('Invalid data destination '+name);return clean;};
const editorialKeys=new Set(['id','path','title','seoTitle','description','learningSummary','keyTerms','sections','practicalOutput','limitations','relatedPaths','learningPath','readMinutes','contentModifiedAt','family','topic','jurisdictions','status','lastReviewed','reviewStatus','sourceIds','ruleIds','nextStage','scenarioType','label']);
const allowedOutcomes=new Set(['verified','partially-verified','actual-business-facts-required','authoritative-ambiguity','access-unresolved']);
const current=()=>rows('guides').filter(g=>g.status==='published');
const refreshTasks=()=>{
 const latest=new Map((workflow.integrations||[]).map(i=>[i.id,i]));
 workflow.residualResearch=[...latest.values()].filter(i=>i.unresolved?.length).map(({id,path,outcome,decisionFile,unresolved})=>({id,path,outcome,decisionFile,unresolved}));
 for(const task of workflow.tasks||[]){
  if(!task.items?.length||task.items.some(i=>typeof i!=='object'))continue;
  task.items=task.items.map(item=>{const d=latest.get(item.id),article=workflow.articles.find(a=>a.id===item.id);return d?{...item,state:article?.state||'integrated',outcome:d.outcome,conclusion:d.conclusion,unresolved:d.unresolved,decisionFile:d.decisionFile}:item;});
  const states=task.items.map(i=>i.state),limits=task.items.some(i=>i.outcome&&i.outcome!=='verified');
  task.state=states.every(s=>s==='live-verified')?(limits?'released-with-limits':'released'):states.every(s=>s==='validated')?(limits?'validated-with-limits':'validated'):states.every(s=>['independently-reviewed','validated','live-verified'].includes(s))?(limits?'reviewed-with-limits':'reviewed'):task.items.every(i=>latest.has(i.id))?'integrated':'researching';
 }
};
const sync=()=>{
 const previous=new Map((workflow.articles||[]).map(a=>[a.id,a]));
 workflow.articles=current().map(g=>{
  const entry=previous.get(g.id)||{id:g.id,path:g.path,state:'drafted'};const hash=editorialHash(g);
  const integration=[...(workflow.integrations||[])].reverse().find(i=>i.id===g.id);
  if(entry.contentHash!==hash||(integration&&entry.integrationFingerprint!==integration.fingerprint)){entry.state='drafted';delete entry.reviewedHash;delete entry.review;delete entry.validatedHash;delete entry.liveVerifiedHash;}
  return {...entry,path:g.path,contentHash:hash,...(integration?{integrationFingerprint:integration.fingerprint}:{})};
 });
 refreshTasks();
};

if(action==='apply'){
 const decisions=await read(file),writeMode=args.includes('--write');
 if(!Array.isArray(decisions))throw Error('Expected decision array');
 workflow.integrations||=[];
 for(const decision of decisions){
  const fingerprint=sha(decision);
  if(!args.includes('--refresh')&&workflow.integrations.some(i=>i.id===decision.id&&i.fingerprint===fingerprint))continue;
  if(!decision.id||!decision.path||!allowedOutcomes.has(decision.outcome)||!decision.conclusion||!decision.evidence?.length)throw Error(`${decision.id}: incomplete factual decision`);
  for(const evidence of decision.evidence){
   if(!evidence.url?.startsWith('https://')||!evidence.retrievedAt||!evidence.readScope||!(evidence.quote||evidence.locator))throw Error(`${decision.id}: missing precise retrieval/read evidence`);
   if(evidence.rawPath&&evidence.sha256&&sha(await readFile(evidence.rawPath))!==evidence.sha256)throw Error(`${decision.id}: retained evidence hash mismatch`);
  }
  for(const[kind,additions,updates]of [['sources',decision.newSources||[],decision.sourceUpdates||[]],['rules',decision.newRules||[],decision.ruleUpdates||[]]]){
   for(const addition of additions){
    const target=filename(addition.file,kind),record=addition.record;
    if(!record?.id||!record.title)throw Error(`${decision.id}: incomplete ${kind} record`);
    const existing=find(kind,record.id);
    if(existing){
     const prior=existing[1].find(r=>r.id===record.id);
     if(sha(prior)!==sha(record)){
      const identities=kind==='sources'?['url','type','authority']:['jurisdiction','topic','sourceIds'];
      if(!args.includes('--refresh')||protectedRecordIds(kind).has(record.id)||existing[0]!==target||identities.some(key=>sha(prior[key]??null)!==sha(record[key]??null)))throw Error(`${record.id}: duplicate addition differs from existing record`);
      Object.assign(prior,record);changed.add(existing[0]);
     }
     continue;
    }
    if(kind==='sources'&&(!record.url?.startsWith('https://')||!record.authority||!record.type||!record.substantiveVerifiedAt))throw Error(`${record.id}: new source needs actual substantive review`);
    if(!data.has(target))data.set(target,[]);data.get(target).push(record);changed.add(target);
   }
   for(const update of updates){
    const match=find(kind,update.id);if(!match||!update.fields||'id'in update.fields)throw Error(`${decision.id}: invalid ${kind} update ${update.id}`);
    Object.assign(match[1].find(r=>r.id===update.id),update.fields);changed.add(match[0]);
   }
  }
  if(decision.guidePatch){
   const patch={id:decision.id,path:decision.path,...decision.guidePatch};
   if(patch.id!==decision.id||patch.path!==decision.path||Object.keys(patch).some(k=>!editorialKeys.has(k)))throw Error(`${decision.id}: invalid guide patch fields/identity`);
   const match=find('guides',decision.id),old=match?.[1].find(g=>g.id===decision.id);
   if(old?.status==='published'&&(patch.path!==old.path||('status'in patch&&patch.status!=='published')))throw Error(`${decision.id}: existing public content cannot be removed`);
   if(!old&&rows('guides').some(g=>g.path===patch.path))throw Error(`${decision.id}: duplicate route`);
   const next={...old,...patch};
   const preservePublicEvidence=old?.status==='published';
   next.sourceIds=[...new Set([...(preservePublicEvidence?old?.sourceIds||[]:[]),...(patch.sourceIds||[])])];next.ruleIds=[...new Set([...(preservePublicEvidence?old?.ruleIds||[]:[]),...(patch.ruleIds||[])])];
   if(old?.sections?.length&&patch.sections){
    const prior=semanticSectionIds(old.sections);const used=new Set(next.sections.flatMap(s=>[s.id,...s.aliases||[]]));
    for(const section of next.sections)section.aliases=[...(section.aliases||[])];
    if(!next.sections.length)throw Error(`${decision.id}: replacement needs a home for existing bookmarks`);
    for(const entry of prior){
     const anchors=[entry.id,...entry.aliases],target=next.sections.find(s=>anchors.includes(s.id)||s.aliases.some(a=>anchors.includes(a)))||next.sections.find(s=>(s.sourceIds||[]).some(id=>entry.section.sourceIds?.includes(id)))||next.sections[0];
     for(const anchor of anchors)if(!used.has(anchor)){target.aliases.push(anchor);used.add(anchor);}
    }
   }
   for(const key of ['title','description','learningSummary','reviewStatus','family','topic','practicalOutput','lastReviewed'])if(typeof next[key]!=='string'||!next[key].trim())throw Error(`${decision.id}: missing guide ${key}`);
   if(!next.sourceIds.length||!Array.isArray(next.sections)||!next.limitations?.length)throw Error(`${decision.id}: incomplete sourced explanation`);
   for(const id of new Set([...next.sourceIds,...next.sections.flatMap(s=>s.sourceIds||[])]))if(!find('sources',id))throw Error(`${decision.id}: unknown source ${id}`);
   for(const id of next.ruleIds)if(!find('rules',id))throw Error(`${decision.id}: unknown rule ${id}`);
   if(!old||editorialHash(old)!==editorialHash(next))next.contentModifiedAt=new Date().toISOString();
   if(match){Object.assign(old,next);changed.add(match[0]);}else{const target='next-release-guides.json';if(!data.has(target))data.set(target,[]);data.get(target).push(next);changed.add(target);}
  }
  workflow.integrations.push({id:decision.id,path:decision.path,outcome:decision.outcome,fingerprint,decisionFile:file,conclusion:decision.conclusion,unresolved:decision.unresolved||[],integratedAt:new Date().toISOString()});
 }
 sync();
 if(writeMode){for(const name of changed)await write('src/data/'+name,data.get(name));await write(`${root}/workflow.json`,workflow);}
 console.log(JSON.stringify({mode:writeMode?'applied':'checked',changedFiles:[...changed],published:current().length}));
}else if(action==='review'){
 sync();for(const review of await read(file)){
  const entry=workflow.articles.find(a=>a.id===review.id);
  if(!entry||entry.contentHash!==review.reviewedHash||!review.notes?.trim()||!review.reviewer?.trim()||!['approved','revise'].includes(review.decision))throw Error(`${review.id}: incomplete or stale review`);
  if(entry.integrationFingerprint&&review.decisionFingerprint!==entry.integrationFingerprint)throw Error(`${review.id}: research review does not match current decision`);
  Object.assign(entry,{review,reviewedHash:review.reviewedHash,state:review.decision==='approved'?'independently-reviewed':'revision-needed'});
 }
 refreshTasks();await write(`${root}/workflow.json`,workflow);
}else if(action==='validate'){
 sync();const published=current();
 for(const old of publicationBaseline?.articles||[]){
  const g=published.find(g=>g.id===old.id);
  if(!g||g.path!==old.path)throw Error(`${old.id}: protected public article lost`);
  const ids=new Set(semanticSectionIds(g.sections).flatMap(s=>[s.id,...s.aliases]));
  for(const id of old.anchors)if(!ids.has(id))throw Error(`${g.id}: protected public bookmark lost ${id}`);
  for(const kind of ['sourceIds','ruleIds'])for(const id of old[kind]||[])if(!g[kind]?.includes(id))throw Error(`${g.id}: protected public reference lost ${id}`);
  if(editorialHash(g)!==old.contentHash&&!workflow.integrations.some(i=>i.id===g.id&&Date.parse(i.integratedAt)>=Date.parse(publicationBaseline.createdAt)))throw Error(`${g.id}: unrecorded change since publication baseline`);
 }
 for(const old of baseline.filter(g=>g.status==='published')){
  const g=published.find(g=>g.id===old.id);if(!g||g.path!==old.path)throw Error(`${old.id}: original public article lost`);
  const ids=new Set(semanticSectionIds(g.sections).flatMap(s=>[s.id,...s.aliases]));for(const id of semanticSectionIds(old.sections).flatMap(s=>[s.id,...s.aliases]))if(!ids.has(id))throw Error(`${g.id}: lost bookmark ${id}`);
  if(editorialHash(g)!==editorialHash(old)&&!workflow.integrations.some(i=>i.id===g.id))throw Error(`${g.id}: unrecorded editorial change`);
 }
 for(const entry of workflow.articles)if(entry.reviewedHash!==entry.contentHash||entry.review?.decision!=='approved'||(entry.integrationFingerprint&&entry.review?.decisionFingerprint!==entry.integrationFingerprint))throw Error(`${entry.id}: current independent review pending`);
 execFileSync(process.execPath,['scripts/validate-data.mjs'],{stdio:'inherit'});
 for(const entry of workflow.articles)Object.assign(entry,{state:'validated',validatedHash:entry.contentHash,validatedAt:new Date().toISOString()});
 workflow.expectedArticleCount=published.length;refreshTasks();
 const input=published.map(g=>({...g,dataset:find('guides',g.id)[0]}));
 const fragments=published.map(g=>({id:g.id,path:g.path,sections:semanticSectionIds(g.sections).flatMap(s=>[{semanticId:s.id},...s.aliases.map(semanticId=>({semanticId}))])}));
 await write(`${root}/input.json`,input);await write(`${root}/fragments.json`,fragments);await write(`${root}/workflow.json`,workflow);
}else if(action==='checkpoint'){sync();await write(`${root}/workflow.json`,workflow);
}else if(action!=='status')throw Error('Use status, apply <decisions.json> [--write], review <reviews.json>, validate, or checkpoint');

if(['status','review','validate','checkpoint'].includes(action)){
 sync();const stages={};for(const a of workflow.articles)stages[a.state]=(stages[a.state]||0)+1;
 console.log(JSON.stringify({published:current().length,stages,researchDecisions:new Set((workflow.integrations||[]).map(i=>i.id)).size,researchDecisionsWithSourceOrInterpretationLimits:(workflow.residualResearch||[]).filter(i=>['partially-verified','authoritative-ambiguity','access-unresolved'].includes(i.outcome)).length,actualBusinessFactQuestions:(workflow.residualResearch||[]).filter(i=>i.outcome==='actual-business-facts-required').length,tasks:workflow.tasks.map(t=>({id:t.id,state:t.state})),next:workflow.articles.filter(a=>!['validated','live-verified'].includes(a.state)).filter(a=>a.state!=='independently-reviewed').map(a=>({id:a.id,state:a.state})).slice(0,12)}));
}
