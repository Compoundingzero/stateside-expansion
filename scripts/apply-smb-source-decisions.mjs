import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {editorialFields} from './smb-edit-utils.mjs';
const directory='research/smb-edit';
const [family,...args]=process.argv.slice(2),apply=args.includes('--apply');
if(!family)throw Error('Use <family> [--apply] [--only <article-id>]');
const only=args.includes('--only')?args[args.indexOf('--only')+1]:null;
const decisionFile=`${directory}/${family}-source-decisions.json`;
const decisions=JSON.parse(await readFile(`${directory}/${family}-source-decisions.normalized.json`,'utf8').catch(()=>readFile(decisionFile,'utf8')));
const patchFile=`${directory}/${family}-patches.json`,patches=JSON.parse(await readFile(patchFile,'utf8'));
const workflow=JSON.parse(await readFile(`${directory}/workflow.json`,'utf8'));
const exceptions=JSON.parse(await readFile(`${directory}/evidence-changes.json`,'utf8').catch(()=>'[]'));
const integrations=JSON.parse(await readFile(`${directory}/source-integrations.json`,'utf8').catch(()=>'[]'));
const sha=data=>createHash('sha256').update(data).digest('hex');
const sourceFiles=(await readdir('src/data')).filter(f=>f.endsWith('sources.json')||f.endsWith('rules.json'));
const datasets=new Map(await Promise.all(sourceFiles.map(async f=>[f,JSON.parse(await readFile(`src/data/${f}`,'utf8'))])));
const guideFiles=(await readdir('src/data')).filter(f=>f.endsWith('guides.json'));
const guideData=new Map(await Promise.all(guideFiles.map(async f=>[f,JSON.parse(await readFile(`src/data/${f}`,'utf8'))])));
const changedGuides=new Set();
const changed=new Set(),done=[];
for(const decision of decisions){
 if(only&&decision.id!==only)continue;
 const fingerprint=sha(JSON.stringify(decision));
 if(integrations.some(i=>i.id===decision.id&&i.fingerprint===fingerprint))continue;
 if(!['source-resolved','scope-resolved','unresolved'].includes(decision.decision)||!decision.conclusion?.trim()||!decision.evidence?.length)throw Error(`${decision.id}: incomplete source decision`);
 for(const evidence of decision.evidence){
  if(!evidence.url?.startsWith('https://')||!evidence.retrievedAt||!(evidence.snippet||evidence.reviewedScope||evidence.accessObservation))throw Error(`${decision.id}: missing retrieval and substantive observation`);
  if(evidence.rawPath&&evidence.sha256&&sha(await readFile(evidence.rawPath))!==evidence.sha256)throw Error(`${decision.id}: evidence hash mismatch`);
 }
 const patch=patches.find(p=>p.id===decision.id);
 if(!patch)throw Error(`${decision.id}: article is outside ${family}`);
 if(decision.proposedPublicPatch){
  const proposed=decision.proposedPublicPatch;
  if(proposed.id!==patch.id||proposed.path!==patch.path)throw Error(`${patch.id}: source patch identity mismatch`);
  for(const key of Object.keys(proposed))if(!['id','path',...editorialFields].includes(key))throw Error(`${patch.id}: source decision attempted non-editorial field ${key}`);
  Object.assign(patch,proposed);
  patch.editNote+=` Source follow-up: ${decision.conclusion}`;
  patch.conditionsRetained.push(`Source follow-up scope: ${(decision.remainingLimits||[]).join(' ')||decision.conclusion}`);
 }
 const sourceIdsAdded=[];
 for(const addition of decision.proposedNewSources||[]){
  const {file,source}=addition;
  if(!file.endsWith('sources.json')||!datasets.has(file)||!source.id||!source.url||!source.title||!source.authority||!source.type)throw Error(`${decision.id}: incomplete new source record`);
  if(!decision.evidence.some(e=>e.url===source.url&&e.sha256===source.sha256&&e.retrievedAt===source.fetchedAt))throw Error(`${source.id}: new source is not bound to retrieved evidence`);
  const existing=[...datasets].filter(([file])=>file.endsWith('sources.json')).flatMap(([,records])=>records).find(s=>s.id===source.id);
  if(existing){if(existing.url!==source.url)throw Error(`${source.id}: conflicting existing source`);}
  else {datasets.get(file).push(source);changed.add(file);}
  sourceIdsAdded.push(source.id);
 }
 if(sourceIdsAdded.length){
  const [file,records]=[...guideData].find(([,records])=>records.some(g=>g.id===decision.id));
  const guide=records.find(g=>g.id===decision.id);
  guide.sourceIds=[...new Set([...guide.sourceIds,...sourceIdsAdded])];changedGuides.add(file);
 }
 for(const update of decision.proposedSourceUpdates||[]){
  const match=[...datasets].find(([file,records])=>file.endsWith('sources.json')&&records.some(s=>s.id===update.id));
  if(!match)throw Error(`${decision.id}: unknown source ${update.id}`);
  const [file,records]=match,source=records.find(s=>s.id===update.id);
  const fields=update.fields||{};
  if(Object.keys(fields).some(k=>['id','type','authority'].includes(k)))throw Error(`${update.id}: source identity cannot change in this workflow`);
  if(fields.url&&!decision.evidence.some(e=>e.url===fields.url))throw Error(`${update.id}: changed URL has no retrieved evidence`);
  if(fields.sha256&&!decision.evidence.some(e=>e.sha256===fields.sha256))throw Error(`${update.id}: source hash has no matching retrieved evidence`);
  Object.assign(source,fields);changed.add(file);
 }
 for(const update of decision.proposedRuleUpdates||[]){
  const match=[...datasets].find(([file,records])=>file.endsWith('rules.json')&&records.some(r=>r.id===update.id));
  if(!match||Object.keys(update.fields||{}).some(k=>['id','jurisdiction','affectedParty','dependentPaths','verifiedAt','status'].includes(k)))throw Error(`${update.id}: invalid scoped rule clarification`);
  const [file,records]=match;Object.assign(records.find(r=>r.id===update.id),update.fields);changed.add(file);
 }
 done.push({id:decision.id,decision:decision.decision,conclusion:decision.conclusion,remainingLimits:decision.remainingLimits||[],fingerprint,decisionFile,sourceIdsAdded,integratedAt:new Date().toISOString()});
}
if(only&&!decisions.some(d=>d.id===only))throw Error('Requested source decision was not found');
if(apply){
 await writeFile(patchFile,JSON.stringify(patches,null,2)+'\n');
 for(const file of changedGuides)await writeFile(`src/data/${file}`,JSON.stringify(guideData.get(file),null,2)+'\n');
 for(const file of changed){
  const before=execFileSync('git',['show',`${workflow.baseCommit}:src/data/${file}`],{maxBuffer:20*1024*1024});
  const after=JSON.stringify(datasets.get(file),null,2)+'\n';
  await writeFile(`src/data/${file}`,after);
  const entry={file,beforeHash:sha(before),afterHash:sha(after),reason:'Targeted official-source follow-up; exact record and scope changes are recorded in the linked decisions.',decisionFile};
  const index=exceptions.findIndex(e=>e.file===file);if(index<0)exceptions.push(entry);else exceptions[index]=entry;
 }
 integrations.push(...done);
 await writeFile(`${directory}/source-integrations.json`,JSON.stringify(integrations,null,2)+'\n');
 await writeFile(`${directory}/evidence-changes.json`,JSON.stringify(exceptions,null,2)+'\n');
}
console.log(JSON.stringify({mode:apply?'applied':'checked',decisions:done.length,sourceFiles:changed.size,articles:done.map(d=>d.id)}));
