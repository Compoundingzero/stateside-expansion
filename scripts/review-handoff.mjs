import {readdir,readFile,writeFile} from 'node:fs/promises';
const files=(await readdir('src/data')).filter(f=>f.endsWith('.json'));
const load=async suffix=>(await Promise.all(files.filter(f=>f.endsWith(suffix)).map(async file=>(JSON.parse(await readFile(`src/data/${file}`,'utf8'))).map(record=>({...record,dataset:file}))))).flat();
const [guides,rules,sources]=await Promise.all([load('-guides.json'),load('-rules.json'),load('-sources.json')]);
const sourceMap=new Map(sources.map(s=>[s.id,s]));
const cell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
const columns=['ruleId','dataset','title','jurisdiction','status','legalStatus','verifiedAt','requirement','exceptions','interpretationLimits','sourceEvidence','dependentPublishedPaths','humanReviewer','reviewDate','decision','correctionEvidence'];
const rows=rules.map(rule=>{
 const cited=(rule.sourceIds||[]).map(id=>{const s=sourceMap.get(id);return s?`${id}: ${s.url} | ${s.section||''} | ${s.supportingPassage||''} | access=${s.accessStatus} | substantiveReview=${s.substantiveVerifiedAt||'none'}`:`MISSING ${id}`;});
 return [rule.id,rule.dataset,rule.title,rule.jurisdiction,rule.status,rule.legalStatus,rule.verifiedAt,rule.requirement,rule.exceptions,(rule.interpretationLimits||[]).join(' | '),cited.join('\n'),guides.filter(g=>g.status==='published'&&(g.ruleIds||[]).includes(rule.id)).map(g=>g.path).join(' | '),'','','',''];
});
await writeFile('docs/professional-review-register.csv',[columns,...rows].map(row=>row.map(cell).join(',')).join('\n')+'\n');
console.log(`Prepared ${rows.length} rule records with primary evidence and affected published paths. No human review has been recorded.`);
