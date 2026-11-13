import test from 'node:test';
import assert from 'node:assert/strict';
import {dependencyImpact,sourceObservation,configureSourceProxy,cacheSuccessfulPromise,failedResponseEvidence,loadSourceReviewState} from '../scripts/check-sources.mjs';

test('source review explicitly uses an inherited proxy without inventing one for direct environments',()=>{
 const calls:any[]=[];const configure=(env:any)=>calls.push(env);
 assert.equal(configureSourceProxy({env:{},configure}),'direct');assert.equal(calls.length,0);
 const env={HTTPS_PROXY:'http://public-proxy.example:8080',NO_PROXY:'example.gov'};
 assert.equal(configureSourceProxy({env,configure}),'inherited-environment-proxy');assert.deepEqual(calls,[env]);
});
test('a rejected shared metadata request is retried rather than poisoning later sources',async()=>{
 let attempts=0;
 const titles=cacheSuccessfulPromise(async()=>{attempts++;if(attempts===1)throw Error('HTTP503 upstream connection failure');return [{number:16,up_to_date_as_of:'2026-11-10'}];});
 const first=await Promise.allSettled([titles(),titles()]);assert.ok(first.every(r=>r.status==='rejected'));assert.equal(attempts,1);
 assert.deepEqual(await titles(),[{number:16,up_to_date_as_of:'2026-11-10'}]);assert.equal(attempts,2);
 await titles();assert.equal(attempts,2);
});
test('a 503 security challenge is distinguished from a transient upstream failure with bounded evidence',async()=>{
 const challenge=await failedResponseEvidence(new Response('<title>Security Check</title><p>You must confirm that you are human.</p>',{status:503,headers:{server:'envoy','set-cookie':'not-retained'}}),'https://agency.gov/law');
 assert.equal(challenge.observation.accessInterstitial,true);assert.ok(challenge.observation.bodyPreview.includes('Security Check'));assert.equal(challenge.observation.headers['set-cookie'],undefined);
 const upstream=await failedResponseEvidence(new Response('upstream connect error or disconnect before headers; remote connection failure',{status:503}),'https://agency.gov/law');
 assert.equal(upstream.observation.accessInterstitial,false);assert.ok(upstream.observation.bodyPreview.includes('remote connection failure'));
 const large=await failedResponseEvidence(new Response('x'.repeat(100000),{status:503}),'https://agency.gov/law');assert.equal(large.body.length,65536);assert.equal(large.observation.bodyPreview.length,4096);
});

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
test('named typographic entities match real source punctuation without masking changed words',()=>{
 const sentence='These are state and county taxes that are withheld from your employees’ wages.';
 const encoded='<body><main><h1>Withholding</h1><p>These are state and county taxes that are withheld from your employees&rsquo; wages.</p><p>Report them under &ldquo;Turnover taxable at zero VAT rate&rdquo;.</p></main></body>';
 assert.equal(extractSourceText(encoded,sentence).supportingPassagePresent,true);
 assert.equal(extractSourceText(encoded,'Report them under “Turnover taxable at zero VAT rate”.').supportingPassagePresent,true);
 assert.equal(extractSourceText(encoded.replace('state and county','federal'),sentence).supportingPassagePresent,false);
 assert.notEqual(extractSourceText(encoded,sentence).hash,extractSourceText(encoded.replace('state and county','federal'),sentence).hash);
});
test('published Nuxt table cells preserve qualifications while unrelated script/config text is excluded',()=>{
 const data=[{headerColumns:1,bodyRows:4,trackingText:14},[2],{cellContent:3},[5],[[6,8]],{text:7}, {cellContent:9},'<p>Destination</p>',{cellContent:10},[11],[12],{text:13},{text:15},'<p>United States</p>','ignore configuration string','<p>Only organisations certified under the named framework qualify.</p>'];
 // Nuxt tables contain arrays of references, rather than nested JSON row data.
 data[4]=[16];data.push([6,8]);
 const page='<body><main><h1>Official adequacy guidance</h1><p>The binding list below has qualifications and must be read together with the named safeguards and applicable law.</p></main><script type="application/json" id="__NUXT_DATA__">'+JSON.stringify(data)+'</script><script>Only organisations are always approved without conditions.</script></body>';
 const quote='Only organisations certified under the named framework qualify.';
 const result=extractSourceText(page,quote);
 assert.equal(result.supportingPassagePresent,true);assert.ok(result.text.includes('United States'));assert.ok(result.text.includes('binding list'));
 assert.ok(!result.text.includes('ignore configuration'));assert.ok(!result.text.includes('always approved'));
 assert.equal(extractSourceText(page.replace('certified under','excluded from'),quote).supportingPassagePresent,false);
 assert.notEqual(result.hash,extractSourceText(page.replace('certified under','excluded from'),quote).hash);
 assert.equal(extractSourceText(page.replace('application/json','text/javascript'),quote).supportingPassagePresent,false);
});
test('normalizer migration does not pretend a source changed its law or review date',()=>{
 const result=sourceObservation({source:{id:'a',substantiveVerifiedAt:'2026-11-01'},prior:{hash:'old'},current:{hash:'new',normalizationVersion:2},fetchedAt:'2026-11-12',dependencies:{}});
 assert.equal(result.result,'baseline-migrated');assert.equal(result.substantiveVerifiedAt,'2026-11-01');assert.equal(result.normalizationAuditRequired,true);
});
test('release migration audit binds exact versions and hashes and does not approve an older hosted cache',()=>{
 const fixture={source:{id:'a',substantiveVerifiedAt:'2026-11-01'},prior:{hash:'old',normalizationVersion:4},current:{hash:'new',normalizationVersion:5},fetchedAt:'2026-11-13',dependencies:{}};
 const normalizationAudits=[{sourceId:'a',fromVersion:4,toVersion:5,previousHash:'old',currentHash:'new',matchesPrior:true}];
 assert.equal(sourceObservation({...fixture,normalizationAudits}).normalizationAuditRequired,false);
 assert.equal(sourceObservation({...fixture,prior:{...fixture.prior,normalizationVersion:2},normalizationAudits}).normalizationAuditRequired,true);
 assert.equal(sourceObservation({...fixture,current:{...fixture.current,hash:'changed-source'},normalizationAudits}).normalizationAuditRequired,true);
 assert.equal(sourceObservation({...fixture,current:{...fixture.current,hash:'old'}}).normalizationComparison,'identical-normalized-hash');
 const summary=publicSourceReviewSummary({runAt:'2026-11-13',results:[sourceObservation({...fixture,prior:{...fixture.prior,normalizationVersion:2},normalizationAudits})],queue:[]});
 assert.equal(summary.normalizationMigrationsRequiringAudit,1);
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
test('missing source cache can start fresh but malformed retained state cannot erase unresolved history',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'stateside-retained-source-state-'));
 try{
  assert.deepEqual(await loadSourceReviewState(directory),{baseline:{},queue:[]});
  await writeFile(join(directory,'editorial-review-queue.json'),'[{invalid');
  await assert.rejects(loadSourceReviewState(directory),/Cannot read retained source-review state/);
  await writeFile(join(directory,'editorial-review-queue.json'),JSON.stringify([{id:'pending',sourceId:'agency',reason:'source-content-changed',status:'needs-review'}]));
  const retained=await loadSourceReviewState(directory);assert.equal(retained.queue[0].id,'pending');
  await writeFile(join(directory,'source-baseline.json'),'[]');await assert.rejects(loadSourceReviewState(directory),/baseline must be an object/);
  await writeFile(join(directory,'source-baseline.json'),'{}');await writeFile(join(directory,'editorial-review-queue.json'),'{}');await assert.rejects(loadSourceReviewState(directory),/queue must contain issue records/);
 }finally{await rm(directory,{recursive:true,force:true})}
});
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

