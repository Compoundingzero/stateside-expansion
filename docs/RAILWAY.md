# Railway deployment and infrastructure

This project uses Railway Infrastructure as Code at `.railway/railway.ts`. The configuration was imported from the existing production project, edited against Railway CLI 5.71.0 and TypeScript SDK 3.16.0, type-checked, and reviewed with a read-only plan on 12 November 2026. The launch owner reviewed the fresh plan and applied the settings to the existing production service. Application deployment status and tested commit are recorded in `deployment.json`.

## Linked production identity

- Workspace: `adb766fd-2a16-4a61-86be-d147413d12eb`.
- Project: `stateside-expansion`, ID `9c491763-4d9b-4283-83ee-8b55f82b5997`.
- Environment: `production`, ID `4852756e-b95b-445c-9991-abb5c22ff6f0`.
- Existing service: `web`, ID `7cf5b894-48a5-44b2-a97c-c2145ceebf76`.
- Source: `Compoundingzero/stateside-expansion`, branch `main`.
- Existing generated public URL: https://web-production-b4c2154d.up.railway.app.

These are resource identifiers and public configuration, not credentials. The authoring file guards against a different linked project or environment. The imported `service.web` address resolves to the existing service; its plan adds no service.

## Declared behavior

The existing single `sfo` replica is retained. Builds use `Dockerfile` and the container's existing `CMD` starts `node server.mjs`. The health check is `/health`, with a 60-second timeout. Restart policy is `ON_FAILURE`, at most three retries. The service listens on `PORT=3000`. `PUBLIC_SITE_URL` supplies the generated production URL for canonical URLs and the sitemap at build time. The Dockerfile accepts the public URL as a build argument.

`source.checkSuites: true` tells Railway to wait for GitHub checks before automatic deployment. Keep the repository's CI checks working and inspect Railway deployment status after a change; a source push by itself does not prove a successful deployment.

## Preserve the generated domain

Railway's importer deliberately omits generated service domains from the authoring file. Do not add this generated hostname as a custom domain, request a replacement domain, or set an empty domain map. The current file leaves `networking` and `domains` absent.

The unedited imported configuration produced a clean no-change plan even with the existing domain present. The edited plan contains no networking changes and zero resource destruction. This preserves `web-production-b4c2154d.up.railway.app` rather than creating a duplicate. Recheck the exact plan if the domain or target port is changed later.

## Reviewed change set

The final read-only plan showed **0 to add, 3 to change, 0 to destroy**, all on the existing `web` service:

1. Set `source.checkSuites` to `true`.
2. Set `build.builder` to `DOCKERFILE`.
3. Set health-check path `/health`, timeout `60`, restart policy `ON_FAILURE` and maximum retries `3`.

The GitHub repository/branch, current variables, replica placement and generated domain do not appear as changes. No additional resource is declared, renamed or deleted. Railway groups multiple deployment fields into one change, so “3 to change” is not a count of three services.

The CLI-generated `variables: { managed: true }` policy is retained. It owns the two current public service variables. If a secret or another variable is added later, represent it with `preserve()` or deliberately revise variable ownership before applying; omitting a managed variable can delete it. The SDK's current `ProjectDefinition` type omits this newer CLI-generated property, so the policy is kept in an ordinary `production` definition object, which passes the SDK type check and the CLI's runtime planner without a type suppression.

## Operator workflow

Run from the repository root using a Railway CLI already authenticated to the intended account:

```sh
railway status
railway config plan --environment production --verbose
```

Review the linked identity and every change. Apply the reviewed settings with a fresh plan:

```sh
railway config apply --environment production --yes
```

An ordinary source or deployment-settings update should have no destruction. Do not add `--confirm-destructive` to bypass an unexpected deletion; first resolve the omitted resource, variable or wrong project/environment. A domain replacement is also a material change to inspect.

Railway does not automatically evaluate `.railway/` during an app deploy. An IaC edit must be applied through the CLI or a properly configured IaC workflow. Keep application CI distinct from an infrastructure apply.

After an apply or deployment, verify the returned deployment status, request `/health`, check the homepage and a source-backed article, and inspect canonical URLs and `/sitemap.xml`. Run the browser tests against the actual public URL when application behavior changes.

To refresh from remote state without writing secret values to source:

```sh
railway config pull --environment production --variables managed
railway config plan --environment production
```

Review the imported file before retaining it. Pull overwrites authoring configuration only when explicitly allowed; it can omit generated domains by design. Do not use `--include-variables` for a routine refresh. Authentication belongs in the CLI's secure account context or an appropriately scoped deployment secret, never in this repository or chat.

## Current Railway format

Railway's official documentation says legacy `railway.json` / `railway.toml` Config as Code is deprecated, new services cannot opt in, and existing files stop being read on 1 December 2026. This new service is configured using Infrastructure as Code. Remove any obsolete legacy deployment file from source to avoid conflicting maintenance instructions.

References read for this implementation:

- https://docs.railway.com/infrastructure-as-code
- https://docs.railway.com/infrastructure-as-code/reference
- Installed `railway` SDK 3.16.0 type declarations (`BuildConfig`, `DeployConfig`, `IntentServiceConfig`, `ProjectDefinition`).

No database, server-stored private plans, analytics vendor, custom domain, additional service or paid capacity increase is introduced by this configuration.
