import { $, expect } from "@wdio/globals";
import path from "node:path";
import {
  artifactDirectory,
  navigateToReplacementDocument,
} from "./navigation.native.helpers.js";

describe("Navigation & Document Context Rotation (Native WebDriver)", () => {
  it("reactivates decoration after full-document navigation", async () => {
    await navigateToReplacementDocument();

    const app = await $(".app");
    const titlebar = await $('[data-testid="titlebar"]');
    const status = await $('[role="status"]');

    await expect(app).toHaveAttribute("data-titlebar-mode", "custom");
    await expect(titlebar).toExist();
    await expect(status).toHaveText("Custom titlebar active");
    await browser.saveScreenshot(path.join(artifactDirectory, "checkpoint", "native", "native-reload.png"));
  });
});
