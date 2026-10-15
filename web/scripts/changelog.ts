import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  BASELINE,
  beginIngest,
  diffIngest,
  type Baseline,
} from "../lib/changelog/git";
import { appendLocalRecords } from "../lib/changelog/local";
const root = process.env.VAULT_PATH || path.resolve(process.cwd(), "../examples/vault");
async function main() {
  const operation = process.argv[2];
  if (operation === "start") {
    const baseline = await beginIngest(root, randomUUID());
    console.log(`Changelog snapshot started: ${baseline.runId}`);
  } else if (operation === "finish") {
    const baseline = JSON.parse(
      await fs.readFile(path.join(root, BASELINE), "utf8"),
    ) as Baseline;
    if (baseline.version !== 1 || !/^[a-f0-9]{40,64}$/.test(baseline.tree))
      throw new Error("Invalid ingest baseline");
    const records = await diffIngest(root, baseline);
    await appendLocalRecords(root, records);
    await fs.unlink(path.join(root, BASELINE));
    console.log(`Changelog: ${records.length} file changes recorded.`);
  } else if (operation === "abort") {
    await fs.unlink(path.join(root, BASELINE));
    console.log("Changelog snapshot discarded; vault files unchanged.");
  } else throw new Error("Use changelog:ingest -- start|finish|abort");
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
