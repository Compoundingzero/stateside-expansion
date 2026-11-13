# ELN owner-board storage on Railway

Prepared on 12 November 2026 against Railway CLI 5.71.0 and installed TypeScript SDK `railway` 3.16.0. The launch owner reviewed and applied the one-volume infrastructure change after the authoring review. The actual application deployment is verified separately.

## Exact infrastructure intent

Keep the existing project `9c491763-4d9b-4283-83ee-8b55f82b5997`, production environment `4852756e-b95b-445c-9991-abb5c22ff6f0`, and `web` service `7cf5b894-48a5-44b2-a97c-c2145ceebf76`. The source remains `Compoundingzero/stateside-expansion` on `main`; the public URL remains `https://web-production-b4c2154d.up.railway.app`. Preserve the existing `sfo: 1` placement, Dockerfile, health check and restart intent.

The only new resource is:

```ts
const boardData = volume("eln-data", { region: "sfo" });
```

Attach it to the existing service using `volumeMounts: { "/data": boardData }` and include both `web` and `boardData` in the existing project's resource list. This is the installed SDK's `VolumeNode` form: `IntentServiceConfig.volumeMounts` accepts a path-to-volume map; `VolumeConfig.region` and `sizeMB` are optional. No explicit size, resize, CPU/RAM change, replica increase, new service or PostgreSQL resource is requested. Railway chooses the new volume's default allocation under the current subscription; that is distinct from used storage and from resizing an existing resource.

The managed service environment retains `PORT=3000` and the existing `PUBLIC_SITE_URL`, and adds:

| Variable | Declaration | Purpose |
| --- | --- | --- |
| `ELN_DATA_DIRECTORY` | `/data` | Persistent SQLite location |
| `ELN_RETENTION_DAYS` | `365` | Application retention setting |
| `ELN_SETUP_TOKEN` | `preserve()` | Retain the remotely provisioned secret without its value in source |
| `RAILWAY_RUN_UID` | `0` | Start the narrow storage bootstrap with permission to prepare the root-owned mount |

The SDK signature is `preserve()` with no argument. The actual token must exist before applying this managed environment. The file does not generate a token, export an existing value or create a placeholder secret. The CLI's supported secret-input shape is `railway variable set ELN_SETUP_TOKEN --stdin --service web --environment production --skip-deploys`, with its value supplied through stdin by the owner. The launch owner provisioned the actual secret through stdin, without writing it to source or output. Do not use `--include-variables`, `--decrypt-variables` or `--show-values` for this workflow.

## Permissions: documented behavior and application implementation

Railway's [volume guide](https://docs.railway.com/volumes#permissions) states that volumes mount as root and recommends `RAILWAY_RUN_UID=0` for images using a non-root user. Its [variables reference](https://docs.railway.com/variables/reference#user-provided-configuration-variables) defines that setting as the UID of the main container process. It changes process identity; it does not promise to assign mount ownership to UID 1000. The installed volume type exposes no owner UID/GID, permission or ACL property. No fixed initial permission mode is assumed.

The application-specific implementation is a short privileged startup phase, followed by privilege dropping. Keep Docker's `USER node` as the default. Root owns the Dockerfile/startup implementation; the IaC setting alone is not enough:

1. Before opening SQLite or listening, set `umask(0o077)`. In Railway, require `RAILWAY_VOLUME_MOUNT_PATH` to equal `/data`, require `ELN_DATA_DIRECTORY=/data`, and inspect the mounted directory. Fail startup when the intended mount is absent; do not silently create an ephemeral substitute.
2. Use `lstat` and reject symlinks/non-directory mount paths. When running as root, adjust only `/data` itself to UID/GID `1000:1000` and mode `0700`. Do not recursively change ownership or permissions across the volume.
3. For an existing database, inspect only the application's known paths: `/data/eln.sqlite`, `/data/eln.sqlite-wal`, `/data/eln.sqlite-shm`, and `/data/eln.sqlite-journal`. Missing files are normal. Reject symlinks/non-regular entries. Correct ownership to `1000:1000` and mode `0600` where necessary; do not delete, truncate or replace their contents. The rollback-journal path matters if SQLite changes journal modes.
4. Clear supplementary groups with `process.setgroups([])`, then call `process.setgid(1000)` and `process.setuid(1000)` while still privileged. Verify the resulting effective UID/GID and data-path access. Node 24 on this Linux environment exposes these APIs; no `apt`, `gosu` or extra helper is needed.
5. Only after dropping privileges should the backend open the database, enable WAL, run its migrations/retention work and start the HTTP listener. The backend creates a new database with mode `0600`. Local development can use its ordinary writable directory without requiring root; production must retain the mount check.

This narrow bootstrap is an application design based on documented Railway mount semantics, not a Railway-managed ownership feature. Verify the effective UID, directory/file permissions and a database write in the actual deployment. Never print submitted values, the setup token or database contents while checking permissions.

## Persistence and redeployment

Keep the `eln-data` resource name, mount and `sfo` placement stable after creation. Railway's [IaC reference](https://docs.railway.com/infrastructure-as-code/reference#volumes) treats volume removal, detachment, downsizing or placement changes as destructive. Do not delete/recreate the volume during ordinary application redeploys or use a new resource name for the same database. A subsequent plan must resolve the existing volume and show no replacement/destruction.

The [volume guide](https://docs.railway.com/volumes#volume-availability) says the mount exists only at container startup, not during build or pre-deploy. All database initialization, migrations and permission handling belong in runtime startup. Do not put database work in Docker build steps or `preDeployCommand`.

The [volume reference](https://docs.railway.com/volumes/reference#caveats) limits a service to one volume and disallows additional replicas with volumes. The existing single instance remains one. It also documents a short interruption during redeploys because two deployments cannot mount the same volume concurrently; a health check does not make this topology a zero-downtime deployment.

The subsequent operations release adds daily SQLite-aware encrypted backups to a separate private bucket; see `BACKUPS.md` for the actual schedule, retention and restore limits. The current IaC explicitly retains the existing 5000 MB volume allocation to avoid a null-size reconciliation; this is not a resize. The original infrastructure preparation created no production records.

## Verification performed

The live read-only status identified the same production project/service/domain, `sfo: 1`, and no existing volume. SDK type checking passed:

```sh
./node_modules/.bin/tsc --noEmit --module nodenext --moduleResolution nodenext --target ES2022 --skipLibCheck .railway/railway.ts
```

The read-only command `/workspace/tools/railway config plan --environment production --verbose` completed successfully and reported **1 to add, 5 to change, 0 to destroy**:

- Create `volume.eln-data`.
- Attach that resource at `/data` on the existing `web` service.
- Set `ELN_DATA_DIRECTORY`, `ELN_RETENTION_DAYS` and `RAILWAY_RUN_UID`.
- Reconcile `deploy.restartPolicyType` from remote `null` to the already-declared `ON_FAILURE`. This is existing configuration drift, not a newly edited restart policy.

The setup secret is not exposed by the plan; `preserve()` keeps its existing remote state. The launch owner provisioned its value before applying. No source, domain, CPU/RAM, replica or explicit size change appeared in the plan. The launch owner applied the reviewed plan with exactly one volume addition and zero destructive changes. Verify persistence through a controlled restart and the non-sensitive existing-database startup marker; use the disposable local database for real-record and owner-enrollment tests. No production test owner or fictional leads need to be retained.
