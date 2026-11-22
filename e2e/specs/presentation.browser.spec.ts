import { $, expect } from "@wdio/globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactDirectory = fileURLToPath(new URL("../artifacts/", import.meta.url));

async function captureCheckpoint(tag: string) {
  await browser.execute(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  await browser.saveScreenshot(path.join(artifactDirectory, "checkpoint", "browser", `${tag}.png`));
}

async function loadWithActivationResult(result: "custom" | "native") {
  await browser.tauri.restoreAllMocks();
  await browser.url(`/?e2e-browser=${result}`);
  await browser.tauri.restoreAllMocks();
  const activation = await browser.tauri.mock("activate_and_show");
  await activation.mockResolvedValue(result);
  await browser.execute(() => {
    window.dispatchEvent(new Event("tauri-decoration-e2e-activate"));
  });
}

async function loadWithActivationFailure() {
  await browser.tauri.restoreAllMocks();
  await browser.url("/?e2e-browser=failure");
  await browser.tauri.restoreAllMocks();
  const activation = await browser.tauri.mock("activate_and_show");
  await activation.mockRejectedValue("browser activation failure");
  await browser.execute(() => {
    window.dispatchEvent(new Event("tauri-decoration-e2e-activate"));
  });
}

describe("Titlebar Presentation & Application-Owned Layout (Browser Mode)", () => {
  it("renders and interacts with the custom titlebar after a successful activation", async () => {
    await loadWithActivationResult("custom");

    const app = await $(".app");
    const titlebar = await $('[data-testid="titlebar"]');
    const title = await $('[data-testid="title"]');
    const actionBtn = await $('[data-testid="interactive-titlebar-control"]');
    const status = await $('[role="status"]');

    await expect(app).toHaveAttribute("data-titlebar-mode", "custom");
    await expect(titlebar).toExist();
    await expect(title).toHaveText("DECORATION EXAMPLE");
    await expect(status).toHaveText("Custom titlebar active");

    expect(await titlebar.getAttribute("data-tauri-drag-region")).not.toBeNull();
    expect(await title.getAttribute("data-tauri-drag-region")).not.toBeNull();
    expect((await titlebar.getCSSProperty("pointer-events")).value).toBe("auto");

    await expect(actionBtn).toBeClickable();
    await actionBtn.click();
    await expect(actionBtn).toHaveText("Menu (1)");
    await captureCheckpoint("browser-custom");
  });

  it("renders the native fallback result distinctly", async () => {
    await loadWithActivationResult("native");

    const app = await $(".app");
    const titlebar = await $('[data-testid="titlebar"]');
    const status = await $('[role="status"]');

    await expect(app).toHaveAttribute("data-titlebar-mode", "native");
    await expect(titlebar).not.toExist();
    await expect(status).toHaveText("Native titlebar fallback");
    await captureCheckpoint("browser-native");
  });

  it("surfaces activation failure instead of accepting presentation as success", async () => {
    await loadWithActivationFailure();

    const app = await $(".app");
    const titlebar = await $('[data-testid="titlebar"]');
    const status = await $('[role="status"]');

    await expect(app).toHaveAttribute("data-titlebar-mode", "failed");
    await expect(titlebar).not.toExist();
    await expect(status).toHaveText(
      "Decoration setup failed: browser activation failure",
    );
    await captureCheckpoint("browser-failure");
  });

  it("keeps application content below the fixed titlebar", async () => {
    await loadWithActivationResult("custom");

    const appBody = await $(".app-body");
    await expect(appBody).toExist();
    expect((await appBody.getCSSProperty("margin-top")).value).toBe("32px");
  });

  it("uses keyboard focus for the example's visible focus indication", async () => {
    await loadWithActivationResult("custom");

    const actionBtn = await $('[data-testid="interactive-titlebar-control"]');
    await browser.execute(() => (document.activeElement as HTMLElement | null)?.blur());
    await browser.keys("Tab");
    expect(
      await browser.execute(
        () => document.activeElement?.getAttribute("data-testid"),
      ),
    ).toBe("interactive-titlebar-control");
    expect((await actionBtn.getCSSProperty("outline-style")).value).not.toBe("none");
    expect(
      Number.parseFloat((await actionBtn.getCSSProperty("outline-width")).value ?? "0"),
    ).toBeGreaterThan(0);
  });

  it("keeps the example target-size recommendation overridable", async () => {
    await loadWithActivationResult("custom");

    const actionBtn = await $('[data-testid="interactive-titlebar-control"]');
    expect((await actionBtn.getCSSProperty("min-height")).value).toBe("24px");

    await browser.execute(() => {
      document
        .querySelector<HTMLElement>('[data-testid="interactive-titlebar-control"]')
        ?.style.setProperty("--titlebar-action-min-size", "16px");
    });
    expect((await actionBtn.getCSSProperty("min-height")).value).toBe("16px");
  });
});
