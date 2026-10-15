export type ChangeSurface =
  "tasks" | "docs" | "daily" | "wiki" | "recall" | "sources";
export type RecallRun = {
  candidates: {
    received: number;
    rejected: number;
    duplicates: number;
    added: number;
    addedIds: string[];
    decisions: {
      stem: string;
      outcome: "added" | "rejected" | "duplicate";
      reason?: string;
      cardId?: string;
    }[];
  };
  grading: {
    received: number;
    unmatched: number;
    graded: number;
    reviews: {
      cardId: string;
      answeredAt: string;
      verdict: string;
      rating: number;
      dueBefore: string;
      dueAfter: string;
      stateBefore: number;
      stateAfter: number;
    }[];
  };
  selection: {
    date: string;
    total: number;
    new: number;
    due: number;
    cardIds: string[];
  };
  bankSize: number;
  pendingAnswers: number;
};
export type ChangeRecord = {
  id: string;
  timestamp: string;
  source: "web" | "ingest" | "srs";
  runId: string;
  surface: ChangeSurface;
  action: "created" | "updated" | "deleted" | "status_changed" | "run";
  path: string;
  title: string;
  before?: Record<string, string | number | boolean>;
  after?: Record<string, string | number | boolean>;
  changedFields?: string[];
  noteDate?: string;
  recall?: RecallRun;
};
export type DailyChangelog = {
  version: 1;
  date: string;
  timezone: "America/New_York";
  records: ChangeRecord[];
};
