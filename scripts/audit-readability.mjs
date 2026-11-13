import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
const directory='research/readability';
const manifest=JSON.parse(await readFile(`${directory}/manifest.json`,'utf8'));
const text=g=>[g.title,g.description,g.learningSummary,...(g.keyTerms??[]).flatMap(t=>[t.term,t.meaning]),...(g.sections??[]).flatMap(s=>[s.heading,...(s.paragraphs??[]),...(s.bullets??[]),...(s.table?.headers??[]),...(s.table?.rows??[]).flat()]),g.practicalOutput,...(g.limitations??[])].filter(Boolean).join(' ');
const numbers=s=>[...new Set(s.match(/(?:[$€£]\s*)?\b\d[\d,.]*(?:\s*%)?/g)??[])];
const rows=[];
for(const batch of Object.keys(manifest.batches)){
 const input=JSON.parse(await readFile(`${directory}/${batch}-input.json`,'utf8'));
 let patches;try{patches=JSON.parse(await readFile(`${directory}/${batch}-output.json`,'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
 const map=new Map(input.map(g=>[g.id,g]));
 for(const g of patches){
  const old=map.get(g.id);if(!old||old.path!==g.path)throw Error('Unknown proposal identity');
  const oldtext=text(old),newtext=text(g),newNumbers=numbers(newtext);
  const missingNumbers=numbers(oldtext).filter(n=>!newNumbers.includes(n));
  rows.push({id:g.id,path:g.path,batch,beforeWords:oldtext.match(/\S+/g)?.length??0,afterWords:newtext.match(/\S+/g)?.length??0,keyTerms:g.keyTerms?.length??0,sections:g.sections.length,missingNumericStringsForReview:missingNumbers,remainingResearchShorthand:[...new Set((newtext.match(/\b(?:workstreams?|release gates?|evidence chains?|canonical|nexus|cohorts?|substantiation)\b/gi)??[]).map(s=>s.toLowerCase()))],oldTables:old.sections.filter(s=>s.table).map(s=>s.table.rows.length),newTables:g.sections.filter(s=>s.table).map(s=>s.table.rows.length)});
 }
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/readability-audit.json',JSON.stringify({generatedAt:new Date().toISOString(),expected:278,proposals:rows.length,policy:'Numbers and shorthand are review prompts, not an automatic quality or legal-equivalence verdict.',rows},null,2)+'\n');
console.log(JSON.stringify({proposals:rows.length,expected:278,withoutTerms:rows.filter(r=>r.keyTerms<2).length,numericReviewPrompts:rows.filter(r=>r.missingNumericStringsForReview.length).length}));
