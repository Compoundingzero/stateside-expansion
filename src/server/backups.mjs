import { DatabaseSync, backup } from 'node:sqlite';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, readFile, writeFile, stat, chmod, rm, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const MAGIC = Buffer.from('ELNBKP1\n');
const DAY = 86_400_000;
const sha = value => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const decodeXML = value => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
async function fileDigest(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}

export function backupConfigFromEnvironment(env = process.env) {
  const names = ['ENDPOINT', 'BUCKET', 'REGION', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY', 'ENCRYPTION_KEY'];
  if (!names.some(name => env[`ELN_BACKUP_${name}`])) return null;
  if (names.some(name => !env[`ELN_BACKUP_${name}`])) throw Error('Backup configuration is incomplete.');
  const key = env.ELN_BACKUP_ENCRYPTION_KEY;
  if (!/^[a-fA-F0-9]{64}$/.test(key)) throw Error('Backup encryption key must contain 32 random bytes encoded as hex.');
  let endpoint;
  try { endpoint = new URL(env.ELN_BACKUP_ENDPOINT); } catch { throw Error('Backup endpoint must be a plain HTTPS endpoint.'); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw Error('Backup endpoint must be a plain HTTPS endpoint.');
  const retentionDays = Number(env.ELN_BACKUP_RETENTION_DAYS || 6);
  const intervalHours = Number(env.ELN_BACKUP_INTERVAL_HOURS || 24);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 30 || !Number.isFinite(intervalHours) || intervalHours < 1 || intervalHours > 168) throw Error('Invalid backup retention or interval.');
  return { endpoint: endpoint.origin, bucket: env.ELN_BACKUP_BUCKET, region: env.ELN_BACKUP_REGION, accessKeyId: env.ELN_BACKUP_ACCESS_KEY_ID, secretAccessKey: env.ELN_BACKUP_SECRET_ACCESS_KEY, encryptionKey: Buffer.from(key, 'hex'), urlStyle: env.ELN_BACKUP_URL_STYLE || 'path', retentionDays, intervalHours };
}

export function signS3Request(config, method, key = '', { query = {}, payloadHash = sha(''), now = new Date() } = {}) {
  const endpoint = new URL(config.endpoint);
  const virtual = /virtual/i.test(config.urlStyle || '');
  if (virtual) endpoint.hostname = `${config.bucket}.${endpoint.hostname}`;
  endpoint.pathname = `/${[...(virtual ? [] : [config.bucket]), ...key.split('/').filter(Boolean)].map(encode).join('/')}`;
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const canonicalQuery = Object.entries(query).map(([k, v]) => [encode(k), encode(String(v))]).sort(([a, av], [b, bv]) => compare(a, b) || compare(av, bv)).map(([k, v]) => `${k}=${v}`).join('&');
  endpoint.search = canonicalQuery;
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = timestamp.slice(0, 8);
  const signed = 'host;x-amz-content-sha256;x-amz-date';
  const headers = { host: endpoint.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': timestamp };
  const canonicalHeaders = `host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
  const canonical = [method, endpoint.pathname, canonicalQuery, canonicalHeaders, signed, payloadHash].join('\n');
  const scope = `${day}/${config.region}/s3/aws4_request`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, day), config.region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(`AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${sha(canonical)}`).digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
  return { url: endpoint.href, headers };
}

export function createS3Store(config, fetcher = fetch) {
  const request = async (method, key, options = {}) => {
    const signed = signS3Request(config, method, key, options);
    const response = await fetcher(signed.url, { method, headers: { ...signed.headers, ...(options.length === undefined ? {} : { 'content-length': String(options.length) }) }, body: options.body, ...(options.body ? { duplex: 'half' } : {}), signal: AbortSignal.timeout(120_000) });
    if (!response.ok) { await response.body?.cancel(); throw Error(`Backup object storage ${method} failed (${response.status}).`); }
    return response;
  };
  return {
    async put(key, file) {
      const response = await request('PUT', key, { body: createReadStream(file), payloadHash: await fileDigest(file), length: (await stat(file)).size });
      await response.body?.cancel();
    },
    async get(key, file) {
      const response = await request('GET', key);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(file, { flags: 'wx', mode: 0o600 }));
    },
    async list(prefix) {
      const records = []; let token;
      for (let page = 0; page < 100; page++) {
        const response = await request('GET', '', { query: { 'list-type': 2, prefix, ...(token ? { 'continuation-token': token } : {}) } });
        const xml = await response.text();
        for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const key = match[1].match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
          const modified = match[1].match(/<LastModified>(.*?)<\/LastModified>/)?.[1];
          if (key && modified) records.push({ key: decodeXML(key), modified });
        }
        if (!/<IsTruncated>true<\/IsTruncated>/.test(xml)) return records;
        token = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1];
        if (!token) throw Error('Backup listing is incomplete.');
        token = decodeXML(token);
      }
      throw Error('Backup listing exceeded the safety limit.');
    },
    async delete(key) { const response = await request('DELETE', key); await response.body?.cancel(); }
  };
}

export async function encryptBackup(source, destination, key) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(MAGIC);
  // Tag is appended after the ciphertext, preserving streaming encryption.
  await writeFile(destination, Buffer.concat([MAGIC, nonce]), { flag: 'wx', mode: 0o600 });
  await pipeline(createReadStream(source), cipher, createWriteStream(destination, { flags: 'a', mode: 0o600 }));
  await writeFile(destination, cipher.getAuthTag(), { flag: 'a', mode: 0o600 });
}

export async function decryptBackup(source, destination, key) {
  const size = (await stat(source)).size;
  if (size < MAGIC.length + 12 + 16) throw Error('Backup envelope is truncated.');
  const { open } = await import('node:fs/promises');
  const file = await open(source, 'r');
  const header = Buffer.alloc(MAGIC.length + 12); const tag = Buffer.alloc(16);
  try { await file.read(header, 0, header.length, 0); await file.read(tag, 0, 16, size - 16); } finally { await file.close(); }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw Error('Backup envelope version is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(MAGIC.length));
  decipher.setAAD(MAGIC); decipher.setAuthTag(tag);
  try {
    await pipeline(createReadStream(source, { start: header.length, end: size - 17 }), decipher, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  } catch { await rm(destination, { force: true }); throw Error('Backup authentication failed.'); }
}

export function checkDatabaseIntegrity(path) {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    const checks = database.prepare('PRAGMA integrity_check').all();
    if (checks.length !== 1 || Object.values(checks[0])[0] !== 'ok' || database.prepare('PRAGMA foreign_key_check').all().length) throw Error('Restored database integrity check failed.');
    return { integrityCheck: 'ok', foreignKeys: 'ok' };
  } finally { database.close(); }
}

// This verifier has no destination option: it cannot replace the live database.
export async function verifyRemoteBackup({ objectKey, config, store = createS3Store(config) }) {
  if (!/^eln\/[0-9TZ-]+-[a-f0-9-]+\.sqlite\.aesgcm$/.test(objectKey)) throw Error('Invalid backup object key.');
  const temporary = await mkdtemp(join(tmpdir(), 'eln-restore-check-'));
  await chmod(temporary, 0o700);
  try {
    const encrypted = join(temporary, 'download.encrypted');
    const restored = join(temporary, 'restored.sqlite');
    await store.get(objectKey, encrypted);
    await decryptBackup(encrypted, restored, config.encryptionKey);
    return { event: 'eln-backup-verified', objectKey, integrity: checkDatabaseIntegrity(restored) };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export async function runBackup({ dbPath, config, store = createS3Store(config), now = new Date() }) {
  const temporary = await mkdtemp(join(tmpdir(), 'eln-backup-'));
  await chmod(temporary, 0o700);
  const objectKey = `eln/${now.toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.sqlite.aesgcm`;
  try {
    const copy = join(temporary, 'snapshot.sqlite');
    const source = new DatabaseSync(dbPath, { readOnly: true, timeout: 5000 });
    try { await backup(source, copy); } finally { source.close(); }
    await chmod(copy, 0o600);
    checkDatabaseIntegrity(copy);
    const encrypted = join(temporary, 'snapshot.encrypted');
    await encryptBackup(copy, encrypted, config.encryptionKey);
    await store.put(objectKey, encrypted);
    // Restore verification uses the uploaded remote object, not the original local copy.
    const downloaded = join(temporary, 'download.encrypted');
    await store.get(objectKey, downloaded);
    if (await fileDigest(downloaded) !== await fileDigest(encrypted)) throw Error('Downloaded backup does not match the uploaded snapshot.');
    const restored = join(temporary, 'restored.sqlite');
    await decryptBackup(downloaded, restored, config.encryptionKey);
    const integrity = checkDatabaseIntegrity(restored);
    const cutoff = now.getTime() - config.retentionDays * DAY;
    let expiredDeleted = 0; let retentionStatus = 'ok';
    try {
      for (const item of await store.list('eln/')) {
        if (item.key !== objectKey && /^eln\/[0-9TZ-]+-[a-f0-9-]+\.sqlite\.aesgcm$/.test(item.key) && Number.isFinite(Date.parse(item.modified)) && Date.parse(item.modified) < cutoff) {
          await store.delete(item.key); expiredDeleted++;
        }
      }
    } catch { retentionStatus = 'failed'; }
    return { event: 'eln-backup-completed', objectKey, completedAt: new Date().toISOString(), createdAt: now.toISOString(), encryptedBytes: (await stat(encrypted)).size, integrity, expiredDeleted, retentionDays: config.retentionDays, retentionStatus };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export function startBackupScheduler({ dbPath, env = process.env, onEvent = value => console.log(JSON.stringify(value)), store, now = () => new Date() }) {
  const config = backupConfigFromEnvironment(env);
  if (!config) return { enabled: false, stop: async () => {}, runNow: async () => { throw Error('Backups are not configured.'); } };
  const statePath = join(dirname(dbPath), 'backup-status.json');
  let timer; let stopped = false; let active;
  const readState = async () => { try { return JSON.parse(await readFile(statePath, 'utf8')); } catch { return {}; } };
  const writeState = async value => {
    const temp = `${statePath}.${randomUUID()}.tmp`;
    try { await writeFile(temp, JSON.stringify(value), { flag: 'wx', mode: 0o600 }); await rename(temp, statePath); } finally { await rm(temp, { force: true }); }
  };
  const runNow = () => {
    if (stopped) return Promise.reject(Error('Backup scheduler is stopped.'));
    if (active) return active;
    active = (async () => {
      const previous = await readState();
      await writeState({ ...previous, lastAttemptAt: now().toISOString() });
      const result = await runBackup({ dbPath, config, ...(store ? { store } : {}), now: now() });
      await writeState(result); onEvent(result); return result;
    })().finally(() => { active = undefined; });
    return active;
  };
  const tick = async () => {
    if (stopped) return;
    try {
      const state = await readState();
      if (stopped) return;
      const last = Date.parse(state.createdAt || '');
      const attempt = Date.parse(state.lastAttemptAt || '');
      const due = !Number.isFinite(last) || now().getTime() - last >= config.intervalHours * 3_600_000;
      const retryDue = !Number.isFinite(attempt) || now().getTime() - attempt >= 3_600_000;
      if (due && retryDue) await runNow();
    } catch { onEvent({ event: 'eln-backup-failed', at: now().toISOString(), error: 'Backup did not complete; check storage access and backup configuration.' }); }
    if (!stopped) { timer = setTimeout(tick, 60_000); timer.unref(); }
  };
  timer = setTimeout(tick, 1000); timer.unref();
  return { enabled: true, runNow, stop: async () => { stopped = true; clearTimeout(timer); await active?.catch(() => {}); } };
}
