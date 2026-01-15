"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
// Hugging Face model for embeddings
const HUGGINGFACE_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
// Router API format: https://router.huggingface.co/hf-inference/models/{model}/pipeline/feature-extraction
const HUGGINGFACE_API_URL = `https://router.huggingface.co/hf-inference/models/${HUGGINGFACE_MODEL}/pipeline/feature-extraction`;

// Get IPFS gateway URL from environment variable or use default
function getIPFSGatewayUrl(): string {
  const customGateway = process.env.PINATA_GATEWAY_URL;
  if (customGateway) {
    // If custom gateway already starts with http:// or https://, use it as-is
    // Otherwise, add https:// prefix
    return customGateway.startsWith("http://") || customGateway.startsWith("https://")
      ? customGateway
      : `https://${customGateway}`;
  }
  return "https://gateway.pinata.cloud";
}

// Fetch content from IPFS using CID
async function fetchContentFromIPFS(cid: string): Promise<string> {
  if (!cid) {
    throw new Error("CID is required to fetch content from IPFS");
  }

  const gatewayBase = getIPFSGatewayUrl();
  const publicGatewayBase = "https://gateway.pinata.cloud";
  const gatewayUrl = `${gatewayBase}/ipfs/${cid}`;
  const publicGatewayUrl = `${publicGatewayBase}/ipfs/${cid}`;

  // Try custom gateway first, fallback to public gateway on 403, 401, 429, or other errors
  try {
    const response = await fetch(gatewayUrl);
    if (!response.ok) {
      // If custom gateway returns 403 (Forbidden), 401 (Unauthorized), or 429 (Rate Limited), try public gateway
      if (response.status === 403 || response.status === 401 || response.status === 429) {
        const fallbackResponse = await fetch(publicGatewayUrl);
        if (!fallbackResponse.ok) {
          throw new Error(
            `Failed to fetch content from IPFS: ${fallbackResponse.status} ${fallbackResponse.statusText}`
          );
        }
        return await fallbackResponse.text();
      }
      throw new Error(
        `Failed to fetch content from IPFS: ${response.status} ${response.statusText}`
      );
    }
    const content = await response.text();
    return content;
  } catch (error) {
    // If custom gateway fails completely, try public gateway as fallback
    if (gatewayBase !== publicGatewayBase) {
      try {
        const fallbackResponse = await fetch(publicGatewayUrl);
        if (!fallbackResponse.ok) {
          throw new Error(
            `Failed to fetch content from IPFS: ${fallbackResponse.status} ${fallbackResponse.statusText}`
          );
        }
        return await fallbackResponse.text();
      } catch (fallbackError) {
        // If both fail, throw the original error
        if (error instanceof Error) {
          throw new Error(`Failed to fetch content from IPFS: ${error.message}`);
        }
        throw new Error(`Failed to fetch content from IPFS: ${String(error)}`);
      }
    }
    
    // If already using public gateway or fallback failed, throw error
    if (error instanceof Error) {
      throw new Error(`Failed to fetch content from IPFS: ${error.message}`);
    }
    throw new Error(`Failed to fetch content from IPFS: ${String(error)}`);
  }
}

// Search result type matching existing search.ts format
const searchResultValidator = v.object({
  _id: v.string(),
  type: v.union(v.literal("post"), v.literal("page")),
  slug: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  snippet: v.string(),
  score: v.number(), // Similarity score from vector search
});

