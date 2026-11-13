# Encrypted owner-board backups

Prepared and tested on 13 November 2026. This records the actual backup mechanism and its limits; it does not authorize a production restore.

## Storage and schedule

The live board remains on volume `cce9f368-28b9-46fd-bec3-ac55317bafa2`, mounted at `/data` on the existing single `web` service. Backup objects live in the separate private Railway storage bucket `eln-backups`, ID `1aa74bc7-106a-48b6-a3a1-2ea690fe6e1e`, region `sjc`, in the existing production project. Railway documents these as [private S3-compatible buckets](https://docs.railway.com/storage-buckets). No additional application service, replica, volume, or subscription upgrade was created for backups.

Railway's [native volume backup documentation](https://docs.railway.com/volumes/backups) describes a DAILY schedule retained for six days. Attempting to enable it on volume instance `f405ce5e-8f93-47bf-b388-8b547533c58f` returned `Manual backups and backup schedules are only available for Pro workspaces` (`BAD_USER_INPUT`, trace `2251686158868184562`). Consequently there is **no native schedule ID or native snapshot ID**. No native restore or volume replacement was attempted.

The existing application instead runs `startBackupScheduler` from [backups.mjs](../src/server/backups.mjs). It backs up when no successful status exists, then every 24 hours from the last successful backup's start time. It checks once a minute while the application runs and catches up after a restart. Failed attempts retry no more than hourly. Calls in the same process share one active operation. On shutdown the scheduler stops accepting new work and the server waits for the active operation within its ordinary shutdown deadline.

This schedule depends on the application running and reaching object storage. It is not an independent Railway cron service. An extended application/provider outage delays backups; a healthy daily schedule targets at most approximately 24 hours of data loss. Server termination can interrupt an operation; only fully uploaded, downloaded, authenticated, matching and checked backups receive a successful status. The state file is `/data/backup-status.json` and contains object identifiers, timestamps and check results, never submissions or keys.

The retention target is six days. After a newly verified backup, the application lists only the `eln/` prefix and deletes matching generated backup objects whose storage modification time is older than six days. It preserves unrelated objects. It never expires old objects before the new backup has passed remote verification. If listing/deletion fails, the new backup still counts as verified, but reports `retentionStatus: "failed"`; retry/operations must address that warning. Downtime and cleanup failures can retain backups longer than six days. The six-day target reduces, but does not instantly eliminate, deleted submission data from historical backups.

The owner security page provides an immediate backup control through `POST /api/owner/backup`. It requires the existing owner session, the normal same-origin protections, the security rate limit and a JSON body containing only `currentPassword`. The server verifies that password and checks that the owner's credential/session state has not changed before calling the same scheduler's `runNow()`. An overlapping automatic run is shared. Successful HTTP 200 returns only `ok`, `completedAt`, `integrity`, `retentionDays` and `retentionStatus`; it does not disclose the object key, credentials or submission values. Failed reauthentication returns 401; unavailable/failed backup returns 503. A manual successful run also advances the next daily due time. This control is used to take a fresh snapshot after owner activation or a security change rather than waiting for the next scheduled run.

## Consistency and encryption

The process opens the source database read-only and uses Node 24's SQLite Online Backup API. That produces a standalone SQLite snapshot incorporating committed WAL transactions while the application remains live. It does not copy the `.sqlite` file alone or checkpoint/truncate production WAL files. Before upload, it checks the snapshot using `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.

Each snapshot is encrypted with AES-256-GCM before it leaves the runtime. The envelope is `ELNBKP1\n`, a fresh 12-byte nonce, ciphertext and a 16-byte authentication tag; the version bytes are authenticated as additional data. Requests use S3 Signature Version 4. Credentials, authorization headers, submission values and encryption keys are never logged.

The runtime uploads the encrypted file, downloads that exact remote object, compares its SHA-256 digest with the uploaded ciphertext, authenticates/decrypts it into a separate temporary directory, and runs both SQLite checks again. A stale valid backup cannot satisfy the upload/download digest comparison. All plaintext snapshots and restored checks use private temporary directories (`0700`) and files (`0600`), removed in `finally` blocks. A hard process/host failure can interrupt cleanup; the files live on ephemeral container storage, not in the repository or backup bucket. The verifier never opens a restored database as the production board and never outputs row contents.

## Configuration and key custody

Managed IaC preserves the existing values of `ELN_BACKUP_ENDPOINT`, `ELN_BACKUP_BUCKET`, `ELN_BACKUP_REGION`, `ELN_BACKUP_URL_STYLE`, `ELN_BACKUP_ACCESS_KEY_ID`, `ELN_BACKUP_SECRET_ACCESS_KEY` and `ELN_BACKUP_ENCRYPTION_KEY`. The current bucket credentials specify `virtual-host` URL style. The explicit public settings are `ELN_BACKUP_INTERVAL_HOURS=24` and `ELN_BACKUP_RETENTION_DAYS=6`. The actual secret values were provisioned through CLI stdin with deployment skipped; they do not appear in Git, command arguments or output.

The encryption key is 32 cryptographically random bytes encoded as 64 hexadecimal characters. An offline private copy was prepared outside the repository for delivery in the owner's credential file. Keep that copy in the owner's password manager or other protected offline storage. Bucket credentials can be recovered/reset through the Railway account; the encryption key cannot be reconstructed from an encrypted backup. Do not rotate or overwrite the encryption key without retaining the old key for all remaining old objects. Protect the offline file as strongly as the owner credentials.

Object storage separates backups from the live volume's failure domain, but both resources remain in the same Railway account. This does not guarantee access during a complete account/provider outage. Offline key custody is necessary but does not substitute for access to the encrypted objects.

## Isolated verification and recovery

The safe verification utility accepts an existing object key and has **no production destination option**:

```sh
railway run --service web --environment production --no-local -- \
  node scripts/verify-backup.mjs 'eln/REPLACE_WITH_RECORDED_BACKUP.sqlite.aesgcm'
```

Use the exact generated key recorded in the successful status. The example placeholder deliberately fails validation. In the managed development environment, outbound Node requests additionally require `NODE_USE_ENV_PROXY=1`; that is an environment-specific proxy setting, not a production requirement. The utility downloads only encrypted object data, decrypts in a private temporary directory, performs full SQLite integrity and foreign-key checks, outputs only the safe object key and check results, and removes the files. It does not export personal records or modify the live database.

An authorized production recovery is a separate maintenance operation. Keep public owner access disabled, stop the writer, retain the original volume, and restore first into an isolated target. Authenticate/decrypt with the corresponding offline key and check SQLite integrity and schema migration compatibility there. Never swap the live volume or overwrite `/data/eln.sqlite` as a verification test.

**A historical database also restores historical owner authentication state.** Old password hashes, sessions and recovery-code hashes may reappear; previously consumed one-use codes can become usable again. Before activating a restored database, revoke all restored owner sessions and replace the owner password and recovery-code set through a trusted, explicitly authorized recovery procedure. Do not trust a historical session or consumed code as proof that it should regain access. Keep the board unavailable until credential rotation and session invalidation are confirmed. Restore also reintroduces historical submissions and retention state; run the normal migration/retention path before exposing the board. Do not imply restoration preserves current deletions or one-use code history.

## Verification evidence

Six focused tests in [backups.test.ts](../tests/backups.test.ts) passed: committed uncheckpointed WAL data; private encrypted remote roundtrip; modified ciphertext/wrong-key rejection and cleanup; stale valid ciphertext replay rejection; no expiry after failed remote verification and explicit cleanup warning; scheduler serialization/state permissions/stop; and fail-closed configuration. These use fictional records only.

A real S3 synthetic roundtrip succeeded at `2026-11-13T00:21:51.221Z`: 8,228 encrypted bytes uploaded, downloaded, digest-matched, AES-GCM authenticated and restored with both then-configured SQLite quick/foreign-key checks passing. The synthetic object was then deleted. This demonstrated actual credential/signature/bucket access without reading production rows. A separate S3 prefix-list check succeeded. The implementation was subsequently strengthened from `quick_check` to the full `integrity_check`; the focused tests passed again.

The module, six focused tests, actual bucket access, private offline key handoff, scheduler/server integration and protected manual trigger are ready. Actual production snapshot and isolated verification evidence will be recorded after the deployment and owner activation. Until that returned success is recorded, the synthetic test is not evidence that the populated production board has been backed up. Production restore verification runs within the Railway runtime; no populated production database or decrypted production snapshot is copied to the development workspace.
