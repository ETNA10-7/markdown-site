import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import siteConfig from "../config/siteConfig";
import {
  House,
  Book,
  Gear,
  Folder,
  Code,
  FileText,
  Question,
  Lightbulb,
  Rocket,
  Star,
  Heart,
  Bell,
  Calendar,
  User,
  ArrowRight,
  Check,
  Warning,
  Info,
  Lightning,
  Database,
  Globe,
  Lock,
  Key,
  Shield,
  Terminal,
  Package,
  PuzzlePiece,
  Flag,
  Target,
  Compass,
  MapPin,
  Bookmark,
  Tag,
  Hash,
  Link as LinkIcon,
  At,
  Play,
  Pause,
  Plus,
  Minus,
  X,
  List,
  MagnifyingGlass,
  FunnelSimple,
  SortAscending,
  Download,
  Upload,
  Share,
  Copy,
  Clipboard,
  PencilSimple,
  Trash,
  Archive,
  Eye,
  EyeClosed,
  type Icon,
} from "@phosphor-icons/react";

// Map of supported Phosphor icon names to components
const docsSectionIcons: Record<string, Icon> = {
  House,
  Book,
  Gear,
  Folder,
  Code,
  FileText,
  Question,
  Lightbulb,
  Rocket,
  Star,
  Heart,
  Bell,
  Calendar,
  User,
  ArrowRight,
  Check,
  Warning,
  Info,
  Lightning,
  Database,
  Globe,
  Lock,
  Key,
  Shield,
  Terminal,
  Package,
  PuzzlePiece,
  Flag,
  Target,
  Compass,
  MapPin,
  Bookmark,
  Tag,
  Hash,
  Link: LinkIcon,
  At,
  Play,
  Pause,
  Plus,
  Minus,
  X,
  List,
  MagnifyingGlass,
  FunnelSimple,
  SortAscending,
  Download,
  Upload,
  Share,
  Copy,
  Clipboard,
  PencilSimple,
  Trash,
  Archive,
  Eye,
  EyeClosed,
};

// Docs item from query
interface DocsItem {
  _id: string;
  slug: string;
  title: string;
  docsSectionGroup?: string;
  docsSectionOrder?: number;
  docsSectionGroupOrder?: number;
  docsSectionGroupIcon?: string;
}

// Grouped docs structure
interface DocsGroup {
  name: string;
  items: DocsItem[];
  icon?: string;
}

interface DocsSidebarProps {
  currentSlug?: string;
  isMobile?: boolean;
}

// Storage key for expanded state
const STORAGE_KEY = "docs-sidebar-expanded-state";

