import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, createHmac, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, chmodSync, lstatSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isIP } from 'node:net';

const scrypt = promisify(scryptCallback);
const SESSION_LIFETIME = 12 * 60 * 60 * 1000;
const BODY_LIMIT = 32 * 1024;
const RECOVERY_CODE_COUNT = 8;
const AUTH_WINDOW = 15 * 60 * 1000;
const STATUSES = new Set(['new', 'in-progress', 'closed']);
const RECEIVED = { ok: true, message: 'Thank you. Your submission has been received.' };
const hash = value => createHash('sha256').update(value).digest('hex');
class RequestError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; }
}

async function readJson(req) {
  if (!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type'] ?? '')) {
    throw new RequestError(415, 'Please send a JSON request.');
  }
  const declared = req.headers['content-length'];
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > BODY_LIMIT)) {
    req.resume(); throw new RequestError(413, 'The request is too large.');
  }
  const raw = await new Promise((resolveBody, reject) => {
    let size = 0; const chunks = [];
    const cleanup = () => { req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.off('aborted', onAbort); };
    const fail = error => { cleanup(); req.resume(); reject(error); };
    const onData = chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) return fail(new RequestError(413, 'The request is too large.'));
      chunks.push(chunk);
    };
    const onEnd = () => { cleanup(); resolveBody(Buffer.concat(chunks).toString('utf8')); };
    const onError = () => fail(new RequestError(400, 'The request could not be read.'));
    const onAbort = () => fail(new RequestError(400, 'The request could not be read.'));
    req.on('data', onData); req.on('end', onEnd); req.on('error', onError); req.on('aborted', onAbort);
  });
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch { throw new RequestError(400, 'Please check the form and try again.'); }
}

function validateSubmission(kind, body) {
  const fields = {}; const result = {};
  const limits = kind === 'interest'
    ? { name: [1, 160], company: [1, 160], arr: [0, 160], email: [1, 254] }
    : { comments: [1, 5000], email: [1, 254] };
  const allowed = new Set([...Object.keys(limits), 'website']);
  if (Object.keys(body).some(key => !allowed.has(key))) throw new RequestError(400, 'Please check the form and try again.');
  for (const [key, [min, max]] of Object.entries(limits)) {
    const value = body[key] === undefined && min === 0 ? '' : body[key];
    if (typeof value !== 'string') { fields[key] = key === 'arr' ? 'Use text or leave this blank.' : 'This field is required.'; continue; }
    const trimmed = value.trim();
    const controls = key === 'comments' ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
    if (trimmed.length < min || trimmed.length > max || controls.test(trimmed)) {
      fields[key] = trimmed.length < min ? 'This field is required.' : `Use no more than ${max} characters without control characters.`;
    } else { result[key] = trimmed; }
  }
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(result.email)) fields.email = 'Enter a valid email address.';
  if (body.website !== undefined && typeof body.website !== 'string') fields.website = 'Please leave this field blank.';
  if (Object.keys(fields).length) throw new RequestError(400, 'Please check the form and try again.', fields);
  return result;
}