import {validateSourceURL,isNonPublicAddress,officialFullTextRoute,isOfficialReservedECFRPart,officialRISQuery,officialRISDocument,sourceSizeLimit,HTML_SOURCE_LIMIT,PDF_SOURCE_LIMIT} from '../scripts/check-sources.mjs';
import {isAccessInterstitial} from '../scripts/source-text.mjs';
test('Federal Register access pages never become accepted primary-source evidence',()=>{
 const html='<html><body><h1>Request Access</h1><p>Due to aggressive automated scraping of FederalRegister.gov and eCFR.gov, programmatic access to these sites is limited to access to our extensive developer APIs.</p><p>Please complete the CAPTCHA and click Request Access.</p></body></html>';
 assert.equal(isAccessInterstitial(html),true);
 assert.equal(isAccessInterstitial('<html><body>A different body</body></html>','https://unblock.federalregister.gov/'),true);
 assert.throws(()=>extractSourceText(html,'at least 14 calendar-days'),/interstitial/);
 const source={id:'fed-timing',substantiveVerifiedAt:'2026-11-12'};
 const result=sourceObservation({source,prior:{url:'https://unblock.federalregister.gov/',hash:'captcha',normalizationVersion:2},current:{url:'https://www.ecfr.gov/api/versioner/v1/full/2026-11-10/title-16.xml?section=436.2',hash:'primary',normalizationVersion:3},fetchedAt:'2026-11-13',dependencies:{}});
 assert.equal(result.result,'baseline-recovered');assert.equal(result.previousBaselineIssue,'access-interstitial-not-primary-text');assert.equal(result.substantiveVerifiedAt,'2026-11-12');
});
test('proxy DNS exceptions are exact reviewed hosts and never permit known private addresses',async()=>{
 const missing=async()=>{throw Object.assign(Error('getaddrinfo ENOTFOUND'),{code:'ENOTFOUND'})};
 const privateAnswer=async()=>[{address:'127.0.0.1',family:4}];
 const publicAnswer=async()=>[{address:'8.8.8.8',family:4}];
 const accepted=await validateSourceURL('https://tradeinvest.tl/',{lookup:missing,proxy:true});
 assert.equal(accepted.dnsResolution,'reviewed-public-host-via-inherited-proxy');
 await assert.rejects(validateSourceURL('https://tradeinvest.tl/',{lookup:missing,proxy:false}),/ENOTFOUND/);
 await assert.rejects(validateSourceURL('https://unknown-source.gov/',{lookup:missing,proxy:true}),/ENOTFOUND/);
 await assert.rejects(validateSourceURL('https://tradeinvest.tl/',{lookup:privateAnswer,proxy:true}),/non-public/);
 for(const url of ['http://agency.gov/','https://127.0.0.1/','https://169.254.169.254/','https://[::1]/','https://user:pass@agency.gov/','https://agency.gov:8443/','https://metadata.internal/'])await assert.rejects(validateSourceURL(url,{lookup:publicAnswer,proxy:true}),/public HTTPS/);
 assert.equal((await validateSourceURL('https://agency.gov/rule',{lookup:publicAnswer,proxy:false})).dnsResolution,'public-local-dns');
 for(const address of ['10.1.2.3','172.31.0.1','192.168.1.1','100.64.0.1','198.18.0.1','fc00::1','fe80::1','ff02::1','::ffff:127.0.0.1'])assert.equal(isNonPublicAddress(address),true,address);
});
test('official API routes preserve source scope and historical dates without inventing currency',()=>{
 const titles=[{number:16,up_to_date_as_of:'2026-11-10'}];
 const current=officialFullTextRoute('https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-436/subpart-C/section-436.5#p-436.5(s)',titles);
 assert.equal(current.url,'https://www.ecfr.gov/api/versioner/v1/full/2026-11-10/title-16.xml?part=436&section=436.5');
 assert.equal(current.primaryTextAsOf,'2026-11-10');
 assert.ok(officialFullTextRoute('https://www.ecfr.gov/on/2025-07-01/title-16/part-436/section-436.5',titles).url.includes('/2025-07-01/'));
 const fr=officialFullTextRoute('https://www.federalregister.gov/documents/2026/08/14/2026-16576/example');
 assert.equal(fr.url,'https://www.federalregister.gov/documents/full_text/xml/2026/08/14/2026-16576.xml');
 assert.throws(()=>officialFullTextRoute('https://www.ecfr.gov/current/title-16/part-436/section-436.2',[]),/metadata/);
 assert.equal(sourceSizeLimit({type:'text/html',url:'https://agency.gov/title.htm'}),HTML_SOURCE_LIMIT);assert.equal(HTML_SOURCE_LIMIT,12*1024*1024);
 assert.equal(sourceSizeLimit({type:'application/pdf',url:'https://agency.gov/report'}),PDF_SOURCE_LIMIT);
});
test('a complete reserved eCFR part is valid short primary text without relaxing ordinary page checks',()=>{
 const xml='<?xml version="1.0"?><DIV5 N="791" TYPE="PART" VOLUME="3"><HEAD>PART 791 [RESERVED]\n</HEAD></DIV5>';
 const route={url:'https://www.ecfr.gov/api/versioner/v1/full/2026-11-10/title-29.xml?part=791',retrievalMethod:'official-ecfr-full-text-api'};
 assert.equal(isOfficialReservedECFRPart(xml,route),true);assert.throws(()=>extractSourceText(xml,'PART 791 [RESERVED]'),/Insufficient/);
 assert.equal(extractSourceText(xml,'PART 791 [RESERVED]',{minimumLength:12}).supportingPassagePresent,true);
 assert.equal(isOfficialReservedECFRPart(xml,{...route,url:route.url.replace('part=791','part=792')}),false);
 assert.equal(isOfficialReservedECFRPart(xml,{...route,retrievalMethod:'canonical-source'}),false);
 assert.equal(isOfficialReservedECFRPart(xml.replace('</DIV5>','<P>An operative rule now exists.</P></DIV5>'),route),false);
 assert.equal(isOfficialReservedECFRPart('<html><body>PART 791 [RESERVED]</body></html>',route),false);
});
test('the advertised RIS API route binds the actual XML to the requested law, paragraph and date',()=>{
 const raw='https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004873&Paragraf=3a';
 const query=officialRISQuery(raw,'2026-11-13');assert.equal(new URL(query.url).searchParams.get('Fassung.FassungVom'),'2026-11-13');
 const historic=officialRISQuery(raw+'&FassungVom=2025-01-01','2026-11-13');assert.equal(historic.asOf,'2025-01-01');
 const data={Metadaten:{Technisch:{ID:'NOR40263525',Applikation:'BrKons'},Bundesrecht:{BrKons:{Gesetzesnummer:'10004873',Paragraphnummer:'3',Paragraphbuchstabe:'a'}}},Dokumentliste:{ContentReference:{Urls:{ContentUrl:[{DataType:'Xml',Url:'https://ogd.ris.bka.gv.at/Dokumente/Bundesnormen/NOR40263525/NOR40263525.xml'}]}}}};
 const payload={OgdSearchResult:{OgdDocumentResults:{Hits:{'#text':'1'},OgdDocumentReference:{Data:data}}}};
 assert.equal(officialRISDocument(payload,query).primaryTextAsOf,'2026-11-13');
 assert.equal(officialRISDocument(payload,query).primaryDocumentId,'NOR40263525');
 assert.throws(()=>officialRISDocument(payload,{...query,law:'10000000'}),/does not match/);
 const bad=structuredClone(payload);bad.OgdSearchResult.OgdDocumentResults.OgdDocumentReference.Data.Dokumentliste.ContentReference.Urls.ContentUrl[0].Url='https://127.0.0.1/private.xml';
 assert.throws(()=>officialRISDocument(bad,query),/scoped official/);
 assert.equal(officialRISQuery('https://unrelated.gov/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004873&Paragraf=3a'),null);
 assert.throws(()=>officialRISQuery(raw.replace('https:','http:')),/public HTTPS/);
 assert.throws(()=>officialRISQuery(raw.replace('https://','https://user:secret@')),/credentials/);
});

