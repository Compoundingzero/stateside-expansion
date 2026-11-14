import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {createLearningCatalog,emptyLearning,restoreLearning,updateLearningItem,solveLearningChallenge,learningStats,checkLearningAnswer,pathItems,pathSteps,isLearningChallengeSolved} from '../src/lib/learning';
import {versionLearningChallenges} from '../src/lib/learning-build';
import {learningPaths,learningChallenges} from '../src/data/learning-paths';

const files=await readdir('src/data');
const records=async(suffix:string)=>(await Promise.all(files.filter(file=>file.endsWith(suffix)).map(async file=>JSON.parse(await readFile('src/data/'+file,'utf8'))))).flat();
const [guides,sources,rules]=await Promise.all([records('guides.json'),records('sources.json'),records('rules.json')]);
const toolDefinitions=JSON.parse(await readFile('src/data/tool-definitions.json','utf8'));
const tools=toolDefinitions.map((tool:any)=>({mode:tool.id,slug:tool.path.split('/').filter(Boolean).at(-1),name:tool.id,stage:3}));
const items=createLearningCatalog(guides,tools),challenges=await versionLearningChallenges(learningChallenges,guides,sources,rules);

test('every published old or new guide and every tool is reachable in learning without gating',async()=>{
 const published=guides.filter(guide=>guide.status==='published');
 assert.equal(items.filter(item=>item.type==='guide').length,published.length);
 assert.equal(items.filter(item=>item.type==='tool').length,toolDefinitions.length);
 assert.equal(new Set(items.map(item=>item.key)).size,items.length);
 const original=JSON.parse(await readFile('research/smb-edit/input.json','utf8'));
 assert.equal(original.length,278);for(const guide of original)assert.ok(items.some(item=>item.id===guide.id&&item.path===guide.path));
 for(const item of items)assert.ok(learningPaths.some(path=>pathItems(path,items).some(member=>member.key===item.key)),'No learning route for '+item.path);
 const expanded=createLearningCatalog([...guides,{id:'future-guide',path:'/new-guide/',title:'Future guide',status:'published',topic:'employment',family:'federal'}],tools);
 assert.ok(pathItems(learningPaths.find(path=>path.id==='people')!,expanded).some(item=>item.id==='future-guide'));
 assert.ok(!items.some(item=>item.path.startsWith('/owner/')||item.path.startsWith('/api/')));
});

test('curated paths and practice cite existing content and primary sources associated with that content',async()=>{
 assert.equal(learningPaths.length,8);assert.equal(challenges.length,14);
 for(const path of learningPaths){assert.equal(pathSteps(path,items).length,path.steps.length);for(const id of path.challengeIds)assert.ok(challenges.some(challenge=>challenge.id===id));}
 for(const challenge of challenges){assert.match(challenge.version!,/^[a-f0-9]{64}$/);assert.ok(challenge.fictional);assert.ok(challenge.sourceIds.length);for(const id of challenge.sourceIds)assert.ok(sources.some(source=>source.id===id&&['primary','official-guidance'].includes(source.type)));}
 await assert.rejects(()=>versionLearningChallenges([{...learningChallenges[0],sourceIds:['fed-irs-5472']}],guides,sources,rules),/cited by a dependent guide/);
});

test('activity XP is idempotent and only current content and current challenge versions count',()=>{
 const item=items.find(item=>item.type==='guide')!,challenge=challenges[0];let progress=emptyLearning();
 progress=updateLearningItem(progress,item.key,{status:'complete'});progress=updateLearningItem(progress,item.key,{status:'complete'});
 assert.equal(learningStats(progress,items,learningPaths,challenges).xp,10);
 progress=solveLearningChallenge(progress,challenge.id,challenge.version!);progress=solveLearningChallenge(progress,challenge.id,challenge.version!);
 assert.equal(learningStats(progress,items,learningPaths,challenges).xp,30);
 progress=updateLearningItem(progress,item.key,{status:'not-started'});progress=updateLearningItem(progress,item.key,{status:'complete'});
 assert.equal(learningStats(progress,items,learningPaths,challenges).xp,30);
 const changed=challenges.map(c=>c.id===challenge.id?{...c,version:'a'.repeat(64)===c.version?'b'.repeat(64):'a'.repeat(64)}:c);
 assert.equal(learningStats(progress,items,learningPaths,changed).xp,10);
 assert.equal(isLearningChallengeSolved(progress,changed[0]),false);
 progress=solveLearningChallenge(progress,changed[0].id,changed[0].version!);assert.equal(learningStats(progress,items,learningPaths,changed).xp,30);
 assert.equal(learningStats(progress,[],learningPaths,[]).xp,0);
});

