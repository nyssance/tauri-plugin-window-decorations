import { rmSync } from "node:fs";
import path from "node:path";

export function resetEvidenceArtifacts(artifactRoot, serviceName) {
  if (serviceName !== "browser" && serviceName !== "native") {
    throw new Error(`unsupported E2E service artifact scope: ${serviceName}`);
  }
  for (const relativePath of [
    path.join("checkpoint", serviceName),
    path.join("failure", serviceName),
    path.join("service", serviceName),
  ]) {
    rmSync(path.join(artifactRoot, relativePath), { force: true, recursive: true });
  }
}
