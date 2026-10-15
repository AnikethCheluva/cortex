import fs from "node:fs/promises";
import path from "node:path";
import {
  changeDate,
  changelogPath,
  mergeRecords,
  readChangelog,
} from "./records";
import type { ChangeRecord } from "./types";

// Local ingest runs are serialized; unique IDs make retries safe.
export async function appendLocalRecords(
  root: string,
  records: ChangeRecord[],
) {
  const dates = new Set(records.map((record) => changeDate(record.timestamp)));
  for (const date of dates) {
    const file = path.join(root, changelogPath(date));
    let raw: string | null = null;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const day = mergeRecords(
      readChangelog(raw, date),
      records.filter((record) => changeDate(record.timestamp) === date),
    );
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}`;
    await fs.writeFile(temporary, JSON.stringify(day, null, 2) + "\n");
    await fs.rename(temporary, file);
  }
}
