import { query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Search result type for both posts and pages
const searchResultValidator = v.object({
  _id: v.string(),
  type: v.union(v.literal("post"), v.literal("page")),
  slug: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  snippet: v.string(),
  anchor: v.optional(v.string()), // Anchor ID for scrolling to exact match location
});

// Get IPFS gateway URL from environment variable or use default
function getIPFSGatewayUrl(): string {
  const customGateway = process.env.PINATA_GATEWAY_URL;
  if (customGateway) {
    return `https://${customGateway}`;
  }
  return "https://gateway.pinata.cloud";
}

// Fetch content from IPFS using CID
async function fetchContentFromIPFS(cid: string): Promise<string> {
  if (!cid) {
    throw new Error("CID is required to fetch content from IPFS");
  }

  const gatewayBase = getIPFSGatewayUrl();
  const gatewayUrl = `${gatewayBase}/ipfs/${cid}`;

  try {
    const response = await fetch(gatewayUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch content from IPFS: ${response.status} ${response.statusText}`
      );
    }
    const content = await response.text();
    return content;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch content from IPFS: ${error.message}`);
    }
    throw new Error(`Failed to fetch content from IPFS: ${String(error)}`);
  }
}

// Fast title-only search (query - reactive, but no content search)
export const searchTitleOnly = query({
  args: {
    query: v.string(),
  },
  returns: v.array(searchResultValidator),
  handler: async (ctx, args) => {
    if (!args.query.trim()) {
      return [];
    }

    const results: Array<{
      _id: string;
      type: "post" | "page";
      slug: string;
      title: string;
      description?: string;
      snippet: string;
      anchor?: string;
    }> = [];

    // Search posts by title
    const postsByTitle = await ctx.db
      .query("posts")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("published", true)
      )
      .take(10);

    // Search pages by title
    const pagesByTitle = await ctx.db
      .query("pages")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("published", true)
      )
      .take(10);

    // Process post results
    const seenPostIds = new Set<string>();
    for (const post of postsByTitle) {
      if (seenPostIds.has(post._id)) continue;
      seenPostIds.add(post._id);
      if (post.unlisted) continue;

      const snippet = post.description
        ? post.description.slice(0, 120) + (post.description.length > 120 ? "..." : "")
        : "";

      results.push({
        _id: post._id,
        type: "post" as const,
        slug: post.slug,
        title: post.title,
        description: post.description,
        snippet,
      });
    }

    // Process page results
    const seenPageIds = new Set<string>();
    for (const page of pagesByTitle) {
      if (seenPageIds.has(page._id)) continue;
      seenPageIds.add(page._id);

      const snippet = page.excerpt
        ? page.excerpt.slice(0, 120) + (page.excerpt.length > 120 ? "..." : "")
        : page.title;

      results.push({
        _id: page._id,
        type: "page" as const,
        slug: page.slug,
        title: page.title,
        snippet,
      });
    }

    const queryLower = args.query.toLowerCase();
    results.sort((a, b) => {
      const aInTitle = a.title.toLowerCase().includes(queryLower);
      const bInTitle = b.title.toLowerCase().includes(queryLower);
      if (aInTitle && !bInTitle) return -1;
      if (!aInTitle && bInTitle) return 1;
      return 0;
    });

    return results.slice(0, 15);
  },
});

