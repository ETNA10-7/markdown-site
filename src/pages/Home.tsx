import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import PostList from "../components/PostList";

// Site configuration - customize this for your site
const siteConfig = {
  name: "Markdown Site",
  title: "Real-time Site with Convex",
  // Optional logo/header image (place in public/images/, set to null to hide)
  logo: "/images/logo.svg" as string | null,
  intro: (
    <>
      An open source markdown blog powered by Convex and deployed on Netlify.{" "}
      <a
        href="https://github.com/waynesutton/markdown-site"
        target="_blank"
        rel="noopener noreferrer"
        className="home-text-link"
      >
        Fork it
      </a>
      , customize it, ship it.
    </>
  ),
  bio: `Write in markdown, sync to a real-time database, and deploy in minutes. Every time you sync new posts, they appear immediately without redeploying. Built with React, TypeScript, and Convex for instant updates.`,
  featuredEssays: [
    { title: "Setup Guide", slug: "setup-guide" },
    { title: "How to Publish", slug: "how-to-publish" },
    { title: "About This Site", slug: "about-this-blog" },
  ],
  // Links for footer section
  links: {
    docs: "/setup-guide",
    convex: "https://convex.dev",
    netlify: "https://netlify.com",
  },
};

export default function Home() {
  // Fetch published posts from Convex
  const posts = useQuery(api.posts.getAllPosts);

  return (
    <div className="home">
      {/* Header section with intro */}
      <header className="home-header">
        {/* Optional site logo */}
        {siteConfig.logo && (
          <img
            src={siteConfig.logo}
            alt={siteConfig.name}
            className="home-logo"
          />
        )}
        <h1 className="home-name">{siteConfig.name}</h1>

        <p className="home-intro">{siteConfig.intro}</p>

        <p className="home-bio">{siteConfig.bio}</p>

        {/* Featured essays section */}
        <div className="home-featured">
          <p className="home-featured-intro">Get started:</p>
          <ul className="home-featured-list">
            {siteConfig.featuredEssays.map((essay) => (
              <li key={essay.slug}>
                <a href={`/${essay.slug}`} className="home-featured-link">
                  {essay.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </header>

      {/* Blog posts section - no loading state to avoid flash (Convex syncs instantly) */}
      <section id="posts" className="home-posts">
        {posts === undefined ? null : posts.length === 0 ? (
          <p className="no-posts">No posts yet. Check back soon!</p>
        ) : (
          <PostList posts={posts} />
        )}
      </section>

      {/* Footer section */}
      <section className="home-footer">
        <p className="home-footer-text">
          Built with{" "}
          <a
            href={siteConfig.links.convex}
            target="_blank"
            rel="noopener noreferrer"
          >
            Convex
          </a>{" "}
          for real-time sync and deployed on{" "}
          <a
            href={siteConfig.links.netlify}
            target="_blank"
            rel="noopener noreferrer"
          >
            Netlify
          </a>
          . Read the{" "}
          <a
            href="https://github.com/waynesutton/markdown-site"
            target="_blank"
            rel="noopener noreferrer"
          >
            project on GitHub
          </a>{" "}
          to fork and deploy your own. View{" "}
          <a href="/stats" className="home-text-link">
            real-time site stats
          </a>
          .
        </p>
      </section>
    </div>
  );
}
