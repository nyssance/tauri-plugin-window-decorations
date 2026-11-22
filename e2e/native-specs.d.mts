export const nativeSpecs: readonly string[];
export function nativeSpecsForPlatform(
  platform: NodeJS.Platform,
  includeNavigationStress?: boolean,
): string[];
