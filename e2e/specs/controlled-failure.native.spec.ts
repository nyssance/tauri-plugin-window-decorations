import { $, expect } from "@wdio/globals";
import { navigateWithQuery } from "./navigation.native.helpers.js";

type DecorationState = {
  lifecycle: string;
  decorated: boolean;
};

describe("Controlled native-frame recovery (Native WebDriver)", () => {
  it("restores the native frame after an ordinary stylesheet-conflict failure", async () => {
    await navigateWithQuery("?e2e-native-failure");
    const app = await $(".app");
    await expect(app).toHaveAttribute("data-e2e-shell-ready", "true");
    await browser.waitUntil(async () =>
      (await browser.execute(() =>
        document.documentElement.getAttribute("data-e2e-guest-ready"),
      )) === "true",
    );
    await browser.waitUntil(async () =>
      (await browser.execute(() =>
        document.documentElement.getAttribute("data-e2e-activation-ready"),
      )) === "true",
    );
    await expect($(`[data-e2e-stylesheet-conflict="true"]`)).toExist();
    await browser.execute(() =>
      window.dispatchEvent(new Event("tauri-decoration-e2e-activate")),
    );
    const titlebar = await $('[data-testid="titlebar"]');
    const status = await $("[role=\"status\"]");
    await expect(app).toHaveAttribute("data-titlebar-mode", "native");
    await expect(titlebar).not.toExist();
    await expect(status).toHaveText("Native titlebar fallback");
    const frontendStatus = await browser.execute(() =>
      (globalThis as typeof globalThis & {
        __TAURI_PLUGIN_DECORATION__?: { status?: () => unknown };
      }).__TAURI_PLUGIN_DECORATION__?.status?.(),
    );
    expect(frontendStatus).toMatchObject({
      phase: "failed",
      errorCode: "stylesheet-conflict",
    });
    const nativeState = (await browser.tauri.execute(({ core }) =>
      core.invoke("e2e_decoration_state"),
    )) as DecorationState;
    expect(nativeState).toEqual({ lifecycle: "native", decorated: true });
  });
});
