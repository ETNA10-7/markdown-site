import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up stale sessions every 5 minutes
crons.interval(
  "cleanup stale sessions",
  { minutes: 5 },
  internal.stats.cleanupStaleSessions,
  {}
);

export default crons;

