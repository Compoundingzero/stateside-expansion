import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, symlink, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash, scryptSync } from 'node:crypto';
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
  if (typeof options.beforeOpen === 'function') await options.beforeOpen(dbPath);
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

test('manual backup requires current owner proof and returns only safe verification metadata',async t=>{
 let calls=0; let fail=false;
 const f=await fixture({runOwnerBackup:async()=>{calls++;if(fail)throw Error('secret provider detail');return {completedAt:'2026-11-13T00:00:00.000Z',integrity:{integrityCheck:'ok',foreignKeys:'ok'},retentionDays:6,retentionStatus:'complete',secretAccessKey:'must never return',objectKey:'private/internal/key'};}});
 t.after(()=>f.close());
 let result=await f.request('/api/owner/backup',{method:'POST',body:{currentPassword:password}});
 assert.equal(result.response.status,401);assert.equal(calls,0);
 await f.request('/api/owner/setup',{method:'POST',body:{token,password}});
 result=await f.request('/api/owner/backup',{method:'POST',origin:'https://other.example',body:{currentPassword:password}});
 assert.equal(result.response.status,403);assert.equal(calls,0);
 result=await f.request('/api/owner/backup',{method:'POST',body:{currentPassword:'An incorrect long password'}});
 assert.equal(result.response.status,401);assert.equal(calls,0);
 result=await f.request('/api/owner/backup',{method:'POST',body:{currentPassword:password}});
 assert.equal(result.response.status,200);assert.equal(calls,1);
 assert.deepEqual(result.json,{ok:true,completedAt:'2026-11-13T00:00:00.000Z',integrity:{integrityCheck:'ok',foreignKeys:'ok'},retentionDays:6,retentionStatus:'complete'});
 fail=true;result=await f.request('/api/owner/backup',{method:'POST',body:{currentPassword:password}});
 assert.equal(result.response.status,503);assert(!result.text.includes('secret provider'));
 const unavailable=await fixture();t.after(()=>unavailable.close());
 await unavailable.request('/api/owner/setup',{method:'POST',body:{token,password}});
 result=await unavailable.request('/api/owner/backup',{method:'POST',body:{currentPassword:password}});
 assert.equal(result.response.status,503);
});

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
  result = await f.request('/api/owner/session'); assert.deepEqual(result.json, { authenticated: true, configured: true, recoveryConfigured: true });
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

const codeHash = (code: string) => createHash('sha256').update(code.slice(4).replaceAll('-', '').toUpperCase()).digest('hex');
const nextPassword = 'A replacement local password that is long enough!';

test('setup returns recovery codes only once and persists only their hashes', async t => {
  const f = await fixture(); t.after(() => f.close());
  const setup = await f.request('/api/owner/setup', { method: 'POST', body: { token, password } });
  assert.equal(setup.response.status, 200);
  const codes: string[] = setup.json.recoveryCodes;
  assert.equal(codes.length, 8); assert.equal(new Set(codes).size, 8);
  for (const code of codes) assert.match(code, /^ELN-(?:[A-F0-9]{8}-){5}[A-F0-9]{8}$/);
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, 2);
  const rows = db.prepare('SELECT * FROM owner_recovery_codes').all();
  assert.deepEqual(rows.map(row => row.code_hash).sort(), codes.map(codeHash).sort());
  assert(rows.every(row => row.owner_id === 1 && /Z$/.test(String(row.created_at))));
  db.close();
  for (const suffix of ['', '-wal']) {
    const bytes = await readFile(f.dbPath + suffix);
    for (const code of codes) { assert(!bytes.includes(Buffer.from(code))); assert(!bytes.includes(Buffer.from(code.slice(4).replaceAll('-', '')))); }
    assert(!bytes.includes(Buffer.from(password)));
  }
  let result = await f.request('/api/owner/session');
  assert.deepEqual(result.json, { authenticated: true, configured: true, recoveryConfigured: true });
  assert(!result.text.includes(codes[0]));
  result = await f.request('/api/owner/setup', { method: 'POST', body: { token, password } });
  assert.equal(result.response.status, 409); assert(!result.text.includes('recoveryCodes'));
  result = await f.request('/api/owner/session', { cookie: false });
  assert.deepEqual(result.json, { authenticated: false, configured: true });
  for (const path of ['/api/owner/recovery-codes', '/api/owner/password']) {
    result = await f.request(path, { method: 'POST', cookie: false, body: { currentPassword: password, newPassword: nextPassword } });
    assert.equal(result.response.status, 401); assert(!result.text.includes(password)); assert(!result.text.includes(codes[0]));
  }
});

