import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import {
  ArrowLeft,
  Users,
  Eye,
  FileText,
  BookOpen,
  Activity,
} from "lucide-react";

export default function Stats() {
  const navigate = useNavigate();
  const stats = useQuery(api.stats.getStats);

  // Don't render until stats load
  if (stats === undefined) {
    return null;
  }

  return (
    <div className="stats-page">
      {/* Header with back button */}
      <nav className="stats-nav">
        <button onClick={() => navigate("/")} className="back-button">
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      </nav>

      {/* Page header */}
      <header className="stats-header">
        <h1 className="stats-title">Site Statistics</h1>
        <p className="stats-subtitle">
          Real-time analytics for this site. All data updates automatically.
        </p>
      </header>

      {/* Stats cards grid */}
      <section className="stats-grid">
        {/* Active visitors card */}
        <div className="stat-card">
          <div className="stat-card-header">
            <Activity size={18} className="stat-card-icon" />
            <span className="stat-card-label">Active Now</span>
          </div>
          <div className="stat-card-value">{stats.activeVisitors}</div>
          <div className="stat-card-desc">Visitors on site</div>
        </div>

        {/* Total page views card */}
        <div className="stat-card">
          <div className="stat-card-header">
            <Eye size={18} className="stat-card-icon" />
            <span className="stat-card-label">Total Views</span>
          </div>
          <div className="stat-card-value">{stats.totalPageViews}</div>
          <div className="stat-card-desc">All-time page views</div>
        </div>

        {/* Unique visitors card */}
        <div className="stat-card">
          <div className="stat-card-header">
            <Users size={18} className="stat-card-icon" />
            <span className="stat-card-label">Unique Visitors</span>
          </div>
          <div className="stat-card-value">{stats.uniqueVisitors}</div>
          <div className="stat-card-desc">Unique sessions</div>
        </div>

        {/* Published posts card */}
        <div className="stat-card">
          <div className="stat-card-header">
            <BookOpen size={18} className="stat-card-icon" />
            <span className="stat-card-label">Blog Posts</span>
          </div>
          <div className="stat-card-value">{stats.publishedPosts}</div>
          <div className="stat-card-desc">Published posts</div>
        </div>

        {/* Published pages card */}
        <div className="stat-card">
          <div className="stat-card-header">
            <FileText size={18} className="stat-card-icon" />
            <span className="stat-card-label">Pages</span>
          </div>
          <div className="stat-card-value">{stats.publishedPages}</div>
          <div className="stat-card-desc">Static pages</div>
        </div>
      </section>

      {/* Active visitors by page */}
      {stats.activeByPath.length > 0 && (
        <section className="stats-section">
          <h2 className="stats-section-title">Currently Viewing</h2>
          <div className="stats-list">
            {stats.activeByPath.map((item) => (
              <div key={item.path} className="stats-list-item">
                <span className="stats-list-path">
                  {item.path === "/" ? "Home" : item.path}
                </span>
                <span className="stats-list-count">
                  {item.count} {item.count === 1 ? "visitor" : "visitors"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Page views by page */}
      {stats.pageStats.length > 0 && (
        <section className="stats-section">
          <h2 className="stats-section-title">Views by Page</h2>
          <div className="stats-list">
            {stats.pageStats.map((item) => (
              <div key={item.path} className="stats-list-item">
                <div className="stats-list-info">
                  <span className="stats-list-title">{item.title}</span>
                  <span className="stats-list-type">{item.pageType}</span>
                </div>
                <span className="stats-list-count">
                  {item.views} {item.views === 1 ? "view" : "views"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