async function passwordRecord(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt}$${digest.toString('hex')}`;
}
async function verifyPassword(password, record) {
  const [algorithm, n, r, p, salt, digest] = record.split('$');
  if (algorithm !== 'scrypt' || n !== '16384' || r !== '8' || p !== '1' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(digest)) return false;
  const actual = await scrypt(password, salt, 64, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(Buffer.from(digest, 'hex'), actual);
}
function passwordInput(body, field = 'password') {
  if (typeof body[field] !== 'string' || body[field].length < 12 || body[field].length > 128 || /[\u0000-\u001f\u007f]/.test(body[field])) {
    throw new RequestError(400, 'Use a password between 12 and 128 characters.', { [field]: 'Use between 12 and 128 characters without control characters.' });
  }
  return body[field];
}
function onlyFields(body, fields) {
  if (Object.keys(body).some(key => !fields.includes(key))) throw new RequestError(400, 'Please check the form and try again.');
}
function newRecoveryCodes() {
  // Each independently generated code has 192 bits of entropy. Only its digest reaches SQLite.
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => `ELN-${randomBytes(24).toString('hex').toUpperCase().match(/.{8}/g).join('-')}`);
}
function recoveryDigest(value) {
  if (typeof value !== 'string' || value.length > 128) return null;
  const code = value.trim().toUpperCase();
  const canonical = /^[A-F0-9]{48}$/.test(code) ? code : /^ELN-(?:[A-F0-9]{8}-){5}[A-F0-9]{8}$/.test(code) ? code.slice(4).replaceAll('-', '') : null;
  return canonical ? hash(canonical) : null;
}
function publicRow(row) {
  const common = { id: row.id, kind: row.kind, email: row.email, status: row.status, createdAt: row.created_at };
  return row.kind === 'interest'
    ? { ...common, name: row.name, company: row.company, arr: row.arr ?? '' }
    : { ...common, comments: row.comments };
}
function csvCell(value) {
  let text = String(value ?? '');
  // Quoting alone does not stop spreadsheet formulas, including formulas after leading whitespace/BOM.
  if (/^[\s\uFEFF\u200B-\u200D]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Single-owner submission service. clock is injectable only to verify retention/session expiry in tests. */
export function createSubmissionService({ dbPath, setupToken = '', origin, secureCookies = true, retentionDays = 365, clock = Date.now, getClientAddress, runOwnerBackup }) {
  if (!dbPath || typeof dbPath !== 'string') throw new Error('A submission database path is required.');
  const allowedOrigin = new URL(origin).origin;
  if (!/^https?:\/\//.test(allowedOrigin)) throw new Error('A valid submission origin is required.');
  if (typeof setupToken !== 'string' || (setupToken && (setupToken.length < 32 || setupToken.length > 512))) throw new Error('The owner setup token must contain at least 32 characters.');
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw new Error('Invalid submission retention period.');
  const diskPath = dbPath === ':memory:' ? dbPath : resolve(dbPath);
  if (diskPath !== ':memory:') {
    mkdirSync(dirname(diskPath), { recursive: true, mode: 0o700 });
    for (const file of [diskPath, `${diskPath}-wal`, `${diskPath}-shm`, `${diskPath}-journal`]) {
      try { if (lstatSync(file).isSymbolicLink()) throw new Error('Submission storage must not use symbolic links.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  const db = new DatabaseSync(diskPath);
  if (diskPath !== ':memory:') chmodSync(diskPath, 0o600);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA trusted_schema=OFF;');
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 2) { db.close(); throw new Error('The submission database schema is newer than this application.'); }
  if (version === 0) db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE owner_account (
      id INTEGER PRIMARY KEY CHECK(id=1), password_hash TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE owner_sessions (
      token_hash TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES owner_account(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE INDEX owner_sessions_expiry ON owner_sessions(expires_at);
    CREATE TABLE submissions (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('interest','enquiry')),
      name TEXT, company TEXT, arr TEXT, email TEXT NOT NULL, comments TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in-progress','closed')), created_at TEXT NOT NULL
    );
    CREATE INDEX submissions_kind_created ON submissions(kind,created_at DESC);
    PRAGMA user_version=1;
    COMMIT;`);
  if (version < 2) db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE owner_recovery_codes (
      code_hash TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES owner_account(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );
    PRAGMA user_version=2;
    COMMIT;`);
  const sql = {
    owner: db.prepare('SELECT password_hash FROM owner_account WHERE id=1'),
    createOwner: db.prepare('INSERT OR IGNORE INTO owner_account(id,password_hash,created_at) VALUES(1,?,?)'),
    addSession: db.prepare('INSERT INTO owner_sessions(token_hash,owner_id,created_at,expires_at) VALUES(?,1,?,?)'),
    session: db.prepare('SELECT expires_at FROM owner_sessions WHERE token_hash=?'),
    deleteSession: db.prepare('DELETE FROM owner_sessions WHERE token_hash=?'),
    deleteSessions: db.prepare('DELETE FROM owner_sessions WHERE owner_id=1'),
    deleteExpired: db.prepare('DELETE FROM owner_sessions WHERE expires_at<=?'),
    setPassword: db.prepare('UPDATE owner_account SET password_hash=? WHERE id=1'),
    addRecovery: db.prepare('INSERT INTO owner_recovery_codes(code_hash,owner_id,created_at) VALUES(?,1,?)'),
    recovery: db.prepare('SELECT code_hash FROM owner_recovery_codes WHERE code_hash=? AND owner_id=1'),
    recoveryCount: db.prepare('SELECT count(*) AS count FROM owner_recovery_codes WHERE owner_id=1'),
    consumeRecovery: db.prepare('DELETE FROM owner_recovery_codes WHERE code_hash=? AND owner_id=1'),
    deleteRecovery: db.prepare('DELETE FROM owner_recovery_codes WHERE owner_id=1'),
    purge: db.prepare('DELETE FROM submissions WHERE created_at<?'),
    add: db.prepare("INSERT INTO submissions(id,kind,name,company,arr,email,comments,status,created_at) VALUES(?,?,?,?,?,?,?,'new',?)"),
    list: db.prepare('SELECT * FROM submissions WHERE kind=? ORDER BY created_at DESC,id DESC'),
    one: db.prepare('SELECT * FROM submissions WHERE id=?'),
    update: db.prepare('UPDATE submissions SET status=? WHERE id=?'),
    remove: db.prepare('DELETE FROM submissions WHERE id=?')
  };
  const cookieName = secureCookies ? '__Host-eln-owner' : 'eln-owner-dev';
  const cookieParts = `Path=/; HttpOnly; SameSite=Strict${secureCookies ? '; Secure' : ''}`;
  const setupDigest = hash(setupToken);
  const rateSecret = randomBytes(32); const rates = new Map();
  let closed = false; let lastPurge = 0;
  function purge(force = false) {
    const now = clock();
    if (!force && now - lastPurge < 60 * 60 * 1000) return;
    const removed = sql.purge.run(new Date(now - retentionDays * 86400000).toISOString());
    if (removed.changes) db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    sql.deleteExpired.run(new Date(now).toISOString());
    lastPurge = now;
  }
  purge(true);
  const timer = setInterval(() => { try { if (!closed) purge(true); } catch { /* No submitted content is logged. The next request retries cleanup. */ } }, 60 * 60 * 1000);
  timer.unref();
  function rate(req, purpose, limit, windowMs, identityOverride) {
    const now = clock();
    for (const [key, record] of rates) if (record.until <= now) rates.delete(key);
    // Address buckets may use the deployment-selected edge signal. Principal and
    // email buckets always have independent identities, never proxy headers.
    const selected = (purpose === 'public' || purpose.endsWith('-ip')) && typeof getClientAddress === 'function' ? getClientAddress(req) : undefined;
    const address = typeof selected === 'string' && isIP(selected) ? selected : req.socket.remoteAddress ?? 'unknown';
    const key = createHmac('sha256', rateSecret).update(`${purpose}\0${identityOverride ?? address}`).digest('hex');
    let entry = rates.get(key);
    if (!entry) {
      if (rates.size >= 10000) throw new RequestError(429, 'Please wait before trying again.');
      entry = { count: 0, until: now + windowMs }; rates.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > limit) {
      const error = new RequestError(429, 'Please wait before trying again.');
      error.retryAfter = Math.max(1, Math.ceil((entry.until - now) / 1000)); throw error;
    }
  }
  function ownerRate(req, purpose, limit = 8) {
    rate(req, `${purpose}-ip`, limit, AUTH_WINDOW);
    rate(req, purpose, limit, AUTH_WINDOW, `single-owner-${purpose}`);
  }
  function tokenFrom(req) {
    const cookie = req.headers.cookie;
    if (typeof cookie !== 'string' || cookie.length > 8192) return null;
    const item = cookie.split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`));
    const token = item?.slice(cookieName.length + 1);
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  }
  function authenticated(req) {
    const token = tokenFrom(req); if (!token) return false;
    const row = sql.session.get(hash(token));
    return Boolean(row && row.expires_at > new Date(clock()).toISOString());
  }
  function requireOwner(req) { if (!authenticated(req)) throw new RequestError(401, 'Authentication required.'); }
  function transaction(action) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = action(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function saveRecoveryCodes(codes) {
    sql.deleteRecovery.run();
    const now = new Date(clock()).toISOString();
    for (const code of codes) sql.addRecovery.run(recoveryDigest(code), now);
  }
  function clearSession(res) { res.setHeader('Set-Cookie', `${cookieName}=; ${cookieParts}; Max-Age=0`); }
  function requireUnchangedCredentials(req, expectedHash) {
    // Password work yields to other requests. Recheck both proofs inside the write
    // transaction so a concurrent reset, password change or logout wins safely.
    requireOwner(req);
    if (sql.owner.get()?.password_hash !== expectedHash) throw new RequestError(401, 'Authentication required.');
  }
  function setSession(res) {
    const token = randomBytes(32).toString('base64url'); const now = clock();
    sql.addSession.run(hash(token), new Date(now).toISOString(), new Date(now + SESSION_LIFETIME).toISOString());
    res.setHeader('Set-Cookie', `${cookieName}=${token}; ${cookieParts}; Max-Age=${SESSION_LIFETIME / 1000}`);
  }
  function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
  function kindFrom(url) {
    const kind = url.searchParams.get('kind') ?? 'interest';
    if (!['interest', 'enquiry'].includes(kind)) throw new RequestError(400, 'Choose a valid submission type.');
    return kind;
  }
  async function handle(req, res) {
    let url;
    try { url = new URL(req.url ?? '/', allowedOrigin); } catch { return false; }
    if (!url.pathname.startsWith('/api/')) return false;
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache'); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      if (closed) throw new RequestError(503, 'The service is temporarily unavailable.');
      purge();
      const method = req.method ?? 'GET';
      if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) { res.setHeader('Allow', 'GET, POST, PATCH, DELETE'); throw new RequestError(405, 'This request method is not supported.'); }
      if (['POST', 'PATCH', 'DELETE'].includes(method)) {
        if (req.headers.origin !== allowedOrigin || req.headers['sec-fetch-site'] === 'cross-site') throw new RequestError(403, 'The request origin is not allowed.');
      }
      const path = url.pathname;
      if ((path === '/api/interest' || path === '/api/enquiries') && method === 'POST') {
        rate(req, 'public', 10, 15 * 60 * 1000);
        const body = await readJson(req);
        if (typeof body.website === 'string' && body.website.trim()) { json(res, 202, RECEIVED); return true; }
        const kind = path === '/api/interest' ? 'interest' : 'enquiry';
        const fields = validateSubmission(kind, body);
        rate(req, 'public-email', 5, 60 * 60 * 1000, fields.email.toLowerCase());
        sql.add.run(randomUUID(), kind, fields.name ?? null, fields.company ?? null, fields.arr ?? null, fields.email, fields.comments ?? null, new Date(clock()).toISOString());
        json(res, 202, RECEIVED); return true;
      }
      if (path === '/api/owner/session' && method === 'GET') {
        const signedIn = authenticated(req);
        json(res, 200, { authenticated: signedIn, configured: Boolean(sql.owner.get()), ...(signedIn ? { recoveryConfigured: sql.recoveryCount.get().count > 0 } : {}) }); return true;
      }
      if (path === '/api/owner/setup' && method === 'POST') {
        ownerRate(req, 'setup', 5);
        const body = await readJson(req);
        onlyFields(body, ['token', 'password']);
        if (sql.owner.get() || !setupToken) throw new RequestError(409, 'Owner setup is unavailable.');
        const candidate = typeof body.token === 'string' && body.token.length <= 512 ? body.token : '';
        if (!timingSafeEqual(Buffer.from(hash(candidate), 'hex'), Buffer.from(setupDigest, 'hex'))) throw new RequestError(403, 'Owner setup could not be completed.');
        const record = await passwordRecord(passwordInput(body));
        const recoveryCodes = newRecoveryCodes();
        transaction(() => {
          // INSERT OR IGNORE makes concurrent setup one-use even while scrypt yields.
          const created = sql.createOwner.run(record, new Date(clock()).toISOString());
          if (created.changes !== 1) throw new RequestError(409, 'Owner setup is unavailable.');
          saveRecoveryCodes(recoveryCodes);
          setSession(res);
        });
        json(res, 200, { ok: true, recoveryCodes }); return true;
      }
      if (path === '/api/owner/login' && method === 'POST') {
        ownerRate(req, 'login');
        const body = await readJson(req); onlyFields(body, ['password']);
        const password = passwordInput(body); const owner = sql.owner.get();
        if (!owner || !(await verifyPassword(password, owner.password_hash))) throw new RequestError(401, 'Sign-in could not be completed.');
        transaction(() => {
          // Keep the final proof and insertion under one write lock, including if
          // another service connection shares the database during a restart.
          if (sql.owner.get()?.password_hash !== owner.password_hash) throw new RequestError(401, 'Sign-in could not be completed.');
          setSession(res);
        });
        json(res, 200, { ok: true }); return true;
      }
      if (path === '/api/owner/recover' && method === 'POST') {
        ownerRate(req, 'recovery');
        const body = await readJson(req); onlyFields(body, ['recoveryCode', 'newPassword']);
        const newPassword = passwordInput(body, 'newPassword');
        const digest = recoveryDigest(body.recoveryCode);
        const failed = () => new RequestError(401, 'Recovery could not be completed. Check your code and try again.');
        if (!digest || !sql.recovery.get(digest)) throw failed();
        const record = await passwordRecord(newPassword);
        transaction(() => {
          // Conditional deletion consumes the code exactly once, including when two
          // requests finish their asynchronous password work at the same time.
          if (sql.consumeRecovery.run(digest).changes !== 1) throw failed();
          sql.setPassword.run(record); sql.deleteSessions.run();
        });
        clearSession(res); json(res, 200, { ok: true }); return true;
      }
      if (path === '/api/owner/recovery-codes' && method === 'POST') {
        requireOwner(req); ownerRate(req, 'security');
        const body = await readJson(req); onlyFields(body, ['currentPassword']);
        const currentPassword = passwordInput(body, 'currentPassword'); const owner = sql.owner.get();
        if (!owner || !(await verifyPassword(currentPassword, owner.password_hash))) throw new RequestError(401, 'The security change could not be completed. Check your current password.');
        const recoveryCodes = newRecoveryCodes();
        transaction(() => { requireUnchangedCredentials(req, owner.password_hash); saveRecoveryCodes(recoveryCodes); });
        json(res, 200, { ok: true, recoveryCodes }); return true;
      }
      if (path === '/api/owner/password' && method === 'POST') {
        requireOwner(req); ownerRate(req, 'security');
        const body = await readJson(req); onlyFields(body, ['currentPassword', 'newPassword']);
        const currentPassword = passwordInput(body, 'currentPassword'); const newPassword = passwordInput(body, 'newPassword');
        const owner = sql.owner.get();
        if (!owner || !(await verifyPassword(currentPassword, owner.password_hash))) throw new RequestError(401, 'The security change could not be completed. Check your current password.');
        const record = await passwordRecord(newPassword);
        transaction(() => {
          requireUnchangedCredentials(req, owner.password_hash);
          sql.setPassword.run(record); sql.deleteSessions.run();
        });
        clearSession(res); json(res, 200, { ok: true }); return true;
      }
      if (path === '/api/owner/backup' && method === 'POST') {
        requireOwner(req); ownerRate(req, 'security');
        const body = await readJson(req); onlyFields(body, ['currentPassword']);
        const currentPassword = passwordInput(body, 'currentPassword'); const owner = sql.owner.get();
        if (!owner || !(await verifyPassword(currentPassword, owner.password_hash))) throw new RequestError(401, 'The backup could not be started. Check your current password.');
        requireUnchangedCredentials(req, owner.password_hash);
        if (typeof runOwnerBackup !== 'function') throw new RequestError(503, 'Backups are not configured.');
        try {
          const result = await runOwnerBackup();
          json(res, 200, { ok: true, completedAt: result.completedAt, integrity: result.integrity, retentionDays: result.retentionDays, retentionStatus: result.retentionStatus });
        } catch { throw new RequestError(503, 'The backup did not complete. Please try again later.'); }
        return true;
      }
      if (path === '/api/owner/logout' && method === 'POST') {
        const token = tokenFrom(req); if (token) sql.deleteSession.run(hash(token));
        req.resume(); clearSession(res);
        json(res, 200, { ok: true }); return true;
      }
      if (path === '/api/owner/submissions' && method === 'GET') {
        requireOwner(req); const kind = kindFrom(url);
        json(res, 200, { submissions: sql.list.all(kind).map(publicRow), retentionDays }); return true;
      }
      const item = path.match(/^\/api\/owner\/submissions\/([a-f0-9-]{36})$/i);
      if (item && ['PATCH', 'DELETE'].includes(method)) {
        requireOwner(req);
        const existing = sql.one.get(item[1]); if (!existing) throw new RequestError(404, 'The submission was not found.');
        if (method === 'PATCH') {
          const body = await readJson(req);
          requireOwner(req);
          if (!STATUSES.has(body.status) || Object.keys(body).some(key => key !== 'status')) throw new RequestError(400, 'Choose a valid submission status.');
          sql.update.run(body.status, item[1]); json(res, 200, { ok: true, submission: publicRow(sql.one.get(item[1])) });
        } else { req.resume(); sql.remove.run(item[1]); db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); json(res, 200, { ok: true }); }
        return true;
      }
      if (path === '/api/owner/export' && method === 'GET') {
        requireOwner(req); const kind = kindFrom(url); const rows = sql.list.all(kind).map(publicRow);
        const columns = kind === 'interest' ? ['id', 'kind', 'name', 'company', 'arr', 'email', 'status', 'createdAt'] : ['id', 'kind', 'email', 'comments', 'status', 'createdAt'];
        const csv = [columns.map(csvCell).join(','), ...rows.map(row => columns.map(key => csvCell(row[key])).join(','))].join('\r\n') + '\r\n';
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="eln-${kind}-submissions.csv"` });
        res.end(csv); return true;
      }
      if (path.startsWith('/api/owner/')) requireOwner(req);
      throw new RequestError(404, 'The requested endpoint was not found.');
    } catch (error) {
      if (res.headersSent) { res.end(); return true; }
      if (error instanceof RequestError) {
        if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
        json(res, error.status, { error: error.message, ...(error.fields ? { fields: error.fields } : {}) });
      } else { json(res, 500, { error: 'The request could not be completed. Please try again.' }); }
      return true;
    }
  }
  return { handle, close() { if (closed) return; closed = true; clearInterval(timer); db.close(); rates.clear(); rateSecret.fill(0); } };
}
