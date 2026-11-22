import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

type TitlebarMode = "activating" | "custom" | "failed" | "native";
function App() {
	const [mode, setMode] = useState<TitlebarMode>("activating");
	const [status, setStatus] = useState("Activating custom titlebar…");

	const [clickCount, setClickCount] = useState(0);

	useEffect(() => {
		let disposed = false;
		const parameters = new URLSearchParams(window.location.search);
		const nativeTest = import.meta.env.VITE_TAURI_E2E === "1";
		const controlledFailure =
			nativeTest && parameters.has("e2e-native-failure");
		const activate = () => {
			void invoke<TitlebarMode>("activate_and_show")
				.then((result) => {
					if (disposed) return;
					setMode(result);
					setStatus(
						result === "custom"
							? "Custom titlebar active"
							: "Native titlebar fallback",
					);
				})
				.catch((error) => {
					if (!disposed) {
						setMode("failed");
						setStatus(`Decoration setup failed: ${String(error)}`);
					}
				});
		};
		const browserTest =
			import.meta.env.VITE_BROWSER_E2E === "1" &&
			parameters.has("e2e-browser");
		const rapidRotation =
			import.meta.env.VITE_TAURI_E2E === "1" &&
			parameters.has("e2e-rapid-rotation");
		if (rapidRotation) {
			const rotationKey = "tauri-plugin-window-decorations-e2e-rotations";
			const rotationMarker = "data-tauri-window-decorations-e2e-rotation-id";
			const rotationCountMarker = "data-tauri-window-decorations-e2e-rotation-count";
			const rotation = JSON.parse(sessionStorage.getItem(rotationKey) ?? "null") as
				| { count: number; id: string }
				| null;
			if (rotation && rotation.count < 2) {
				sessionStorage.setItem(
					rotationKey,
					JSON.stringify({ ...rotation, count: rotation.count + 1 }),
				);
				window.setTimeout(() => window.location.reload(), 0);
			} else if (rotation) {
				document.documentElement.setAttribute(rotationMarker, rotation.id);
				document.documentElement.setAttribute(
					rotationCountMarker,
					String(rotation.count),
				);
				sessionStorage.removeItem(rotationKey);
			}
		}
		if (browserTest || controlledFailure) {
			window.addEventListener("tauri-decoration-e2e-activate", activate, {
				once: true,
			});
		} else {
			activate();
		}
		if (nativeTest) {
			document.documentElement.setAttribute("data-e2e-activation-ready", "true");
		}
		return () => {
			disposed = true;
			window.removeEventListener("tauri-decoration-e2e-activate", activate);
		};
	}, []);

	return (
		<div
			className="app"
			data-titlebar-mode={mode}
			data-e2e-shell-ready={import.meta.env.VITE_TAURI_E2E === "1" ? "true" : undefined}
		>
			{mode === "custom" && (
				<>
					<div className="titlebar-surface" aria-hidden="true" />
					<header className="titlebar-content" data-tauri-drag-region data-testid="titlebar">
						<span className="app-title" data-tauri-drag-region data-testid="title">Decoration example</span>
						<button
							type="button"
							className="titlebar-action"
							data-testid="interactive-titlebar-control"
							onClick={() => setClickCount((c) => c + 1)}
						>
							Menu {clickCount > 0 ? `(${clickCount})` : ""}
						</button>
					</header>
				</>
			)}

			<main className="app-body">
				<section className="intro" aria-labelledby="demo-title">
					<p className="eyebrow">tauri-plugin-window-decorations</p>
					<h1 id="demo-title">One window. Native controls.</h1>
					<p>
						The backend awaits the complete decoration transaction before revealing
						the window.
					</p>
					<p>
						If activation fails or reaches its deadline, Rust restores and reveals
						the native titlebar.
					</p>
					<p className="status" role="status">
						{status}
					</p>
				</section>
			</main>
		</div>
	);
}

export default App;
