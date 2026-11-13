import {readdir,readFile,writeFile} from 'node:fs/promises';
const directory='src/data';
const guides=(await Promise.all((await readdir(directory)).filter(f=>f.endsWith('guides.json')).map(async f=>JSON.parse(await readFile(`${directory}/${f}`,'utf8'))))).flat().filter(g=>g.status==='published');
const tools=JSON.parse(await readFile(`${directory}/tool-definitions.json`,'utf8'));
const candidates=JSON.parse(await readFile(`${directory}/page-candidates.json`,'utf8'));
const decisionFiles=['research/batch3/planning-candidate-decisions.json',...JSON.parse(await readFile('research/batch3/candidate-overlay-files.json','utf8').catch(error=>{if(error.code==='ENOENT')return '[]';throw error;}))];
const reviewedById=new Map();
for(const file of decisionFiles)for(const d of JSON.parse(await readFile(file,'utf8')))reviewedById.set(d.candidateId,{...d,evidenceFile:file});
const paths=new Set([...guides,...tools].map(x=>x.path));
for(const path of ['/','/coverage/','/methodology/','/sources/','/guides/','/tools/','/plan/'])paths.add(path);
for(const c of candidates){
 const exact=guides.find(g=>g.path===c.path);
 const reviewed=reviewedById.get(c.id);
 if(reviewed&&reviewed.path!==c.path)throw Error(`Candidate path changed in decision evidence: ${c.id}`);
 let decision=reviewed;
 if(exact)decision={decision:'publish',canonicalPath:exact.path,reason:'A published canonical guide answers the question within its expressly stated evidence and coverage limits.',decidedAt:exact.lastReviewed,scope:exact.title,sourceIds:exact.sourceIds??[],ruleIds:exact.ruleIds??[],researchCompleteness:'limited-to-published-guide-scope',unresolvedResearch:exact.limitations};
 if(!decision)throw Error(`Missing editorial decision: ${c.id}`);
 if(!['publish','merge','retire','needs-research'].includes(decision.decision))throw Error(`Invalid editorial decision: ${c.id}`);
 if(decision.canonicalPath&&(!decision.canonicalPath.startsWith('/')||decision.canonicalPath.startsWith('//')))throw Error(`Editorial destination must be a local path: ${c.id}`);
 if(['publish','merge'].includes(decision.decision)&&!paths.has(new URL(decision.canonicalPath,'https://eln.invalid').pathname))throw Error(`Unpublished canonical destination: ${c.id}`);
 c.publicationDecision={decision:decision.decision,canonicalPath:decision.canonicalPath??null,reason:decision.reason,decidedAt:decision.decidedAt,scope:decision.scope??'Limited to the named published guide or tool.',sourceIds:decision.sourceIds??[],ruleIds:decision.ruleIds??[],evidenceFile:decision.evidenceFile??'Canonical published guide record',researchCompleteness:decision.researchCompleteness??'not-established-by-editorial-disposition',unresolvedResearch:decision.unresolvedResearch??[]};
 c.status=decision.decision==='publish'?(tools.some(t=>t.path===decision.canonicalPath)?'implemented-tool':'published'):decision.decision==='merge'?'merged':decision.decision==='retire'?'retired':'not-researched';
}
await writeFile(`${directory}/page-candidates.json`,JSON.stringify(candidates,null,2)+'\n');
const counts={};for(const c of candidates)counts[c.status]=(counts[c.status]??0)+1;
console.log(JSON.stringify({candidates:candidates.length,statuses:counts,policy:'Editorial disposition does not establish complete jurisdiction or topic research. Published-guide limits and independent coverage statuses remain authoritative.'}));