export default function DocsSidebar({ currentSlug, isMobile }: DocsSidebarProps) {
  const location = useLocation();
  // Workaround: Use getAllPages and filter if getDocsPages is not available (Convex sync issue)
  const allPagesForDocs = useQuery(api.pages.getAllPages);
  const docsPages = allPagesForDocs
    ? allPagesForDocs
        .filter((p) => p.docsSection === true && p.published)
        .map((p) => ({
          _id: p._id,
          slug: p.slug,
          title: p.title,
          docsSectionGroup: p.docsSectionGroup,
          docsSectionOrder: p.docsSectionOrder,
          docsSectionGroupOrder: p.docsSectionGroupOrder,
          docsSectionGroupIcon: p.docsSectionGroupIcon,
        }))
        .sort((a, b) => {
          const orderA = a.docsSectionOrder ?? 999;
          const orderB = b.docsSectionOrder ?? 999;
          if (orderA !== orderB) return orderA - orderB;
          return a.title.localeCompare(b.title);
        })
    : undefined;
  const docsPosts = useQuery(api.posts.getDocsPosts);

  // Combine posts and pages
  const allDocsItems = useMemo(() => {
    const items: DocsItem[] = [];
    if (docsPosts) {
      items.push(...docsPosts.map((p) => ({ ...p, _id: p._id.toString() })));
    }
    if (docsPages) {
      items.push(...docsPages.map((p) => ({ ...p, _id: p._id.toString() })));
    }
    return items;
  }, [docsPosts, docsPages]);

  // Group items by docsSectionGroup
  const groups = useMemo(() => {
    const groupMap = new Map<string, DocsItem[]>();
    const ungrouped: DocsItem[] = [];

    for (const item of allDocsItems) {
      const groupName = item.docsSectionGroup || "";
      if (groupName) {
        if (!groupMap.has(groupName)) {
          groupMap.set(groupName, []);
        }
        groupMap.get(groupName)!.push(item);
      } else {
        ungrouped.push(item);
      }
    }

    // Sort items within each group by docsSectionOrder
    const sortItems = (a: DocsItem, b: DocsItem) => {
      const orderA = a.docsSectionOrder ?? 999;
      const orderB = b.docsSectionOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    };

    // Convert to array and sort
    const result: DocsGroup[] = [];

    // Add groups sorted by docsSectionGroupOrder (using minimum order from items in each group)
    const sortedGroupNames = Array.from(groupMap.keys()).sort((a, b) => {
      const groupAItems = groupMap.get(a)!;
      const groupBItems = groupMap.get(b)!;
      const orderA = Math.min(...groupAItems.map(i => i.docsSectionGroupOrder ?? 999));
      const orderB = Math.min(...groupBItems.map(i => i.docsSectionGroupOrder ?? 999));
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b); // Fallback to alphabetical
    });
    for (const name of sortedGroupNames) {
      const items = groupMap.get(name)!;
      items.sort(sortItems);
      // Get the first icon found in the group (allows any item to define the group icon)
      const icon = items.find(i => i.docsSectionGroupIcon)?.docsSectionGroupIcon;
      result.push({ name, items, icon });
    }

    // Add ungrouped items at the end if any
    if (ungrouped.length > 0) {
      ungrouped.sort(sortItems);
      result.push({ name: "", items: ungrouped });
    }

    return result;
  }, [allDocsItems]);

  // Expanded state for groups - initialize from localStorage only
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Load from localStorage only, don't use groups here (groups not ready yet)
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch {
      // Ignore parsing errors
    }
    return new Set<string>();
  });

  // Create stable reference for group names (serialized version for dependency comparison)
  const groupNames = useMemo(() => {
    return groups.map((g) => g.name).join(",");
  }, [groups]);

  // Persist expanded state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expanded)));
    } catch {
      // Ignore storage errors
    }
  }, [expanded]);

  // Update expanded state when groups change (ensure new groups are expanded if defaultExpanded)
  // Use groupNames (stable string) instead of groups (unstable array reference) as dependency
  // groupNames changes only when actual group names change, preventing infinite loops
  useEffect(() => {
    if (!siteConfig.docsSection?.defaultExpanded || groups.length === 0) {
      return;
    }

    setExpanded((prev) => {
      // Check if there are any new groups that need to be added
      let hasNewGroups = false;
      for (const group of groups) {
        if (group.name && !prev.has(group.name)) {
          hasNewGroups = true;
          break;
        }
      }

      // Only create new Set if there are actual changes (prevents unnecessary re-renders)
      if (!hasNewGroups) {
        return prev; // Return same reference if no changes
      }

      // Create new Set with new groups added
      const newExpanded = new Set(prev);
      for (const group of groups) {
        if (group.name && !prev.has(group.name)) {
          newExpanded.add(group.name);
        }
      }
      return newExpanded;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupNames]); // Only depend on stable groupNames string, groups is read inside (safe because groupNames changes when groups change)

  // Get current slug from URL if not provided
  const activeSlug = currentSlug || location.pathname.replace(/^\//, "");

  // Toggle group expansion
  const toggleGroup = (name: string) => {
    setExpanded((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(name)) {
        newExpanded.delete(name);
      } else {
        newExpanded.add(name);
      }
      return newExpanded;
    });
  };

  // Loading state
  if (docsPosts === undefined || docsPages === undefined) {
    return null;
  }

  // No docs items
  if (allDocsItems.length === 0) {
    return null;
  }

  const containerClass = isMobile ? "docs-mobile-sidebar" : "docs-sidebar-nav";

  return (
    <nav className={containerClass}>
      <h3 className="docs-sidebar-title">
        {siteConfig.docsSection?.title || "Documentation"}
      </h3>

      {groups.map((group) => (
        <div key={group.name || "ungrouped"} className="docs-sidebar-group">
          {/* Group title (only for named groups) */}
          {group.name && (
            <button
              className={`docs-sidebar-group-title ${expanded.has(group.name) ? "expanded" : ""}`}
              onClick={() => toggleGroup(group.name)}
              type="button"
            >
              {group.icon && docsSectionIcons[group.icon] && (
                (() => {
                  const IconComponent = docsSectionIcons[group.icon];
                  return <IconComponent size={16} weight="regular" className="docs-sidebar-group-icon" />;
                })()
              )}
              <ChevronRight />
              <span>{group.name}</span>
            </button>
          )}

          {/* Group items (show if no name or if expanded) */}
          {(!group.name || expanded.has(group.name)) && (
            <ul className="docs-sidebar-group-list">
              {group.items.map((item) => (
                <li key={item._id} className="docs-sidebar-item">
                  <Link
                    to={`/${item.slug}`}
                    className={`docs-sidebar-link ${activeSlug === item.slug ? "active" : ""}`}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
