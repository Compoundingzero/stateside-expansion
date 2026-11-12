import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, symlink, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSubmissionService } from '../src/server/submissions.mjs';

const token = 'test-only-owner-setup-token-32-characters-long';
const password = 'A local test password with enough characters!';
const interest = { name: 'Test manager', company: 'Example services', arr: 'EUR 2m; self-reported', email: 'test@example.test', website: '' };

async function fixture(options: Record<string, unknown> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'eln-submissions-test-'));
  const dbPath = join(directory, 'eln.sqlite');
  let service: ReturnType<typeof createSubmissionService>;
  let origin = '';
  const server = http.createServer(async (req, res) => {
    if (!(await service.handle(req, res))) { res.writeHead(404); res.end('not found'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address === 'object');
  origin = `http://127.0.0.1:${address.port}`;
  service = createSubmissionService({ dbPath, setupToken: token, origin, secureCookies: false, ...options });
  let cookie = '';
  async function request(path: string, config: Record<string, any> = {}) {
    const method = config.method ?? 'GET';
    const headers: Record<string, string> = { ...(config.cookie === false ? {} : cookie ? { Cookie: cookie } : {}), ...(config.headers ?? {}) };
    if (config.origin !== false && ['POST', 'PATCH', 'DELETE'].includes(method)) headers.Origin = config.origin ?? origin;
    let body;
    if (config.rawBody !== undefined) body = config.rawBody;
    else if (config.body !== undefined) { body = JSON.stringify(config.body); headers['Content-Type'] ??= 'application/json'; }
    const response = await fetch(origin + path, { method, headers, body });
    const text = await response.text();
    let json: any; try { json = JSON.parse(text); } catch { json = undefined; }
    const setCookie = response.headers.get('set-cookie');
    if (setCookie && config.keepCookie !== false) cookie = setCookie.split(';')[0];
    return { response, text, json };
  }
  return {
    request, dbPath, origin, directory,
    getCookie: () => cookie,
    reopen: () => { service.close(); service = createSubmissionService({ dbPath, setupToken: token, origin, secureCookies: false, ...options }); },
    async close() { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); service.close(); await rm(directory, { recursive: true, force: true }); }
  };
}

test('submission data is never returned without owner authentication; setup is one-use and credentials are hashed', async t => {
  const f = await fixture(); t.after(() => f.close());
  let result = await f.request('/api/owner/session');
  assert.deepEqual(result.json, { authenticated: false, configured: false });
  result = await f.request('/api/interest', { method: 'POST', body: interest });
  assert.equal(result.response.status, 202); assert.deepEqual(Object.keys(result.json).sort(), ['message', 'ok']);
  assert(!result.text.includes(interest.email));
  for (const path of ['/api/owner/submissions?kind=interest', '/api/owner/export?kind=interest', '/api/owner/unknown']) {
    result = await f.request(path, { cookie: false }); assert.equal(result.response.status, 401); assert(!result.text.includes(interest.email));
    assert.match(result.response.headers.get('cache-control')!, /private, no-store/);
    assert.match(result.response.headers.get('x-robots-tag')!, /noindex/);
    assert.equal(result.response.headers.get('access-control-allow-origin'), null);
  }
  result = await f.request('/api/owner/setup', { method: 'POST', body: { token: 'incorrect', password } }); assert.equal(result.response.status, 403);
  result = await f.request('/api/owner/setup', { method: 'POST', body: { token, password: 'short' } }); assert.equal(result.response.status, 400);
  result = await f.request('/api/owner/setup', { method: 'POST', body: { token, password } }); assert.equal(result.response.status, 200);
  const cookie = result.response.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Max-Age=43200/);
  result = await f.request('/api/owner/setup', { method: 'POST', body: { token, password: 'A different sufficiently long password' } }); assert.equal(result.response.status, 409);
  result = await f.request('/api/owner/session'); assert.deepEqual(result.json, { authenticated: true, configured: true });
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  const owner = db.prepare('SELECT password_hash FROM owner_account').get()!;
  const session = db.prepare('SELECT token_hash FROM owner_sessions').get()!;
  assert.match(String(owner.password_hash), /^scrypt\$/); assert(!String(owner.password_hash).includes(password));
  assert.match(String(session.token_hash), /^[a-f0-9]{64}$/); assert(!String(session.token_hash).includes(f.getCookie().split('=')[1]));
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%ip%'").get(), undefined);
  db.close();
  assert.equal((await stat(f.dbPath)).mode & 0o777, 0o600);
});

