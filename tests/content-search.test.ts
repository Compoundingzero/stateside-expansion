import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesContentQuery} from '../src/lib/content-search';

test('public content search finds all query terms across a title and purpose in any order',()=>{
 const publicText='Before rejecting an applicant because of a background report. Give the applicant the report and rights notice before the final decision.';
 assert.equal(matchesContentQuery(publicText,'applicant rights'),true);
 assert.equal(matchesContentQuery(publicText,'rights applicant'),true);
 assert.equal(matchesContentQuery(publicText,'applicant payroll'),false);
 assert.equal(matchesContentQuery(publicText,'  '),true);
 assert.equal(matchesContentQuery(publicText,'---'),false);
});
test('search normalizes ordinary spelling and punctuation without inventing an answer',()=>{
 assert.equal(matchesContentQuery('Franchising versus licensing','licence'),true);
 assert.equal(matchesContentQuery('A licence for your business','license'),true);
 assert.equal(matchesContentQuery('Côte d’Ivoire: cash flow','cote cash'),true);
 assert.equal(matchesContentQuery('FDD Item 19: earnings claims','item19'),true);
 assert.equal(matchesContentQuery('I-9 employment verification','I9'),true);
 assert.equal(matchesContentQuery('FDD Item 19: earnings claims','I-9'),false);
 assert.equal(matchesContentQuery('Business planning in Australia','US'),false);
 assert.equal(matchesContentQuery('US unit economics','US'),true);
 assert.equal(matchesContentQuery('U.S. payroll registration','US payroll'),true);
 assert.equal(matchesContentQuery('U.S.-based employees and payroll','US payroll'),true);
 assert.equal(matchesContentQuery('U.S. payroll registration','U.S. payroll'),true);
 assert.equal(matchesContentQuery('Australian payroll registration','US payroll'),false);
});
