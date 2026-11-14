import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {editorialHash} from '../scripts/smb-edit-utils.mjs';

const script=resolve('scripts/next-release.mjs');
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function fixture(run:(f:any)=>Promise<void>){
 const directory=await mkdtemp(join(tmpdir(),'eln-release-'));
 const write=async(path:string,value:unknown)=>writeFile(join(directory,path),JSON.stringify(value,null,2)+'\n');
 const read=async(path:string)=>JSON.parse(await readFile(join(directory,path),'utf8'));
 const source={id:'official',title:'Official rule',url:'https://authority.invalid/rule',authority:'Government',type:'statute',substantiveVerifiedAt:'2026-11-14'};
 const guide={id:'owner',path:'/owner/',status:'published',title:'Owner question',description:'A useful answer.',learningSummary:'An actual explanation.',sections:[{id:'original',heading:'Owner decision',paragraphs:['A real condition.'],sourceIds:['official']}],sourceIds:['official'],ruleIds:[],practicalOutput:'Prepare the real facts.',limitations:['Individual facts still matter.'],reviewStatus:'source-checked',family:'guide',topic:'planning',lastReviewed:'2026-11-14'};
 const decision={id:'owner',path:'/owner/',question:'What changed?',outcome:'verified',conclusion:'Read the actual text.',evidence:[{url:source.url,retrievedAt:'2026-11-14T12:00:00Z',locator:'Section 1',readScope:'Full section',quote:'A real condition.'}],guidePatch:{learningSummary:'A clearer explanation.',sections:[{id:'current',heading:'What applies?',paragraphs:['A real condition and its exception.'],sourceIds:['official']}]},newSources:[],sourceUpdates:[],newRules:[],ruleUpdates:[]};
 const cli=(...args:string[])=>spawnSync(process.execPath,[script,...args],{cwd:directory,encoding:'utf8'});
 try{
  await mkdir(join(directory,'src/data'),{recursive:true});await mkdir(join(directory,'research/next-release'),{recursive:true});
  await write('src/data/test-guides.json',[guide]);await write('src/data/test-sources.json',[source]);await write('src/data/test-rules.json',[]);
  await write('research/next-release/baseline-guides.json',[guide]);await write('research/next-release/baseline-record-ids.json',{sources:['official'],rules:[]});
  await write('research/next-release/workflow.json',{tasks:[],articles:[],integrations:[]});await write('decisions.json',[decision]);
  await run({directory,write,read,guide,source,decision,cli});
 }finally{await rm(directory,{recursive:true,force:true});}
}
test('release integration is transactional, supports partial patches and preserves old public bookmarks',async()=>fixture(async(f:any)=>{
 const before=await readFile(join(f.directory,'src/data/test-guides.json'),'utf8');
 assert.equal(f.cli('apply','decisions.json').status,0);assert.equal(await readFile(join(f.directory,'src/data/test-guides.json'),'utf8'),before);
 await f.write('decisions.json',[f.decision,{...f.decision,id:'bad',path:'/bad/',guidePatch:{id:'different'}}]);
 assert.notEqual(f.cli('apply','decisions.json','--write').status,0);assert.equal(await readFile(join(f.directory,'src/data/test-guides.json'),'utf8'),before);
 await f.write('decisions.json',[f.decision]);assert.equal(f.cli('apply','decisions.json','--write').status,0);
 const current=(await f.read('src/data/test-guides.json'))[0];assert.equal(current.learningSummary,'A clearer explanation.');assert.ok(current.sections[0].aliases.includes('original'));
 assert.equal((await f.read('research/next-release/workflow.json')).articles[0].state,'drafted');
}));
test('existing public routes/status, citations, retained evidence and baseline source identity are guarded',async()=>fixture(async(f:any)=>{
 for(const patch of [{status:'draft'},{status:null},{status:''},{status:false},{path:'/removed/'},{sourceIds:['missing']}]){
  await f.write('decisions.json',[{...f.decision,guidePatch:patch}]);assert.notEqual(f.cli('apply','decisions.json','--write').status,0);
 }
 await writeFile(join(f.directory,'evidence.txt'),'Actual text');
 await f.write('decisions.json',[{...f.decision,evidence:[{...f.decision.evidence[0],rawPath:'evidence.txt',sha256:'wrong'}]}]);assert.notEqual(f.cli('apply','decisions.json','--write').status,0);
 await f.write('decisions.json',[{...f.decision,newSources:[{file:'test-sources.json',record:{...f.source,title:'Changed silently'}}]}]);
 assert.notEqual(f.cli('apply','decisions.json','--write','--refresh').status,0);
}));
test('in-progress additions can be corrected explicitly; approvals bind both content and research decision',async()=>fixture(async(f:any)=>{
 const additional={...f.source,id:'new-official',url:'https://authority.invalid/second'};
 f.decision.newSources=[{file:'test-sources.json',record:additional}];await f.write('decisions.json',[f.decision]);
 assert.equal(f.cli('apply','decisions.json','--write').status,0);
 additional.title='A clearer source title';await f.write('decisions.json',[f.decision]);assert.notEqual(f.cli('apply','decisions.json','--write').status,0);
 assert.equal(f.cli('apply','decisions.json','--write','--refresh').status,0);
 const guide=(await f.read('src/data/test-guides.json'))[0],review={id:guide.id,reviewedHash:editorialHash(guide),decision:'approved',notes:'Read the actual source and explanation.',reviewer:'independent-fixture',decisionFingerprint:hash(f.decision)};
 await f.write('reviews.json',[{...review,decisionFingerprint:'old'}]);assert.notEqual(f.cli('review','reviews.json').status,0);
 await f.write('reviews.json',[review]);assert.equal(f.cli('review','reviews.json').status,0);
 f.decision.conclusion='An additional qualification from the same source.';await f.write('decisions.json',[f.decision]);assert.equal(f.cli('apply','decisions.json','--write').status,0);
 assert.equal((await f.read('research/next-release/workflow.json')).articles[0].state,'drafted');
 assert.notEqual(f.cli('review','reviews.json').status,0);
}));
