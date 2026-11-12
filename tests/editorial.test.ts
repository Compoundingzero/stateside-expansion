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
