import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Internal query to get posts without embeddings
// Note: Content is stored on IPFS, returns contentCid instead
export const getPostsWithoutEmbeddings = internalQuery({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      title: v.string(),
      contentCid: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    return posts
      .filter((post) => !post.embedding && !post.unlisted)
      .slice(0, args.limit)
      .map((post) => ({
        _id: post._id,
        title: post.title,
        contentCid: post.contentCid,
      }));
  },
});

// Internal query to get pages without embeddings
// Note: Content is stored on IPFS, returns contentCid instead
export const getPagesWithoutEmbeddings = internalQuery({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("pages"),
      title: v.string(),
      contentCid: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    return pages
      .filter((page) => !page.embedding && !page.unlisted)
      .slice(0, args.limit)
      .map((page) => ({
        _id: page._id,
        title: page.title,
        contentCid: page.contentCid,
      }));
  },
});

// Internal mutation to save embedding for a post
export const savePostEmbedding = internalMutation({
  args: {
    id: v.id("posts"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { embedding: args.embedding });
  },
});

// Internal mutation to save embedding for a page
export const savePageEmbedding = internalMutation({
  args: {
    id: v.id("pages"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { embedding: args.embedding });
  },
});

// Internal query to get post by slug
// Note: Content is stored on IPFS, returns contentCid instead
export const getPostBySlug = internalQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("posts"),
      title: v.string(),
      contentCid: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!post) return null;

    return {
      _id: post._id,
      title: post.title,
      contentCid: post.contentCid,
    };
  },
});

// Internal query to get page by slug
// Note: Content is stored on IPFS, returns contentCid instead
export const getPageBySlug = internalQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("pages"),
      title: v.string(),
      contentCid: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("pages")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!page) return null;

    return {
      _id: page._id,
      title: page.title,
      contentCid: page.contentCid,
    };
  },
});
