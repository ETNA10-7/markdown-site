"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
// import { api } from "./_generated/api"; // Unused - import disabled
import FirecrawlApp from "@mendable/firecrawl-js";

/**
 * Generate a URL-safe slug from a title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);
}

/**
 * Clean up markdown content
 */
function cleanMarkdown(content: string): string {
  return content.replace(/^\s+|\s+$/g, "").replace(/\n{3,}/g, "\n\n");
}

/**
 * Calculate reading time from content
 * Note: Currently unused - import action is disabled
 */
// function calculateReadTime(content: string): string {
//   const wordsPerMinute = 200;
//   const wordCount = content.split(/\s+/).length;
//   const minutes = Math.ceil(wordCount / wordsPerMinute);
//   return `${minutes} min read`;
// }

/**
 * Import content from a URL using Firecrawl and save directly to database
 */
export const importFromUrl = action({
  args: {
    url: v.string(),
    published: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    slug: v.optional(v.string()),
    title: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error:
          "FIRECRAWL_API_KEY not configured. Add it to your Convex environment variables.",
      };
    }

    try {
      const firecrawl = new FirecrawlApp({ apiKey });
      const result = await firecrawl.scrapeUrl(args.url, {
        formats: ["markdown"],
      });

      if (!result.success || !result.markdown) {
        return {
          success: false,
          error: result.error || "Failed to scrape URL - no content returned",
        };
      }

      const title = result.metadata?.title || "Imported Post";
      // const description = result.metadata?.description || ""; // Unused - import disabled
      const content = cleanMarkdown(result.markdown);
      const baseSlug = generateSlug(title);
      const slug = baseSlug || `imported-${Date.now()}`;
      const today = new Date().toISOString().split("T")[0];

      // Add source attribution
      let hostname: string;
      try {
        hostname = new URL(args.url).hostname;
      } catch {
        hostname = "external source";
      }
      const contentWithAttribution = `${content}\n\n---\n\n*Originally published at [${hostname}](${args.url})*`;

      // Upload content to IPFS first
      // TODO: Implement IPFS upload in importAction (requires Pinata REST API or SDK)
      // For now, import is disabled - content must be uploaded to IPFS before creating post
      throw new Error("Import action requires IPFS upload. Please use sync script instead.");
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});