test('lost-password recovery consumes one code durably and revokes every session', async t => {
  const f = await fixture(); t.after(() => f.close());
  await f.request('/api/interest', { method: 'POST', body: interest });
  const setup = await f.request('/api/owner/setup', { method: 'POST', body: { token, password } });
  const codes: string[] = setup.json.recoveryCodes; const firstCookie = f.getCookie();
  await f.request('/api/owner/login', { method: 'POST', body: { password } }); const secondCookie = f.getCookie();
  let result = await f.request('/api/owner/recover', { method: 'POST', cookie: false, body: { recoveryCode: codes[0].toLowerCase(), newPassword: nextPassword } });
  assert.equal(result.response.status, 200); assert.deepEqual(result.json, { ok: true });
  assert.match(result.response.headers.get('set-cookie')!, /Max-Age=0/);
  for (const cookie of [firstCookie, secondCookie]) assert.equal((await f.request('/api/owner/submissions', { headers: { Cookie: cookie }, keepCookie: false })).response.status, 401);
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  assert.equal(db.prepare('SELECT count(*) c FROM owner_sessions').get()!.c, 0);
  assert.equal(db.prepare('SELECT count(*) c FROM owner_recovery_codes').get()!.c, 7); db.close();
  const used = await f.request('/api/owner/recover', { method: 'POST', cookie: false, body: { recoveryCode: codes[0], newPassword: password } });
  const invalid = await f.request('/api/owner/recover', { method: 'POST', cookie: false, body: { recoveryCode: 'ELN-' + '00000000-'.repeat(5) + '00000000', newPassword: password } });
  assert.equal(used.response.status, 401); assert.deepEqual(used.json, invalid.json); assert(!used.text.includes(codes[0]));
  assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password } })).response.status, 401);
  assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password: nextPassword } })).response.status, 200);
  assert.equal((await f.request('/api/owner/submissions')).json.submissions.length, 1);
  f.reopen();
  result = await f.request('/api/owner/recover', { method: 'POST', cookie: false, body: { recoveryCode: codes[1], newPassword: password } });
  assert.equal(result.response.status, 200);
  assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password } })).response.status, 200);
});

test('concurrent use of the same recovery code succeeds exactly once', async t => {
  const f = await fixture(); t.after(() => f.close());
  const setup = await f.request('/api/owner/setup', { method: 'POST', body: { token, password } });
  const choices = [nextPassword, 'Another independent replacement password!'];
  const results = await Promise.all(choices.map(newPassword => f.request('/api/owner/recover', { method: 'POST', cookie: false, keepCookie: false, body: { recoveryCode: setup.json.recoveryCodes[0], newPassword } })));
  assert.deepEqual(results.map(result => result.response.status).sort(), [200, 401]);
  const winner = results.findIndex(result => result.response.status === 200);
  assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password: choices[winner] } })).response.status, 200);
  assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password: choices[1 - winner] } })).response.status, 401);
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  assert.equal(db.prepare('SELECT count(*) c FROM owner_recovery_codes').get()!.c, 7); db.close();
});

