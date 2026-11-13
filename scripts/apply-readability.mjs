import {readFile,readdir,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
const dir='research/readability';
const manifest=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8'));
const batch=process.argv[2];
const batches=batch?[batch]:Object.keys(manifest.batches);
if(batches.some(b=>!manifest.batches[b]))throw Error('Unknown editorial batch');
const files=(await readdir('src/data')).filter(f=>f.endsWith('guides.json'));
const datasets=new Map(await Promise.all(files.map(async file=>[file,JSON.parse(await readFile(`src/data/${file}`,'utf8'))])));
const all=[...datasets.values()].flat(),byId=new Map(all.map(g=>[g.id,g]));
const rules=(await Promise.all((await readdir('src/data')).filter(f=>f.endsWith('rules.json')).map(async f=>JSON.parse(await readFile(`src/data/${f}`,'utf8'))))).flat();
const allowed=new Set(['id','path','title','description','learningSummary','keyTerms','sections','practicalOutput','limitations','readMinutes']);
const changedFiles=new Set(),applied=[];
for(const name of batches){
 const input=JSON.parse(await readFile(`${dir}/${name}-input.json`,'utf8'));
 const original=new Map(input.map(g=>[g.id,g]));
 const patches=JSON.parse(await readFile(`${dir}/${name}-output.json`,'utf8'));
 if(!batch&&patches.length!==manifest.batches[name].length)throw Error(`${name}: batch is incomplete`);
 if(new Set(patches.map(p=>p.id)).size!==patches.length)throw Error(`${name}: duplicate patch`);
 for(const p of patches){
  const old=original.get(p.id),g=byId.get(p.id);
  if(!old||!manifest.batches[name].includes(p.id)||!g||p.path!==old.path||p.path!==g.path)throw Error(`${name}: wrong guide identity`);
  if(Object.keys(p).some(k=>!allowed.has(k)))throw Error(`${p.id}: attempted non-editorial field mutation`);
  for(const [key,value] of Object.entries(old))if(!allowed.has(key)&&!['dataset','contentModifiedAt'].includes(key)&&!isDeepStrictEqual(g[key],value))throw Error(`${p.id}: immutable field changed: ${key}`);
  for(const key of ['title','description','learningSummary','practicalOutput'])if(typeof p[key]!=='string'||!p[key].trim())throw Error(`${p.id}: missing ${key}`);
  if(!Array.isArray(p.keyTerms)||p.keyTerms.length<2||p.keyTerms.length>6||p.keyTerms.some(t=>!t.term?.trim()||!t.meaning?.trim()))throw Error(`${p.id}: invalid teaching terms`);
  if(!Array.isArray(p.sections)||p.sections.length<3)throw Error(`${p.id}: incomplete explanation`);
  if(!Array.isArray(p.limitations)||!p.limitations.length)throw Error(`${p.id}: missing limits`);
  if(!Number.isInteger(p.readMinutes)||p.readMinutes<1)throw Error(`${p.id}: invalid reading time`);
  const ids=new Set([...(g.sourceIds??[]),...rules.filter(r=>g.ruleIds?.includes(r.id)).flatMap(r=>r.sourceIds??[])]);
  for(const section of p.sections)for(const id of section.sourceIds??[])if(!ids.has(id))throw Error(`${p.id}: unexplained new source ${id}`);
  Object.assign(g,p,{contentModifiedAt:new Date().toISOString()});
  changedFiles.add(old.dataset.split('/').pop());applied.push(p.id);
 }
}
for(const file of changedFiles)await writeFile(`src/data/${file}`,JSON.stringify(datasets.get(file),null,2)+'\n');
console.log(JSON.stringify({batches,articlesUpdated:applied.length,publishedTotal:all.filter(g=>g.status==='published').length,sourceDatesPreserved:true}));
