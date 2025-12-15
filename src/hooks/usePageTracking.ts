import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";

// Heartbeat interval: 30 seconds
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

// Session ID key in localStorage
const SESSION_ID_KEY = "markdown_blog_session_id";

/**
 * Generate a random session ID (UUID v4 format)
 */
function generateSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a persistent session ID
 */
function getSessionId(): string {
  if (typeof window === "undefined") {
    return generateSessionId();
  }

  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Determine page type from path
 */
function getPageType(path: string): string {
  if (path === "/" || path === "") {
    return "home";
  }
  if (path === "/stats") {
    return "stats";
  }
  // Could be a blog post or static page
  return "page";
}

/**
 * Hook to track page views and maintain active session presence
 */
export function usePageTracking(): void {
  const location = useLocation();
  const recordPageView = useMutation(api.stats.recordPageView);
  const heartbeat = useMutation(api.stats.heartbeat);

  // Track if we've recorded view for current path
  const lastRecordedPath = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Initialize session ID
  useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  // Record page view when path changes
  useEffect(() => {
    const path = location.pathname;
    const sessionId = sessionIdRef.current;

    if (!sessionId) return;

    // Only record if path changed
    if (lastRecordedPath.current !== path) {
      lastRecordedPath.current = path;

      recordPageView({
        path,
        pageType: getPageType(path),
        sessionId,
      }).catch(() => {
        // Silently fail - analytics shouldn't break the app
      });
    }
  }, [location.pathname, recordPageView]);

  // Send heartbeat on interval and on path change
  useEffect(() => {
    const path = location.pathname;
    const sessionId = sessionIdRef.current;

    if (!sessionId) return;

    // Send initial heartbeat
    const sendHeartbeat = () => {
      heartbeat({
        sessionId,
        currentPath: path,
      }).catch(() => {
        // Silently fail
      });
    };

    sendHeartbeat();

    // Set up interval for ongoing heartbeats
    const intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [location.pathname, heartbeat]);
}

