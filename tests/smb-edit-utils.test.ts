import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {editorialHash, sectionText, teachingSections} from '../scripts/smb-edit-utils.mjs';

const applyScript=fileURLToPath(new URL('../scripts/apply-smb-edit.mjs',import.meta.url));
const workflowScript=fileURLToPath(new URL('../scripts/smb-workflow.mjs',import.meta.url));
const original=()=>({
  id:'fixture-guide',path:'/us-expansion/fixture/',status:'published',dataset:'src/data/fixture-guides.json',
  family:'decision',topic:'commercial-feasibility',jurisdictions:['Federal'],nextStage:1,
  title:'Old title',seoTitle:'Old search title',description:'Old description',learningSummary:'Old answer.',
  keyTerms:[],sections:[
    {id:'old-main',heading:'Old main',paragraphs:['An old explanation.'],sourceIds:['source-a']},
    {id:'old-extra',heading:'Old extra',paragraphs:['A material qualification.'],sourceIds:['source-a']},
  ],
  practicalOutput:'An old next step.',limitations:['A narrow test scope.'],readMinutes:2,
  relatedPaths:[],learningPath:'decision',lastReviewed:'2026-11-12',reviewStatus:'Test fixture',
  sourceIds:['source-a'],ruleIds:['rule-a'],contentModifiedAt:'2026-11-12T00:00:00Z',
});
const patch=()=>({id:'fixture-guide',path:'/us-expansion/fixture/',learningSummary:'A new direct answer.',
  sections:[{id:'owner-answer',heading:'What the owner needs to decide',paragraphs:['A shorter explanation that retains the material qualification.'],sourceIds:['source-b'],aliases:['old-main','section-0']}],
  editNote:'Replace repeated preparation instructions with one decision and retain its qualification.',
  conditionsRetained:['The material qualification and narrow scope remain.'],
});
type Fixture={directory:string;write:(path:string,data:unknown)=>Promise<void>;read:(path:string)=>Promise<any>;run:(script:string,args:string[])=>ReturnType<typeof spawnSync>};
async function fixture(run:(fixture:Fixture)=>Promise<void>){
  const directory=await mkdtemp(join(tmpdir(),'eln-smb-workflow-'));
  const write=async(path:string,data:unknown)=>writeFile(join(directory,path),JSON.stringify(data,null,2)+'\n');
  const read=async(path:string)=>JSON.parse(await readFile(join(directory,path),'utf8'));
  try{
    await mkdir(join(directory,'src/data'),{recursive:true});
    await mkdir(join(directory,'research/smb-edit'),{recursive:true});
    const guide=original(),hash=editorialHash(guide);
    await write('src/data/fixture-guides.json',[guide]);
    await write('src/data/fixture-rules.json',[{id:'rule-a',sourceIds:['source-b']}]);
    await write('src/data/tool-definitions.json',[{path:'/tools/cash-runway/'}]);
    await write('research/smb-edit/input.json',[guide]);
    await write('research/smb-edit/fragments.json',[{id:guide.id,sections:[
      {heading:'Old main',semanticId:'old-main',legacyId:'section-0',sourceIds:['source-a']},
      {heading:'Old extra',semanticId:'old-extra',legacyId:'section-1',sourceIds:['source-a']},
    ]}]);
    await write('research/smb-edit/workflow.json',{articles:[{id:guide.id,state:'independently-reviewed',contentHash:hash,reviewedHash:hash,review:{notes:'An old review.'}}]});
    await write('research/smb-edit/fixture-patches.json',[patch()]);
    await run({directory,write,read,run:(script,args)=>spawnSync(process.execPath,[script,...args],{cwd:directory,encoding:'utf8'})});
  }finally{await rm(directory,{recursive:true,force:true});}
}
const success=(result:ReturnType<typeof spawnSync>)=>assert.equal(result.status,0,String(result.stderr));

test('review hashes bind the visible explanation, including tables, while ignoring bookmark and source-review metadata',()=>{
  const guide=original(),hash=editorialHash(guide);
  const bookmarkChange=structuredClone(guide);
  Object.assign(bookmarkChange.sections[0],{aliases:['old-bookmark'],legacyIndex:7});
  Object.assign(bookmarkChange,{lastReviewed:'2026-11-13',contentModifiedAt:'2026-11-14T00:00:00Z',reviewStatus:'Another review'});
  assert.equal(editorialHash(bookmarkChange),hash);
  const bodyChange=structuredClone(guide);bodyChange.sections[0].paragraphs[0]='Different advice.';
  assert.notEqual(editorialHash(bodyChange),hash);
  const withTable={...guide,sections:[{...guide.sections[0],table:{headers:['Account'],rows:[['Withholding']]}}]};
  const tableChange=structuredClone(withTable);tableChange.sections[0].table.rows[0][0]='Unemployment insurance';
  assert.notEqual(editorialHash(withTable),editorialHash(tableChange));
});

