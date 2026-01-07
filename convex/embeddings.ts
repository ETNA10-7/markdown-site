"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI from "openai";

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

// Generate embedding for text using OpenAI text-embedding-ada-002
export const generateEmbedding = internalAction({
  args: { text: v.string() },
  returns: v.array(v.float64()),
  handler: async (_ctx, { text }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured in Convex environment");
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text.slice(0, 8000), // Truncate to stay within token limit
    });

    return response.data[0].embedding;
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
    if (!process.env.OPENAI_API_KEY) {
      console.log("OPENAI_API_KEY not set, skipping embedding generation");
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
    if (!process.env.OPENAI_API_KEY) {
      return { success: false, error: "OPENAI_API_KEY not configured" };
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
