import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const args=process.argv.slice(2);const reviewed=args.includes('--reviewed');const at=args.indexOf('--reviewer');const reviewer=at<0?null:args[at+1];
if(!reviewed||!reviewer)throw Error('Review the proposed guides, primary evidence and applicability first, then pass --reviewed --reviewer ID.');
const directory=resolve(args.find((a,i)=>!a.startsWith('--')&&i!==at+1)||'research/batch2');
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const assignments=['east','west','blocked','territories','origins'];
const listing=await readdir(directory);
const files=assignments.map(a=>a+'-guides.json').filter(f=>listing.includes(f));
if(files.length!==assignments.length&&!args.includes('--allow-partial'))throw Error('Wait for all authoritative batch proposals (east, west, blocked, territories, origins), or explicitly select --allow-partial after a bounded review.');const proposals=[];
for(const file of files){const rows=await read(join(directory,file));if(!Array.isArray(rows))throw Error('Expected an array: '+file);proposals.push(...rows);}
const seen=new Set();for(const p of proposals){if(!p.path||seen.has(p.path))throw Error('Duplicate or missing proposed canonical path: '+p.path);seen.add(p.path);}
const guideFiles=(await readdir('src/data')).filter(f=>f.endsWith('guides.json'));const contents=new Map();for(const file of guideFiles)contents.set(file,await read(join('src/data',file)));
const revisions=[],newRecords=[];let replaced=0;
for(const proposal of proposals){let found=false;for(const [file,rows] of contents){const index=rows.findIndex(g=>g.path===proposal.path);if(index<0)continue;if(found)throw Error('Existing duplicate path '+proposal.path);found=true;revisions.push({dataset:file,before:rows[index],after:proposal});rows[index]=proposal;replaced++;}if(!found)newRecords.push(proposal);}
const allGuides=[...[...contents.values()].flat(),...newRecords];const allSources=[];for(const file of (await readdir('src/data')).filter(f=>f.endsWith('sources.json')))allSources.push(...await read(join('src/data',file)));
const sourceIds=new Set(allSources.map(s=>s.id));for(const g of proposals){if(!['published','draft','blocked'].includes(g.status))throw Error('Invalid status '+g.id);for(const id of g.sourceIds??[])if(!sourceIds.has(id))throw Error('Unknown source '+id+' for '+g.path);if(g.status==='published'&&(!g.lastReviewed||!g.reviewStatus||!g.sections?.length||!g.practicalOutput||!g.limitations?.length))throw Error('Publication gate not met: '+g.path);}
const updates=[];for(const [suffix,target] of [['-jurisdictions.json','states.json'],['origins-updates.json','origins.json'],['markets-updates.json','markets.json']]){
 const files=(await readdir(directory)).filter(f=>suffix.startsWith('-')?assignments.some(a=>f===a+suffix):f===suffix);if(!files.length)continue;const rows=await read(join('src/data',target));const updated=new Set();for(const file of files){for(const record of await read(join(directory,file))){if(updated.has(record.id))throw Error('Duplicate jurisdiction override '+record.id);const index=rows.findIndex(r=>r.id===record.id);if(index<0)throw Error('Unknown coverage record '+record.id);updated.add(record.id);updates.push({dataset:target,id:record.id,before:rows[index],after:record});rows[index]=record;}}contents.set(target,rows);
}
const tools=await read('src/data/tool-definitions.json');for(const file of (await readdir('src/data')).filter(f=>f.endsWith('rules.json'))){const rows=await read(join('src/data',file));for(const r of rows)r.dependentPaths=[...new Set([...allGuides.filter(g=>g.status==='published'&&g.ruleIds?.includes(r.id)).map(g=>g.path),...tools.filter(t=>t.ruleIds?.includes(r.id)).map(t=>t.path)])].sort();contents.set(file,rows);}
await mkdir('artifacts/batch-imports',{recursive:true});const stamp=new Date().toISOString().replaceAll(':','-');await writeFile('artifacts/batch-imports/'+stamp+'.json',JSON.stringify({reviewer,at:new Date().toISOString(),proposals:files,revisions,coverageUpdates:updates,newRecords},null,2)+'\n');
for(const [file,rows] of contents)await writeFile(join('src/data',file),JSON.stringify(rows,null,2)+'\n');
if(newRecords.length){let existing=[];try{existing=await read('src/data/batch2-guides.json')}catch{};const paths=new Set(newRecords.map(g=>g.path));await writeFile('src/data/batch2-guides.json',JSON.stringify([...existing.filter(g=>!paths.has(g.path)),...newRecords],null,2)+'\n');}
console.log(JSON.stringify({reviewer,proposed:proposals.length,replaced,newCanonicalRecords:newRecords.length,coverageUpdates:updates.length,publishedProposals:proposals.filter(g=>g.status==='published').length,revisionArchive:'artifacts/batch-imports/'+stamp+'.json'}));
