#!/usr/bin/env node
import { join, resolve } from 'node:path';
import { backupConfigFromEnvironment, runBackup } from '../src/server/backups.mjs';
const config = backupConfigFromEnvironment();
if (!config) throw Error('Backups are not configured.');
const directory = resolve(process.env.ELN_DATA_DIRECTORY || 'data');
try {
  const result = await runBackup({ dbPath: join(directory, 'eln.sqlite'), config });
  console.log(JSON.stringify(result));
} catch {
  console.error(JSON.stringify({ event: 'eln-backup-failed', error: 'Backup verification did not complete.' }));
  process.exitCode = 1;
}