import {applyRecordedSourceResolutions} from '../scripts/check-sources.mjs';
test('checked-in resolutions match only reviewed issue instances and preserve new occurrences',()=>{
 const queue=[{id:'old-instance',sourceId:'agency',reason:'supporting-passage-not-found',observedHash:'captcha-hash',status:'needs-review',createdAt:'2026-11-12T12:00:00Z',substantiveVerifiedAt:'2026-11-01'},
  {id:'new-instance',sourceId:'agency',reason:'supporting-passage-not-found',observedHash:'real-new-hash',status:'needs-review'}];
 const decision={issueId:'old-instance',sourceId:'agency',reason:'supporting-passage-not-found',observedHash:'captcha-hash',reviewer:'AI-assisted source review',reviewedAt:'2026-11-13T00:30:00Z',evidence:'research/batch3/editorial-review.json#agency',decision:'not-a-source-change',reviewComplete:true};
 const applied=applyRecordedSourceResolutions(queue,[decision]);
 assert.equal(applied[0].status,'resolved');assert.equal(applied[1].status,'needs-review');assert.equal(queue[0].status,'needs-review');
 assert.equal(applied[0].substantiveVerifiedAt,'2026-11-01');assert.equal(applied[0].resolution.substantiveVerificationChanged,false);
 assert.equal(applyRecordedSourceResolutions([{...queue[0],observedHash:'different'}],[decision])[0].status,'needs-review');
 assert.throws(()=>applyRecordedSourceResolutions(queue,[{...decision,evidence:''}]),/Invalid recorded/);
 assert.equal(applyRecordedSourceResolutions(applied,[decision])[0].resolution.reviewedAt,'2026-11-13T00:30:00Z');
 assert.equal(applyRecordedSourceResolutions([{...queue[0],createdAt:'2026-11-13T00:31:00Z'}],[decision])[0].status,'needs-review');
 assert.equal(applyRecordedSourceResolutions([{...queue[0],createdAt:undefined}],[decision])[0].status,'needs-review');
 assert.throws(()=>applyRecordedSourceResolutions(queue,[{...decision,reviewedAt:'2026-11-13'}]),/Invalid recorded/);
});

