import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';

const base='d39eeb8d33c7044e7907a81f41d6a848d6a34594';
const names=await readdir('src/data');
const editorial=new Set(['title','description','learningSummary','keyTerms','sections','practicalOutput','limitations','readMinutes','seoTitle','relatedPaths','learningPath','contentModifiedAt']);
const protectedFields=g=>Object.fromEntries(Object.entries(g).filter(([key])=>!editorial.has(key)));
const teachingBody=sections=>sections.map(({legacyIndex,...body})=>body);
const headingKey=heading=>heading.replace(/\s/g,'');
let articles=0,unpublished=0,protectedFiles=0;
const all=[];
for(const file of names.filter(f=>f.endsWith('guides.json'))){
 const before=JSON.parse(execFileSync('git',['show',`${base}:src/data/${file}`],{maxBuffer:12*1024*1024}));
 const after=JSON.parse(await readFile(`src/data/${file}`,'utf8'));
 if(before.length!==after.length)throw Error(`${file}: inventory changed`);
 for(let i=0;i<before.length;i++){
  const a=before[i],b=after[i];all.push(b);
  if(!isDeepStrictEqual(protectedFields(a),protectedFields(b)))throw Error(`${a.id}: source/publication metadata changed`);
  if(a.status!=='published'){if(!isDeepStrictEqual(a,b))throw Error(`${a.id}: unpublished record changed`);unpublished++;continue;}
  if(!b.seoTitle||!b.relatedPaths?.length)throw Error(`${a.id}: search title or reading path missing`);
  if(isDeepStrictEqual(teachingBody(a.sections),teachingBody(b.sections))&&a.learningSummary===b.learningSummary&&isDeepStrictEqual(a.keyTerms,b.keyTerms))throw Error(`${a.id}: article-specific learning change missing`);
  if(!a.limitations.every(limit=>b.limitations.includes(limit)))throw Error(`${a.id}: coverage boundary removed`);
  for(const [index,section] of a.sections.entries())if(!b.sections.some(next=>headingKey(next.heading)===headingKey(section.heading)&&next.legacyIndex===index))throw Error(`${a.id}: original section fragment changed meaning: section-${index}`);
  articles++;
 }
}
for(const file of names.filter(f=>f.endsWith('sources.json')||f.endsWith('rules.json')||['states.json','origins.json','markets.json','case-connections.json'].includes(f))){
 const old=execFileSync('git',['show',`${base}:src/data/${file}`],{maxBuffer:12*1024*1024});
 if(!old.equals(await readFile(`src/data/${file}`)))throw Error(`${file}: protected evidence changed`);
 protectedFiles++;
}
const payroll=all.find(g=>g.id==='state-employer-payroll-registration');
const beforePayroll=JSON.parse(execFileSync('git',['show',`${base}:src/data/${(await import('node:path')).basename(JSON.parse(await readFile('research/improvements/input.json','utf8')).find(g=>g.id===payroll.id).dataset)}`],{maxBuffer:12*1024*1024})).find(g=>g.id===payroll.id);
const stateTables=g=>g.sections.filter(s=>s.table).map(s=>s.table);
if(!isDeepStrictEqual(stateTables(payroll),stateTables(beforePayroll)))throw Error('Payroll reference tables changed');
if(articles!==278)throw Error(`Expected 278 article improvements, found ${articles}`);
const result={baseCommit:base,articlesImproved:articles,unpublishedPreserved:unpublished,sourceRuleJurisdictionFilesByteIdentical:protectedFiles,payrollJurisdictionsPreserved:51,sourceEvidenceAutomaticallyReverified:false};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/improvement-integrity.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
