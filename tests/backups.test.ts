import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupConfigFromEnvironment, runBackup, encryptBackup, decryptBackup, startBackupScheduler, verifyRemoteBackup } from '../src/server/backups.mjs';

const now = new Date('2026-11-13T10:00:00.000Z');
const oldKey = 'eln/2026-11-01T10-00-00-000Z-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.sqlite.aesgcm';
const env = () => ({ ELN_BACKUP_ENDPOINT: 'https://storage.example.com', ELN_BACKUP_BUCKET: 'test', ELN_BACKUP_REGION: 'auto', ELN_BACKUP_ACCESS_KEY_ID: 'example', ELN_BACKUP_SECRET_ACCESS_KEY: 'example', ELN_BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('hex') });
function memoryStore() {
  const objects = new Map<string, Buffer>();
  const deleted: string[] = [];
  return { objects, deleted,
    async put(key: string, path: string) { objects.set(key, await readFile(path)); },
    async get(key: string, path: string) { await writeFile(path, objects.get(key)!, { flag: 'wx', mode: 0o600 }); },
    async list() { return [{ key: oldKey, modified: '2026-11-01T10:00:00Z' }, { key: 'eln/unrelated.txt', modified: '2020-01-01' }, { key: oldKey.replace('11-01', '11-12'), modified: '2026-11-12T10:00:00Z' }]; },
    async delete(key: string) { deleted.push(key); }
  };
}
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'eln-backup-test-'));
  const dbPath = join(directory, 'eln.sqlite');
  const database = new DatabaseSync(dbPath);
  database.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE sample(value TEXT);');
  database.prepare('INSERT INTO sample VALUES (?)').run('fictional committed WAL record');
  return { directory, dbPath, database, async close() { database.close(); await rm(directory, { recursive: true, force: true }); } };
}

test('online backup includes committed WAL and remote ciphertext restores privately', async () => {
  const f = await fixture();
  try {
    assert.ok((await stat(`${f.dbPath}-wal`)).size > 0);
    const config = backupConfigFromEnvironment(env())!;
    const store = memoryStore();
    const result = await runBackup({ dbPath: f.dbPath, config, store, now });
    assert.deepEqual(result.integrity, { integrityCheck: 'ok', foreignKeys: 'ok' });
    assert.equal(result.retentionStatus, 'ok');
    assert.deepEqual(store.deleted, [oldKey]);
    assert.deepEqual((await verifyRemoteBackup({ objectKey: result.objectKey, config, store })).integrity, result.integrity);
    await assert.rejects(verifyRemoteBackup({ objectKey: '/data/eln.sqlite', config, store }), /Invalid backup object key/);
    const encrypted = store.objects.get(result.objectKey)!;
    assert.equal(encrypted.includes(Buffer.from('fictional committed WAL record')), false);
    const path = join(f.directory, 'download'); const restored = join(f.directory, 'restored.sqlite');
    await writeFile(path, encrypted);
    await decryptBackup(path, restored, config.encryptionKey);
    const copy = new DatabaseSync(restored, { readOnly: true });
    try { assert.equal(copy.prepare('SELECT value FROM sample').get()!.value, 'fictional committed WAL record'); } finally { copy.close(); }
    assert.equal((await stat(restored)).mode & 0o777, 0o600);
  } finally { await f.close(); }
});

test('GCM rejects changed ciphertext and wrong key and removes incomplete plaintext', async () => {
  const f = await fixture();
  try {
    const key = randomBytes(32); const encrypted = join(f.directory, 'encrypted');
    await encryptBackup(f.dbPath, encrypted, key);
    const output = join(f.directory, 'rejected.sqlite');
    await assert.rejects(decryptBackup(encrypted, output, randomBytes(32)), /authentication failed/);
    await assert.rejects(stat(output), { code: 'ENOENT' });
    const bytes = await readFile(encrypted); bytes[30] ^= 1; await writeFile(encrypted, bytes);
    await assert.rejects(decryptBackup(encrypted, output, key), /authentication failed/);
    await assert.rejects(stat(output), { code: 'ENOENT' });
  } finally { await f.close(); }
});

test('valid older ciphertext replay cannot pass verification or trigger retention', async () => {
  const f = await fixture();
  try {
    const config = backupConfigFromEnvironment(env())!; const store = memoryStore();
    const first = await runBackup({ dbPath: f.dbPath, config, store, now });
    const previous = store.objects.get(first.objectKey)!; store.deleted.length = 0;
    store.get = async (_key, path) => { await writeFile(path, previous); };
    await assert.rejects(runBackup({ dbPath: f.dbPath, config, store, now }), /does not match/);
    assert.deepEqual(store.deleted, []);
  } finally { await f.close(); }
});

test('remote failure prevents expiry; retention failure preserves verified success with explicit warning', async () => {
  const f = await fixture();
  try {
    const config = backupConfigFromEnvironment(env())!; const store = memoryStore();
    const get = store.get; store.get = async () => { throw Error('network'); };
    await assert.rejects(runBackup({ dbPath: f.dbPath, config, store, now }));
    assert.deepEqual(store.deleted, []);
    store.get = get; store.list = async () => { throw Error('listing denied'); };
    const result = await runBackup({ dbPath: f.dbPath, config, store, now });
    assert.equal(result.retentionStatus, 'failed');
    assert.equal(result.integrity.integrityCheck, 'ok');
  } finally { await f.close(); }
});

test('scheduler serializes overlapping runs, persists safe status and stops', async () => {
  const f = await fixture();
  try {
    const store = memoryStore(); const events: unknown[] = [];
    const scheduler = startBackupScheduler({ dbPath: f.dbPath, env: env(), store, now: () => now, onEvent: event => events.push(event) });
    const first = scheduler.runNow(); const second = scheduler.runNow();
    assert.equal(first, second); await first;
    await scheduler.stop();
    assert.equal(events.length, 1);
    const status = JSON.parse(await readFile(join(f.directory, 'backup-status.json'), 'utf8'));
    assert.equal(status.integrity.integrityCheck, 'ok');
    assert.equal(JSON.stringify(status).includes('fictional committed WAL record'), false);
    await assert.rejects(scheduler.runNow(), /stopped/);
    assert.equal((await stat(join(f.directory, 'backup-status.json'))).mode & 0o777, 0o600);
  } finally { await f.close(); }
});

test('configuration fails closed for partial, insecure or invalid encryption settings', () => {
  assert.equal(backupConfigFromEnvironment({}), null);
  assert.throws(() => backupConfigFromEnvironment({ ELN_BACKUP_BUCKET: 'test' }), /incomplete/);
  assert.throws(() => backupConfigFromEnvironment({ ...env(), ELN_BACKUP_ENDPOINT: 'http://storage.example.com' }), /HTTPS/);
  assert.throws(() => backupConfigFromEnvironment({ ...env(), ELN_BACKUP_ENDPOINT: 'private-invalid-endpoint' }), /HTTPS/);
  assert.throws(() => backupConfigFromEnvironment({ ...env(), ELN_BACKUP_ENCRYPTION_KEY: 'short' }), /32 random bytes/);
});