test('actual article, legal and evidence changes invalidate mastery; administrative review timestamps do not',async()=>{
 const definition=learningChallenges[0],base=(await versionLearningChallenges([definition],guides,sources,rules))[0].version;
 const reviewOnly=(record:any)=>({...record,fetchedAt:'2099-01-01T00:00:00Z',nextReview:'2099-02-01',substantiveVerifiedAt:'2099-01-01',verifiedAt:'2099-01-01',retrievalReviewedAt:'2099-01-01T00:00:00Z'});
 assert.equal((await versionLearningChallenges([definition],guides,sources.map(reviewOnly),rules.map(reviewOnly)))[0].version,base);
 const changedArticle=guides.map(guide=>guide.path===definition.guidePaths[0]?{...guide,contentModifiedAt:'2026-11-15T00:00:00Z'}:guide);
 assert.notEqual((await versionLearningChallenges([definition],changedArticle,sources,rules))[0].version,base);
 for(const field of ['supportingPassage','contentHash','rawHash','legalStatus','section','notes','reviewerStatus','publicationDate','effectiveDate']){
  const changed=sources.map(source=>source.id===definition.sourceIds[0]?{...source,[field]:'changed substantive '+field}:source);
  assert.notEqual((await versionLearningChallenges([definition],guides,changed,rules))[0].version,base,'Source '+field+' must invalidate mastery');
 }
 const ruleId=guides.find(guide=>guide.path===definition.guidePaths[0]).ruleIds[0];
 for(const field of ['requirement','exceptions','deadline','legalStatus','reviewerStatus']){
  const changed=rules.map(rule=>rule.id===ruleId?{...rule,[field]:'changed substantive '+field}:rule);
  assert.notEqual((await versionLearningChallenges([definition],guides,sources,changed))[0].version,base,'Rule '+field+' must invalidate mastery');
 }
 assert.notEqual((await versionLearningChallenges([{...definition,explanation:'A revised explanation.'}],guides,sources,rules))[0].version,base);
});

test('zero is a real answer, blank and malformed numbers are unknown, and choice feedback explains the distinction',()=>{
 const calculation=challenges.find(challenge=>challenge.id==='manager-remainder')!;
 assert.deepEqual(checkLearningAnswer(calculation,''),{answered:false,correct:false,feedback:'Enter a number before checking. A blank answer is not zero.'});
 assert.equal(checkLearningAnswer(calculation,'0').correct,true);assert.equal(checkLearningAnswer(calculation,'000').correct,true);
 for(const value of ['NaN','1e100','0 USD','Infinity','0,000'])assert.equal(checkLearningAnswer(calculation,value).answered,false);
 const wrong=checkLearningAnswer(challenges[0],'label');assert.equal(wrong.correct,false);assert.match(wrong.feedback,/actual/);
});

test('restoring progress ignores forged scores, private text, unknown identifiers and corrupt shapes',()=>{
 const item=items[0],challenge=challenges[0];
 const restored=restoreLearning({version:1,xp:999999,name:'Do not retain',items:{[item.key]:{status:'complete',bookmarked:true,notes:'private'},'guide:unknown':{status:'complete'},'email@example.invalid':{status:'complete'}},solved:{[challenge.id]:challenge.version,'not-a-challenge':'b'.repeat(64)},activePath:'unknown',lastItem:'email@example.invalid'},{items:new Set(items.map(item=>item.key)),challenges:new Set(challenges.map(challenge=>challenge.id)),paths:new Set(learningPaths.map(path=>path.id))});
 assert.deepEqual(Object.keys(restored.items),[item.key]);assert.deepEqual(Object.keys(restored.solved),[challenge.id]);
 assert.equal(restored.activePath,'model-offer');assert.equal(restored.lastItem,null);assert.ok(!JSON.stringify(restored).includes('private'));assert.ok(!('xp' in restored));
 for(const input of [null,[],{},'bad',{version:2,items:{}},{version:1,items:[],solved:['old-unversioned-id']}])assert.deepEqual(restoreLearning(input),emptyLearning());
});
