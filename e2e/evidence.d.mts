export type GitEvidence = {
  expectedCommit: string | null;
  observedCommit: string;
  workingTreeDirty: boolean;
};

export function gitEvidence(rootDir: string): GitEvidence;
