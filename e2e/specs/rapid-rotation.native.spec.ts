import { $, expect } from "@wdio/globals";
import path from "node:path";
import { artifactDirectory, rotationCountMarker, rotationKey, rotationMarker } from "./navigation.native.helpers.js";

describe("Rapid document rotation (Native WebDriver)", () => {
  it("keeps only the final document active", async () => {
    const rotationId = `rotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await browser.execute(
      ({ key, id }: { key: string; id: string }) =>
        sessionStorage.setItem(key, JSON.stringify({ count: 0, id })),
      { key: rotationKey, id: rotationId },
    );
    const target = new URL(await browser.getUrl());
    target.search = "?e2e-rapid-rotation";
    target.hash = "";
    await browser.url(target.toString());
    await browser.waitUntil(
      async () =>
        await browser.execute(
          ({ marker, id }: { marker: string; id: string }) =>
            document.documentElement.getAttribute(marker) === id,
          { marker: rotationMarker, id: rotationId },
        ),
      { timeout: 10000, interval: 100 },
    );
    await browser.waitUntil(
      async () =>
        await browser.execute(
          (marker: string) => document.documentElement.getAttribute(marker) === "2",
          rotationCountMarker,
        ),
      { timeout: 10000, interval: 100 },
    );
    expect(await browser.execute((key: string) => sessionStorage.getItem(key), rotationKey)).toBeNull();
    const app = await $(".app");
    const titlebar = await $('[data-testid="titlebar"]');
    const status = await $("[role=\"status\"]");
    await expect(app).toHaveAttribute("data-titlebar-mode", "custom");
    await expect(titlebar).toExist();
    await expect(status).toHaveText("Custom titlebar active");
    await browser.saveScreenshot(path.join(artifactDirectory, "checkpoint", "native", "native-rapid-rotation.png"));
  });
});