test('authenticated code replacement requires the current password and invalidates all old codes', async t => {
  const f = await fixture(); t.after(() => f.close());
  const setup = await f.request('/api/owner/setup', { method: 'POST', body: { token, password } });
  const oldCodes: string[] = setup.json.recoveryCodes;
  let result = await f.request('/api/owner/recovery-codes', { method: 'POST', body: { currentPassword: nextPassword } });
  assert.equal(result.response.status, 401);
  result = await f.request('/api/owner/recovery-codes', { method: 'POST', body: { currentPassword: password } });
  assert.equal(result.response.status, 200); const codes: string[] = result.json.recoveryCodes;
  assert.equal(codes.length, 8); assert(codes.every(code => !oldCodes.includes(code)));
  assert.equal((await f.request('/api/owner/session')).json.authenticated, true);
  const db = new DatabaseSync(f.dbPath, { readOnly: true });
  const hashes = db.prepare('SELECT code_hash FROM owner_recovery_codes').all().map(row => row.code_hash);
  assert.deepEqual(hashes.sort(), codes.map(codeHash).sort()); assert(oldCodes.every(code => !hashes.includes(codeHash(code)))); db.close();
  result = await f.request('/api/owner/recover', { method: 'POST', cookie: false, body: { recoveryCode: oldCodes[0], newPassword: nextPassword } });
  assert.equal(result.response.status, 401);
  result = await f.request('/api/owner/recover', { method: 'POST', cookie: false, body: { recoveryCode: codes[0], newPassword: nextPassword } });
  assert.equal(result.response.status, 200);
});

test('changing a password requires current-password proof, revokes sessions and preserves unused recovery codes', async t => {
  const f = await fixture(); t.after(() => f.close());
  const setup = await f.request('/api/owner/setup', { method: 'POST', body: { token, password } }); const firstCookie = f.getCookie();
  await f.request('/api/owner/login', { method: 'POST', body: { password } }); const secondCookie = f.getCookie();
  let result = await f.request('/api/owner/password', { method: 'POST', body: { currentPassword: nextPassword, newPassword: nextPassword } });
  assert.equal(result.response.status, 401); assert.equal((await f.request('/api/owner/session')).json.authenticated, true);
  result = await f.request('/api/owner/password', { method: 'POST', body: { currentPassword: password, newPassword: 'short' } });
  assert.equal(result.response.status, 400); assert(result.json.fields.newPassword);
  result = await f.request('/api/owner/password', { method: 'POST', body: { currentPassword: password, newPassword: nextPassword } });
  assert.equal(result.response.status, 200); assert.deepEqual(result.json, { ok: true }); assert.match(result.response.headers.get('set-cookie')!, /Max-Age=0/);
  for (const cookie of [firstCookie, secondCookie]) assert.equal((await f.request('/api/owner/submissions', { headers: { Cookie: cookie } })).response.status, 401);
  assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password } })).response.status, 401);
  assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password: nextPassword } })).response.status, 200);
  result = await f.request('/api/owner/recover', { method: 'POST', cookie: false, body: { recoveryCode: setup.json.recoveryCodes[0], newPassword: password } });
  assert.equal(result.response.status, 200);
});

