# ELN Railway configuration

`.railway/railway.ts` describes the existing production `web` service. Read `../docs/RAILWAY.md` for the linked identities, generated-domain preservation, verification and deployment workflow.

Run `railway config plan --environment production` before applying a change. The authorized owner-board rollout adds exactly one `eln-data` volume and has zero destructive changes. Later ordinary settings plans should preserve that volume and update the existing service without resource replacement. See `docs/BOARD-STORAGE.md`. Never treat a source-code push as confirmation that Infrastructure as Code changes were applied; Railway does not read `.railway/` automatically during app deployments.

The authoring file contains only public configuration. Keep authentication and secret values outside the repository. An import uses `preserve()` for existing values by default; never add `--include-variables` merely to refresh this file.
