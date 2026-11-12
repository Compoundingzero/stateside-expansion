# Stateside Railway configuration

`.railway/railway.ts` describes the existing production `web` service. Read `../docs/RAILWAY.md` for the linked identities, generated-domain preservation, verification and deployment workflow.

Run `railway config plan --environment production` before applying a change. A valid deployment-settings plan must update the existing service with zero added and zero destroyed resources. Never treat a source-code push as confirmation that Infrastructure as Code changes were applied; Railway does not read `.railway/` automatically during app deployments.

The authoring file contains only public configuration. Keep authentication and secret values outside the repository. An import uses `preserve()` for existing values by default; never add `--include-variables` merely to refresh this file.