test('a documented case source also invalidates guides repeating facts in curated case cards',()=>{
 const fixture={guides:[{id:'real-case',family:'case',scenarioType:'real',status:'published',path:'/cases/example/',sourceIds:['case-order'],ruleIds:[]},
  {id:'cleaning-guide',path:'/industries/cleaning/',sourceIds:[],ruleIds:[]},
  {id:'earnings-guide',path:'/fdd/item-19/',sourceIds:[],ruleIds:['item-19-rule']},
  {id:'unrelated-guide',path:'/industries/unrelated/',sourceIds:[],ruleIds:[]}],rules:[],tools:[],
  caseConnections:[{caseGuideId:'real-case',guideIds:['cleaning-guide'],ruleIds:['item-19-rule']}]};
 const before=JSON.stringify(fixture),impact=dependencyImpact('case-order',fixture);
 assert.deepEqual(new Set(impact.paths),new Set(['/cases/example/','/industries/cleaning/','/fdd/item-19/']));
 assert.ok(!impact.paths.includes('/industries/unrelated/'));assert.equal(JSON.stringify(fixture),before);
});

import {publicSourceReviewSummary} from '../scripts/check-sources.mjs';
test('public source status separates a dated technical snapshot from legal verification and private evidence',()=>{
 const summary=publicSourceReviewSummary({runAt:'2026-11-13T00:50:00Z',results:[{sourceId:'one',result:'unchanged',supportingPassagePresent:true,rawEvidence:'/private/research/path'},{sourceId:'two',result:'fetch-failed'}],queue:[{status:'resolved'},{status:'needs-review',privateNote:'never public'}]});
 assert.equal(summary.checkedAt,'2026-11-13T00:50:00Z');assert.equal(summary.sourceRecordsChecked,2);assert.equal(summary.retrievalFailures,1);assert.equal(summary.openReviewItems,1);assert.equal(summary.legalReviewDatesAutomaticallyRefreshed,false);
 assert.ok(!JSON.stringify(summary).includes('/private/'));assert.ok(!JSON.stringify(summary).includes('never public'));assert.ok(summary.note.includes('not a live legal-currency guarantee'));
});

