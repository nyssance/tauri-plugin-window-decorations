import { $, expect } from "@wdio/globals";

describe("Same-document navigation (Native WebDriver)", () => {
  it("preserves the active titlebar across History API navigation", async () => {
    const initialUrl = await browser.getUrl();
    await browser.execute(() => {
      window.history.pushState({ e2e: "native-navigation" }, "", "#native-navigation");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await browser.getUrl()).toBe(`${initialUrl}#native-navigation`);
    const app = await $(".app");
    const titlebar = await $('[data-testid="titlebar"]');
    const status = await $("[role=\"status\"]");
    await expect(app).toHaveAttribute("data-titlebar-mode", "custom");
    await expect(titlebar).toExist();
    await expect(status).toHaveText("Custom titlebar active");
  });
});
