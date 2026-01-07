#!/usr/bin/env bun
/**
 * Script to verify that content is stored in Pinata IPFS
 * 
 * Usage:
 *   bun run scripts/verify-ipfs.ts
 * 
 * This script:
 * 1. Lists all posts/pages from Convex with their contentCid
 * 2. Attempts to fetch content from IPFS using the CID
 * 3. Verifies the content is accessible
 */

import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

const CONVEX_URL = process.env.VITE_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ VITE_CONVEX_URL not found in .env.local");
  process.exit(1);
}

const PINATA_GATEWAY = process.env.VITE_PINATA_GATEWAY_URL 
  ? `https://${process.env.VITE_PINATA_GATEWAY_URL}`
  : "https://gateway.pinata.cloud";

async function fetchFromIPFS(cid: string): Promise<string | null> {
  const url = `${PINATA_GATEWAY}/ipfs/${cid}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log("🔍 Verifying IPFS storage...\n");
  console.log(`📍 Gateway: ${PINATA_GATEWAY}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);

  // Get all posts
  const posts = await client.query("posts:listAll", {});
  console.log(`📝 Found ${posts.length} posts\n`);

  // Get all pages
  const pages = await client.query("pages:listAll", {});
  console.log(`📄 Found ${pages.length} pages\n`);

  let postsVerified = 0;
  let postsFailed = 0;
  let pagesVerified = 0;
  let pagesFailed = 0;

  // Verify posts
  console.log("🔎 Verifying posts...");
  for (const post of posts) {
    if (!post.contentCid) {
      console.log(`  ⚠️  ${post.slug}: No contentCid`);
      postsFailed++;
      continue;
    }

    const content = await fetchFromIPFS(post.contentCid);
    if (content) {
      console.log(`  ✅ ${post.slug}: ${post.contentCid.substring(0, 20)}... (${content.length} bytes)`);
      postsVerified++;
    } else {
      console.log(`  ❌ ${post.slug}: ${post.contentCid.substring(0, 20)}... (Failed to fetch)`);
      postsFailed++;
    }
  }

  console.log("\n🔎 Verifying pages...");
  for (const page of pages) {
    if (!page.contentCid) {
      console.log(`  ⚠️  ${page.slug}: No contentCid`);
      pagesFailed++;
      continue;
    }

    const content = await fetchFromIPFS(page.contentCid);
    if (content) {
      console.log(`  ✅ ${page.slug}: ${page.contentCid.substring(0, 20)}... (${content.length} bytes)`);
      pagesVerified++;
    } else {
      console.log(`  ❌ ${page.slug}: ${page.contentCid.substring(0, 20)}... (Failed to fetch)`);
      pagesFailed++;
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`  Posts: ${postsVerified} verified, ${postsFailed} failed`);
  console.log(`  Pages: ${pagesVerified} verified, ${pagesFailed} failed`);
  console.log(`  Total: ${postsVerified + pagesVerified} verified, ${postsFailed + pagesFailed} failed`);
  console.log("=".repeat(50));

  if (postsFailed === 0 && pagesFailed === 0) {
    console.log("\n✅ All content is accessible from IPFS!");
  } else {
    console.log("\n⚠️  Some content failed to fetch. Check the CIDs above.");
  }
}

main().catch(console.error);

