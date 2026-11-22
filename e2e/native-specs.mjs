const baselineNativeSpecs = [
  "./specs/lifecycle.native.spec.ts",
  "./specs/drag.native.spec.ts",
  "./specs/navigation.native.spec.ts",
  "./specs/same-document.native.spec.ts",
  "./specs/rapid-rotation.native.spec.ts",
  "./specs/controlled-failure.native.spec.ts",
];

export function nativeSpecsForPlatform(
  platform,
  includeNavigationStress = false,
) {
  return [
    ...baselineNativeSpecs,
    ...(platform === "win32" && includeNavigationStress
      ? ["./specs/navigation-stress.native.spec.ts"]
      : []),
  ];
}

export const nativeSpecs = nativeSpecsForPlatform(process.platform);
