import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resetEvidenceArtifacts } from "./artifacts.mjs";
import { gitEvidence } from "./evidence.mjs";
import { nativeSpecsForPlatform } from "./native-specs.mjs";

const includeNavigationStress =
  process.env.TAURI_E2E_INCLUDE_NAVIGATION_STRESS === "1";
export const nativeSpecs = nativeSpecsForPlatform(
  process.platform,
  includeNavigationStress,
);

export async function runNativeScenarios(specs, runScenario) {
  const results = [];
  for (const spec of specs) {
    const exitCode = await runScenario(spec);
    results.push({ exitCode, spec });
  }
  return results;
}

export function nativeAggregateEvidence(evidence, results) {
  return {
    kind: "native-e2e-aggregate",
    ...evidence,
    scenarios: results,
  };
}

function runWdio(spec) {
  return new Promise((resolve) => {
    const { args, command } = nativeWdioInvocation(process.platform, spec);
    const environment = {
      ...process.env,
      TAURI_E2E_SCENARIO: path.basename(spec, path.extname(spec)),
    };
    const child = spawn(
      command,
      args,
      { env: environment, stdio: "inherit", windowsHide: true },
    );
    child.once("error", () => resolve(1));
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

export function nativeWdioInvocation(platform, spec) {
  if (platform === "win32") {
    return {
      command: process.env.ComSpec ?? "cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        `pnpm exec wdio run ./wdio.native.conf.ts --spec ${spec}`,
      ],
    };
  }
  return {
    command: "pnpm",
    args: ["exec", "wdio", "run", "./wdio.native.conf.ts", "--spec", spec],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rootDir = fileURLToPath(new URL("../", import.meta.url));
  const artifactRoot = fileURLToPath(new URL("./artifacts/", import.meta.url));
  resetEvidenceArtifacts(artifactRoot, "native");
  const evidence = { platform: process.platform, ...gitEvidence(rootDir) };
  const results = await runNativeScenarios(nativeSpecs, runWdio);
  const completedEvidence = { platform: process.platform, ...gitEvidence(rootDir) };
  if (JSON.stringify(completedEvidence) !== JSON.stringify(evidence)) {
    throw new Error("native E2E checkout changed while scenarios were running");
  }
  const serviceDirectory = path.join(artifactRoot, "service", "native");
  mkdirSync(serviceDirectory, { recursive: true });
  writeFileSync(
    path.join(serviceDirectory, "aggregate.json"),
    JSON.stringify(nativeAggregateEvidence(completedEvidence, results), null, 2),
  );
  for (const result of results) {
    console.log(`native E2E ${result.exitCode === 0 ? "passed" : "failed"}: ${result.spec}`);
  }
  process.exitCode = results.some(({ exitCode }) => exitCode !== 0) ? 1 : 0;
}
