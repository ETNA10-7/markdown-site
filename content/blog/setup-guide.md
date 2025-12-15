---
title: "Fork and Deploy Your Own Markdown Blog"
description: "Step-by-step guide to fork this blog, set up Convex backend, and deploy to Netlify in under 10 minutes."
date: "2025-01-14"
slug: "setup-guide"
published: true
tags: ["convex", "netlify", "tutorial", "deployment"]
readTime: "8 min read"
---

# Fork and Deploy Your Own Markdown Blog

This guide walks you through forking [this markdown site](https://github.com/waynesutton/markdown-site), setting up your Convex backend, and deploying to Netlify. The entire process takes about 10 minutes.

**How publishing works:** Once deployed, you write posts in markdown, run `npm run sync`, and they appear on your live site immediately. No rebuild or redeploy needed. Convex handles real-time data sync, so all connected browsers update automatically.

## Table of Contents

- [Fork and Deploy Your Own Markdown Blog](#fork-and-deploy-your-own-markdown-blog)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Step 1: Fork the Repository](#step-1-fork-the-repository)
  - [Step 2: Set Up Convex](#step-2-set-up-convex)
    - [Create a Convex Project](#create-a-convex-project)
    - [Verify the Schema](#verify-the-schema)
  - [Step 3: Sync Your Blog Posts](#step-3-sync-your-blog-posts)
  - [Step 4: Run Locally](#step-4-run-locally)
  - [Step 5: Get Your Convex HTTP URL](#step-5-get-your-convex-http-url)
  - [Step 6: Verify Edge Functions](#step-6-verify-edge-functions)
  - [Step 7: Deploy to Netlify](#step-7-deploy-to-netlify)
    - [Option A: Netlify CLI](#option-a-netlify-cli)
    - [Option B: Netlify Dashboard](#option-b-netlify-dashboard)
    - [Netlify Build Configuration](#netlify-build-configuration)
  - [Step 8: Set Up Production Convex](#step-8-set-up-production-convex)
  - [Writing Blog Posts](#writing-blog-posts)
    - [Frontmatter Fields](#frontmatter-fields)
    - [Adding Images](#adding-images)
    - [Sync After Adding Posts](#sync-after-adding-posts)
    - [Environment Files](#environment-files)
  - [Customizing Your Blog](#customizing-your-blog)
    - [Change the Favicon](#change-the-favicon)
    - [Change the Site Logo](#change-the-site-logo)
    - [Change the Default Open Graph Image](#change-the-default-open-graph-image)
    - [Update Site Configuration](#update-site-configuration)
    - [Change the Default Theme](#change-the-default-theme)
    - [Change the Font](#change-the-font)
    - [Add Static Pages (Optional)](#add-static-pages-optional)
    - [Update SEO Meta Tags](#update-seo-meta-tags)
    - [Update llms.txt and robots.txt](#update-llmstxt-and-robotstxt)
  - [API Endpoints](#api-endpoints)
  - [Troubleshooting](#troubleshooting)
    - [Posts not appearing](#posts-not-appearing)
    - [RSS/Sitemap not working](#rsssitemap-not-working)
    - [Build failures on Netlify](#build-failures-on-netlify)
  - [Project Structure](#project-structure)
  - [Next Steps](#next-steps)

## Prerequisites

Before you start, make sure you have:

- Node.js 18 or higher installed
- A GitHub account
- A Convex account (free at [convex.dev](https://convex.dev))
- A Netlify account (free at [netlify.com](https://netlify.com))

## Step 1: Fork the Repository

Fork the repository to your GitHub account:

```bash
# Clone your forked repo
git clone https://github.com/waynesutton/markdown-site.git
cd markdown-site

# Install dependencies
npm install
```

## Step 2: Set Up Convex

Convex is the backend that stores your blog posts and serves the API endpoints.

### Create a Convex Project

Run the Convex development command:

```bash
npx convex dev
```

This will:

1. Prompt you to log in to Convex (opens browser)
2. Ask you to create a new project or select an existing one
3. Generate a `.env.local` file with your `VITE_CONVEX_URL`

Keep this terminal running during development. It syncs your Convex functions automatically.

### Verify the Schema

The schema is already defined in `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    lastSyncedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_published", ["published"]),

  viewCounts: defineTable({
    slug: v.string(),
    count: v.number(),
  }).index("by_slug", ["slug"]),
});
```

## Step 3: Sync Your Blog Posts

Blog posts live in `content/blog/` as markdown files. Sync them to Convex:

```bash
npm run sync
```

This reads all markdown files, parses the frontmatter, and uploads them to your Convex database.

## Step 4: Run Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to see your blog.

## Step 5: Get Your Convex HTTP URL

Your Convex deployment has two URLs:

- **Client URL**: `https://your-deployment.convex.cloud` (for the React app)
- **HTTP URL**: `https://your-deployment.convex.site` (for API endpoints)

Find your deployment name in the Convex dashboard or check `.env.local`:

```bash
# Your .env.local contains something like:
VITE_CONVEX_URL=https://happy-animal-123.convex.cloud
```

The HTTP URL uses `.convex.site` instead of `.convex.cloud`:

```
https://happy-animal-123.convex.site
```

## Step 6: Verify Edge Functions

The blog uses Netlify Edge Functions to dynamically proxy RSS, sitemap, and API requests to your Convex HTTP endpoints. No manual URL configuration is needed.

Edge functions in `netlify/edge-functions/`:

- `rss.ts` - Proxies `/rss.xml` and `/rss-full.xml`
- `sitemap.ts` - Proxies `/sitemap.xml`
- `api.ts` - Proxies `/api/posts` and `/api/post`
- `botMeta.ts` - Serves Open Graph HTML to social media crawlers

These functions automatically read `VITE_CONVEX_URL` from your environment and convert it to the Convex HTTP site URL (`.cloud` becomes `.site`).

## Step 7: Deploy to Netlify

For detailed Convex + Netlify integration, see the official [Convex Netlify Deployment Guide](https://docs.convex.dev/production/hosting/netlify).

### Option A: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
npm run deploy
```

### Option B: Netlify Dashboard

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click "Add new site" then "Import an existing project"
3. Connect your GitHub repository
4. Configure build settings:
   - Build command: `npm ci --include=dev && npx convex deploy --cmd 'npm run build'`
   - Publish directory: `dist`
5. Add environment variables:
   - `CONVEX_DEPLOY_KEY`: Generate from [Convex Dashboard](https://dashboard.convex.dev) > Project Settings > Deploy Key
   - `VITE_CONVEX_URL`: Your production Convex URL (e.g., `https://your-deployment.convex.cloud`)
6. Click "Deploy site"

The `CONVEX_DEPLOY_KEY` deploys functions at build time. The `VITE_CONVEX_URL` is required for edge functions to proxy RSS, sitemap, and API requests at runtime.

### Netlify Build Configuration

The `netlify.toml` file includes the correct build settings:

```toml
[build]
  command = "npm ci --include=dev && npx convex deploy --cmd 'npm run build'"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

Key points:

- `npm ci --include=dev` forces devDependencies to install even when `NODE_ENV=production`
- The build script uses `npx vite build` to resolve vite from node_modules
- `@types/node` is required for TypeScript to recognize `process.env`

## Step 8: Set Up Production Convex

For production, deploy your Convex functions:

```bash
npx convex deploy
```

This creates a production deployment. Update your Netlify environment variable with the production URL if different.

## Writing Blog Posts

Create new posts in `content/blog/`:

```markdown
---
title: "Your Post Title"
description: "A brief description for SEO and social sharing"
date: "2025-01-15"
slug: "your-post-url"
published: true
tags: ["tag1", "tag2"]
readTime: "5 min read"
image: "/images/my-post-image.png"
---

Your markdown content here...
```

### Frontmatter Fields

| Field         | Required | Description                   |
| ------------- | -------- | ----------------------------- |
| `title`       | Yes      | Post title                    |
| `description` | Yes      | Short description for SEO     |
| `date`        | Yes      | Publication date (YYYY-MM-DD) |
| `slug`        | Yes      | URL path (must be unique)     |
| `published`   | Yes      | Set to `true` to publish      |
| `tags`        | Yes      | Array of topic tags           |
| `readTime`    | No       | Estimated reading time        |
| `image`       | No       | Header/Open Graph image URL   |

### Adding Images

Place images in `public/images/` and reference them in your posts:

**Header/OG Image (in frontmatter):**

```yaml
image: "/images/my-header.png"
```

This image appears when sharing on social media. Recommended: 1200x630 pixels.

**Inline Images (in content):**

```markdown
![Alt text description](/images/screenshot.png)
```

**External Images:**

```markdown
![Photo](https://images.unsplash.com/photo-xxx?w=800)
```

### Sync After Adding Posts

After adding or editing posts, sync to Convex.

**Development sync:**

```bash
npm run sync
```

**Production sync:**

First, create `.env.production.local` in your project root:

```
VITE_CONVEX_URL=https://your-prod-deployment.convex.cloud
```

Get your production URL from the [Convex Dashboard](https://dashboard.convex.dev) by selecting your project and switching to the Production deployment.

Then sync:

```bash
npm run sync:prod
```

### Environment Files

| File                    | Purpose             | Created by                   |
| ----------------------- | ------------------- | ---------------------------- |
| `.env.local`            | Dev deployment URL  | `npx convex dev` (automatic) |
| `.env.production.local` | Prod deployment URL | You (manual)                 |

Both files are gitignored. Each developer creates their own local environment files.

## Customizing Your Blog

### Change the Favicon

Replace `public/favicon.svg` with your own SVG icon. The default is a rounded square with the letter "m":

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect x="32" y="32" width="448" height="448" rx="96" ry="96" fill="#000000"/>
  <text x="256" y="330" text-anchor="middle" font-size="300" font-weight="800" fill="#ffffff">m</text>
</svg>
```

To use a different letter or icon, edit the SVG directly or replace the file.

### Change the Site Logo

The logo appears on the homepage. Edit `src/pages/Home.tsx`:

```typescript
const siteConfig = {
  logo: "/images/logo.svg", // Set to null to hide the logo
  // ...
};
```

Replace `public/images/logo.svg` with your own logo file. Recommended: SVG format, 512x512 pixels.

### Change the Default Open Graph Image

The default OG image is used when a post does not have an `image` field in its frontmatter. Replace `public/images/og-default.svg` with your own image.

Recommended dimensions: 1200x630 pixels. Supported formats: PNG, JPG, or SVG.

Update the reference in `src/pages/Post.tsx`:

```typescript
const DEFAULT_OG_IMAGE = "/images/og-default.svg";
```

### Update Site Configuration

Edit `src/pages/Home.tsx` to customize:

```typescript
const siteConfig = {
  name: "Your Name",
  title: "Your Title",
  intro: "Your introduction...",
  bio: "Your bio...",
  featuredEssays: [{ title: "Post Title", slug: "post-slug" }],
  links: {
    github: "https://github.com/waynesutton/markdown-site",
    twitter: "https://twitter.com/yourusername",
  },
};
```

### Change the Default Theme

Edit `src/context/ThemeContext.tsx`:

```typescript
const DEFAULT_THEME: Theme = "tan"; // Options: "dark", "light", "tan", "cloud"
```

### Change the Font

The blog uses a serif font by default. To switch to sans-serif, edit `src/styles/global.css`:

```css
body {
  /* Sans-serif */
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Serif (default) */
  font-family:
    "New York",
    -apple-system-ui-serif,
    ui-serif,
    Georgia,
    serif;
}
```

### Add Static Pages (Optional)

Create optional pages like About, Projects, or Contact. These appear as navigation links in the top right corner.

1. Create a `content/pages/` directory
2. Add markdown files with frontmatter:

```markdown
---
title: "About"
slug: "about"
published: true
order: 1
---

Your page content here...
```

| Field       | Required | Description                   |
| ----------- | -------- | ----------------------------- |
| `title`     | Yes      | Page title (shown in nav)     |
| `slug`      | Yes      | URL path (e.g., `/about`)     |
| `published` | Yes      | Set `true` to show            |
| `order`     | No       | Display order (lower = first) |

3. Run `npm run sync` to sync pages

Pages appear automatically in the navigation when published.

### Update SEO Meta Tags

Edit `index.html` to update:

- Site title
- Meta description
- Open Graph tags
- JSON-LD structured data

### Update llms.txt and robots.txt

Edit `public/llms.txt` and `public/robots.txt` with your site information.

## Real-time Stats

Your blog includes a real-time analytics page at `/stats`:

- **Active visitors**: See who is currently on your site and which pages they are viewing
- **Total page views**: All-time view count across the site
- **Unique visitors**: Count based on anonymous session IDs
- **Views by page**: Every page and post ranked by view count

Stats update automatically without refreshing. Powered by Convex subscriptions.

How it works:

- Page views are recorded as event records (not counters) to prevent write conflicts
- Active sessions use a heartbeat system (30 second interval)
- Sessions expire after 2 minutes of inactivity
- A cron job cleans up stale sessions every 5 minutes
- No personal data is stored (only anonymous UUIDs)

## API Endpoints

Your blog includes these API endpoints for search engines and AI:

| Endpoint                       | Description                 |
| ------------------------------ | --------------------------- |
| `/stats`                       | Real-time site analytics    |
| `/rss.xml`                     | RSS feed with descriptions  |
| `/rss-full.xml`                | RSS feed with full content  |
| `/sitemap.xml`                 | Dynamic XML sitemap         |
| `/api/posts`                   | JSON list of all posts      |
| `/api/post?slug=xxx`           | Single post as JSON         |
| `/api/post?slug=xxx&format=md` | Single post as raw markdown |

## Troubleshooting

### Posts not appearing

1. Check that `published: true` in frontmatter
2. Run `npm run sync` to sync posts to development
3. Run `npm run sync:prod` to sync posts to production
4. Verify posts exist in Convex dashboard

### RSS/Sitemap not working

1. Verify `VITE_CONVEX_URL` is set in Netlify environment variables
2. Check that Convex HTTP endpoints are deployed (`npx convex deploy`)
3. Test the Convex HTTP URL directly: `https://your-deployment.convex.site/rss.xml`
4. Verify edge functions exist in `netlify/edge-functions/`

### Build failures on Netlify

Common errors and fixes:

**"vite: not found" or "Cannot find package 'vite'"**

Netlify sets `NODE_ENV=production` which skips devDependencies. Fix by using `npm ci --include=dev` in your build command:

```toml
[build]
  command = "npm ci --include=dev && npx convex deploy --cmd 'npm run build'"
```

Also ensure your build script uses `npx`:

```json
"build": "npx vite build"
```

**"Cannot find name 'process'"**

Add `@types/node` to devDependencies:

```bash
npm install --save-dev @types/node
```

**General checklist:**

1. Verify `CONVEX_DEPLOY_KEY` environment variable is set in Netlify
2. Check that `@types/node` is in devDependencies
3. Ensure Node.js version is 20 or higher
4. Verify build command includes `--include=dev`

See [netlify-deploy-fix.md](https://github.com/waynesutton/markdown-site/blob/main/netlify-deploy-fix.md) for detailed troubleshooting.

## Project Structure

```
markdown-site/
├── content/blog/       # Markdown blog posts
├── convex/             # Convex backend functions
│   ├── http.ts         # HTTP endpoints
│   ├── posts.ts        # Post queries/mutations
│   ├── rss.ts          # RSS feed generation
│   └── schema.ts       # Database schema
├── netlify/
│   └── edge-functions/ # Netlify edge functions
│       ├── rss.ts      # RSS proxy
│       ├── sitemap.ts  # Sitemap proxy
│       ├── api.ts      # API proxy
│       └── botMeta.ts  # OG crawler detection
├── public/             # Static assets
│   ├── robots.txt      # Crawler rules
│   └── llms.txt        # AI agent discovery
├── src/
│   ├── components/     # React components
│   ├── context/        # Theme context
│   ├── pages/          # Page components
│   └── styles/         # Global CSS
├── netlify.toml        # Netlify configuration
└── package.json        # Dependencies
```

## Next Steps

After deploying:

1. Add your own blog posts
2. Customize the theme colors in `global.css`
3. Update the featured essays list
4. Submit your sitemap to Google Search Console
5. Share your first post

Your blog is now live with real-time updates, SEO optimization, and AI-friendly APIs. Every time you sync new posts, they appear immediately without redeploying.
