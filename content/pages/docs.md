---
title: "Docs"
slug: "docs"
published: true
order: 0
---

Reference documentation for setting up, customizing, and deploying this markdown site.

**How publishing works:** Write posts in markdown, run `npm run sync` for development or `npm run sync:prod` for production, and they appear on your live site immediately. No rebuild or redeploy needed. Convex handles real-time data sync, so connected browsers update automatically.

## Quick start

```bash
git clone https://github.com/waynesutton/markdown-site.git
cd markdown-site
npm install
npx convex dev
npm run sync          # development
npm run sync:prod     # production
npm run dev
```

Open `http://localhost:5173` to view locally.

## Requirements

- Node.js 18+
- Convex account (free at convex.dev)
- Netlify account (free at netlify.com)

## Project structure

```
markdown-site/
├── content/
│   ├── blog/           # Blog posts (.md)
│   └── pages/          # Static pages (.md)
├── convex/
│   ├── schema.ts       # Database schema
│   ├── posts.ts        # Post queries/mutations
│   ├── pages.ts        # Page queries/mutations
│   ├── http.ts         # API endpoints
│   └── rss.ts          # RSS generation
├── netlify/
│   └── edge-functions/ # Netlify edge functions
│       ├── rss.ts      # RSS proxy
│       ├── sitemap.ts  # Sitemap proxy
│       ├── api.ts      # API proxy
│       └── botMeta.ts  # OG crawler detection
├── src/
│   ├── components/     # React components
│   ├── context/        # Theme context
│   ├── pages/          # Route components
│   └── styles/         # CSS
├── public/
│   ├── images/         # Static images
│   ├── robots.txt      # Crawler rules
│   └── llms.txt        # AI discovery
└── netlify.toml        # Deployment config
```

## Content

### Blog posts

Create files in `content/blog/` with frontmatter:

```markdown
---
title: "Post Title"
description: "SEO description"
date: "2025-01-15"
slug: "url-path"
published: true
tags: ["tag1", "tag2"]
readTime: "5 min read"
image: "/images/og-image.png"
---

Content here...
```

| Field         | Required | Description           |
| ------------- | -------- | --------------------- |
| `title`       | Yes      | Post title            |
| `description` | Yes      | SEO description       |
| `date`        | Yes      | YYYY-MM-DD format     |
| `slug`        | Yes      | URL path (unique)     |
| `published`   | Yes      | `true` to show        |
| `tags`        | Yes      | Array of strings      |
| `readTime`    | No       | Display time estimate |
| `image`       | No       | Open Graph image      |

### Static pages

Create files in `content/pages/` with frontmatter:

```markdown
---
title: "Page Title"
slug: "url-path"
published: true
order: 1
---

Content here...
```

| Field       | Required | Description               |
| ----------- | -------- | ------------------------- |
| `title`     | Yes      | Nav link text             |
| `slug`      | Yes      | URL path                  |
| `published` | Yes      | `true` to show            |
| `order`     | No       | Nav order (lower = first) |

### Syncing content

```bash
# Development
npm run sync

# Production
npm run sync:prod
```

## Configuration

### Site settings

Edit `src/pages/Home.tsx`:

```typescript
const siteConfig = {
  name: "Site Name",
  title: "Tagline",
  logo: "/images/logo.svg", // null to hide
  intro: "Introduction text...",
  bio: "Bio text...",
  featuredEssays: [{ title: "Post Title", slug: "post-slug" }],
  links: {
    docs: "/docs",
    convex: "https://convex.dev",
  },
};
```

### Theme

Default: `tan`. Options: `dark`, `light`, `tan`, `cloud`.

Edit `src/context/ThemeContext.tsx`:

```typescript
const DEFAULT_THEME: Theme = "tan";
```

### Font

Edit `src/styles/global.css`:

```css
body {
  /* Sans-serif */
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Serif (default) */
  font-family: "New York", ui-serif, Georgia, serif;
}
```

### Images

| Image            | Location                       | Size     |
| ---------------- | ------------------------------ | -------- |
| Favicon          | `public/favicon.svg`           | 512x512  |
| Site logo        | `public/images/logo.svg`       | 512x512  |
| Default OG image | `public/images/og-default.svg` | 1200x630 |
| Post images      | `public/images/`               | Any      |

## Real-time stats

The `/stats` page displays real-time analytics:

- Active visitors (with per-page breakdown)
- Total page views
- Unique visitors
- Views by page (sorted by count)

All stats update automatically via Convex subscriptions.

## API endpoints

| Endpoint                       | Description             |
| ------------------------------ | ----------------------- |
| `/stats`                       | Real-time analytics     |
| `/rss.xml`                     | RSS feed (descriptions) |
| `/rss-full.xml`                | RSS feed (full content) |
| `/sitemap.xml`                 | XML sitemap             |
| `/api/posts`                   | JSON post list          |
| `/api/post?slug=xxx`           | Single post (JSON)      |
| `/api/post?slug=xxx&format=md` | Single post (markdown)  |

## Deployment

### Netlify setup

1. Connect GitHub repo to Netlify
2. Build command: `npm ci --include=dev && npx convex deploy --cmd 'npm run build'`
3. Publish directory: `dist`
4. Add env variables:
   - `CONVEX_DEPLOY_KEY` (from Convex Dashboard > Project Settings > Deploy Key)
   - `VITE_CONVEX_URL` (your production Convex URL, e.g., `https://your-deployment.convex.cloud`)

Both are required: deploy key for builds, URL for edge function runtime.

### Convex production

```bash
npx convex deploy
```

### Edge functions

RSS, sitemap, and API routes are handled by Netlify Edge Functions in `netlify/edge-functions/`. They dynamically read `VITE_CONVEX_URL` from the environment. No manual URL configuration needed.

## Convex schema

```typescript
// convex/schema.ts
export default defineSchema({
  posts: defineTable({
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    content: v.string(),
    date: v.string(),
    published: v.boolean(),
    tags: v.array(v.string()),
    readTime: v.optional(v.string()),
    image: v.optional(v.string()),
    lastSyncedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_published", ["published"]),

  pages: defineTable({
    slug: v.string(),
    title: v.string(),
    content: v.string(),
    published: v.boolean(),
    order: v.optional(v.number()),
    lastSyncedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_published", ["published"]),
});
```

## Troubleshooting

**Posts not appearing**

- Check `published: true` in frontmatter
- Run `npm run sync` for development
- Run `npm run sync:prod` for production
- Verify in Convex dashboard

**RSS/Sitemap errors**

- Verify `VITE_CONVEX_URL` is set in Netlify
- Test Convex HTTP URL: `https://your-deployment.convex.site/rss.xml`
- Check edge functions in `netlify/edge-functions/`

**Build failures**

- Verify `CONVEX_DEPLOY_KEY` is set in Netlify
- Ensure `@types/node` is in devDependencies
- Build command must include `--include=dev`
- Check Node.js version (18+)