test('origin checks, body/type limits, field validation and honeypot keep unsafe input out of storage', async t => {
  const f = await fixture(); t.after(() => f.close());
  for (const origin of [false, 'https://another.example', f.origin + '.attacker.test']) {
    const result = await f.request('/api/interest', { method: 'POST', body: interest, origin }); assert.equal(result.response.status, 403);
  }
  let result = await f.request('/api/interest', { method: 'POST', rawBody: JSON.stringify(interest), headers: { 'Content-Type': 'text/plain' } }); assert.equal(result.response.status, 415);
  result = await f.request('/api/interest', { method: 'POST', rawBody: '{', headers: { 'Content-Type': 'application/json' } }); assert.equal(result.response.status, 400);
  result = await f.request('/api/interest', { method: 'POST', body: { ...interest, email: 'invalid', name: '' } });
  assert.equal(result.response.status, 400); assert(result.json.fields.email); assert(result.json.fields.name);
  result = await f.request('/api/enquiries', { method: 'POST', body: { comments: 'x'.repeat(5001), email: 'test@example.test' } }); assert.equal(result.response.status, 400);
  result = await f.request('/api/interest', { method: 'POST', body: { ...interest, company: 'unsafe\nline' } }); assert.equal(result.response.status, 400);
  result = await f.request('/api/interest', { method: 'POST', rawBody: 'x'.repeat(32769), headers: { 'Content-Type': 'application/json' } }); assert.equal(result.response.status, 413);
  result = await f.request('/api/interest', { method: 'POST', body: { ...interest, website: 'bot-filled.example' } }); assert.equal(result.response.status, 202);
  result = await f.request('/api/owner/setup', { method: 'POST', body: { token, password } }); assert.equal(result.response.status, 200);
  result = await f.request('/api/owner/submissions'); assert.deepEqual(result.json.submissions, []);
  result = await f.request('/api/interest', { method: 'OPTIONS' }); assert.equal(result.response.status, 405);
});

test('public rate limits ignore spoofed forwarded IP headers by default and expire', async t => {
  let now = Date.parse('2030-01-01T00:00:00.000Z');
  const f = await fixture({ clock: () => now }); t.after(() => f.close());
  for (let i = 0; i < 10; i++) {
    const result = await f.request('/api/interest', { method: 'POST', body: { ...interest, website: 'honeypot' }, headers: { 'X-Forwarded-For': `192.0.2.${i}`, 'X-Real-IP': `192.0.2.${i}` } });
    assert.equal(result.response.status, 202);
  }
  let result = await f.request('/api/interest', { method: 'POST', body: interest }); assert.equal(result.response.status, 429); assert(Number(result.response.headers.get('retry-after')) > 0);
  now += 15 * 60 * 1000 + 1;
  result = await f.request('/api/interest', { method: 'POST', body: { ...interest, arr: 'Not recurring / not known' } }); assert.equal(result.response.status, 202);
});

test('an explicitly trusted address selector isolates rate buckets without storing addresses', async t => {
  const f = await fixture({ getClientAddress: (req: http.IncomingMessage) => req.headers['x-real-ip'] }); t.after(() => f.close());
  for (let i = 0; i < 10; i++) assert.equal((await f.request('/api/interest', { method: 'POST', body: { ...interest, website: 'honeypot' }, headers: { 'X-Real-IP': '192.0.2.1' } })).response.status, 202);
  assert.equal((await f.request('/api/interest', { method: 'POST', body: interest, headers: { 'X-Real-IP': '192.0.2.1' } })).response.status, 429);
  assert.equal((await f.request('/api/interest', { method: 'POST', body: interest, headers: { 'X-Real-IP': '192.0.2.2' } })).response.status, 202);
});

test('owner can manage both kinds, export formula-safe CSV, log out and reopen durable storage', async t => {
  const f = await fixture(); t.after(() => f.close());
  await f.request('/api/interest', { method: 'POST', body: { ...interest, name: '=1+1', company: 'Example, "quoted" company', arr: '' } });
  await f.request('/api/enquiries', { method: 'POST', body: { comments: '@SUM(1,2)\nSecond line, with comma and "quotes"', email: 'contact@example.test' } });
  await f.request('/api/owner/setup', { method: 'POST', body: { token, password } });
  let result = await f.request('/api/owner/submissions?kind=interest');
  assert.equal(result.json.submissions.length, 1); const id = result.json.submissions[0].id;
  assert.equal(result.json.submissions[0].arr, ''); assert.equal(result.json.retentionDays, 365);
  assert.match(result.json.submissions[0].createdAt, /Z$/);
  result = await f.request('/api/owner/submissions/' + id, { method: 'PATCH', body: { status: 'in-progress' } }); assert.equal(result.json.submission.status, 'in-progress');
  result = await f.request('/api/owner/submissions/' + id, { method: 'PATCH', body: { status: 'arbitrary' } }); assert.equal(result.response.status, 400);
  result = await f.request('/api/owner/export?kind=interest');
  assert.match(result.text, /"'=1\+1"/); assert.match(result.text, /"Example, ""quoted"" company"/); assert.match(result.response.headers.get('content-disposition')!, /^attachment/);
  result = await f.request('/api/owner/export?kind=enquiry'); assert.match(result.text, /"'@SUM\(1,2\)\nSecond line, with comma and ""quotes"""/);
  result = await f.request('/api/owner/logout', { method: 'POST', body: {} }); assert.equal(result.response.status, 200);
  result = await f.request('/api/owner/submissions'); assert.equal(result.response.status, 401);
  result = await f.request('/api/owner/login', { method: 'POST', body: { password: 'Wrong but sufficiently long password' } }); assert.equal(result.response.status, 401);
  result = await f.request('/api/owner/login', { method: 'POST', body: { password } }); assert.equal(result.response.status, 200);
  f.reopen();
  result = await f.request('/api/owner/submissions?kind=interest'); assert.equal(result.json.submissions.length, 1); assert.equal(result.json.submissions[0].status, 'in-progress');
  result = await f.request('/api/owner/submissions/' + id, { method: 'DELETE' }); assert.equal(result.response.status, 200);
  result = await f.request('/api/owner/submissions/' + id, { method: 'DELETE' }); assert.equal(result.response.status, 404);
  result = await f.request('/api/owner/submissions?kind=interest'); assert.equal(result.json.submissions.length, 0);
  result = await f.request('/api/owner/submissions?kind=enquiry'); assert.equal(result.json.submissions.length, 1);
});