test('teaching extraction retains useful text and evidence associations without mutating sections',()=>{
  const sections=[{id:'answer',heading:'An answer',paragraphs:['A paragraph.'],bullets:['A condition.'],table:{headers:['State','Clock'],rows:[['Example','10 business days']]},sourceIds:['source-a'],aliases:['section-0'],legacyIndex:0}];
  const before=structuredClone(sections),teaching=teachingSections(sections);
  assert.deepEqual(sections,before);
  assert.ok(!('aliases' in teaching[0])&&!('legacyIndex' in teaching[0]));
  assert.deepEqual(teaching[0].sourceIds,['source-a']);
  const text=sectionText({sections});
  for(const value of ['An answer','A paragraph.','A condition.','State Clock','Example 10 business days'])assert.ok(text.includes(value));
  assert.ok(!text.includes('source-a')&&!text.includes('section-0'));
});

test('dry-run changes no files; applying preserves source dates, restores old fragments and invalidates stale review',async()=>fixture(async f=>{
  const dataBefore=await readFile(join(f.directory,'src/data/fixture-guides.json'),'utf8');
  const ledgerBefore=await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8');
  success(f.run(applyScript,['fixture']));
  assert.equal(await readFile(join(f.directory,'src/data/fixture-guides.json'),'utf8'),dataBefore);
  assert.equal(await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8'),ledgerBefore);
  success(f.run(applyScript,['fixture','--apply']));
  const [guide]=await f.read('src/data/fixture-guides.json');
  for(const key of ['path','lastReviewed','reviewStatus','sourceIds','ruleIds','status'])assert.deepEqual(guide[key],original()[key as keyof ReturnType<typeof original>]);
  assert.ok(Number.isFinite(Date.parse(guide.contentModifiedAt)));
  assert.notEqual(guide.contentModifiedAt,original().contentModifiedAt);
  assert.deepEqual(new Set(guide.sections[0].aliases),new Set(['old-main','section-0','old-extra','section-1']));
  const entry=(await f.read('research/smb-edit/workflow.json')).articles[0];
  assert.equal(entry.state,'drafted');assert.equal(entry.contentHash,editorialHash(guide));
  assert.ok(!('reviewedHash' in entry)&&!('review' in entry));
}));

test('protected metadata, unsupported sources, metadata-only edits and alias conflicts fail without writes',async()=>{
  const invalid=[
    {...patch(),lastReviewed:'2099-01-01'},
    {...patch(),sections:[{...patch().sections[0],sourceIds:['unresearched-source']}]},
    {...patch(),learningSummary:original().learningSummary,sections:original().sections,title:'Only a new title'},
    {...patch(),sections:[{...patch().sections[0],aliases:['sources']}]},
  ];
  for(const candidate of invalid)await fixture(async f=>{
    await f.write('research/smb-edit/fixture-patches.json',[candidate]);
    const before=await readFile(join(f.directory,'src/data/fixture-guides.json'),'utf8');
    const ledger=await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8');
    const result=f.run(applyScript,['fixture','--apply']);
    assert.notEqual(result.status,0,'An unsafe patch should be rejected');
    assert.equal(await readFile(join(f.directory,'src/data/fixture-guides.json'),'utf8'),before);
    assert.equal(await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8'),ledger);
  });
});

test('a bad second patch prevents the whole batch from being partially written',async()=>fixture(async f=>{
  await f.write('research/smb-edit/fixture-patches.json',[patch(),patch()]);
  const before=await readFile(join(f.directory,'src/data/fixture-guides.json'),'utf8');
  const ledger=await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8');
  const result=f.run(applyScript,['fixture','--apply']);
  assert.notEqual(result.status,0);assert.match(String(result.stderr),/invalid\/duplicate identity/);
  assert.equal(await readFile(join(f.directory,'src/data/fixture-guides.json'),'utf8'),before);
  assert.equal(await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8'),ledger);
}));

test('independent approvals are hash-bound and a changed body cannot reuse the prior approval',async()=>fixture(async f=>{
  success(f.run(applyScript,['fixture','--apply']));
  const [guide]=await f.read('src/data/fixture-guides.json'),reviewedHash=editorialHash(guide);
  await f.write('review.json',[{id:guide.id,reviewedHash,decision:'approved',notes:'Read the rewritten answer and checked its retained scope.',reviewer:'fixture-reviewer'}]);
  success(f.run(workflowScript,['review','review.json']));
  assert.equal((await f.read('research/smb-edit/workflow.json')).articles[0].state,'independently-reviewed');
  guide.sections[0].paragraphs[0]='An explanation changed after review.';
  await f.write('src/data/fixture-guides.json',[guide]);
  const before=await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8');
  const stale=f.run(workflowScript,['review','review.json']);
  assert.notEqual(stale.status,0);assert.match(String(stale.stderr),/does not match the current article/);
  assert.equal(await readFile(join(f.directory,'research/smb-edit/workflow.json'),'utf8'),before);
  await f.write('review.json',[{id:guide.id,reviewedHash:editorialHash(guide),decision:'revise',notes:'The revised sentence needs another scope check.',reviewer:'fixture-reviewer'}]);
  success(f.run(workflowScript,['review','review.json']));
  assert.equal((await f.read('research/smb-edit/workflow.json')).articles[0].state,'revision-needed');
}));
