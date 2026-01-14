"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
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

// Prepare text for embedding: combine title and content
function prepareTextForEmbedding(title: string, content: string): string {
  // Combine title and content, with title first for better semantic understanding
  // Remove markdown syntax that doesn't add semantic value
  const cleanContent = content
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks (keep inline code)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // Remove images
    .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines
    .trim();

  // Combine title and content
  return `${title}\n\n${cleanContent}`;
}

// Generate embedding for text using Hugging Face sentence-transformers/all-MiniLM-L6-v2
export const generateEmbedding = internalAction({
  args: { text: v.string() },
  returns: v.array(v.float64()),
  handler: async (_ctx, { text }) => {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      throw new Error("HUGGINGFACE_API_KEY not configured in Convex environment");
    }

    // Truncate text to reasonable length (Hugging Face models handle up to ~512 tokens)
    const truncatedText = text.slice(0, 2000);

    // Call Hugging Face Router API
    // Router API format: https://router.huggingface.co/models/{model}
    const response = await fetch(HUGGINGFACE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: truncatedText }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const embedding = await response.json();
    
    // Hugging Face returns an array of numbers (the embedding vector)
    // Ensure it's an array of numbers
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Invalid embedding response from Hugging Face API");
    }

    return embedding as number[];
  },
});

// Internal action to generate embeddings for posts without them
export const generatePostEmbeddings = internalAction({
  args: {},
  returns: v.object({ processed: v.number() }),
  handler: async (ctx) => {
    const posts = await ctx.runQuery(
      internal.embeddingsQueries.getPostsWithoutEmbeddings,
      { limit: 10 }
    );

    let processed = 0;
    for (const post of posts) {
      try {
        // Fetch full content from IPFS
        let content = "";
        try {
          content = await fetchContentFromIPFS(post.contentCid);
        } catch (error) {
          console.error(`Failed to fetch content from IPFS for post ${post._id}:`, error);
          // Fallback to title-only if IPFS fetch fails
          content = "";
        }

        // Prepare text for embedding: title + content
        const textToEmbed = content
          ? prepareTextForEmbedding(post.title, content)
          : post.title; // Fallback to title only if content fetch failed

        const embedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
          text: textToEmbed,
        });
        await ctx.runMutation(internal.embeddingsQueries.savePostEmbedding, {
          id: post._id,
          embedding,
        });
        processed++;
      } catch (error) {
        console.error(`Failed to generate embedding for post ${post._id}:`, error);
      }
    }

    return { processed };
  },
});

// Internal action to generate embeddings for pages without them
export const generatePageEmbeddings = internalAction({
  args: {},
  returns: v.object({ processed: v.number() }),
  handler: async (ctx) => {
    const pages = await ctx.runQuery(
      internal.embeddingsQueries.getPagesWithoutEmbeddings,
      { limit: 10 }
    );

    let processed = 0;
    for (const page of pages) {
      try {
        // Fetch full content from IPFS
        let content = "";
        try {
          content = await fetchContentFromIPFS(page.contentCid);
        } catch (error) {
          console.error(`Failed to fetch content from IPFS for page ${page._id}:`, error);
          // Fallback to title-only if IPFS fetch fails
          content = "";
        }

        // Prepare text for embedding: title + content
        const textToEmbed = content
          ? prepareTextForEmbedding(page.title, content)
          : page.title; // Fallback to title only if content fetch failed

        const embedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
          text: textToEmbed,
        });
        await ctx.runMutation(internal.embeddingsQueries.savePageEmbedding, {
          id: page._id,
          embedding,
        });
        processed++;
      } catch (error) {
        console.error(`Failed to generate embedding for page ${page._id}:`, error);
      }
    }

    return { processed };
  },
});

// Public action to generate missing embeddings for all content
// Called from sync script or manually
export const generateMissingEmbeddings = action({
  args: {},
  returns: v.object({
    postsProcessed: v.number(),
    pagesProcessed: v.number(),
    skipped: v.boolean(),
  }),
  handler: async (ctx): Promise<{
    postsProcessed: number;
    pagesProcessed: number;
    skipped: boolean;
  }> => {
    // Check for API key first - gracefully skip if not configured
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.log("HUGGINGFACE_API_KEY not set, skipping embedding generation");
      return { postsProcessed: 0, pagesProcessed: 0, skipped: true };
    }

    const postsResult: { processed: number } = await ctx.runAction(
      internal.embeddings.generatePostEmbeddings,
      {}
    );
    const pagesResult: { processed: number } = await ctx.runAction(
      internal.embeddings.generatePageEmbeddings,
      {}
    );

    return {
      postsProcessed: postsResult.processed,
      pagesProcessed: pagesResult.processed,
      skipped: false,
    };
  },
});

// Public action to regenerate embedding for a specific post
export const regeneratePostEmbedding = action({
  args: { slug: v.string() },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    if (!process.env.HUGGINGFACE_API_KEY) {
      return { success: false, error: "HUGGINGFACE_API_KEY not configured" };
    }

    // Find the post by slug
    const post = await ctx.runQuery(internal.embeddingsQueries.getPostBySlug, {
      slug: args.slug,
    });

    if (!post) {
      return { success: false, error: "Post not found" };
    }

    try {
      // Fetch full content from IPFS
      let content = "";
      try {
        content = await fetchContentFromIPFS(post.contentCid);
      } catch (error) {
        console.error(`Failed to fetch content from IPFS for post ${post._id}:`, error);
        // Fallback to title-only if IPFS fetch fails
        content = "";
      }

      // Prepare text for embedding: title + content
      const textToEmbed = content
        ? prepareTextForEmbedding(post.title, content)
        : post.title; // Fallback to title only if content fetch failed

      const embedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
        text: textToEmbed,
      });
      await ctx.runMutation(internal.embeddingsQueries.savePostEmbedding, {
        id: post._id,
        embedding,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// Public action to regenerate embedding for a specific page
export const regeneratePageEmbedding = action({
  args: { slug: v.string() },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    if (!process.env.HUGGINGFACE_API_KEY) {
      return { success: false, error: "HUGGINGFACE_API_KEY not configured" };
    }

    // Find the page by slug
    const page = await ctx.runQuery(internal.embeddingsQueries.getPageBySlug, {
      slug: args.slug,
    });

    if (!page) {
      return { success: false, error: "Page not found" };
    }

    try {
      // Fetch full content from IPFS
      let content = "";
      try {
        content = await fetchContentFromIPFS(page.contentCid);
      } catch (error) {
        console.error(`Failed to fetch content from IPFS for page ${page._id}:`, error);
        // Fallback to title-only if IPFS fetch fails
        content = "";
      }

      // Prepare text for embedding: title + content
      const textToEmbed = content
        ? prepareTextForEmbedding(page.title, content)
        : page.title; // Fallback to title only if content fetch failed

      const embedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
        text: textToEmbed,
      });
      await ctx.runMutation(internal.embeddingsQueries.savePageEmbedding, {
        id: page._id,
        embedding,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});
