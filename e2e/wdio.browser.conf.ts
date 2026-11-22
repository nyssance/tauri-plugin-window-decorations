import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TauriServiceOptions } from "@wdio/tauri-service";
import { resetEvidenceArtifacts } from "./artifacts.mjs";
import { gitEvidence } from "./evidence.mjs";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const devServerUrl = "http://127.0.0.1:4174";
const artifactRoot = path.join(rootDir, "e2e/artifacts");
const checkpointDirectory = path.join(artifactRoot, "checkpoint", "browser");
const failureDirectory = path.join(artifactRoot, "failure", "browser");
const serviceDirectory = path.join(artifactRoot, "service", "browser");
let viteProcess: ChildProcess | undefined;
let spawnError: Error | undefined;

async function waitForDevServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (spawnError) throw spawnError;
    try {
      const response = await fetch(`${devServerUrl}/`);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite did not become ready at ${devServerUrl}`);
}

async function startDevServer() {
  resetEvidenceArtifacts(artifactRoot, "browser");
  for (const directory of [
    checkpointDirectory,
    failureDirectory,
    serviceDirectory,
  ]) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(
    path.join(serviceDirectory, "run.json"),
    JSON.stringify({
      kind: "browser-e2e",
      platform: process.platform,
      devServerUrl,
      ...gitEvidence(rootDir),
    }),
  );
  const viteEntry = path.join(
    rootDir,
    "examples/tauri-app/node_modules/vite/bin/vite.js",
  );
  viteProcess = spawn(
    process.execPath,
    [viteEntry, "--host", "127.0.0.1", "--port", "4174", "--strictPort"],
    {
      cwd: path.join(rootDir, "examples/tauri-app"),
      env: { ...process.env, VITE_BROWSER_E2E: "1", VITE_TAURI_E2E: "0" },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  viteProcess.once("error", (error) => {
    spawnError = error;
  });
  viteProcess.once("exit", (code) => {
    if (code !== null && code !== 0) {
      spawnError = new Error(`Vite exited before readiness with code ${code}`);
    }
  });
  await waitForDevServer();
}

async function stopDevServer() {
  if (!viteProcess || viteProcess.exitCode !== null) return;
  const processToStop = viteProcess;
  processToStop.kill();
  await once(processToStop, "exit");
  viteProcess = undefined;
}

const tauriServiceOptions: TauriServiceOptions = {
  devServerUrl,
  mode: "browser",
};

export const config = {
  runner: "local",
  autoXvfb: false,
  specs: ["./specs/presentation.browser.spec.ts"],
  maxInstances: 1,
  baseUrl: devServerUrl,
  services: [["@wdio/tauri-service", tauriServiceOptions]],
  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: [
          "--headless",
          "--disable-gpu",
          "--force-light-mode",
          "--force-device-scale-factor=1",
          "--font-render-hinting=none",
          "--hide-scrollbars",
          "--no-sandbox",
          "--window-size=1024,768",
        ],
      },
    },
  ],
  logLevel: "warn",
  outputDir: serviceDirectory,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 30000,
  },
  before: async function () {
    await browser.setWindowSize(1024, 768);
  },
  onPrepare: startDevServer,
  onComplete: stopDevServer,
  afterTest: async function (test, _context, { passed, error }) {
    if (passed) return;
    const label = [test.parent, test.title]
      .filter(Boolean)
      .join("-")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .slice(0, 96);
    const stem = `browser-${label || "unknown"}-${Date.now()}`;
    const filename = `${stem}.png`;
    let runtimeState: Record<string, unknown> = {};
    try {
      runtimeState = await browser.execute(() => {
        const runtime = (
          globalThis as typeof globalThis & {
            __TAURI_PLUGIN_DECORATION__?: { status?: () => unknown };
          }
        ).__TAURI_PLUGIN_DECORATION__;
        return {
          decoration: runtime?.status?.() ?? null,
          mode: document.querySelector(".app")?.getAttribute("data-titlebar-mode") ?? null,
          url: window.location.href,
        };
      });
    } catch (error) {
      runtimeState = { inspectionError: String(error) };
    }
    try {
      await browser.saveScreenshot(path.join(failureDirectory, filename));
    } catch (captureError) {
      runtimeState.captureError = String(captureError);
    }
    try {
      writeFileSync(
        path.join(failureDirectory, `${stem}.json`),
        JSON.stringify(
          {
            error: String(error ?? "unknown browser E2E failure").slice(0, 4000),
            platform: process.platform,
            screenshot: filename,
            test: [test.parent, test.title].filter(Boolean).join(" > "),
            ...runtimeState,
          },
          null,
          2,
        ),
      );
    } catch (artifactError) {
      console.warn("browser E2E failure artifact could not be written", artifactError);
    }
  },
} satisfies WebdriverIO.Config;
