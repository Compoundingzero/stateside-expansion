import {readFile,readdir,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {editorialFields,editorialHash} from './smb-edit-utils.mjs';

const directory='research/smb-edit';
const originals=JSON.parse(await readFile(`${directory}/input.json`,'utf8'));
const originalById=new Map(originals.map(g=>[g.id,g]));
const fragments=new Map(JSON.parse(await readFile(`${directory}/fragments.json`,'utf8')).map(g=>[g.id,g.sections]));
const workflow=JSON.parse(await readFile(`${directory}/workflow.json`,'utf8'));
const sourceIntegrations=JSON.parse(await readFile(`${directory}/source-integrations.json`,'utf8').catch(()=>'[]'));
const additionsFor=id=>sourceIntegrations.filter(i=>i.id===id).flatMap(i=>i.sourceIdsAdded||[]);
const ledger=new Map(workflow.articles.map(g=>[g.id,g]));
const files=(await readdir('src/data')).filter(f=>f.endsWith('guides.json'));
const datasets=new Map(await Promise.all(files.map(async f=>[f,JSON.parse(await readFile(`src/data/${f}`,'utf8'))])));
const current=new Map([...datasets.values()].flat().map(g=>[g.id,g]));
const rules=(await Promise.all((await readdir('src/data')).filter(f=>f.endsWith('rules.json')).map(async f=>JSON.parse(await readFile(`src/data/${f}`,'utf8'))))).flat();
const tools=JSON.parse(await readFile('src/data/tool-definitions.json','utf8'));
const destinations=new Set([...originals.map(g=>g.path),...tools.map(t=>t.path)]);
const editable=new Set(editorialFields);
const notes=new Set(['editNote','conditionsRetained']);
const permitted=new Set(['id','path',...editable,...notes]);
const fixed=new Set(['start-here','words-to-know','sources','choose-jurisdiction','what-to-prepare','guide-limits','official-federal-explanation','detailed-rules','documented-cases','related-preparation']);
const tokens=s=>new Set(s.toLowerCase().match(/[a-z0-9]+/g)||[]);
const meaningful=sections=>sections.map(({aliases,legacyIndex,...section})=>section);
const args=process.argv.slice(2),apply=args.includes('--apply');
const onlyIndex=args.indexOf('--only');
const only=onlyIndex<0?null:new Set((args[onlyIndex+1]||'').split(',').filter(Boolean));
if(only&&only.size===0)throw Error('--only needs guide IDs');
const batches=args.filter((a,index)=>a!=='--apply'&&a!=='--only'&&(onlyIndex<0||index!==onlyIndex+1));
const selected=batches.length?batches:(await readdir(directory)).filter(f=>f.endsWith('-patches.json'));
const seen=new Set(),changedFiles=new Set();let changed=0;
for(const batch of selected){
 const filename=batch.endsWith('.json')?batch:`${batch}-patches.json`;
 const patches=JSON.parse(await readFile(`${directory}/${filename}`,'utf8'));
 for(const p of patches){
  if(only&&!only.has(p.id))continue;
  const old=originalById.get(p.id),g=current.get(p.id);
  if(!old||!g||g.status!=='published'||p.path!==old.path||g.path!==old.path||seen.has(g.id))throw Error(`${p.id}: invalid/duplicate identity`);
  seen.add(g.id);
  for(const key of Object.keys(p))if(!permitted.has(key))throw Error(`${p.id}: not an editorial field: ${key}`);
  for(const [key,value] of Object.entries(old)){
   const expected=key==='sourceIds'?[...new Set([...value,...additionsFor(g.id)])]:value;
   if(!editable.has(key)&&!['dataset','contentModifiedAt'].includes(key)&&!isDeepStrictEqual(g[key],expected))throw Error(`${p.id}: protected metadata changed: ${key}`);
  }
  if(!p.editNote?.trim()||!Array.isArray(p.conditionsRetained)||!p.conditionsRetained.length||p.conditionsRetained.some(c=>!c?.trim()))throw Error(`${p.id}: missing specific editorial/condition review`);
  const publicPatch=Object.fromEntries(Object.entries(p).filter(([key])=>!notes.has(key)));
  const next={...g,...publicPatch};
  for(const key of ['title','seoTitle','description','learningSummary','practicalOutput'])if(typeof next[key]!=='string'||!next[key].trim())throw Error(`${p.id}: missing ${key}`);
  if(!Array.isArray(next.keyTerms)||next.keyTerms.length>6||next.keyTerms.some(t=>!t.term?.trim()||!t.meaning?.trim()))throw Error(`${p.id}: invalid optional terms`);
  if(!Array.isArray(next.sections)||!next.sections.length)throw Error(`${p.id}: empty explanation`);
  if(!Array.isArray(next.limitations)||!next.limitations.length)throw Error(`${p.id}: missing actual scope`);
  if(!Array.isArray(next.relatedPaths)||next.relatedPaths.length>5||new Set(next.relatedPaths).size!==next.relatedPaths.length||next.relatedPaths.some(path=>path===g.path||!destinations.has(path)))throw Error(`${p.id}: invalid reading link`);
  const sourceIds=new Set([...(old.sourceIds||[]),...additionsFor(g.id),...rules.filter(r=>old.ruleIds?.includes(r.id)).flatMap(r=>r.sourceIds||[])]);
  const sectionRuleIds=new Set([...(old.ruleIds||[]),...old.sections.flatMap(s=>s.ruleIds||[])]);
  const ids=new Set();
  for(const section of next.sections){
   if(!section.id||!section.heading||ids.has(section.id)||fixed.has(section.id)||!(/^[a-z][a-z0-9-]*$/).test(section.id))throw Error(`${p.id}: invalid section identity`);
   ids.add(section.id);
   for(const id of section.sourceIds||[])if(!sourceIds.has(id))throw Error(`${p.id}: new source needs separate evidence: ${id}`);
   for(const id of section.ruleIds||[])if(!sectionRuleIds.has(id))throw Error(`${p.id}: new rule association ${id}`);
  }
  if(isDeepStrictEqual(meaningful(next.sections),meaningful(old.sections))&&next.learningSummary===old.learningSummary)throw Error(`${p.id}: body has not been edited`);
  const assigned=new Map();
  next.sections=next.sections.map(({legacyIndex,...section})=>({...section,aliases:[...(section.aliases||[])]}));
  for(const section of next.sections)for(const alias of section.aliases){
   if(fixed.has(alias)||!(/^[a-z][a-z0-9-]*$/).test(alias)||(ids.has(alias)&&alias!==section.id)||(assigned.has(alias)&&assigned.get(alias)!==section.id))throw Error(`${p.id}: conflicting alias ${alias}`);
   assigned.set(alias,section.id);
  }
  for(const prior of fragments.get(p.id)||[]){
   const aliases=[prior.semanticId,prior.legacyId].filter(Boolean);
   const existing=next.sections.find(s=>aliases.some(alias=>s.id===alias||s.aliases.includes(alias)));
   const oldWords=tokens(prior.heading);
   const best=existing||next.sections.map((s,index)=>({s,index,score:[...tokens(s.heading+' '+s.id)].filter(w=>oldWords.has(w)).length*3+(prior.sourceIds||[]).filter(id=>s.sourceIds?.includes(id)).length})).sort((a,b)=>b.score-a.score||a.index-b.index)[0].s;
   for(const alias of aliases)if(!ids.has(alias)&&!assigned.has(alias)){best.aliases.push(alias);assigned.set(alias,best.id);}
  }
  for(const section of next.sections)section.aliases=[...new Set(section.aliases)].filter(alias=>alias!==section.id);
  const hash=editorialHash(next),entry=ledger.get(g.id);
  if(!isDeepStrictEqual(g,next)){
   Object.assign(g,next,{contentModifiedAt:new Date().toISOString()});changed++;changedFiles.add(old.dataset.split('/').pop());
  }
  if(entry.contentHash!==hash){entry.state='drafted';delete entry.reviewedHash;delete entry.review;}
  Object.assign(entry,{contentHash:hash,editNote:p.editNote,conditionsRetained:p.conditionsRetained});
 }
}
if(only&&[...only].some(id=>!seen.has(id)))throw Error('Selected prototype was not found');
if(apply){
 for(const file of changedFiles)await writeFile(`src/data/${file}`,JSON.stringify(datasets.get(file),null,2)+'\n');
 await writeFile(`${directory}/workflow.json`,JSON.stringify(workflow,null,2)+'\n');
}
console.log(JSON.stringify({mode:apply?'applied':'checked',articles:seen.size,changed,oldHeadingsRequired:false,sourceReviewDatesAutomaticallyRefreshed:false}));
