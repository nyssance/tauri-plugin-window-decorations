import { $, $$, expect } from "@wdio/globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactDirectory = fileURLToPath(new URL("../artifacts/", import.meta.url));

describe("Decoration activation state and layout (Native WebDriver)", () => {
  it("reports the committed custom state after activation", async () => {
    const app = await $(".app");
    const titlebar = await $('[data-testid="titlebar"]');
    const status = await $('[role="status"]');

    await expect(app).toHaveAttribute("data-titlebar-mode", "custom");
    await expect(titlebar).toExist();
    await expect(status).toExist();
    await expect(status).toHaveText("Custom titlebar active");
  });

  it("keeps the application content below the fixed titlebar after resize", async () => {
    const before = (await browser.tauri.execute(({ core }) =>
      core.invoke("e2e_window_metrics"),
    )) as [number, number, number, number, number, boolean, boolean];
    await browser.setWindowSize(1024, 768);
    const titlebar = await $('[data-testid="titlebar"]');
    const appBody = await $(".app-body");

    await expect(titlebar).toExist();
    await expect(appBody).toExist();
    expect((await appBody.getCSSProperty("margin-top")).value).toBe("32px");
    const after = (await browser.tauri.execute(({ core }) =>
      core.invoke("e2e_window_metrics"),
    )) as [number, number, number, number, number, boolean, boolean];
    expect(after[2]).toBe(1024);
    expect(after[3]).toBe(768);
    expect(after[4]).toBeGreaterThan(0);
    expect(after[5]).toBe(false);
    expect(after[6]).toBe(true);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });

  it("updates native maximize and fullscreen state in the injected controls", async () => {
    if (process.platform === "darwin") {
      const controls = await $$('[data-tauri-decoration-control]');
      expect(controls.length).toBe(0);
    } else {
      const maximize = await $('[data-tauri-decoration-control="maximize"]');
      const maximizeExists = await maximize.isExisting();
      if (maximizeExists) {
        await expect(maximize).toHaveAttribute("aria-label", "Maximize window size");
        await maximize.click();
        await expect(maximize).toHaveAttribute("aria-label", "Restore window size");
        const maximizedState = (await browser.tauri.execute(({ core }) =>
          core.invoke("e2e_window_state"),
        )) as [boolean, boolean];
        expect(maximizedState[0]).toBe(true);

        await maximize.click();
        await expect(maximize).toHaveAttribute("aria-label", "Maximize window size");
        const restoredState = (await browser.tauri.execute(({ core }) =>
          core.invoke("e2e_window_state"),
        )) as [boolean, boolean];
        expect(restoredState[0]).toBe(false);
      } else {
        expect(process.platform).toBe("linux");
      }
    }

    await browser.tauri.execute(({ core }) =>
      core.invoke("set_e2e_fullscreen", { fullscreen: true }),
    );
    const root = await $("[data-tauri-plugin-window-decorations-root]");
    try {
      await expect(root).toHaveAttribute("data-tauri-decoration-fullscreen", "");
      const fullscreenState = (await browser.tauri.execute(({ core }) =>
        core.invoke("e2e_window_state"),
      )) as [boolean, boolean];
      expect(fullscreenState[1]).toBe(true);
    } finally {
      await browser.tauri.execute(({ core }) =>
        core.invoke("set_e2e_fullscreen", { fullscreen: false }),
      );
    }
    await expect(root).not.toHaveAttribute("data-tauri-decoration-fullscreen");
    const normalState = (await browser.tauri.execute(({ core }) =>
      core.invoke("e2e_window_state"),
    )) as [boolean, boolean];
    expect(normalState[1]).toBe(false);
    await browser.saveScreenshot(path.join(artifactDirectory, "checkpoint", "native", "native-controls-state.png"));
  });

  it("reports minimized and restored native window state", async function () {
    // xdg_toplevel exposes neither observable minimized state nor an
    // unminimize request, so this state transition cannot be asserted on Linux.
    if (process.platform === "linux") this.skip();

    const before = (await browser.tauri.execute(({ core }) =>
      core.invoke("e2e_window_metrics"),
    )) as [number, number, number, number, number, boolean, boolean];
    await browser.tauri.execute(({ core }) => core.invoke("e2e_minimize"));
    await browser.waitUntil(async () => {
      const metrics = (await browser.tauri.execute(({ core }) =>
        core.invoke("e2e_window_metrics"),
      )) as [number, number, number, number, number, boolean, boolean];
      return metrics[5] === true;
    }, { timeout: 5000, interval: 100 });
    await browser.tauri.execute(({ core }) => core.invoke("e2e_unminimize"));
    await browser.waitUntil(async () => {
      const metrics = (await browser.tauri.execute(({ core }) =>
        core.invoke("e2e_window_metrics"),
      )) as [number, number, number, number, number, boolean, boolean];
      return metrics[5] === false && metrics[6] === true;
    }, { timeout: 5000, interval: 100 });
    const restored = (await browser.tauri.execute(({ core }) =>
      core.invoke("e2e_window_metrics"),
    )) as [number, number, number, number, number, boolean, boolean];
    expect(restored.slice(0, 5)).toEqual(before.slice(0, 5));
  });
});
