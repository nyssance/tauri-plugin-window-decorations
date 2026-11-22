# Decoration example

This application is the reference integration for `tauri-plugin-window-decorations`
3.0.5. It starts the `main` window hidden, waits for decoration activation, and
restores the native frame before showing the window when activation fails.

The titlebar content and drag region belong to the application. Its interactive
button is not draggable, and the layout uses the clearances published by the
plugin.

See the project [integration guide](../../docs/integration.md) for a line-by-line
setup and [platform support](../../docs/platforms.md) for host limitations.

## Run the example

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter tauri-app build
pnpm example:dev
```

The example requires Tauri 2.10 or later, Node.js 24, and pnpm 11.18.0.

## Run its tests

Browser-mode tests run against the Vite frontend:

```sh
pnpm test:e2e:browser
```

Native tests use a separate E2E build and test-only capabilities:

```sh
pnpm example:e2e:build
pnpm test:e2e:launcher
pnpm test:e2e:native
```

Native WDIO uses the embedded provider. Windows needs the WebView2 Runtime;
the service checks and downloads the matching Edge WebDriver. Linux native
tests need a Wayland compositor and `GDK_BACKEND=wayland`.

The E2E build writes to `dist-e2e` and does not change the release
configuration. More test and artifact details are in the
[development guide](../../docs/development.md#native-e2e).
