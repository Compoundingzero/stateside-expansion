import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, createHmac, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, chmodSync, lstatSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isIP } from 'node:net';

const scrypt = promisify(scryptCallback);
const SESSION_LIFETIME = 12 * 60 * 60 * 1000;
const BODY_LIMIT = 32 * 1024;
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
function passwordInput(body) {
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128 || /[\u0000-\u001f\u007f]/.test(body.password)) {
    throw new RequestError(400, 'Use a password between 12 and 128 characters.');
  }
  return body.password;
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
export function createSubmissionService({ dbPath, setupToken = '', origin, secureCookies = true, retentionDays = 365, clock = Date.now, getClientAddress }) {
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
  if (version > 1) { db.close(); throw new Error('The submission database schema is newer than this application.'); }
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
  const sql = {
    owner: db.prepare('SELECT password_hash FROM owner_account WHERE id=1'),
    createOwner: db.prepare('INSERT OR IGNORE INTO owner_account(id,password_hash,created_at) VALUES(1,?,?)'),
    addSession: db.prepare('INSERT INTO owner_sessions(token_hash,owner_id,created_at,expires_at) VALUES(?,1,?,?)'),
    session: db.prepare('SELECT expires_at FROM owner_sessions WHERE token_hash=?'),
    deleteSession: db.prepare('DELETE FROM owner_sessions WHERE token_hash=?'),
    deleteExpired: db.prepare('DELETE FROM owner_sessions WHERE expires_at<=?'),
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
    // Only public abuse buckets may use the deployment-selected edge address.
    // Owner-account and email limits use independent identities, never proxy headers.
    const selected = purpose === 'public' && typeof getClientAddress === 'function' ? getClientAddress(req) : undefined;
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
        json(res, 200, { authenticated: authenticated(req), configured: Boolean(sql.owner.get()) }); return true;
      }
      if (path === '/api/owner/setup' && method === 'POST') {
        rate(req, 'setup', 5, 15 * 60 * 1000, 'single-owner-setup');
        const body = await readJson(req);
        if (sql.owner.get() || !setupToken) throw new RequestError(409, 'Owner setup is unavailable.');
        const candidate = typeof body.token === 'string' && body.token.length <= 512 ? body.token : '';
        if (!timingSafeEqual(Buffer.from(hash(candidate), 'hex'), Buffer.from(setupDigest, 'hex'))) throw new RequestError(403, 'Owner setup could not be completed.');
        const record = await passwordRecord(passwordInput(body));
        // INSERT OR IGNORE makes concurrent setup attempts one-use even while scrypt yields.
        const created = sql.createOwner.run(record, new Date(clock()).toISOString());
        if (created.changes !== 1) throw new RequestError(409, 'Owner setup is unavailable.');
        setSession(res); json(res, 200, { ok: true }); return true;
      }
      if (path === '/api/owner/login' && method === 'POST') {
        rate(req, 'login', 8, 15 * 60 * 1000, 'single-owner-account');
        const body = await readJson(req); const password = passwordInput(body); const owner = sql.owner.get();
        if (!owner || !(await verifyPassword(password, owner.password_hash))) throw new RequestError(401, 'Sign-in could not be completed.');
        setSession(res); json(res, 200, { ok: true }); return true;
      }
      if (path === '/api/owner/logout' && method === 'POST') {
        const token = tokenFrom(req); if (token) sql.deleteSession.run(hash(token));
        req.resume(); res.setHeader('Set-Cookie', `${cookieName}=; ${cookieParts}; Max-Age=0`);
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