// Main semantic search action
export const semanticSearch = action({
  args: { query: v.string() },
  returns: v.array(searchResultValidator),
  handler: async (ctx, args) => {
    // Return empty for empty queries
    if (!args.query.trim()) {
      return [];
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      // Gracefully return empty if not configured
      console.log("HUGGINGFACE_API_KEY not set, semantic search unavailable");
      return [];
    }

    // Generate embedding for search query using Hugging Face
    // Router API format: https://router.huggingface.co/hf-inference/models/{model}/pipeline/feature-extraction
    console.log(`Generating embedding for query: "${args.query}"`);
    console.log(`Using endpoint: ${HUGGINGFACE_API_URL}`);
    
    const response = await fetch(HUGGINGFACE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: args.query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Hugging Face Router API error: ${response.status} ${response.statusText}`);
      console.error(`Error details: ${errorText}`);
      console.error(`Request URL: ${HUGGINGFACE_API_URL}`);
      console.error(`Model: ${HUGGINGFACE_MODEL}`);
      // Return empty array gracefully - semantic search unavailable
      // User can use keyword search instead
      return [];
    }

    const responseData = await response.json();
    
    // Handle different response formats from Hugging Face API
    let queryEmbedding: number[];
    if (Array.isArray(responseData)) {
      // Direct array format: [0.1, 0.2, ...]
      queryEmbedding = responseData;
    } else if (Array.isArray(responseData[0])) {
      // Nested array format: [[0.1, 0.2, ...]]
      queryEmbedding = responseData[0];
    } else if (responseData.embeddings && Array.isArray(responseData.embeddings[0])) {
      // Object with embeddings key: {embeddings: [[0.1, 0.2, ...]]}
      queryEmbedding = responseData.embeddings[0];
    } else {
      console.error("Invalid embedding response format from Hugging Face API");
      console.error("Response data:", JSON.stringify(responseData).slice(0, 200));
      return [];
    }
    
    // Ensure it's an array of numbers
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      console.error("Invalid embedding response from Hugging Face API - not an array or empty");
      console.error("Extracted embedding:", queryEmbedding);
      return [];
    }

    // Search posts using vector index
    const postResults = await ctx.vectorSearch("posts", "by_embedding", {
      vector: queryEmbedding,
      limit: 10,
      filter: (q) => q.eq("published", true),
    });

    // Search pages using vector index
    const pageResults = await ctx.vectorSearch("pages", "by_embedding", {
      vector: queryEmbedding,
      limit: 10,
      filter: (q) => q.eq("published", true),
    });

    // Fetch full document details
    // Note: Content is stored on IPFS, returns contentCid instead
    const posts: Array<{
      _id: string;
      slug: string;
      title: string;
      description: string;
      contentCid: string;
      unlisted?: boolean;
    }> = await ctx.runQuery(internal.semanticSearchQueries.fetchPostsByIds, {
      ids: postResults.map((r) => r._id),
    });
    const pages: Array<{
      _id: string;
      slug: string;
      title: string;
      contentCid: string;
    }> = await ctx.runQuery(internal.semanticSearchQueries.fetchPagesByIds, {
      ids: pageResults.map((r) => r._id),
    });

    // Build results with scores
    const results: Array<{
      _id: string;
      type: "post" | "page";
      slug: string;
      title: string;
      description?: string;
      snippet: string;
      score: number;
    }> = [];

    // Map posts with scores
    for (const result of postResults) {
      const post = posts.find((p) => p._id === result._id);
      // Explicitly skip unlisted posts (defensive check - query already filters, but this adds safety)
      if (post && !post.unlisted) {
        // Fetch content from IPFS and create snippet from actual content
        let snippet = post.description
          ? post.description.slice(0, 120) + (post.description.length > 120 ? "..." : "")
          : "";
        
        try {
          const content = await fetchContentFromIPFS(post.contentCid);
          snippet = createSnippet(content, 150);
        } catch (error) {
          // Fallback to description if IPFS fetch fails
          // Only log non-rate-limit errors (429 is expected and handled gracefully)
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes("429")) {
            console.warn(`Failed to fetch content from IPFS for post ${post._id}:`, errorMessage);
          }
        }

        results.push({
          _id: String(post._id),
          type: "post",
          slug: post.slug,
          title: post.title,
          description: post.description,
          snippet,
          score: result._score,
        });
      }
    }

    // Map pages with scores
    for (const result of pageResults) {
      const page = pages.find((p) => p._id === result._id);
      if (page) {
        // Fetch content from IPFS and create snippet from actual content
        let snippet = page.title;
        
        try {
          const content = await fetchContentFromIPFS(page.contentCid);
          snippet = createSnippet(content, 150);
        } catch (error) {
          // Fallback to title if IPFS fetch fails
          // Only log non-rate-limit errors (429 is expected and handled gracefully)
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes("429")) {
            console.warn(`Failed to fetch content from IPFS for page ${page._id}:`, errorMessage);
          }
        }

        results.push({
          _id: String(page._id),
          type: "page",
          slug: page.slug,
          title: page.title,
          snippet,
          score: result._score,
        });
      }
    }

    // Sort by score descending (higher = more similar)
    results.sort((a, b) => b.score - a.score);

    // Limit to top 15 results
    return results.slice(0, 15);
  },
});

// Check if semantic search is available (API key configured)
export const isSemanticSearchAvailable = action({
  args: {},
  returns: v.boolean(),
  handler: async () => {
    return !!process.env.HUGGINGFACE_API_KEY;
  },
});

// Helper to create snippet from content (same logic as search.ts)
function createSnippet(content: string, maxLength: number): string {
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

  if (cleanContent.length <= maxLength) {
    return cleanContent;
  }
  return cleanContent.slice(0, maxLength) + "...";
}
