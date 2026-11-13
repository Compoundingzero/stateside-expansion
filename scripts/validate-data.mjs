import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const dir=resolve('src/data');
const errors=[],warnings=[];const files=(await readdir(dir)).filter(f=>f.endsWith('.json'));
const datasets={};for(const f of files){try{const a=JSON.parse(await readFile(resolve(dir,f),'utf8'));if(!Array.isArray(a))errors.push(f+': expected array');else datasets[f]=a}catch(e){errors.push(f+': '+e.message)}}
const pick=suffix=>Object.entries(datasets).filter(([f])=>f.endsWith(suffix)).flatMap(([,a])=>a);
const guides=pick('guides.json'),sources=pick('sources.json'),rules=pick('rules.json');
const unique=(arr,label,key='id')=>{const seen=new Set();for(const r of arr){if(!r[key])errors.push(label+': missing '+key);else if(seen.has(r[key]))errors.push(label+': duplicate '+r[key]);seen.add(r[key]);}};
unique(guides,'guide');unique(guides,'guide path','path');unique(sources,'source');unique(rules,'rule');
const smap=new Map(sources.map(s=>[s.id,s])),rmap=new Map(rules.map(r=>[r.id,r]));const published=guides.filter(g=>g.status==='published');
const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v)&&!Number.isNaN(Date.parse(v));
const caseConnections=datasets['case-connections.json']??[];unique(caseConnections,'case connection');
for(const link of caseConnections){
 if(!published.some(g=>g.id===link.caseGuideId&&g.family==='case'&&g.scenarioType==='real'))errors.push(link.id+': must link a published documented case');
 for(const id of link.ruleIds??[])if(!rmap.has(id))errors.push(link.id+': unknown linked rule '+id);
 for(const id of link.guideIds??[])if(!published.some(g=>g.id===id))errors.push(link.id+': unknown linked guide '+id);
 if(!link.explanation)errors.push(link.id+': case connection needs a scoped explanation');
}
for(const g of guides){
 const name=g.id??'unnamed guide';
 if(!/^\/[a-z0-9/-]+\/$/.test(g.path??''))errors.push(name+': canonical path must be lowercase leading/trailing slash');
 if(!['published','draft','blocked'].includes(g.status))errors.push(name+': invalid publication status');
 for(const id of g.sourceIds??[])if(!smap.has(id))errors.push(name+': missing source '+id);
 for(const id of g.ruleIds??[])if(!rmap.has(id))errors.push(name+': missing rule '+id);
 if(g.status!=='published')continue;
 for(const key of ['title','description','family','topic','practicalOutput','reviewStatus','learningSummary'])if(typeof g[key]!=='string'||!g[key].trim())errors.push(name+': published guide missing '+key);
 if(!Array.isArray(g.keyTerms)||g.keyTerms.length<2||g.keyTerms.length>6||g.keyTerms.some(t=>typeof t?.term!=='string'||!t.term.trim()||typeof t?.meaning!=='string'||!t.meaning.trim()))errors.push(name+': published guide needs two to six explained terms');
 if(!iso(g.lastReviewed))errors.push(name+': published guide needs substantive review date');
 if(!g.sourceIds?.length)errors.push(name+': published guide needs cited sources');
 if(!Array.isArray(g.sections)||g.sections.length===0)errors.push(name+': published guide needs sections');
 for(const [i,s] of (g.sections??[]).entries()){
  if(!s.heading||(!(s.paragraphs??[]).some(Boolean)&&!(s.bullets??[]).some(Boolean)&&!s.table?.rows?.length))errors.push(name+': section '+i+' is empty');
  if(s.table&&s.table.rows.some(row=>row.length!==s.table.headers.length))errors.push(name+': section '+i+' has uneven table');
  for(const id of s.sourceIds??[])if(!smap.has(id))errors.push(name+': section source not found '+id);
 }
 if(!Array.isArray(g.limitations)||!g.limitations.length)errors.push(name+': published guide must state coverage limits');
 if(g.scenarioType==='fictional'&&!/fiction|illustrat/i.test(g.title+' '+g.description))errors.push(name+': fictional scenario must be labelled in title/description');
 if(!Number.isInteger(g.nextStage)||g.nextStage<0||g.nextStage>6)errors.push(name+': invalid next stage');
 for(const id of g.sourceIds??[]){const s=smap.get(id);if(s&&!iso(s.substantiveVerifiedAt))warnings.push(name+': source '+id+' lacks a substantive verification date; inspect whether the source is only an explicitly limited lead');}
}
for(const s of sources){try{const u=new URL(s.url);if(u.protocol!=='https:')errors.push(s.id+': source requires HTTPS')}catch{errors.push(s.id+': invalid source URL')}for(const key of ['title','authority','type'])if(!s[key])errors.push(s.id+': source missing '+key);if(s.substantiveVerifiedAt&&!iso(s.substantiveVerifiedAt))errors.push(s.id+': invalid substantive date');}
for(const r of rules){for(const id of r.sourceIds??[])if(!smap.has(id))errors.push(r.id+': missing source '+id);if(r.status==='verified'&&(!iso(r.verifiedAt)||!r.sourceIds?.length))errors.push(r.id+': verified rule needs date and evidence');for(const p of r.dependentPaths??[]){if(!guides.some(g=>g.path===p)&&!(datasets['tool-definitions.json']??[]).some(t=>t.path===p))warnings.push(r.id+': dependent path '+p+' not in guide inventory (may be a tool)');}for(const g of published.filter(g=>g.ruleIds?.includes(r.id)))if(!r.dependentPaths?.includes(g.path))warnings.push(r.id+': reciprocal dependency missing '+g.path);}
const toolDefinitions=datasets['tool-definitions.json']??[];unique(toolDefinitions,'tool');unique(toolDefinitions,'tool path','path');for(const tool of toolDefinitions){for(const id of tool.sourceIds??[])if(!smap.has(id))errors.push(tool.id+': missing tool source '+id);for(const id of tool.ruleIds??[])if(!rmap.has(id))errors.push(tool.id+': missing tool rule '+id);if(!/^\/tools\/[a-z0-9-]+\/$/.test(tool.path??''))errors.push(tool.id+': invalid canonical tool path');}
for(const t of [...(datasets['tool-definitions.json']??[]),...(datasets['site-dependencies.json']??[])]){for(const id of t.ruleIds??[])if(!rmap.has(id))errors.push(t.id+': missing tool rule '+id);for(const id of t.sourceIds??[])if(!smap.has(id))errors.push(t.id+': missing tool source '+id);}
const stateRecords=datasets['states.json']??[];if(stateRecords.length){const national=stateRecords.filter(s=>['state','district'].includes(s.kind));if(national.length!==51)errors.push('coverage: expected exactly 50 states + DC; found '+national.length);const territories=stateRecords.filter(s=>s.kind==='territory');if(territories.length!==5)errors.push('coverage: expected 5 territories; found '+territories.length);}
const candidates=datasets['page-candidates.json']??[];if(candidates.length){unique(candidates,'candidate');unique(candidates,'candidate path','path');if(candidates.length<700||candidates.length>1000)errors.push('candidate manifest must contain 700–1000 distinct research leads');for(const c of candidates)for(const key of ['reader','queryIntent','question','decision','distinctEvidence','practicalOutput','path'])if(!c[key])errors.push(c.id+': missing '+key);}
for(const x of [...new Set(warnings)])console.warn('REVIEW:',x);
for(const e of errors)console.error('ERROR:',e);
console.log(JSON.stringify({guides:guides.length,published:published.length,sources:sources.length,rules:rules.length,candidates:candidates.length,errors:errors.length,reviewNotes:new Set(warnings).size}));
if(errors.length)process.exitCode=1;
