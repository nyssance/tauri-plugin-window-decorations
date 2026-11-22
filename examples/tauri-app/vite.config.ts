import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Injects the controlled conflicting stylesheet for the native E2E recovery
// scenario. The plugin runtime installs its own stylesheet once the document
// reaches DOM ready, which can happen before any deferred module script runs,
// so the conflict must exist during HTML parsing. The injected inline head
// script runs synchronously while the document is still loading and appends
// the application-owned stylesheet before the runtime can install.
function controlledStylesheetConflict(e2eBuild: boolean): Plugin {
  return {
    name: "tauri-plugin-window-decorations-e2e-controlled-conflict",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (!e2eBuild) return html;
        return {
          html,
          tags: [
            {
              tag: "script",
              injectTo: "head-prepend",
              children: `(function () {
  if (!new URLSearchParams(window.location.search).has("e2e-native-failure")) {
    return;
  }
  var conflict = document.createElement("link");
  conflict.rel = "stylesheet";
  conflict.href = "data:text/css,/* controlled stylesheet conflict */";
  conflict.setAttribute("data-tauri-plugin-window-decorations-stylesheet", "v1");
  conflict.setAttribute("data-e2e-stylesheet-conflict", "true");
  document.head.appendChild(conflict);
})();`,
            },
          ],
        };
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, ".");
  return {
    plugins: [
      react(),
      controlledStylesheetConflict(env.VITE_TAURI_E2E === "1"),
    ],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      watch: {
        // 3. tell vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
