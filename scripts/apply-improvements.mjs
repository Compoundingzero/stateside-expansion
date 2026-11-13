import {readFile,readdir,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';

// Apply reviewed presentation patches without changing the evidence or publication decision.
const directory='research/improvements';
const frozen=JSON.parse(await readFile(`${directory}/input.json`,'utf8'));
const originals=new Map(frozen.map(g=>[g.id,g]));
const files=(await readdir('src/data')).filter(f=>f.endsWith('guides.json'));
const datasets=new Map(await Promise.all(files.map(async f=>[f,JSON.parse(await readFile(`src/data/${f}`,'utf8'))])));
const current=new Map([...datasets.values()].flat().map(g=>[g.id,g]));
const rules=(await Promise.all((await readdir('src/data')).filter(f=>f.endsWith('rules.json')).map(async f=>JSON.parse(await readFile(`src/data/${f}`,'utf8'))))).flat();
const tools=JSON.parse(await readFile('src/data/tool-definitions.json','utf8'));
const destinations=new Set([...frozen.map(g=>g.path),...tools.map(t=>t.path)]);
const editable=new Set(['title','description','learningSummary','keyTerms','sections','practicalOutput','limitations','readMinutes','seoTitle','relatedPaths','learningPath']);
const permitted=new Set(['id','path',...editable]);
const arguments_=process.argv.slice(2),apply=arguments_.includes('--apply');
const names=arguments_.filter(a=>a!=='--apply');
const batches=names.length?names:(await readdir(directory)).filter(f=>f.endsWith('-patches.json'));
const changedFiles=new Set(),ids=new Set(),changed=[];
const headingKey=heading=>heading.replace(/\s/g,'');
for(const name of batches){
 const file=name.endsWith('.json')?name:`${name}-patches.json`;
 const patches=JSON.parse(await readFile(`${directory}/${file}`,'utf8'));
 if(!Array.isArray(patches))throw Error(`${file}: expected patch array`);
 for(const p of patches){
  const old=originals.get(p.id),g=current.get(p.id);
  if(!old||!g||g.status!=='published'||p.path!==old.path||g.path!==old.path)throw Error(`${p.id}: invalid published identity`);
  if(ids.has(p.id))throw Error(`${p.id}: duplicate patch across batches`);
  ids.add(p.id);
  for(const key of Object.keys(p))if(!permitted.has(key))throw Error(`${p.id}: non-editorial field ${key}`);
  for(const [key,value] of Object.entries(old))if(!editable.has(key)&&!['dataset','contentModifiedAt'].includes(key)&&!isDeepStrictEqual(g[key],value))throw Error(`${p.id}: protected field changed: ${key}`);
  if(typeof p.seoTitle!=='string'||!p.seoTitle.trim()||p.seoTitle.length>150)throw Error(`${p.id}: missing or unreasonable search title`);
  if(!Array.isArray(p.relatedPaths)||p.relatedPaths.length<3||p.relatedPaths.length>5||new Set(p.relatedPaths).size!==p.relatedPaths.length||p.relatedPaths.some(path=>path===g.path||!destinations.has(path)))throw Error(`${p.id}: invalid curated reading links`);
  const next={...g,...p};
  for(const key of ['title','description','learningSummary','practicalOutput'])if(typeof next[key]!=='string'||!next[key].trim())throw Error(`${p.id}: missing ${key}`);
  if(!Array.isArray(next.keyTerms)||next.keyTerms.length<2||next.keyTerms.length>6||next.keyTerms.some(t=>!t.term?.trim()||!t.meaning?.trim()))throw Error(`${p.id}: incomplete definitions`);
  if(!Array.isArray(next.sections)||next.sections.length<3)throw Error(`${p.id}: missing teaching body`);
  if(!old.limitations.every(limit=>next.limitations?.includes(limit)))throw Error(`${p.id}: original coverage limitation removed`);
  const sourceIds=new Set([...(old.sourceIds??[]),...rules.filter(r=>old.ruleIds?.includes(r.id)).flatMap(r=>r.sourceIds??[])]);
  for(const section of next.sections)for(const id of section.sourceIds??[])if(!sourceIds.has(id))throw Error(`${p.id}: new unreviewed source ${id}`);
  const oldSectionSources=new Set(old.sections.flatMap(s=>s.sourceIds??[]));
  const nextSectionSources=new Set(next.sections.flatMap(s=>s.sourceIds??[]));
  for(const id of oldSectionSources)if(!nextSectionSources.has(id))throw Error(`${p.id}: original section citation removed: ${id}`);
  if(isDeepStrictEqual(old.sections,next.sections)&&old.learningSummary===next.learningSummary&&old.keyTerms.every((term,i)=>isDeepStrictEqual(term,next.keyTerms[i])))throw Error(`${p.id}: metadata alone does not implement the learning recommendation`);
  // Numeric fragments are already public URLs. Preserve their original meaning
  // when a new teaching section is inserted ahead of an existing one.
  const oldHeadings=new Map(old.sections.map((section,index)=>[headingKey(section.heading),index]));
  if(oldHeadings.size!==old.sections.length)throw Error(`${p.id}: ambiguous original heading mapping`);
  for(const heading of oldHeadings.keys())if(!next.sections.some(section=>headingKey(section.heading)===heading))throw Error(`${p.id}: original section heading removed: ${heading}`);
  next.sections=next.sections.map(section=>{
   const {legacyIndex,...body}=section;
   return oldHeadings.has(headingKey(section.heading))?{...body,legacyIndex:oldHeadings.get(headingKey(section.heading))}:body;
  });
  p.sections=next.sections;
  if(!isDeepStrictEqual(g,next)){
   Object.assign(g,p,{contentModifiedAt:new Date().toISOString()});
   changedFiles.add(old.dataset.split('/').pop());changed.push(g.id);
  }
 }
}
if(apply)for(const file of changedFiles)await writeFile(`src/data/${file}`,JSON.stringify(datasets.get(file),null,2)+'\n');
console.log(JSON.stringify({mode:apply?'applied':'checked',batches,articlesChecked:ids.size,articlesChanged:changed.length,sourceDatesPreserved:true,publicationDecisionsPreserved:true}));
