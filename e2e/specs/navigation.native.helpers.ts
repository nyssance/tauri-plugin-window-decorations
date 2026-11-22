import { fileURLToPath } from "node:url";

export const artifactDirectory = fileURLToPath(new URL("../artifacts/", import.meta.url));
export const navigationMarker = "data-tauri-decoration-e2e-navigation";
export const rotationKey = "tauri-plugin-window-decorations-e2e-rotations";
export const rotationMarker = "data-tauri-decoration-e2e-rotation-id";
export const rotationCountMarker = "data-tauri-decoration-e2e-rotation-count";
let replacementDocumentSequence = 0;

export async function navigateToReplacementDocument() {
  replacementDocumentSequence += 1;
  await navigateWithQuery(
    `?e2e-document-replacement=${replacementDocumentSequence}`,
  );
}

export async function navigateWithQuery(query: string) {
  const target = new URL(await browser.getUrl());
  target.search = query;
  target.hash = "";
  await browser.execute(
    (marker: string) => document.documentElement.setAttribute(marker, "pending"),
    navigationMarker,
  );
  await browser.url(target.toString());
  await browser.waitUntil(
    async () =>
      await browser.execute(
        ({ marker, search }: { marker: string; search: string }) =>
          window.location.search === search &&
          !document.documentElement.hasAttribute(marker),
        { marker: navigationMarker, search: target.search },
      ),
    { timeout: 10000, interval: 100 },
  );
}
