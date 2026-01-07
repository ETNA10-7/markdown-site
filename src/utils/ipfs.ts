/**
 * Fetch markdown content from IPFS using a CID
 * 
 * @param cid - IPFS Content Identifier (CID)
 * @returns Promise resolving to the markdown content string
 * @throws Error if fetch fails or content is not found
 * 
 * @example
 * ```typescript
 * const content = await fetchContentFromIPFS("QmXxxx...");
 * ```
 */
export async function fetchContentFromIPFS(cid: string): Promise<string> {
  if (!cid) {
    throw new Error("CID is required to fetch content from IPFS");
  }

  // Get gateway URL from environment variable or use default
  // Vite requires VITE_ prefix for env vars exposed to client
  const customGateway = import.meta.env.VITE_PINATA_GATEWAY_URL;
  const gatewayBase = customGateway
    ? `https://${customGateway}`
    : "https://gateway.pinata.cloud";
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