// Full search with content search from IPFS (action - can fetch from IPFS)
export const search = action({
  args: {
    query: v.string(),
  },
  returns: v.array(searchResultValidator),
  handler: async (ctx, args) => {
    // Return empty results for empty queries
    if (!args.query.trim()) {
      return [];
    }

    // First, get title matches using a query (fast)
    const titleResults = await ctx.runQuery(api.search.searchTitleOnly, {
      query: args.query,
    });

    const results: Array<{
      _id: string;
      type: "post" | "page";
      slug: string;
      title: string;
      description?: string;
      snippet: string;
      anchor?: string;
    }> = [];

    // Track which items we've already added (from title search)
    const addedIds = new Set<string>();
    for (const result of titleResults) {
      addedIds.add(result._id);
      results.push(result);
    }

    // Now search content from IPFS for additional matches
    // Get all published posts and pages
    const allPosts = await ctx.runQuery(api.posts.getAllPosts);
    const allPages = await ctx.runQuery(api.pages.getAllPages);

    const queryLower = args.query.toLowerCase();
    const searchTerms = args.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    // Search in post content
    for (const post of allPosts) {
      if (addedIds.has(post._id) || post.unlisted) continue;

      try {
        const fullPost = await ctx.runQuery(api.posts.getPostBySlug, {
          slug: post.slug,
        });

        if (!fullPost || !fullPost.contentCid) continue;

        // Fetch content from IPFS
        const content = await fetchContentFromIPFS(fullPost.contentCid);

        // Check if query appears in content
        const contentLower = content.toLowerCase();
        const matchesInContent =
          contentLower.includes(queryLower) ||
          searchTerms.some((term) => contentLower.includes(term));

        if (matchesInContent) {
          // Create snippet from content
          const snippetResult = createSnippet(content, args.query, 150);
          results.push({
            _id: post._id,
            type: "post" as const,
            slug: post.slug,
            title: post.title,
            description: post.description,
            snippet: snippetResult.snippet,
            anchor: snippetResult.anchor || undefined,
          });
          addedIds.add(post._id);
        }
      } catch (error) {
        // Skip posts where IPFS fetch fails
        console.error(`Failed to search content for post ${post.slug}:`, error);
      }
    }

    // Search in page content
    for (const page of allPages) {
      if (addedIds.has(page._id)) continue;

      try {
        const fullPage = await ctx.runQuery(api.pages.getPageBySlug, {
          slug: page.slug,
        });

        if (!fullPage || !fullPage.contentCid) continue;

        // Fetch content from IPFS
        const content = await fetchContentFromIPFS(fullPage.contentCid);

        // Check if query appears in content
        const contentLower = content.toLowerCase();
        const matchesInContent =
          contentLower.includes(queryLower) ||
          searchTerms.some((term) => contentLower.includes(term));

        if (matchesInContent) {
          // Create snippet from content
          const snippetResult = createSnippet(content, args.query, 150);
          results.push({
            _id: page._id,
            type: "page" as const,
            slug: page.slug,
            title: page.title,
            snippet: snippetResult.snippet,
            anchor: snippetResult.anchor || undefined,
          });
          addedIds.add(page._id);
        }
      } catch (error) {
        // Skip pages where IPFS fetch fails
        console.error(`Failed to search content for page ${page.slug}:`, error);
      }
    }

    // Sort results: title matches first, then content matches
    results.sort((a, b) => {
      const aInTitle = a.title.toLowerCase().includes(queryLower);
      const bInTitle = b.title.toLowerCase().includes(queryLower);
      if (aInTitle && !bInTitle) return -1;
      if (!aInTitle && bInTitle) return 1;
      return 0;
    });

    // Limit to top 15 results
    return results.slice(0, 15);
  },
});

// Generate slug from heading text (same as frontend)
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// Find the nearest heading before a match position in the original content
function findNearestHeading(content: string, matchPosition: number): string | null {
  const lines = content.split("\n");
  const headings: Array<{ text: string; position: number; id: string }> = [];
  let currentPosition = 0;

  // Find all headings with their positions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const text = headingMatch[2].trim();
      const id = generateSlug(text);
      headings.push({ text, position: currentPosition, id });
    }

    // Add line length + newline to position
    currentPosition += line.length + 1;
  }

  // Find the last heading before the match position
  let nearestHeading: typeof headings[0] | null = null;
  for (const heading of headings) {
    if (heading.position <= matchPosition) {
      nearestHeading = heading;
    } else {
      break;
    }
  }

  return nearestHeading?.id || null;
}

// Helper to create a snippet around the search term and find anchor
function createSnippet(
  content: string,
  searchTerm: string,
  maxLength: number
): { snippet: string; anchor: string | null } {
  const lowerSearchTerm = searchTerm.toLowerCase();
  
  // Find the first occurrence in the original content for anchor lookup
  // This finds the match position before we clean the content
  const originalIndex = content.toLowerCase().indexOf(lowerSearchTerm);
  const anchor = originalIndex !== -1 ? findNearestHeading(content, originalIndex) : null;

  // Remove markdown syntax for cleaner snippets
  const cleanContent = content
    .replace(/#{1,6}\s/g, "") // Headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
    .replace(/\*([^*]+)\*/g, "$1") // Italic
    .replace(/`([^`]+)`/g, "$1") // Inline code
    .replace(/```[\s\S]*?```/g, "") // Code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // Images
    .replace(/\n+/g, " ") // Newlines to spaces
    .replace(/\s+/g, " ") // Multiple spaces to single
    .trim();

  const lowerContent = cleanContent.toLowerCase();
  const index = lowerContent.indexOf(lowerSearchTerm);

  if (index === -1) {
    // Term not found, return beginning of content
    return {
      snippet: cleanContent.slice(0, maxLength) + (cleanContent.length > maxLength ? "..." : ""),
      anchor: null,
    };
  }

  // Calculate start position to center the search term
  const start = Math.max(0, index - Math.floor(maxLength / 3));
  const end = Math.min(cleanContent.length, start + maxLength);

  let snippet = cleanContent.slice(start, end);

  // Add ellipsis if needed
  if (start > 0) snippet = "..." + snippet;
  if (end < cleanContent.length) snippet = snippet + "...";

  return { snippet, anchor };
}

