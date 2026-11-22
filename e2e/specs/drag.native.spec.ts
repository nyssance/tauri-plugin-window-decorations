import { $, expect } from "@wdio/globals";

describe("Application-owned drag contract (Native WebDriver)", () => {
  it("keeps interactive titlebar controls outside the drag region", async () => {
    const actionBtn = await $('[data-testid="interactive-titlebar-control"]');
    await expect(actionBtn).toExist();
    await expect(actionBtn).toBeClickable();
    expect(await actionBtn.getAttribute("data-tauri-drag-region")).toBeNull();

    await actionBtn.click();
    await expect(actionBtn).toHaveText("Menu (1)");
  });

  it("marks only the application-owned noninteractive titlebar areas as draggable", async () => {
    const titlebar = await $('[data-testid="titlebar"]');
    const title = await $('[data-testid="title"]');

    const titlebarDrag = await titlebar.getAttribute("data-tauri-drag-region");
    const titleDrag = await title.getAttribute("data-tauri-drag-region");

    expect(titlebarDrag).not.toBeNull();
    expect(titleDrag).not.toBeNull();
  });
});
