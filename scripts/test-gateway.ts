#!/usr/bin/env bun
/**
 * Quick test script to verify your Pinata gateway is working
 * 
 * Usage:
 *   bun run scripts/test-gateway.ts
 */

import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

const CONVEX_URL = process.env.VITE_CONVEX_URL;
const GATEWAY = process.env.VITE_PINATA_GATEWAY_URL 
  ? `https://${process.env.VITE_PINATA_GATEWAY_URL}`
  : "https://gateway.pinata.cloud";

if (!CONVEX_URL) {
  console.error("❌ VITE_CONVEX_URL not found in .env.local");
  process.exit(1);
}

async function testGateway(cid: string): Promise<boolean> {
  const url = `${GATEWAY}/ipfs/${cid}`;
  try {
    const response = await fetch(url);
    if (response.ok) {
      const content = await response.text();
      console.log(`  ✅ Content accessible (${content.length} bytes)`);
      console.log(`  📄 Preview: ${content.substring(0, 100).replace(/\n/g, ' ')}...`);
      return true;
    } else {
      console.log(`  ❌ HTTP ${response.status}: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log("🧪 Testing Pinata Gateway\n");
  console.log(`📍 Gateway: ${GATEWAY}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);

  // Get first published post
  const posts = await client.query("posts:getAllPosts", {});
  
  if (posts.length === 0) {
    console.log("⚠️  No posts found. Make sure you've synced your content.");
    console.log("   Run: npm run sync");
    process.exit(1);
  }

  const firstPost = posts[0];
  console.log(`📝 Testing with post: "${firstPost.title}"`);
  console.log(`   Slug: ${firstPost.slug}`);
  console.log(`   CID: ${firstPost.contentCid}\n`);

  if (!firstPost.contentCid) {
    console.log("❌ No contentCid found. Content may not be synced to IPFS yet.");
    console.log("   Run: npm run sync");
    process.exit(1);
  }

  console.log(`🔗 Testing URL: ${GATEWAY}/ipfs/${firstPost.contentCid}\n`);
  
  const success = await testGateway(firstPost.contentCid);

  console.log("\n" + "=".repeat(60));
  if (success) {
    console.log("✅ SUCCESS! Your gateway is working correctly!");
    console.log(`\n💡 You can now access any content using:`);
    console.log(`   ${GATEWAY}/ipfs/{CID}`);
    console.log(`\n📋 Example URLs:`);
    console.log(`   ${GATEWAY}/ipfs/${firstPost.contentCid}`);
  } else {
    console.log("❌ FAILED! Check your gateway configuration.");
    console.log("\n🔍 Troubleshooting:");
    console.log("   1. Verify PINATA_JWT is set in .env.local");
    console.log("   2. Check that content was uploaded to Pinata");
    console.log("   3. Verify gateway URL is correct in Pinata dashboard");
  }
  console.log("=".repeat(60));
}

main().catch(console.error);

