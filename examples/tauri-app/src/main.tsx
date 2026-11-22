import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

if (import.meta.env.VITE_TAURI_E2E === "1") {
	const recordFrontendError = (message: string) => {
		const documentElement = document.documentElement;
		const existing = documentElement.getAttribute("data-e2e-frontend-errors");
		const errors = existing ? (JSON.parse(existing) as string[]) : [];
		errors.push(message);
		documentElement.setAttribute(
			"data-e2e-frontend-errors",
			JSON.stringify(errors.slice(-8)),
		);
	};
	window.addEventListener("error", (event) => {
		recordFrontendError(String(event.error ?? event.message));
	});
	window.addEventListener("unhandledrejection", (event) => {
		recordFrontendError(String(event.reason));
	});
}

async function initializeE2EGuest() {
	if (import.meta.env.VITE_TAURI_E2E !== "1") return;

	try {
		const guest = await import("@wdio/tauri-plugin");
		await guest.init();
		document.documentElement.setAttribute("data-e2e-guest-ready", "true");
	} catch (error) {
		document.documentElement.setAttribute("data-e2e-guest-error", String(error));
		throw error;
	}
}

async function bootstrap() {
	await initializeE2EGuest();

	ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
		<React.StrictMode>
			<App />
		</React.StrictMode>,
	);
}

void bootstrap().catch((error) => {
	if (import.meta.env.VITE_TAURI_E2E === "1") {
		document.documentElement.setAttribute("data-e2e-bootstrap-error", String(error));
	}
	console.error("failed to bootstrap the decoration example", error);
});
