import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TauriServiceOptions } from "@wdio/tauri-service";
import { gitEvidence } from "./evidence.mjs";
import { nativeSpecs } from "./native-specs.mjs";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const artifactRoot = path.join(rootDir, "e2e/artifacts");
const checkpointDirectory = path.join(artifactRoot, "checkpoint", "native");
const failureDirectory = path.join(artifactRoot, "failure", "native");
const serviceDirectory = path.join(artifactRoot, "service", "native");
const scenario = (process.env.TAURI_E2E_SCENARIO ?? "standalone").replace(
  /[^a-zA-Z0-9_-]+/g,
  "-",
);
const scenarioServiceDirectory = path.join(serviceDirectory, scenario);
const isWindows = process.platform === "win32";
const defaultAppPath = path.join(
  rootDir,
  "examples/tauri-app/src-tauri/target/release",
  isWindows ? "tauri-app.exe" : "tauri-app",
);
const applicationPath = process.env.TAURI_E2E_BINARY || defaultAppPath;
let sessionHealthy = true;
let firstFailure: string | undefined;

const tauriServiceOptions: TauriServiceOptions = {
  appBinaryPath: applicationPath,
  driverProvider: "embedded",
  autoDownloadEdgeDriver: true,
  embeddedPort: 4445,
};

export const config = {
  runner: "local",
  autoXvfb: false,
  specs: [...nativeSpecs],
  maxInstances: 1,
  services: [["@wdio/tauri-service", tauriServiceOptions]],
  capabilities: [
    {
      browserName: "tauri",
    },
  ],
  logLevel: "info",
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 30000,
  },
  bail: 1,
  waitforTimeout: 10000,
  specFileRetries: 0,
  outputDir: scenarioServiceDirectory,
  onPrepare: () => {
    sessionHealthy = true;
    firstFailure = undefined;
    for (const directory of [
      checkpointDirectory,
      failureDirectory,
      scenarioServiceDirectory,
    ]) {
      mkdirSync(directory, { recursive: true });
    }
    writeFileSync(
      path.join(scenarioServiceDirectory, "run.json"),
      JSON.stringify({
        applicationPath,
        kind: "native-e2e",
        platform: process.platform,
        scenario,
        ...gitEvidence(rootDir),
      }),
    );
  },
  afterCommand: function (command, _args, _result, error) {
    if (
      error &&
      ["execute", "getUrl", "refresh", "url"].includes(command)
    ) {
      sessionHealthy = false;
    }
  },
  afterTest: async function (test, _context, { passed, error }) {
    if (passed) return;
    const primaryError = String(error ?? "unknown native E2E failure").slice(0, 4000);
    firstFailure ??= primaryError;
    const label = [test.parent, test.title]
      .filter(Boolean)
      .join("-")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .slice(0, 96);
    const session = String(browser.sessionId ?? "unknown").replace(/[^a-zA-Z0-9_-]+/g, "-");
    const runnerPid = String(process.pid);
    let runtimeState: Record<string, unknown> = {};
    let phase = "unknown";
    if (sessionHealthy) {
      try {
        runtimeState = await browser.execute(() => {
          const runtime = (
            globalThis as typeof globalThis & {
              __TAURI_PLUGIN_DECORATION__?: { status?: () => unknown };
            }
          ).__TAURI_PLUGIN_DECORATION__;
          return {
            decoration: runtime?.status?.() ?? null,
            bootstrapError: document.documentElement.getAttribute(
              "data-e2e-bootstrap-error",
            ),
            mode: document.querySelector(".app")?.getAttribute("data-titlebar-mode") ?? null,
            url: window.location.href,
            shellReady: document.querySelector(".app")?.getAttribute("data-e2e-shell-ready") ?? null,
            guestReady: document.documentElement.getAttribute("data-e2e-guest-ready"),
            guestError: document.documentElement.getAttribute("data-e2e-guest-error"),
            frontendErrors: document.documentElement.getAttribute("data-e2e-frontend-errors"),
            activationReady: document.documentElement.getAttribute("data-e2e-activation-ready"),
            stylesheetConflict: document
              .querySelector('[data-tauri-plugin-window-decorations-stylesheet="v1"]')
              ?.getAttribute("href") ?? null,
          };
        });
        runtimeState.backendLogDirectory = scenarioServiceDirectory;
        const decoration = runtimeState.decoration;
        if (decoration && typeof decoration === "object" && "phase" in decoration) {
          phase = String((decoration as { phase?: unknown }).phase ?? "unknown");
        }
      } catch (inspectionError) {
        sessionHealthy = false;
        runtimeState = { inspectionError: String(inspectionError) };
      }
    }
    const stem = `${process.platform}-${label || "unknown"}-session-${session}-runner-pid-${runnerPid}-phase-${phase}-${Date.now()}`;
    const filename = `${stem}.png`;
    if (sessionHealthy) {
      try {
        await browser.saveScreenshot(path.join(failureDirectory, filename));
      } catch (captureError) {
        sessionHealthy = false;
        runtimeState.captureError = String(captureError);
      }
    } else {
      runtimeState = {
        ...runtimeState,
        session: "unhealthy; WebDriver probes stopped after the primary failure",
      };
    }
    try {
      writeFileSync(
        path.join(failureDirectory, `${stem}.json`),
        JSON.stringify(
          {
            error: primaryError,
            firstError: firstFailure,
            classification: classifyNativeFailure(primaryError),
            platform: process.platform,
            runnerPid,
            sessionId: session,
            lifecyclePhase: phase,
            screenshot: sessionHealthy ? filename : null,
            test: [test.parent, test.title].filter(Boolean).join(" > "),
            ...runtimeState,
          },
          null,
          2,
        ),
      );
    } catch (artifactError) {
      console.warn("native E2E failure artifact could not be written", artifactError);
    }
  },
} satisfies WebdriverIO.Config;

function classifyNativeFailure(error: string) {
  const value = error.toLowerCase();
  if (value.includes("econnrefused") || value.includes("connection refused")) {
    return "embedded-endpoint-loss";
  }
  if (value.includes("script timeout") || value.includes("timeout executing script")) {
    return "script-timeout";
  }
  if (value.includes("page load") || value.includes("pageload")) {
    return "page-load-timeout";
  }
  if (value.includes("process") && value.includes("exit")) return "application-exit";
  if (value.includes("assert")) return "assertion";
  return "native-e2e-failure";
}
