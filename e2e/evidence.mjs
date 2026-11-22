import { execFileSync } from "node:child_process";

function git(rootDir, args) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

export function gitEvidence(rootDir) {
  const observedCommit = git(rootDir, ["rev-parse", "HEAD"]);
  const workingTreeDirty = git(rootDir, ["status", "--porcelain"]).length > 0;
  const expectedCommit = process.env.EVIDENCE_EXPECTED_SHA || null;
  if (process.env.CI === "true" && !expectedCommit) {
    throw new Error("EVIDENCE_EXPECTED_SHA is required for CI evidence");
  }
  if (expectedCommit && (observedCommit !== expectedCommit || workingTreeDirty)) {
    throw new Error(
      `E2E evidence checkout mismatch: expected ${expectedCommit}, observed ${observedCommit}, dirty=${workingTreeDirty}`,
    );
  }
  return { expectedCommit, observedCommit, workingTreeDirty };
}