test('sessions expire at 12 hours and retained submissions are automatically purged', async t => {
  let now = Date.parse('2030-01-01T00:00:00.000Z');
  const f = await fixture({ clock: () => now, retentionDays: 1 }); t.after(() => f.close());
  await f.request('/api/interest', { method: 'POST', body: interest });
  await f.request('/api/owner/setup', { method: 'POST', body: { token, password } });
  now += 12 * 60 * 60 * 1000;
  let result = await f.request('/api/owner/submissions'); assert.equal(result.response.status, 401);
  now += 13 * 60 * 60 * 1000;
  await f.request('/api/owner/login', { method: 'POST', body: { password } });
  result = await f.request('/api/owner/submissions'); assert.deepEqual(result.json.submissions, []); assert.equal(result.json.retentionDays, 1);
  const db = new DatabaseSync(f.dbPath, { readOnly: true }); assert.equal(db.prepare('SELECT count(*) c FROM submissions').get()!.c, 0); db.close();
});

test('login attempts are bounded, secure cookie attributes are explicit, and storage refuses symlinks', async t => {
  const f = await fixture({ secureCookies: true }); t.after(() => f.close());
  const setup = await f.request('/api/owner/setup', { method: 'POST', body: { token, password } });
  assert.match(setup.response.headers.get('set-cookie')!, /^__Host-eln-owner=/); assert.match(setup.response.headers.get('set-cookie')!, /; Secure/);
  for (let i = 0; i < 8; i++) assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password: 'Wrong but sufficiently long password' } })).response.status, 401);
  assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password } })).response.status, 429);
  const dir = await mkdtemp(join(tmpdir(), 'eln-symlink-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await symlink(f.dbPath, join(dir, 'link.sqlite'));
  assert.throws(() => createSubmissionService({ dbPath: join(dir, 'link.sqlite'), setupToken: token, origin: f.origin }), /symbolic links/);
});

test('email and owner-account throttles cannot be bypassed by changing selected edge headers', async t => {
  const f = await fixture({ getClientAddress: (req: http.IncomingMessage) => req.headers['x-real-ip'] }); t.after(() => f.close());
  for (let i = 0; i < 5; i++) assert.equal((await f.request('/api/interest', { method: 'POST', body: interest, headers: { 'X-Real-IP': `192.0.2.${i + 1}` } })).response.status, 202);
  assert.equal((await f.request('/api/interest', { method: 'POST', body: { ...interest, email: interest.email.toUpperCase() }, headers: { 'X-Real-IP': '192.0.2.99' } })).response.status, 429);
  await f.request('/api/owner/setup', { method: 'POST', body: { token, password } });
  for (let i = 0; i < 8; i++) assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password: 'Wrong but sufficiently long password' }, headers: { 'X-Real-IP': `198.51.100.${i + 1}` } })).response.status, 401);
  assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password }, headers: { 'X-Real-IP': '198.51.100.99' } })).response.status, 429);
});

test('deleting a submission removes its live SQLite content including checkpointed WAL', async t => {
  const f = await fixture(); t.after(() => f.close());
  const email = 'unique-live-delete-check@example.test';
  await f.request('/api/interest', { method: 'POST', body: { ...interest, email } });
  await f.request('/api/owner/setup', { method: 'POST', body: { token, password } });
  const listed = await f.request('/api/owner/submissions');
  const result = await f.request('/api/owner/submissions/' + listed.json.submissions[0].id, { method: 'DELETE' }); assert.equal(result.response.status, 200);
  assert(!(await readFile(f.dbPath)).includes(Buffer.from(email)));
  try { assert(!(await readFile(f.dbPath + '-wal')).includes(Buffer.from(email))); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
});