import {plainSourceText,normalizedPDFBytes} from '../scripts/source-text.mjs';
test('nested site footers and publisher navigation do not hide or alter the primary article hash',()=>{
 const article='<div class="tsg-rwd-main-copy-frame"><div><h1>Treaty Countries</h1><p>Singapore appears in the country table and footnotes remain part of the source.</p></div><h2>Country footnotes</h2><p>Actual eligibility conditions remain a separate review.</p></div>';
 const first='<body><div>Menu one</div>'+article+'<footer><footer>nested copyright</footer><div>popular keyword one</div></footer></body>';
 const second=first.replace('Menu one','Menu two').replace('popular keyword one','popular keyword two');
 const a=extractSourceText(first,'Treaty Countries'),b=extractSourceText(second,'Treaty Countries');
 assert.equal(a.selector,'publisher-main-copy');assert.equal(a.hash,b.hash);assert.ok(a.text.includes('Country footnotes'));assert.ok(!plainSourceText(first).includes('popular keyword'));
 assert.notEqual(extractSourceText(second.replace('Singapore appears','Singapore no longer appears'),'Treaty Countries').hash,a.hash);
});
test('PDF modification metadata alone does not look like changed document content',()=>{
 const first=Buffer.from('%PDF-1.7\n/ModDate(D:20261113001000Z) /CreationDate(D:20260101000000Z) /ID[<ABC><111>]\n<x:xmpmeta><xmp:ModifyDate>2026-11-13T00:10:00Z</xmp:ModifyDate><xmpMM:InstanceID>uuid:old</xmpMM:InstanceID></x:xmpmeta>\nActual legal text\n%%EOF','latin1');
 const second=Buffer.from(first.toString('latin1').replace('20261113001000','20261113002000').replace('<111>','<222>').replace('00:10:00','00:20:00').replace('uuid:old','uuid:new'),'latin1');
 assert.deepEqual(normalizedPDFBytes(first),normalizedPDFBytes(second));
 assert.notDeepEqual(normalizedPDFBytes(first),normalizedPDFBytes(Buffer.from(second.toString('latin1').replace('Actual legal text','Changed legal text'),'latin1')));
});

