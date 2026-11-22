import { statSync } from "node:fs";
import { config } from "./wdio.native.conf.ts";

if (!Array.isArray(config.services) || config.services.length !== 1) {
  throw new Error("native E2E config must register exactly one Tauri service");
}

const [service] = config.services;
if (!Array.isArray(service) || service[0] !== "@wdio/tauri-service") {
  throw new Error("native E2E config must use @wdio/tauri-service");
}

const options = service[1];
if (options?.driverProvider !== "embedded" || !options?.appBinaryPath) {
  throw new Error(
    "native E2E config must select the embedded provider and an appBinaryPath",
  );
}
if (!statSync(options.appBinaryPath).isFile()) {
  throw new Error(`native E2E appBinaryPath is not a file: ${options.appBinaryPath}`);
}

await import("@wdio/tauri-service");
console.log("native E2E launcher imports and configuration are valid");
