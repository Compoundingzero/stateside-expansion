#!/usr/bin/env node
import { backupConfigFromEnvironment, verifyRemoteBackup } from '../src/server/backups.mjs';
try {
  const config = backupConfigFromEnvironment();
  if (!config) throw Error('Not configured.');
  const objectKey = process.argv[2];
  if (!objectKey || process.argv.length !== 3) throw Error('One object key is required.');
  console.log(JSON.stringify(await verifyRemoteBackup({ objectKey, config })));
} catch {
  console.error(JSON.stringify({ event: 'eln-backup-verification-failed', error: 'Isolated backup verification did not complete.' }));
  process.exitCode = 1;
}
