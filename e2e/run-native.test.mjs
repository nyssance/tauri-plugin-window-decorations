import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { resetEvidenceArtifacts } from "./artifacts.mjs";
import { nativeSpecsForPlatform } from "./native-specs.mjs";
import {
  nativeAggregateEvidence,
  nativeWdioInvocation,
  runNativeScenarios,
} from "./run-native.mjs";

test("Windows navigation stress is part of the normal aggregate when requested", () => {
  const windowsSpecs = nativeSpecsForPlatform("win32", true);
  assert.equal(
    windowsSpecs.at(-1),
    "./specs/navigation-stress.native.spec.ts",
  );
  assert.equal(new Set(windowsSpecs).size, windowsSpecs.length);
  assert.equal(
    nativeSpecsForPlatform("linux", true).includes(
      "./specs/navigation-stress.native.spec.ts",
    ),
    false,
  );
});

test("Windows runner passes the controlled relative spec without literal quotes", () => {
  const invocation = nativeWdioInvocation(
    "win32",
    "./specs/lifecycle.native.spec.ts",
  );
  assert.equal(
    invocation.args.at(-1),
    "pnpm exec wdio run ./wdio.native.conf.ts --spec ./specs/lifecycle.native.spec.ts",
  );
});

test("native scenario aggregation continues after a failed session", async () => {
  const attempted = [];
  const results = await runNativeScenarios(
    ["./specs/drag.native.spec.ts", "./specs/navigation.native.spec.ts"],
    async (spec) => {
      attempted.push(spec);
      return spec.includes("drag") ? 1 : 0;
    },
  );

  assert.deepEqual(attempted, [
    "./specs/drag.native.spec.ts",
    "./specs/navigation.native.spec.ts",
  ]);
  assert.deepEqual(results, [
    { exitCode: 1, spec: "./specs/drag.native.spec.ts" },
    { exitCode: 0, spec: "./specs/navigation.native.spec.ts" },
  ]);
});

test("native evidence reset removes only current-suite output", () => {
  const artifactRoot = mkdtempSync(path.join(tmpdir(), "decoration-native-evidence-"));
  const stalePaths = [
    path.join(artifactRoot, "checkpoint", "native", "stale.png"),
    path.join(artifactRoot, "failure", "native", "stale.json"),
    path.join(artifactRoot, "service", "native", "stale.log"),
  ];
  const unrelatedPaths = [
    path.join(artifactRoot, "checkpoint", "browser", "browser-custom.png"),
    path.join(artifactRoot, "failure", "browser", "stale.json"),
    path.join(artifactRoot, "service", "browser", "run.json"),
  ];
  try {
    for (const file of [...stalePaths, ...unrelatedPaths]) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, "stale");
    }

    resetEvidenceArtifacts(artifactRoot, "native");

    for (const file of stalePaths) assert.equal(existsSync(file), false);
    for (const file of unrelatedPaths) assert.equal(existsSync(file), true);
  } finally {
    rmSync(artifactRoot, { force: true, recursive: true });
  }
});

test("native aggregate evidence binds every scenario result to one checkout", () => {
  const evidence = {
    platform: "linux",
    expectedCommit: "a".repeat(40),
    observedCommit: "a".repeat(40),
    workingTreeDirty: false,
  };
  const scenarios = [
    { exitCode: 0, spec: "./specs/lifecycle.native.spec.ts" },
    { exitCode: 1, spec: "./specs/controlled-failure.native.spec.ts" },
  ];

  assert.deepEqual(nativeAggregateEvidence(evidence, scenarios), {
    kind: "native-e2e-aggregate",
    ...evidence,
    scenarios,
  });
});