test('recovery and security changes enforce origin and independent principal/address throttles without leaking secrets', async t => {
  let now = Date.parse('2030-01-01T00:00:00.000Z');
  const f = await fixture({ clock: () => now, getClientAddress: (req: http.IncomingMessage) => req.headers['x-real-ip'] }); t.after(() => f.close());
  const setup = await f.request('/api/owner/setup', { method: 'POST', body: { token, password } });
  const recoveryCode = setup.json.recoveryCodes[0];
  for (const path of ['/api/owner/recover', '/api/owner/password', '/api/owner/recovery-codes']) {
    const result = await f.request(path, { method: 'POST', body: { recoveryCode, currentPassword: password, newPassword: nextPassword }, origin: 'https://attacker.test' });
    assert.equal(result.response.status, 403); assert(!result.text.includes(recoveryCode)); assert(!result.text.includes(password));
  }
  for (let i = 0; i < 8; i++) {
    const result = await f.request('/api/owner/recover', { method: 'POST', body: { recoveryCode: 'not-a-code', newPassword: nextPassword }, headers: { 'X-Real-IP': `192.0.2.${i + 1}` } });
    assert.equal(result.response.status, 401);
  }
  let result = await f.request('/api/owner/recover', { method: 'POST', body: { recoveryCode, newPassword: nextPassword }, headers: { 'X-Real-IP': '192.0.2.100' } });
  assert.equal(result.response.status, 429); assert(Number(result.response.headers.get('retry-after')) > 0); assert(!result.text.includes(recoveryCode));
  // A caller cannot evade reauthentication limits by switching between the two security endpoints.
  for (let i = 0; i < 8; i++) {
    result = await f.request(i % 2 ? '/api/owner/password' : '/api/owner/recovery-codes', { method: 'POST', body: i % 2 ? { currentPassword: nextPassword, newPassword: nextPassword } : { currentPassword: nextPassword }, headers: { 'X-Real-IP': `198.51.100.${i + 1}` } });
    assert.equal(result.response.status, 401);
  }
  result = await f.request('/api/owner/recovery-codes', { method: 'POST', body: { currentPassword: password }, headers: { 'X-Real-IP': '198.51.100.100' } });
  assert.equal(result.response.status, 429);
  now += 15 * 60 * 1000 + 1;
  result = await f.request('/api/owner/recover', { method: 'POST', body: { recoveryCode, newPassword: nextPassword } });
  assert.equal(result.response.status, 200);
  const empty = await fixture(); t.after(() => empty.close());
  const unconfigured = await empty.request('/api/owner/recover', { method: 'POST', body: { recoveryCode, newPassword: nextPassword } });
  const consumed = await f.request('/api/owner/recover', { method: 'POST', body: { recoveryCode, newPassword: nextPassword } });
  assert.equal(unconfigured.response.status, 401); assert.deepEqual(unconfigured.json, consumed.json);
});

test('version-one migration preserves the owner, active sessions and submissions, and enables code creation after sign-in', async t => {
  const sessionToken = 'A'.repeat(43);
  const f = await fixture({ beforeOpen: (dbPath: string) => {
    const db = new DatabaseSync(dbPath);
    const salt = 'ab'.repeat(16); const digest = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
    db.exec(`CREATE TABLE owner_account (id INTEGER PRIMARY KEY CHECK(id=1), password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE owner_sessions (token_hash TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES owner_account(id) ON DELETE CASCADE, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE INDEX owner_sessions_expiry ON owner_sessions(expires_at);
      CREATE TABLE submissions (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('interest','enquiry')), name TEXT, company TEXT, arr TEXT, email TEXT NOT NULL, comments TEXT, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in-progress','closed')), created_at TEXT NOT NULL);
      CREATE INDEX submissions_kind_created ON submissions(kind,created_at DESC); PRAGMA user_version=1;`);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO owner_account VALUES(1,?,?)').run(`scrypt$16384$8$1$${salt}$${digest}`, now);
    db.prepare('INSERT INTO owner_sessions VALUES(?,1,?,?)').run(createHash('sha256').update(sessionToken).digest('hex'), now, new Date(Date.now() + 3600000).toISOString());
    db.prepare("INSERT INTO submissions VALUES('00000000-0000-0000-0000-000000000001','interest',?,?,?, ?,NULL,'in-progress',?)").run(interest.name, interest.company, interest.arr, interest.email, now);
    db.close();
  } }); t.after(() => f.close());
  const oldCookie = `eln-owner-dev=${sessionToken}`;
  let result = await f.request('/api/owner/session', { headers: { Cookie: oldCookie } });
  assert.deepEqual(result.json, { authenticated: true, configured: true, recoveryConfigured: false });
  result = await f.request('/api/owner/submissions', { headers: { Cookie: oldCookie } });
  assert.equal(result.json.submissions.length, 1); assert.equal(result.json.submissions[0].status, 'in-progress');
  assert.equal((await f.request('/api/owner/login', { method: 'POST', body: { password } })).response.status, 200);
  result = await f.request('/api/owner/recovery-codes', { method: 'POST', body: { currentPassword: password } });
  assert.equal(result.response.status, 200); assert.equal(result.json.recoveryCodes.length, 8);
  f.reopen();
  assert.deepEqual((await f.request('/api/owner/session')).json, { authenticated: true, configured: true, recoveryConfigured: true });
  assert.equal((await f.request('/api/owner/submissions')).json.submissions.length, 1);
});
