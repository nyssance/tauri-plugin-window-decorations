import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = fileURLToPath(
	new URL("../node_modules/@tauri-apps/cli/tauri.js", import.meta.url),
);
const result = spawnSync(
	process.execPath,
	[
		command,
		"build",
		"--config",
		"src-tauri/tauri.e2e.conf.json",
		"--features",
		"e2e-wdio",
		"--no-bundle",
	],
	{
		env: {
			...process.env,
			RUSTUP_TOOLCHAIN: process.env.RUSTUP_TOOLCHAIN ?? "stable",
			VITE_BROWSER_E2E: "0",
			VITE_TAURI_E2E: "1",
		},
		stdio: "inherit",
	},
);

if (result.error) {
	console.error(`failed to start the Tauri CLI: ${result.error.message}`);
	process.exit(1);
}

process.exit(result.status ?? 1);
