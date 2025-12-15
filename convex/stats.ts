import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Deduplication window: 30 minutes in milliseconds
const DEDUP_WINDOW_MS = 30 * 60 * 1000;

// Session timeout: 2 minutes in milliseconds
const SESSION_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Record a page view event.
 * Idempotent: same session viewing same path within 30min = 1 view.
 */
export const recordPageView = mutation({
  args: {
    path: v.string(),
    pageType: v.string(),
    sessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const dedupCutoff = now - DEDUP_WINDOW_MS;

    // Check for recent view from same session on same path
    const recentView = await ctx.db
      .query("pageViews")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("path", args.path)
      )
      .order("desc")
      .first();

    // Early return if already viewed within dedup window
    if (recentView && recentView.timestamp > dedupCutoff) {
      return null;
    }

    // Insert new view event
    await ctx.db.insert("pageViews", {
      path: args.path,
      pageType: args.pageType,
      sessionId: args.sessionId,
      timestamp: now,
    });

    return null;
  },
});

/**
 * Update active session heartbeat.
 * Creates or updates session with current path and timestamp.
 */
export const heartbeat = mutation({
  args: {
    sessionId: v.string(),
    currentPath: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find existing session by sessionId
    const existingSession = await ctx.db
      .query("activeSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existingSession) {
      // Update existing session
      await ctx.db.patch(existingSession._id, {
        currentPath: args.currentPath,
        lastSeen: now,
      });
    } else {
      // Create new session
      await ctx.db.insert("activeSessions", {
        sessionId: args.sessionId,
        currentPath: args.currentPath,
        lastSeen: now,
      });
    }

    return null;
  },
});

/**
 * Get all stats for the stats page.
 * Real-time subscription via useQuery.
 */
export const getStats = query({
  args: {},
  returns: v.object({
    activeVisitors: v.number(),
    activeByPath: v.array(
      v.object({
        path: v.string(),
        count: v.number(),
      })
    ),
    totalPageViews: v.number(),
    uniqueVisitors: v.number(),
    publishedPosts: v.number(),
    publishedPages: v.number(),
    pageStats: v.array(
      v.object({
        path: v.string(),
        title: v.string(),
        pageType: v.string(),
        views: v.number(),
      })
    ),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const sessionCutoff = now - SESSION_TIMEOUT_MS;

    // Get active sessions (heartbeat within last 2 minutes)
    const activeSessions = await ctx.db
      .query("activeSessions")
      .withIndex("by_lastSeen", (q) => q.gt("lastSeen", sessionCutoff))
      .collect();

    // Count active visitors by path
    const activeByPathMap: Record<string, number> = {};
    for (const session of activeSessions) {
      activeByPathMap[session.currentPath] =
        (activeByPathMap[session.currentPath] || 0) + 1;
    }
    const activeByPath = Object.entries(activeByPathMap)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count);

    // Get all page views
    const allViews = await ctx.db.query("pageViews").collect();

    // Aggregate views by path and count unique sessions
    const viewsByPath: Record<string, number> = {};
    const uniqueSessions = new Set<string>();

    for (const view of allViews) {
      viewsByPath[view.path] = (viewsByPath[view.path] || 0) + 1;
      uniqueSessions.add(view.sessionId);
    }

    // Get published posts and pages for titles
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    const pages = await ctx.db
      .query("pages")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    // Build page stats array with titles
    const pageStats = Object.entries(viewsByPath)
      .map(([path, views]) => {
        // Match path to post or page
        const slug = path.startsWith("/") ? path.slice(1) : path;
        const post = posts.find((p) => p.slug === slug);
        const page = pages.find((p) => p.slug === slug);

        let title = path;
        let pageType = "other";

        if (path === "/" || path === "") {
          title = "Home";
          pageType = "home";
        } else if (path === "/stats") {
          title = "Stats";
          pageType = "stats";
        } else if (post) {
          title = post.title;
          pageType = "blog";
        } else if (page) {
          title = page.title;
          pageType = "page";
        }

        return {
          path,
          title,
          pageType,
          views,
        };
      })
      .sort((a, b) => b.views - a.views);

    return {
      activeVisitors: activeSessions.length,
      activeByPath,
      totalPageViews: allViews.length,
      uniqueVisitors: uniqueSessions.size,
      publishedPosts: posts.length,
      publishedPages: pages.length,
      pageStats,
    };
  },
});

/**
 * Internal mutation to clean up stale sessions.
 * Called by cron job every 5 minutes.
 */
export const cleanupStaleSessions = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - SESSION_TIMEOUT_MS;

    // Get all stale sessions
    const staleSessions = await ctx.db
      .query("activeSessions")
      .withIndex("by_lastSeen", (q) => q.lt("lastSeen", cutoff))
      .collect();

    // Delete in parallel
    await Promise.all(staleSessions.map((session) => ctx.db.delete(session._id)));

    return staleSessions.length;
  },
});

