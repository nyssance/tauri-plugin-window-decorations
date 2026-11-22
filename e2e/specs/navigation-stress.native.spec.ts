import { $, expect } from "@wdio/globals";
import { navigateToReplacementDocument } from "./navigation.native.helpers.js";

describe("Navigation stress (Native WebDriver)", () => {
  it("converges after one hundred sequential document replacements", async () => {
    for (let iteration = 0; iteration < 100; iteration += 1) {
      await navigateToReplacementDocument();
    }
    const app = await $(".app");
    const status = await $("[role=\"status\"]");
    await expect(app).toHaveAttribute("data-titlebar-mode", "custom");
    await expect(status).toHaveText("Custom titlebar active");
  });
});
