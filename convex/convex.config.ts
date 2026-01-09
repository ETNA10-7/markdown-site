import { defineApp } from "convex/server";
// @ts-ignore - Package exports work at runtime but TypeScript needs help resolving
import aggregate from "@convex-dev/aggregate/convex.config";

const app = defineApp();

// Aggregate component for efficient page view counts (O(log n) instead of O(n))
app.use(aggregate, { name: "pageViewsByPath" });

// Aggregate component for total page views count
app.use(aggregate, { name: "totalPageViews" });

// Aggregate component for unique visitors count
app.use(aggregate, { name: "uniqueVisitors" });

export default app;

