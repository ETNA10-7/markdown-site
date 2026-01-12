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
  
  // Build gateway base URL - check if custom gateway already has protocol
  let gatewayBase: string;
  if (customGateway) {
    // If custom gateway already starts with http:// or https://, use it as-is
    // Otherwise, add https:// prefix
    gatewayBase = customGateway.startsWith("http://") || customGateway.startsWith("https://")
      ? customGateway
      : `https://${customGateway}`;
  } else {
    gatewayBase = "https://gateway.pinata.cloud";
  }
  
  const publicGatewayBase = "https://gateway.pinata.cloud";
  const gatewayUrl = `${gatewayBase}/ipfs/${cid}`;
  const publicGatewayUrl = `${publicGatewayBase}/ipfs/${cid}`;

  // Try custom gateway first, fallback to public gateway on 403 or other errors
  try {
    const response = await fetch(gatewayUrl);

    if (!response.ok) {
      // If custom gateway returns 403 (Forbidden) or 401 (Unauthorized), try public gateway
      if (response.status === 403 || response.status === 401) {
        console.warn(`Custom gateway returned ${response.status}, falling back to public gateway`);
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
        console.warn(`Custom gateway failed, falling back to public gateway:`, error instanceof Error ? error.message : String(error));
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

