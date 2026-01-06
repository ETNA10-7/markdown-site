import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

// Internal query to fetch post details by IDs
// Note: Content is stored on IPFS, returns contentCid instead
export const fetchPostsByIds = internalQuery({
  args: { ids: v.array(v.id("posts")) },
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      slug: v.string(),
      title: v.string(),
      description: v.string(),
      contentCid: v.string(),
      unlisted: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx, args) => {
    const results = [];
    for (const id of args.ids) {
      const doc = await ctx.db.get(id);
      if (doc && doc.published && !doc.unlisted) {
        results.push({
          _id: doc._id,
          slug: doc.slug,
          title: doc.title,
          description: doc.description,
          contentCid: doc.contentCid,
          unlisted: doc.unlisted,
        });
      }
    }
    return results;
  },
});

// Internal query to fetch page details by IDs
// Note: Content is stored on IPFS, returns contentCid instead
export const fetchPagesByIds = internalQuery({
  args: { ids: v.array(v.id("pages")) },
  returns: v.array(
    v.object({
      _id: v.id("pages"),
      slug: v.string(),
      title: v.string(),
      contentCid: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const results = [];
    for (const id of args.ids) {
      const doc = await ctx.db.get(id);
      if (doc && doc.published) {
        results.push({
          _id: doc._id,
          slug: doc.slug,
          title: doc.title,
          contentCid: doc.contentCid,
        });
      }
    }
    return results;
  },
});