test('the editorial CLI resolves the new occurrence without replacing same-ID resolved history',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'stateside-review-recurrence-'));
 try{
  const history={id:'same-hash-id',sourceId:'agency',status:'resolved',createdAt:'2026-11-11T10:00:00Z',resolution:{date:'2026-11-11',evidence:'Previous actual review'}};
  const fresh={id:'same-hash-id',sourceId:'agency',status:'needs-review',createdAt:'2026-11-13T10:00:00Z',reason:'source-content-changed'};
  await writeFile(join(directory,'editorial-review-queue.json'),JSON.stringify([history,fresh]));
  await promisify(execFile)(process.execPath,[resolve('scripts/editorial.mjs'),'resolve-source','same-hash-id','--reviewer','AI-assisted-test','--date','2026-11-13','--evidence','New occurrence comparison','--decision','no-material-change','--review-complete'],{env:{...process.env,SOURCE_REVIEW_DIRECTORY:directory}});
  const [old,resolved]=JSON.parse(await readFile(join(directory,'editorial-review-queue.json'),'utf8'));
  assert.deepEqual(old,history);assert.equal(resolved.status,'resolved');assert.equal(resolved.resolution.evidence,'New occurrence comparison');
 }finally{await rm(directory,{recursive:true,force:true})}
});

import {sourceReviewShouldFail} from '../scripts/check-sources.mjs';
test('strict workflow exit policy alerts unresolved observations while local reporting stays optional',()=>{
 const success=[{result:'unchanged'}],failed=[{result:'fetch-failed'}],open=[{status:'needs-review'}],resolved=[{status:'resolved'}];
 assert.equal(sourceReviewShouldFail({results:failed,queue:open}),false);
 assert.equal(sourceReviewShouldFail({results:failed,queue:resolved,failOnFetchError:true}),true);
 assert.equal(sourceReviewShouldFail({results:success,queue:open,failOnReviewItems:true}),true);
 assert.equal(sourceReviewShouldFail({results:success,queue:resolved,failOnFetchError:true,failOnReviewItems:true}),false);
});
