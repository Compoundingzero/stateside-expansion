import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const args=process.argv.slice(2),command=args[0];const dir=resolve('artifacts/editorial');await mkdir(dir,{recursive:true});
const read=async p=>JSON.parse(await readFile(p,'utf8'));const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const flag=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined};
function datasetPath(name){if(name!==basename(name)||!name.endsWith('.json'))throw Error('Dataset must be a JSON filename inside src/data');return resolve('src/data',name);}
async function loadAll(){let all=[];for(const f of (await readdir('src/data')).filter(f=>f.endsWith('.json')))all.push(...await read(datasetPath(f)));return all;}
try{
 if(command==='resolve-source'){
  const issueId=args[1],reviewer=flag('--reviewer'),date=flag('--date'),evidence=flag('--evidence'),decision=flag('--decision');
  const allowed=['retrieval-confirmed','no-material-change','interpretation-updated','not-a-source-change'];
  if(!issueId||!reviewer||!/^\d{4}-\d{2}-\d{2}$/.test(date??'')||!evidence?.trim()||!allowed.includes(decision)||!args.includes('--review-complete'))throw Error('Resolve requires ISSUE_ID --reviewer ID --date YYYY-MM-DD --evidence REFERENCE --decision retrieval-confirmed|no-material-change|interpretation-updated|not-a-source-change --review-complete');
  const queuePath=resolve(process.env.SOURCE_REVIEW_DIRECTORY||'artifacts','editorial-review-queue.json');const queue=await read(queuePath);const item=queue.find(r=>r.id===issueId&&r.status!=='resolved');if(!item)throw Error(queue.some(r=>r.id===issueId)?'Review issue already resolved':'Review issue not found');
  item.status='resolved';item.resolution={reviewer,date,evidence,decision,recordedAt:new Date().toISOString(),substantiveVerificationChanged:false,publicContentChanged:false};await writeFile(queuePath,JSON.stringify(queue,null,2)+'\n');console.log(JSON.stringify({issueId,status:'resolved',publicContentChanged:false,substantiveVerificationChanged:false}));
 }else if(command==='propose'){
  const [file,id,patchPath]=args.slice(1);if(!file||!id||!patchPath)throw Error('Usage: node scripts/editorial.mjs propose DATASET.json RECORD_ID PATCH.json');
  const records=await read(datasetPath(file)),record=records.find(r=>r.id===id);if(!record)throw Error('Record not found');const patch=await read(resolve(patchPath));if(Array.isArray(patch)||!patch||typeof patch!=='object'||patch.id&&patch.id!==id)throw Error('Patch must be an object and cannot change record ID');
  const proposal={id:randomUUID(),createdAt:new Date().toISOString(),dataset:file,recordId:id,originalHash:hash(record),before:record,after:{...record,...patch,id},status:'proposed'};await writeFile(resolve(dir,proposal.id+'.json'),JSON.stringify(proposal,null,2)+'\n');console.log(JSON.stringify({proposalId:proposal.id,status:'proposed',publicContentChanged:false}));
 }else if(command==='apply'){
  const id=args[1];if(!/^[a-f0-9-]{36}$/.test(id??''))throw Error('Expected a proposal UUID');const reviewer=flag('--reviewer'),date=flag('--date');if(!reviewer||!/^\d{4}-\d{2}-\d{2}$/.test(date??'')||!args.includes('--review-complete'))throw Error('Apply requires --reviewer ID --date YYYY-MM-DD --review-complete after an actual review');
  const path=resolve(dir,id+'.json'),proposal=await read(path);if(proposal.status!=='proposed')throw Error('Proposal already handled');const file=datasetPath(proposal.dataset),records=await read(file),index=records.findIndex(r=>r.id===proposal.recordId);if(index<0||hash(records[index])!==proposal.originalHash)throw Error('Record changed since proposal. Rebase and review it again.');
  const all=await loadAll(),after=proposal.after;
  if(after.status==='published'||after.status==='verified'){
   const sourceRecords=(after.sourceIds??[]).map(id=>all.find(r=>r.id===id));if(!sourceRecords.length||sourceRecords.some(s=>!s||!s.substantiveVerifiedAt))throw Error('Published/verified content requires substantively reviewed cited sources');if(!sourceRecords.some(s=>['primary','official-guidance'].includes(s.type)))throw Error('Primary/official evidence required');if(after.conflicts?.length&&!args.includes('--accept-material-limits'))throw Error('Unresolved conflict must be resolved or explicitly limited using --accept-material-limits after review');
   if(after.sections&&(!after.practicalOutput||!after.limitations?.length||!after.sections.length))throw Error('Published guide needs original practical output, sections and coverage limits');
  }
  const reviewed={...after,reviewerStatus:'Reviewed by '+reviewer+'; review scope recorded in proposal '+id};if(after.sections){reviewed.lastReviewed=date;reviewed.reviewStatus=reviewed.reviewerStatus;}if(after.requirement)reviewed.verifiedAt=date;if(after.url&&after.authority)reviewed.substantiveVerifiedAt=date;
  const revision={proposalId:id,appliedAt:new Date().toISOString(),reviewer,date,before:records[index],after:reviewed};await writeFile(resolve(dir,id+'.revision.json'),JSON.stringify(revision,null,2)+'\n');records[index]=reviewed;await writeFile(file,JSON.stringify(records,null,2)+'\n');proposal.status='applied';proposal.appliedAt=revision.appliedAt;await writeFile(path,JSON.stringify(proposal,null,2)+'\n');
  const dependencies=all.filter(r=>r.path&&(r.sourceIds?.includes(proposal.recordId)||r.ruleIds?.includes(proposal.recordId))).map(r=>r.path);const change={recordId:proposal.recordId,dataset:proposal.dataset,changedAt:revision.appliedAt,affectedPaths:[...new Set([...dependencies,...(after.dependentPaths??[])])],status:'needs-dependent-review',publicDeploymentChanged:false,instruction:'Review dependent interpretations and tools before the next publication. Existing built/published version is preserved.'};await writeFile(resolve(dir,id+'.invalidation.json'),JSON.stringify(change,null,2)+'\n');console.log(JSON.stringify(change));
 }else if(command==='queue'){
  let queue=[];try{queue=await read(resolve('artifacts/editorial-review-queue.json'))}catch{}const proposals=[];for(const f of (await readdir(dir)).filter(f=>/^[a-f0-9-]{36}\.json$/.test(f))){const p=await read(resolve(dir,f));if(p.status==='proposed')proposals.push({id:p.id,dataset:p.dataset,recordId:p.recordId,createdAt:p.createdAt});}console.log(JSON.stringify({sourceReview:queue,proposals},null,2));
 }else throw Error('Commands: propose DATASET.json RECORD_ID PATCH.json | apply PROPOSAL_UUID --reviewer ID --date YYYY-MM-DD --review-complete [--accept-material-limits] | queue');
}catch(e){console.error(e.message);process.exitCode=1;}
