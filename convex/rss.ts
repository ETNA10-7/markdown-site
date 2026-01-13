import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

// Site configuration for RSS feed - update these for your site (or run npm run configure)
const SITE_URL = process.env.SITE_URL || "https://www.markdown.fast";
const SITE_TITLE = "markdown sync framework";
const SITE_DESCRIPTION =
  "An open-source publishing framework built for AI agents and developers to ship websites, docs, or blogs. Write markdown, sync from the terminal. Your content is instantly available to browsers, LLMs, and AI agents. Built on Convex and Netlify.";

// Get IPFS gateway URL from environment variable or use default
function getIPFSGatewayUrl(): string {
  const customGateway = process.env.PINATA_GATEWAY_URL;
  if (customGateway) {
    // If custom gateway is provided, assume it's a full domain (e.g., "plum-quickest-ant-289.mypinata.cloud")
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

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Generate RSS XML from posts (description only)
function generateRssXml(
  posts: Array<{
    title: string;
    description: string;
    slug: string;
    date: string;
  }>,
  feedPath: string = "/rss.xml",
): string {
  const items = posts
    .map((post) => {
      const pubDate = new Date(post.date).toUTCString();
      const url = `${SITE_URL}/${post.slug}`;

      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.description)}</description>
    </item>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}${feedPath}" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}

// Generate RSS XML with full content (for LLMs and readers)
// Now includes actual markdown content fetched from IPFS
function generateFullRssXml(
  posts: Array<{
    title: string;
    description: string;
    slug: string;
    date: string;
    contentCid: string;
    content: string; // Full markdown content fetched from IPFS
    readTime?: string;
    tags: string[];
  }>,
): string {
  const items = posts
    .map((post) => {
      const pubDate = new Date(post.date).toUTCString();
      const url = `${SITE_URL}/${post.slug}`;
      // Escape content for XML CDATA (CDATA already handles most escaping, but we escape & for safety)
      const escapedContent = post.content.replace(/]]>/g, "]]&gt;");

      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.description)}</description>
      <content:encoded><![CDATA[${escapedContent}]]></content:encoded>
      ${post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("\n      ")}
    </item>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_TITLE)} - Full Content</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)} Full article content for readers and AI.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss-full.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}

// HTTP action to serve RSS feed (descriptions only)
export const rssFeed = httpAction(async (ctx) => {
  const posts = await ctx.runQuery(api.posts.getAllPosts);

  const xml = generateRssXml(
    posts.map((post: { title: string; description: string; slug: string; date: string }) => ({
      title: post.title,
      description: post.description,
      slug: post.slug,
      date: post.date,
    })),
  );

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=7200",
    },
  });
});

// HTTP action to serve full RSS feed (with complete content)
export const rssFullFeed = httpAction(async (ctx) => {
  const posts = await ctx.runQuery(api.posts.getAllPosts);

  // Fetch full content for each post from IPFS
  const fullPosts = await Promise.all(
    posts.map(async (post: { title: string; description: string; slug: string; date: string; readTime?: string; tags: string[] }) => {
      const fullPost = await ctx.runQuery(api.posts.getPostBySlug, {
        slug: post.slug,
      });

      if (!fullPost || !fullPost.contentCid) {
        // Skip posts without content CID
        return null;
      }

      try {
        // Fetch actual content from IPFS
        const content = await fetchContentFromIPFS(fullPost.contentCid);
        
        return {
          title: post.title,
          description: post.description,
          slug: post.slug,
          date: post.date,
          contentCid: fullPost.contentCid,
          content, // Full markdown content from IPFS
          readTime: post.readTime,
          tags: post.tags,
        };
      } catch (error) {
        // If fetching fails, log error but still include post with empty content
        console.error(`Failed to fetch content for post ${post.slug}:`, error);
        return {
          title: post.title,
          description: post.description,
          slug: post.slug,
          date: post.date,
          contentCid: fullPost.contentCid,
          content: `[Error: Could not fetch content from IPFS. CID: ${fullPost.contentCid}]`,
          readTime: post.readTime,
          tags: post.tags,
        };
      }
    }),
  );

  // Filter out null posts (posts without contentCid)
  const validPosts = fullPosts.filter(
    (post): post is NonNullable<typeof post> => post !== null
  );

  const xml = generateFullRssXml(validPosts);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=7200",
    },
  });
});
