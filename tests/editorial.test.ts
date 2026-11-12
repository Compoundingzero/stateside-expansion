import test from 'node:test';
import assert from 'node:assert/strict';
import {dependencyImpact,sourceObservation} from '../scripts/check-sources.mjs';

test('a changed source identifies dependent guide and tool paths without changing reviewed records',()=>{
 const fixture={guides:[{id:'guide-a',path:'/us-expansion/a/',sourceIds:[],ruleIds:['rule-a'],status:'published',lastReviewed:'2026-11-01',sections:[{heading:'Reviewed answer',paragraphs:['Preserve this interpretation.']}]},{id:'guide-b',path:'/states/b/',sourceIds:['source-b'],ruleIds:[]}],rules:[{id:'rule-a',sourceIds:['source-a'],dependentPaths:['/us-expansion/a/','/tools/example/']}],tools:[{id:'tool-a',path:'/tools/example/',ruleIds:['rule-a'],sourceIds:[]},{id:'tool-b',path:'/tools/direct/',ruleIds:[],sourceIds:['source-a']}]};
 const before=JSON.stringify(fixture);
 const deps=dependencyImpact('source-a',fixture);
 assert.deepEqual(deps.ruleIds,['rule-a']);
 assert.deepEqual(new Set(deps.paths),new Set(['/us-expansion/a/','/tools/example/','/tools/direct/']));
 assert.deepEqual(new Set(deps.tools),new Set(['/tools/example/','/tools/direct/']));
 const source={id:'source-a',substantiveVerifiedAt:'2026-11-01'};
 const result=sourceObservation({source,prior:{hash:'old-hash'},current:{hash:'new-hash',url:'https://example.gov/rule'},fetchedAt:'2026-11-12T12:00:00Z',dependencies:deps});
 assert.equal(result.result,'changed');
 assert.equal(result.substantiveVerifiedAt,'2026-11-01');
 assert.equal(result.fetchedAt,'2026-11-12T12:00:00Z');
 assert.equal(JSON.stringify(fixture),before);
 assert.equal(fixture.guides[0].lastReviewed,'2026-11-01');
});

test('first fetch establishes a technical baseline without inventing substantive review',()=>{
 const result=sourceObservation({source:{id:'unreviewed-source',substantiveVerifiedAt:null},current:{hash:'first-hash'},fetchedAt:'2026-11-12',dependencies:{ruleIds:[],paths:[],tools:[]}});
 assert.equal(result.result,'baseline-established');assert.equal(result.substantiveVerifiedAt,null);
 assert.equal(sourceObservation({source:{id:'reviewed',substantiveVerifiedAt:'2026-11-01'},prior:{hash:'same'},current:{hash:'same'},fetchedAt:'2026-11-12',dependencies:{}}).result,'unchanged');
 assert.deepEqual(dependencyImpact('unknown-source',{guides:[],rules:[],tools:[]}),{ruleIds:[],paths:[],tools:[]});
});

import {extractSourceText,retrievalFailureKind,reviewMarkdown} from '../scripts/source-text.mjs';
test('an empty first main landmark does not hide the actual official article',()=>{
 const sentence='Businesses must register within 30 days after commencing business.';
 const html='<html><body><main aria-label="empty landmark"></main><article><h1>Register a business</h1><p>'+sentence+'</p><p>Prepare the actual entity, address and activity information before registration.</p></article><script>throw Error("not source text")</script></body></html>';
 const result=extractSourceText(html,sentence);
 assert.equal(result.supportingPassagePresent,true);assert.equal(result.selector,'article');assert.ok(!result.text.includes('throw Error'));
});
test('HTML entity differences preserve a supporting passage but missing text stays unresolved',()=>{
 const html='<body><main><h1>Official guidance</h1><p>Partners &amp; operators should retain “dated” records.</p><p>This page explains a narrow operational process and does not establish all applicable obligations.</p></main></body>';
 assert.equal(extractSourceText(html,'Partners & operators should retain "dated" records.').supportingPassagePresent,true);
 assert.equal(extractSourceText(html,'A different substantive deadline that disappeared.').supportingPassagePresent,false);
 assert.throws(()=>extractSourceText('<html><body>Access denied</body></html>'),/readable/);
});
test('normalizer migration does not pretend a source changed its law or review date',()=>{
 const result=sourceObservation({source:{id:'a',substantiveVerifiedAt:'2026-11-01'},prior:{hash:'old'},current:{hash:'new',normalizationVersion:2},fetchedAt:'2026-11-12',dependencies:{}});
 assert.equal(result.result,'baseline-migrated');assert.equal(result.substantiveVerifiedAt,'2026-11-01');
});
test('readable review reports distinguish access issues from content changes and escape table data',()=>{
 assert.equal(retrievalFailureKind(Error('HTTP 403')),'access-blocked');assert.equal(retrievalFailureKind(Error('The operation was aborted due to timeout')),'timeout');
 const report=reviewMarkdown({runAt:'2026-11-12',results:[{sourceId:'agency|one',result:'fetch-failed',error:'HTTP 403',paths:['/states/example/']},{sourceId:'agency-two',result:'changed',paths:['/tools/example/']}],queue:[{status:'needs-review'},{status:'resolved'}]});
 assert.ok(report.includes('1 retrieval issues; 1 content-hash changes; 1 open review items'));assert.ok(report.includes('agency\\|one'));assert.ok(report.includes('/tools/example/'));assert.ok(report.includes('substantive review dates are preserved'));
});

import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
test('an explicit queue resolution retains evidence and does not refresh legal verification',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'stateside-review-'));
 try{
  const issue={id:'test-issue',sourceId:'agency',status:'needs-review',substantiveVerifiedAt:'2026-10-01',reason:'source-content-changed'};
  await writeFile(join(directory,'editorial-review-queue.json'),JSON.stringify([issue]));
  await promisify(execFile)(process.execPath,[resolve('scripts/editorial.mjs'),'resolve-source','test-issue','--reviewer','AI-assisted-test','--date','2026-11-12','--evidence','Fixture comparison against retained reviewed source','--decision','not-a-source-change','--review-complete'],{env:{...process.env,SOURCE_REVIEW_DIRECTORY:directory}});
  const [resolved]=JSON.parse(await readFile(join(directory,'editorial-review-queue.json'),'utf8'));
  assert.equal(resolved.status,'resolved');assert.equal(resolved.substantiveVerifiedAt,'2026-10-01');assert.equal(resolved.resolution.publicContentChanged,false);assert.ok(resolved.resolution.evidence);
 }finally{await rm(directory,{recursive:true,force:true})}
});
