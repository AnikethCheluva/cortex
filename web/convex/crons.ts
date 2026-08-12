import { cronJobs } from "convex/server";
// import { internal } from "./_generated/api";

// Mirror-sync cron DISABLED to stay within the Convex free plan — this job ran
// 24/7 and was the dominant usage. It isn't required: the web app refreshes its
// build-time snapshot on every Vercel deploy (i.e. every push), and the Dashboard
// prefers whichever snapshot is newer, so browse views stay fresh without it.
// The syncFromRepo action still exists — run a one-off manually if ever needed:
//   npx convex run sync:syncFromRepo
// To restore live between-deploy updates, uncomment (consider a paid plan):
//   crons.interval("sync vault from repo", { minutes: 30 }, internal.sync.syncFromRepo, {});
const crons = cronJobs();
export default crons;
