import { PinataSDK } from "pinata";

/**
 * Initialize Pinata SDK instance
 * Reads PINATA_JWT from environment variables
 */
function getPinataClient(): PinataSDK {
  const pinataJwt = process.env.PINATA_JWT;
  
  if (!pinataJwt) {
    throw new Error(
      "PINATA_JWT environment variable is not set. Please configure it in your .env.local or .env.production.local file."
    );
  }

  return new PinataSDK({
    pinataJwt,
    // Gateway is optional for uploads, but can be configured if needed
    // pinataGateway: process.env.PINATA_GATEWAY,
  });
}

/**
 * Upload markdown content to IPFS via Pinata
 * 
 * @param content - Raw markdown content string to upload
 * @returns Promise resolving to the IPFS Content Identifier (CID)
 * @throws Error if PINATA_JWT is not configured or upload fails
 * 
 * @example
 * ```typescript
 * const cid = await uploadMarkdownToIPFS("# Hello World\n\nThis is markdown content.");
 * console.log(`Content uploaded to IPFS: ${cid}`);
 * ```
 */
export async function uploadMarkdownToIPFS(content: string): Promise<string> {
  const pinata = getPinataClient();

  try {
    // Convert markdown string to File object
    // Pinata SDK requires a File object for uploads
    const blob = new Blob([content], { type: "text/markdown" });
    const file = new File([blob], "content.md", { type: "text/markdown" });

    // Upload to IPFS via Pinata
    const upload = await pinata.upload.public.file(file);

    // Extract CID from upload response
    // Pinata SDK v2 returns CID in the 'cid' field
    const cid = upload.cid;
    
    if (!cid) {
      throw new Error(
        `Upload succeeded but no CID was returned. Response: ${JSON.stringify(upload)}`
      );
    }

    return cid;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload markdown to IPFS: ${error.message}`);
    }
    throw new Error(`Failed to upload markdown to IPFS: ${String(error)}`);
  }
}

