import { defineRailway, github, preserve, project, service, volume } from "railway/iac";

// This file manages the existing production project and its existing `web`
// service. The CLI resolves service.web to the imported Railway service binding.
const PROJECT_ID = "9c491763-4d9b-4283-83ee-8b55f82b5997";

export default defineRailway((ctx) => {
  if (ctx.projectId && ctx.projectId !== PROJECT_ID) {
    throw new Error("This configuration belongs to stateside-expansion; link the correct Railway project.");
  }
  if (ctx.environment && ctx.environment !== "production") {
    throw new Error("This configuration is scoped to the existing production environment.");
  }

  // Keep this resource name and mount stable across redeploys. No size override
  // or resize is requested; Railway uses the plan's default volume allocation.
  const boardData = volume("eln-data", { region: "sfo" });

  const web = service("web", {
    source: github("Compoundingzero/stateside-expansion", {
      branch: "main",
      checkSuites: true,
    }),
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
    },
    // Preserve the existing single replica and its placement.
    replicas: { sfo: 1 },
    volumeMounts: {
      "/data": boardData,
    },
    deploy: {
      healthcheckPath: "/health",
      healthcheckTimeout: 60,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 3,
    },
    env: {
      PORT: "3000",
      PUBLIC_SITE_URL: "https://web-production-b4c2154d.up.railway.app",
      ELN_DATA_DIRECTORY: "/data",
      ELN_RETENTION_DAYS: "365",
      // Provisioned outside source; managed IaC must retain the existing secret.
      ELN_SETUP_TOKEN: preserve(),
      // Railway volumes mount as root. The narrow runtime bootstrap prepares
      // only the data paths, then drops to node UID/GID 1000 before DB/listen.
      RAILWAY_RUN_UID: "0",
    },
    // Generated Railway service domains are maintained separately by Railway.
    // Keep networking/domains absent: the imported baseline and reviewed plan
    // preserve web-production-b4c2154d.up.railway.app without creating a duplicate.
  });

  // The current CLI importer emits variables.managed; SDK 3.16.0 has not
  // added it to ProjectDefinition yet. Keep the imported policy as data.
  const production = {
    variables: { managed: true },
    resources: [web, boardData],
  };
  return project("stateside-expansion", production);
});
