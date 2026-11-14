import {readdir, readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import * as http from 'node:http';
import {extractSourceText, plainSourceText, retrievalFailureKind, reviewMarkdown, NORMALIZATION_VERSION, isAccessInterstitial, normalizedPDFBytes} from './source-text.mjs';

// Reviewed public source hosts which the managed proxy resolves successfully even
// when the executor's local resolver returns ENOTFOUND. This is not a general DNS bypass.
export const PROXY_DNS_HOST_EXCEPTIONS = new Set(['ditjenpen.kemendag.go.id', 'tradeinvest.tl', 'bsp.guam.gov', 'www.bot.or.th', 'www.esteri.it']);
export const HTML_SOURCE_LIMIT = 12 * 1024 * 1024;
export const PDF_SOURCE_LIMIT = 16 * 1024 * 1024;
const proxyConfigured = (env = process.env) => Boolean(env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy);
export function configureSourceProxy({env = process.env, configure = http.setGlobalProxyFromEnv} = {}) {
  if (!proxyConfigured(env)) return 'direct';
  if (typeof configure !== 'function') throw Error('A configured environment proxy requires the Node24 source-review runtime');
  // Node fetch otherwise ignores these inherited proxy variables unless enabled
  // at process startup. Use the built-in dispatcher; TLS verification and every
  // source URL, DNS, size and redirect check below remain unchanged.
  configure(env);
  return 'inherited-environment-proxy';
}
export function cacheSuccessfulPromise(load) {
  let cached;
  return async () => {
    if (!cached) cached = Promise.resolve().then(load);
    const current = cached;
    try { return await current; }
    catch (error) { if (cached === current) cached = undefined; throw error; }
  };
}
export async function loadSourceReviewState(directory) {
  async function optional(name, empty) {
    try { return JSON.parse(await readFile(join(directory,name),'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return empty;
      throw Error(`Cannot read retained source-review state ${name}: ${error.message}`); }
  }
  const baseline = await optional('source-baseline.json',{}), queue = await optional('editorial-review-queue.json',[]);
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) throw Error('Retained source baseline must be an object');
  if (!Array.isArray(queue) || queue.some(q => !q || typeof q !== 'object' || !q.id || !q.sourceId || !q.reason)) throw Error('Retained source queue must contain issue records');
  return {baseline,queue};
}
export function diagnosticSourceURL(raw) {
  try { const u=new URL(raw);u.username='';u.password='';u.search='';u.hash='';return u.href.slice(0,500); }
  catch { return '[invalid URL]'; }
}
function diagnosticText(raw,env=process.env,limit=500) {
  let text=String(raw??'').replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi,url=>diagnosticSourceURL(url));
  for(const key of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])try{
    const p=new URL(env[key]);for(const encoded of [p.username,p.password])if(encoded){
      for(const secret of new Set([encoded,decodeURIComponent(encoded)]))if(secret)text=text.split(secret).join('[redacted]');
    }
  }catch{}
  return text.replace(/(^|[\s(])[^\s/@:]{1,256}:[^\s/@]{1,256}@/g,'$1[redacted]@').slice(0,limit);
}
export function sourceConnectionDiagnostics(error,{url,redirectTrail=[],stage='fetch',env=process.env}={}) {
  const causes=[];let current=error;
  for(let depth=0;current&&depth<4;depth++,current=current.cause){
    const code=/^[A-Z0-9_]{1,64}$/.test(current.code??'')?current.code:undefined;
    const host=String(current.hostname??current.host??'');
    causes.push({...(code?{code}:{}),...(/^[a-z0-9.:[\]-]{1,253}$/i.test(host)?{host}:{}),message:diagnosticText(current.message??current.name,env)});
    if(Array.isArray(current.errors))for(const e of current.errors.slice(0,3))causes.push({...(e.code?{code:diagnosticText(e.code,env)}:{}),message:diagnosticText(e.message,env)});
  }
  return {stage,url:diagnosticSourceURL(url),redirectTrail:redirectTrail.slice(0,6).map(r=>({status:r.status,from:diagnosticSourceURL(r.from),to:diagnosticSourceURL(r.to)})),causes};
}
export function sourceBodyFailureEvidence(result,stage='extraction') {
  const body=Buffer.from(result.body),sample=body.subarray(0,65536);
  return {stage,url:diagnosticSourceURL(result.url),status:result.status,type:result.type,bytes:body.length,
    rawHash:createHash('sha256').update(body).digest('hex'),capturedBytes:sample.length,
    bodyPreview:diagnosticText(plainSourceText(sample.toString('utf8')),process.env,4096),
    redirectTrail:(result.redirectTrail??[]).map(r=>({status:r.status,from:diagnosticSourceURL(r.from),to:diagnosticSourceURL(r.to)}))};
}
export async function failedResponseEvidence(response, url) {
  const chunks = []; let bytes = 0;
  const reader = response.body?.getReader();
  if (reader) try {
    while (bytes < 65536) { const {value, done} = await reader.read(); if (done) break;
      const part = Buffer.from(value).subarray(0, 65536 - bytes); chunks.push(part); bytes += part.length;
    }
  } catch {} finally { try { await reader.cancel(); } catch {} }
  const body = Buffer.concat(chunks), text = body.toString('utf8');
  return {body, observation: {url, status: response.status, headers: Object.fromEntries(
    ['content-type', 'date', 'server', 'retry-after', 'x-envoy-upstream-service-time'].map(k => [k, response.headers.get(k)]).filter(([,v]) => v)),
    capturedBytes: body.length, bodyPreview: plainSourceText(text).slice(0, 4096), accessInterstitial: isAccessInterstitial(text, url)}};
}
export function isNonPublicAddress(address) {
  if (net.isIPv4(address)) {
    const p = address.split('.').map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] === 169 && p[1] === 254 ||
      p[0] === 172 && p[1] >= 16 && p[1] <= 31 || p[0] === 192 && p[1] === 168 ||
      p[0] === 100 && p[1] >= 64 && p[1] <= 127 || p[0] >= 224 ||
      p[0] === 192 && p[1] === 0 || p[0] === 198 && [18, 19].includes(p[1]) ||
      p[0] === 198 && p[1] === 51 && p[2] === 100 || p[0] === 203 && p[1] === 0 && p[2] === 113;
  }
  if (!net.isIPv6(address)) return true;
  const a = new URL('https://[' + address + ']/').hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return !/^[23]/.test(a) || a.startsWith('2001:db8:') || a.startsWith('3fff:') || a === '::' || a === '::1' || a.startsWith('fc') || a.startsWith('fd') ||
    /^fe[89ab]/.test(a) || a.startsWith('ff') || a.startsWith('::ffff:');
}
export async function validateSourceURL(raw, {lookup = dns.lookup, proxy = proxyConfigured()} = {}) {
  const u = new URL(raw);
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443' ||
      net.isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') || host.endsWith('.') ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|invalid|test)$/.test(host)) {
    throw Error('Only public HTTPS source hosts on port 443 are allowed');
  }
  let ips;
  try { ips = await lookup(host, {all: true}); }
  catch (error) {
    if (proxy && PROXY_DNS_HOST_EXCEPTIONS.has(host) && ['ENOTFOUND', 'ENODATA', 'EAI_AGAIN'].includes(error.code)) {
      return {url: u, dnsResolution: 'reviewed-public-host-via-inherited-proxy'};
    }
    throw error;
  }
  if (!ips.length || ips.some(x => isNonPublicAddress(x.address))) throw Error('Source host resolves to a non-public address');
  return {url: u, dnsResolution: 'public-local-dns'};
}
export function sourceSizeLimit({type = '', url = ''} = {}) {
  return /pdf/i.test(type) || new URL(url || 'https://example.gov/').pathname.toLowerCase().endsWith('.pdf') ? PDF_SOURCE_LIMIT : HTML_SOURCE_LIMIT;
}
export function isTextLikeSource({type = '', url = ''} = {}) {
  // Office Open XML documents are ZIP packages. The word "xml" in their MIME
  // type does not make the response body readable XML or a checked passage.
  if (/^application\/vnd\.openxmlformats-officedocument\./i.test(type.trim())&&!/\+xml(?:\s*;|\s*$)/i.test(type)) return false;
  return /html|text|json|xml/i.test(type) || /\.(?:xml|txt)$/i.test(new URL(url || 'https://example.gov/').pathname);
}
export function dependencyImpact(sourceId, {guides = [], rules = [], tools = [], pages = [], caseConnections = []} = {}) {
  const directRules = rules.filter(r => r.sourceIds?.includes(sourceId));
  const ruleIds = new Set(directRules.map(r => r.id));
  const guidePaths = guides.filter(g => g.sourceIds?.includes(sourceId) || g.ruleIds?.some(id => ruleIds.has(id))).map(g => g.path);
  const toolPaths = tools.filter(t => t.sourceIds?.includes(sourceId) || t.ruleIds?.some(id => ruleIds.has(id))).map(t => t.path);
  const explicitPaths = directRules.flatMap(r => r.dependentPaths ?? []);
  const pagePaths = pages.filter(p => p.sourceIds?.includes(sourceId) || p.ruleIds?.some(id => ruleIds.has(id))).map(p => p.path);
  const affectedCaseIds = new Set(guides.filter(g => g.family === 'case' && g.scenarioType === 'real' && g.status === 'published' &&
    (g.sourceIds?.includes(sourceId) || g.ruleIds?.some(id => ruleIds.has(id)))).map(g => g.id));
  const affectedConnections = caseConnections.filter(c => affectedCaseIds.has(c.caseGuideId));
  const caseCardPaths = guides.filter(g => affectedConnections.some(c => c.guideIds?.includes(g.id) ||
    g.ruleIds?.some(id => c.ruleIds?.includes(id)))).map(g => g.path);
  return {ruleIds: [...ruleIds], paths: [...new Set([...guidePaths, ...toolPaths, ...pagePaths, ...caseCardPaths, ...explicitPaths])], tools: [...new Set([...toolPaths, ...explicitPaths.filter(p => p.startsWith('/tools/'))])]};
}
export function sourceObservation({source, prior, current, fetchedAt, dependencies, normalizationAudits = []}) {
  const contaminated = prior?.url && /^https:\/\/unblock\.federalregister\.gov\//i.test(prior.url);
  const result = !prior ? 'baseline-established' : contaminated ? 'baseline-recovered' :
    (prior.normalizationVersion ?? 1) !== (current.normalizationVersion ?? 1) ? 'baseline-migrated' :
      prior.hash !== current.hash ? 'changed' : 'unchanged';
  const migration = result === 'baseline-migrated';
  const audited = migration && normalizationAudits.some(a => a.sourceId === source.id &&
    a.fromVersion === (prior.normalizationVersion ?? 1) && a.toVersion === (current.normalizationVersion ?? 1) &&
    a.previousHash === prior.hash && a.currentHash === current.hash && a.matchesPrior === true);
  return {sourceId: source.id, fetchedAt, substantiveVerifiedAt: source.substantiveVerifiedAt ?? null,
    previousHash: prior?.hash ?? null, previousNormalizationVersion: prior?.normalizationVersion ?? 1,
    ...(migration ? {normalizationAuditRequired: prior.hash !== current.hash && !audited,
      normalizationComparison: audited ? 'exact-release-migration-audit' : prior.hash === current.hash ? 'identical-normalized-hash' : 'historical-text-delta-not-yet-audited'} : {}),
    result, ...(contaminated ? {previousBaselineIssue: 'access-interstitial-not-primary-text'} : {}), ...current, ...dependencies};
}
export function officialFullTextRoute(raw, titles = []) {
  const url = new URL(raw);
  if (url.hostname === 'www.ecfr.gov' && /^\/(?:current|on\/\d{4}-\d{2}-\d{2})\//.test(url.pathname)) {
    const title = url.pathname.match(/\/title-(\d+)(?:\/|$)/)?.[1];
    const section = url.pathname.match(/\/section-([^/]+)/)?.[1];
    const part = url.pathname.match(/\/part-([^/]+)/)?.[1];
    const historical = url.pathname.match(/^\/on\/(\d{4}-\d{2}-\d{2})\//)?.[1];
    const meta = titles.find(t => String(t.number) === title);
    const asOf = historical || meta?.up_to_date_as_of;
    if (!title || !asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !part && !section) throw Error('Official eCFR full-text route needs title, part/section and current title metadata');
    const api = new URL(`https://www.ecfr.gov/api/versioner/v1/full/${asOf}/title-${title}.xml`);
    if (part) api.searchParams.set('part', part);
    if (section) api.searchParams.set('section', section);
    return {url: api.href, retrievalMethod: 'official-ecfr-full-text-api', primaryTextAsOf: asOf};
  }
  const fr = url.hostname === 'www.federalregister.gov' && url.pathname.match(/^\/documents\/(\d{4})\/(\d{2})\/(\d{2})\/([\d-]+)(?:\/|$)/);
  if (fr) return {url: `https://www.federalregister.gov/documents/full_text/xml/${fr[1]}/${fr[2]}/${fr[3]}/${fr[4]}.xml`, retrievalMethod: 'official-federal-register-full-text'};
  return {url: raw, retrievalMethod: 'canonical-source'};
}
export function isOfficialReservedECFRPart(xml,route) {
  if (route.retrievalMethod !== 'official-ecfr-full-text-api') return false;
  const url = new URL(route.url), part = url.searchParams.get('part');
  if (url.protocol !== 'https:' || url.hostname !== 'www.ecfr.gov' || !/^\/api\/versioner\/v1\/full\/\d{4}-\d{2}-\d{2}\/title-\d+\.xml$/.test(url.pathname) || !/^\d+$/.test(part ?? '') || url.searchParams.has('section')) return false;
  const body = String(xml).trim().replace(/^<\?xml\b[^]*?\?>\s*/,''), match = body.match(/^<DIV5\b([^>]*)>\s*<HEAD>\s*PART\s+(\d+)\s+\[RESERVED\]\s*<\/HEAD>\s*<\/DIV5>$/);
  return Boolean(match && match[2] === part && new RegExp('\\bN=["\']'+part+'["\']').test(match[1]) && /\bTYPE=["']PART["']/.test(match[1]));
}
export function officialRISQuery(raw, today = new Date().toISOString().slice(0,10)) {
  const source = new URL(raw);
  if (!['www.ris.bka.gv.at','ris.bka.gv.at'].includes(source.hostname) || source.pathname !== '/NormDokument.wxe' || source.searchParams.get('Abfrage') !== 'Bundesnormen') return null;
  if (source.protocol !== 'https:' || source.username || source.password || source.port && source.port !== '443') throw Error('Official RIS sources require public HTTPS without credentials or alternate ports');
  const law = source.searchParams.get('Gesetzesnummer'), paragraph = source.searchParams.get('Paragraf');
  const asOf = source.searchParams.get('FassungVom') || today;
  if (!/^\d{8}$/.test(law ?? '') || !/^\d+[a-z]?$/.test(paragraph ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf))) throw Error('Official RIS query needs a defined law, paragraph and version date');
  const query = new URL('https://data.bka.gv.at/ris/api/v2.6/Bundesrecht');
  for (const [key,value] of Object.entries({Applikation:'BrKons',Gesetzesnummer:law,'Abschnitt.Von':paragraph,'Abschnitt.Bis':paragraph,'Abschnitt.Typ':'Paragraph','Fassung.FassungVom':asOf,DokumenteProSeite:'Ten'})) query.searchParams.set(key,value);
  return {url:query.href,law,paragraph,asOf};
}
export function officialRISDocument(payload, query) {
  const result = payload?.OgdSearchResult?.OgdDocumentResults;
  const entries = Array.isArray(result?.OgdDocumentReference) ? result.OgdDocumentReference : [result?.OgdDocumentReference];
  if (String(result?.Hits?.['#text']) !== '1' || entries.length !== 1) throw Error('RIS did not return one matching current paragraph');
  const data = entries[0]?.Data, meta = data?.Metadaten, rule = meta?.Bundesrecht?.BrKons, id = meta?.Technisch?.ID;
  if (meta?.Technisch?.Applikation !== 'BrKons' || rule?.Gesetzesnummer !== query.law ||
      String(rule?.Paragraphnummer ?? '') + String(rule?.Paragraphbuchstabe ?? '') !== query.paragraph || !/^NOR\d+$/.test(id ?? '')) throw Error('RIS metadata does not match the requested law and paragraph');
  const references = data?.Dokumentliste?.ContentReference;
  const documents = Array.isArray(references) ? references : [references];
  const urls = documents.flatMap(r => {const u=r?.Urls?.ContentUrl;return Array.isArray(u)?u:[u];});
  const document = urls.find(r => r?.DataType === 'Xml'), url = document && new URL(document.Url);
  if (!url || url.protocol !== 'https:' || url.hostname !== 'ogd.ris.bka.gv.at' || url.pathname !== `/Dokumente/Bundesnormen/${id}/${id}.xml` || url.search || url.hash || url.username || url.password || url.port) throw Error('RIS did not provide a scoped official XML rendition');
  return {url:url.href,retrievalMethod:'official-ris-ogd-api-linked-xml',primaryTextAsOf:query.asOf,metadataURL:query.url,primaryDocumentId:id};
}

export function applyRecordedSourceResolutions(queue, decisions = []) {
  const allowed = new Set(['retrieval-confirmed', 'no-material-change', 'interpretation-updated', 'not-a-source-change']);
  for (const d of decisions) {
    if (!d.issueId || !d.sourceId || !d.reason || !d.reviewer || !d.evidence || !allowed.has(d.decision) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(d.reviewedAt ?? '') || Number.isNaN(Date.parse(d.reviewedAt)) || d.reviewComplete !== true) {
      throw Error('Invalid recorded source resolution; explicit dated reviewer/evidence/decision required');
    }
  }
  return queue.map(issue => {
    if (issue.status === 'resolved') return issue;
    const d = decisions.find(d => d.issueId === issue.id && d.sourceId === issue.sourceId && d.reason === issue.reason &&
      (d.observedHash ?? null) === (issue.observedHash ?? null) &&
      Number.isFinite(Date.parse(issue.createdAt)) && Date.parse(issue.createdAt) <= Date.parse(d.reviewedAt));
    if (!d) return issue;
    return {...issue, status: 'resolved', resolution: {reviewer: d.reviewer, reviewedAt: d.reviewedAt, evidence: d.evidence,
      decision: d.decision, publicContentChanged: false, substantiveVerificationChanged: false,
      record: 'research/batch3/editorial-resolutions.json', ...(d.notes ? {notes: d.notes} : {})}};
  });
}

export function publicSourceReviewSummary({runAt, results, queue}) {
  return {schemaVersion: 1, checkedAt: runAt, execution: 'managed-cloud-or-workflow-source-check',
    scope: 'Published guide, tool and site dependency source records at the start of this run; records can cite the same document.',
    sourceRecordsChecked: results.length, retrievalFailures: results.filter(r => r.result === 'fetch-failed').length,
    supportingPassagesNotLocated: results.filter(r => r.supportingPassagePresent === false).length,
    contentHashChanges: results.filter(r => r.result === 'changed').length,
    normalizationMigrations: results.filter(r => r.result === 'baseline-migrated').length,
    normalizationMigrationsRequiringAudit: results.filter(r => r.normalizationAuditRequired === true).length,
    openReviewItems: queue.filter(q => q.status !== 'resolved').length, resolvedReviewItems: queue.filter(q => q.status === 'resolved').length,
    reviewType: 'AI-assisted editorial source review', legalReviewDatesAutomaticallyRefreshed: false,
    note: 'This dated technical snapshot is not a live legal-currency guarantee. Successful retrieval does not establish that every interpretation is current. Source substantive-review dates, applicability limits and unresolved legal/research workstreams remain separate.'};
}

export function sourceReviewShouldFail({results, queue, failOnFetchError = false, failOnReviewItems = false}) {
  return Boolean(failOnFetchError && results.some(r => r.result === 'fetch-failed') ||
    failOnReviewItems && queue.some(q => q.status !== 'resolved'));
}

async function main() {
  const transport = configureSourceProxy();
  const concurrency = Number(process.env.SOURCE_REVIEW_CONCURRENCY || 2);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw Error('SOURCE_REVIEW_CONCURRENCY must be an integer from 1 to 4');
  const out = resolve(process.env.SOURCE_REVIEW_DIRECTORY || 'artifacts');
  await mkdir(join(out, 'source-evidence'), {recursive: true});
  const rawDirectory = process.env.SOURCE_REVIEW_RAW_DIRECTORY ? resolve(process.env.SOURCE_REVIEW_RAW_DIRECTORY) : null;
  if (rawDirectory) await mkdir(rawDirectory, {recursive: true});
  const datasets = {};
  for (const f of (await readdir('src/data')).filter(f => f.endsWith('.json'))) datasets[f] = JSON.parse(await readFile(join('src/data', f), 'utf8'));
  const records = suffix => Object.entries(datasets).filter(([f]) => f.endsWith(suffix)).flatMap(([, v]) => v);
  const guides = records('guides.json'), rules = records('rules.json'), sources = records('sources.json');
  const published = guides.filter(g => g.status === 'published');
  const toolDefinitions = datasets['tool-definitions.json'] ?? [], sitePages = datasets['site-dependencies.json'] ?? [], caseConnections = datasets['case-connections.json'] ?? [];
  const citedIds = new Set([...published, ...toolDefinitions, ...sitePages].flatMap(g => [...(g.sourceIds ?? []), ...(g.ruleIds ?? []).flatMap(id => rules.find(r => r.id === id)?.sourceIds ?? [])]));
  const selectedIds = process.argv.flatMap((arg, index) => arg === '--source' ? [process.argv[index + 1]] : []);
  for (const id of selectedIds) if (!sources.some(s => s.id === id)) throw Error('Unknown source ID: ' + id);
  const toCheck = selectedIds.length ? sources.filter(s => selectedIds.includes(s.id)) : process.argv.includes('--all') ? sources : sources.filter(s => citedIds.has(s.id));
  const retained = await loadSourceReviewState(out);
  const baseline = retained.baseline;
  let existing = retained.queue;
  let recordedDecisions = [];
  try { recordedDecisions = JSON.parse(await readFile(resolve(process.env.SOURCE_REVIEW_RESOLUTIONS_FILE || 'research/batch3/editorial-resolutions.json'), 'utf8')).decisions ?? []; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  existing = applyRecordedSourceResolutions(existing, recordedDecisions);
  let normalizationAudits = [];
  try { normalizationAudits = JSON.parse(await readFile('research/batch3/normalization-migration-audit.json','utf8')).records ?? []; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const history = existing.filter(r => r.status === 'resolved'), open = existing.filter(r => r.status !== 'resolved');
  const rawCache = new Map(), hostNextStart = new Map(), hostBlockedUntil = new Map();
  const isRISOGD = host => ['data.bka.gv.at','ogd.ris.bka.gv.at'].includes(host);
  let risSequence = Promise.resolve();
  async function waitForHost(host) {
    const pacingHost = isRISOGD(host) ? 'ris-ogd' : host;
    let remaining = (hostBlockedUntil.get(host) ?? 0) - Date.now();
    if (remaining > 30000) { const error = Error('HTTP 429: host Retry-After remains in effect'); error.retryAfterMs = remaining; throw error; }
    if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
    const now = Date.now(), start = Math.max(now, hostNextStart.get(pacingHost) ?? 0);
    hostNextStart.set(pacingHost, start + (isRISOGD(host) ? 2000 : host === 'www.ecfr.gov' ? 1100 : 200));
    if (start > now) await new Promise(r => setTimeout(r, start - now));
    remaining = (hostBlockedUntil.get(host) ?? 0) - Date.now();
    if (remaining > 30000) { const error = Error('HTTP 429: host Retry-After remains in effect'); error.retryAfterMs = remaining; throw error; }
    if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
  }
  async function fetchBody(raw) {
    // Cache documents, not interpretations. FDD subsections may share a document;
    // every source still checks its own previously reviewed supporting passage.
    const key = new URL(raw); key.hash = '';
    if (rawCache.has(key.href)) return rawCache.get(key.href);
    const request = async () => {
      const redirectTrail=[];let validated;
      try { validated=await validateSourceURL(key.href); }
      catch(error){error.transportEvidence=sourceConnectionDiagnostics(error,{url:key.href,stage:'source-validation'});throw error;}
      let u=validated.url;
      for (let hop = 0; hop < 6; hop++) {
        await waitForHost(u.hostname);
        let response;
        try { response=await fetch(u, {redirect: 'manual', signal: AbortSignal.timeout(30000),
          headers: {'User-Agent': 'StatesideSourceReview/1.1 (editorial source check; no automatic interpretation)', 'Accept-Encoding': 'gzip, deflate, br'}}); }
        catch(error){error.transportEvidence=sourceConnectionDiagnostics(error,{url:u.href,redirectTrail});throw error;}
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location'); await response.body?.cancel();
          if (!location) throw Error('Redirect has no location');
          let destination;
          try { destination=new URL(location,u).href;redirectTrail.push({status:response.status,from:u.href,to:destination});validated=await validateSourceURL(destination); }
          catch(error){error.transportEvidence=sourceConnectionDiagnostics(error,{url:destination??u.href,redirectTrail,stage:'redirect-validation'});throw error;}
          u=validated.url;continue;
        }
        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after');
          const evidence = await failedResponseEvidence(response, u.href);
          const error = Error('HTTP ' + response.status + (evidence.observation.accessInterstitial ? ': source returned access/security interstitial' : ''));
          error.transportEvidence = {...evidence.observation,redirectTrail:redirectTrail.map(r=>({status:r.status,from:diagnosticSourceURL(r.from),to:diagnosticSourceURL(r.to)}))}; error.responseBody = evidence.body;
          if (evidence.observation.accessInterstitial) error.retryable = false;
          if (retryAfter) { const seconds = Number(retryAfter); error.retryAfterMs = Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(retryAfter) - Date.now()); }
          if (response.status === 429) hostBlockedUntil.set(u.hostname, Date.now() + (error.retryAfterMs ?? 1100));
          throw error;
        }
        const type = response.headers.get('content-type') ?? '', cap = sourceSizeLimit({type, url: u.href});
        if (Number(response.headers.get('content-length')) > cap) { await response.body?.cancel(); throw Error(`Source exceeds ${cap / 1024 / 1024} MiB evidence cap`); }
        const chunks = []; let total = 0;
        try { for await (const chunk of response.body) { total += chunk.length; if (total > cap) throw Error(`Source exceeds ${cap / 1024 / 1024} MiB evidence cap`); chunks.push(chunk); } }
        catch(error){error.transportEvidence={...sourceConnectionDiagnostics(error,{url:u.href,redirectTrail,stage:'response-body-read'}),status:response.status,type,receivedBytes:total};throw error;}
        const body = Buffer.concat(chunks);
        const result={body,type,status:response.status,url:u.href,dnsResolution:validated.dnsResolution,redirectTrail};
        if (isAccessInterstitial(body.toString('utf8'), u.href)) {const error=Error('Source returned access/error interstitial');error.transportEvidence=sourceBodyFailureEvidence(result,'access-interstitial');error.responseBody=body.subarray(0,65536);error.retryable=false;throw error;}
        return result;
      }
      throw Error('Too many source redirects');
    };
    // The advertised RIS OGD service requires serial requests, at most one per
    // two seconds. Keep that policy across both API and linked XML hosts.
    const pending = isRISOGD(key.hostname) ? risSequence.then(request) : request();
    if (isRISOGD(key.hostname)) risSequence = pending.then(() => undefined, () => undefined);
    rawCache.set(key.href, pending);
    try { return await pending; } catch (e) { rawCache.delete(key.href); throw e; }
  }
  const titles = cacheSuccessfulPromise(async () => {
    const result = await fetchBody('https://www.ecfr.gov/api/versioner/v1/titles.json');
    return JSON.parse(result.body.toString('utf8')).titles;
  });
  async function download(source) {
    const metadata = new URL(source.url).hostname === 'www.ecfr.gov' ? await titles() : [];
    const ris = officialRISQuery(source.url);
    const route = ris ? officialRISDocument(JSON.parse((await fetchBody(ris.url)).body.toString('utf8')),ris) : officialFullTextRoute(source.url, metadata);
    const result = await fetchBody(route.url);
    let rawEvidence;
    if (rawDirectory) {
      const name = source.id.replace(/[^a-z0-9_-]/gi, '_') + (/pdf/i.test(result.type) ? '.pdf' : /xml/i.test(result.type) ? '.xml' : '.html');
      rawEvidence = join(rawDirectory, name); await writeFile(rawEvidence, result.body);
    }
    const textLike = isTextLikeSource(result);
    let text = '', extraction = {normalizationVersion: NORMALIZATION_VERSION, supportingPassagePresent: null, selector: 'binary'}, content = result.body;
    if (textLike) { const xml = result.body.toString('utf8');try{extraction = extractSourceText(xml, source.supportingPassage ?? '',{minimumLength:isOfficialReservedECFRPart(xml,route)?12:100});}catch(error){error.transportEvidence=sourceBodyFailureEvidence(result);error.responseBody=result.body.subarray(0,65536);throw error;}text = extraction.text; content = Buffer.from(text); }
    else if (/pdf/i.test(result.type) && result.body.subarray(0, 5).toString() === '%PDF-') { content = normalizedPDFBytes(result.body); extraction.selector = 'pdf-bytes-without-volatile-metadata'; }
    return {requestedURL: source.url, url: result.url, status: result.status, type: result.type, bytes: result.body.length,
      hash: createHash('sha256').update(content).digest('hex'), rawHash: createHash('sha256').update(result.body).digest('hex'),
      textExcerpt: text.slice(0, 16000), normalizationVersion: extraction.normalizationVersion, supportingPassagePresent: extraction.supportingPassagePresent,
      selector: extraction.selector, retrievalMethod: route.retrievalMethod, primaryTextAsOf: route.primaryTextAsOf ?? null, dnsResolution: result.dnsResolution,
      ...(route.metadataURL ? {metadataURL:route.metadataURL,primaryDocumentId:route.primaryDocumentId} : {}),
      ...(rawEvidence ? {rawEvidence} : {})};
  }
  const toolMap = {'classification': ['relationship-factsheet'], 'sales-disclosure': ['relationship-factsheet', 'fdd-comparison', 'launch-planner'], 'corporate-tax': ['brand-support-economics', 'launch-planner'], 'immigration': ['relationship-factsheet', 'launch-planner'], 'commercial-feasibility': ['us-unit-economics', 'cash-runway', 'market-comparison'], 'premises-opening': ['cash-runway', 'launch-planner'], 'employment': ['us-unit-economics', 'launch-planner'], 'products-supply': ['cash-runway', 'launch-planner']};
  function affected(source) { const impact = dependencyImpact(source.id, {guides, rules, tools: toolDefinitions, pages: sitePages, caseConnections}); const ruleRecords = rules.filter(r => impact.ruleIds.includes(r.id)); return {...impact, tools: [...new Set([...impact.tools, ...ruleRecords.flatMap(r => toolMap[r.topic] ?? []).map(s => '/tools/' + s + '/')])]}; }
  const runAt = new Date().toISOString(), results = [];
  function enqueue(entry) { if (!open.some(x => x.sourceId === entry.sourceId && x.reason === entry.reason && x.observedHash === entry.observedHash)) open.push({...entry, id: createHash('sha256').update(entry.sourceId + entry.reason + (entry.observedHash ?? runAt)).digest('hex').slice(0, 20), status: 'needs-review', createdAt: runAt}); }
  let index = 0;
  async function worker() {
    while (index < toCheck.length) {
      const source = toCheck[index++], fetchedAt = new Date().toISOString(), deps = affected(source);
      try {
        let current;
        for (let attempt = 0; attempt < 3; attempt++) {
          try { current = await download(source); break; }
          catch (error) { if (attempt === 2 || error.retryable === false || !/HTTP (408|429|500|502|503|504)|timeout|timed out|aborted|ECONNRESET/i.test(String(error?.message ?? error)) || (error.retryAfterMs ?? 0) > 30000) throw error; await new Promise(r => setTimeout(r, Math.max(1000 * 2 ** attempt, error.retryAfterMs ?? 0))); }
        }
        const prior = baseline[source.id], result = sourceObservation({source, prior, current, fetchedAt, dependencies: deps, normalizationAudits}); results.push(result);
        if (result.normalizationAuditRequired) enqueue({sourceId:source.id,reason:'source-normalization-review-required',observedHash:current.hash,previousHash:prior.hash,previousNormalizationVersion:prior.normalizationVersion??1,normalizationVersion:current.normalizationVersion,sourceURL:source.url,...deps,instruction:'The source normalizer changed and the normalized hash differs. Compare the previous extraction/baseline with the actual new body; migration is not proof of unchanged source text or law. Preserve reviewed content and substantive dates.'});
        if (result.result === 'changed') enqueue({sourceId: source.id, reason: 'source-content-changed', observedHash: current.hash, previousHash: prior.hash, sourceURL: source.url, ...deps, instruction: 'Compare against the last substantively reviewed source and dependent interpretations. An HTTP/content change is not a legal conclusion. Preserve last reviewed public content until an editorial decision.'});
        if (current.supportingPassagePresent === false) enqueue({sourceId: source.id, reason: 'supporting-passage-not-found', observedHash: current.hash, sourceURL: source.url, ...deps, instruction: 'The previously recorded excerpt was not located in the fetched text. Inspect layout, source version and applicability before changing any interpretation.'});
        baseline[source.id] = {normalizationVersion: current.normalizationVersion, hash: current.hash, fetchedAt, url: current.url, substantiveVerifiedAt: source.substantiveVerifiedAt ?? null,
          previousHash: prior && (result.result !== 'unchanged') ? prior.hash : prior?.previousHash ?? null, retrievalMethod: current.retrievalMethod, primaryTextAsOf: current.primaryTextAsOf};
        await writeFile(join(out, 'source-evidence', source.id.replace(/[^a-z0-9_-]/gi, '_') + '.json'), JSON.stringify(result, null, 2) + '\n');
      } catch (e) {
        const transportEvidence = e.transportEvidence ? {...e.transportEvidence} : undefined;
        if (transportEvidence && rawDirectory && e.responseBody?.length) {
          transportEvidence.rawEvidence = join(rawDirectory, source.id.replace(/[^a-z0-9_-]/gi, '_') + '.error.html');
          await writeFile(transportEvidence.rawEvidence, e.responseBody);
        }
        const error = diagnosticText(e.message ?? e).slice(0, 300), failure = {sourceId: source.id, failureKind: retrievalFailureKind(e), error, ...(transportEvidence ? {transportEvidence} : {}), ...deps};
        const observation={...failure,fetchedAt,result:'fetch-failed'};results.push(observation);
        await writeFile(join(out,'source-evidence',source.id.replace(/[^a-z0-9_-]/gi,'_')+'.failure.json'),JSON.stringify(observation,null,2)+'\n');
        enqueue({...failure, reason: 'source-fetch-failed', sourceURL: source.url, instruction: 'Inspect access, redirects and the actual source. Do not treat a failed fetch as no requirement or as repealed law.'});
      }
    }
  }
  await Promise.all(Array.from({length: Math.min(concurrency, toCheck.length)}, worker));
  await writeFile(join(out, 'source-baseline.json'), JSON.stringify(baseline, null, 2) + '\n');
  await writeFile(join(out, 'editorial-review-queue.json'), JSON.stringify([...history, ...open], null, 2) + '\n');
  await writeFile(join(out, 'source-check-results.json'), JSON.stringify({runAt, transport, concurrency, policy: 'Fetch/change detection only. Substantive verification dates remain unchanged. No public content is republished.', results}, null, 2) + '\n');
  await writeFile(join(out, 'editorial-review-report.md'), reviewMarkdown({runAt, results, queue: open}));
  if (process.argv.includes('--write-public-summary')) await writeFile(resolve('public/source-review-status.json'), JSON.stringify(publicSourceReviewSummary({runAt, results, queue: [...history, ...open]}), null, 2) + '\n');
  console.log(JSON.stringify({runAt, checked: results.length, baselineEstablished: results.filter(r => r.result === 'baseline-established').length, baselineMigrated: results.filter(r => r.result === 'baseline-migrated').length, normalizationMigrationsRequiringAudit:results.filter(r=>r.normalizationAuditRequired).length, baselineRecovered: results.filter(r => r.result === 'baseline-recovered').length, changed: results.filter(r => r.result === 'changed').length, unchanged: results.filter(r => r.result === 'unchanged').length, failed: results.filter(r => r.result === 'fetch-failed').length, openReviewItems: open.length, output: out}));
  if (sourceReviewShouldFail({results, queue: [...history, ...open], failOnFetchError: process.argv.includes('--fail-on-fetch-error'), failOnReviewItems: process.argv.includes('--fail-on-review-items')})) process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (proxyConfigured() && process.env.NODE_USE_ENV_PROXY !== '1') {
    const code = await new Promise((done, reject) => { const child = spawn(process.execPath, ['--use-env-proxy', ...process.argv.slice(1)], {env: {...process.env, NODE_USE_ENV_PROXY: '1'}, stdio: 'inherit'}); child.on('error', reject); child.on('exit', code => done(code ?? 1)); }); process.exitCode = Number(code);
  } else await main();
}
