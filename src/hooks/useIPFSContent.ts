import { useState, useEffect } from "react";
import { fetchContentFromIPFS } from "../utils/ipfs";

/**
 * Hook to fetch markdown content from IPFS using a CID
 * 
 * @param cid - IPFS Content Identifier (CID), or null/undefined if not available
 * @returns Object with content string, loading state, and error state
 * 
 * @example
 * ```typescript
 * const { content, isLoading, error } = useIPFSContent(post?.contentCid);
 * ```
 */
export function useIPFSContent(
  cid: string | null | undefined
): {
  content: string | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Reset state when CID changes
    setContent(null);
    setError(null);

    // Skip if no CID provided
    if (!cid) {
      setIsLoading(false);
      return;
    }

    // Fetch content from IPFS
    setIsLoading(true);
    fetchContentFromIPFS(cid)
      .then((fetchedContent) => {
        setContent(fetchedContent);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setContent(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [cid]);

  return { content, isLoading, error };
}

