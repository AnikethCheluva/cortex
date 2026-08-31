"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Render vault markdown. Turns Obsidian-style [[slug]] / [[slug|label]] links
 * into in-app navigation. Source back-links like [[../../sources/foo]] are
 * shown as plain text (they point outside the wiki page set).
 *
 * Math renders with KaTeX — `$inline$` and `$$block$$` — matching the note and
 * doc editors, so an equation looks the same wherever you read it.
 */
export function Markdown({
  body,
  onNavigate,
}: {
  body: string;
  onNavigate?: (slug: string) => void;
}) {
  const pre = (body ?? "").replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_m, target: string, label?: string) => {
      const t = target.trim();
      const text = (label ?? t).trim();
      // Links into sources/ or with a path are not navigable wiki pages.
      if (t.includes("/")) {
        const leaf = t.split("/").pop() ?? t;
        return `\`${label ? text : leaf}\``;
      }
      const slug = t.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      return `[${text}](wiki:${slug})`;
    },
  );
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a({ href, children }) {
            if (href && href.startsWith("wiki:")) {
              const slug = href.slice(5);
              return (
                <a
                  className="wikilink"
                  href={`#${slug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate?.(slug);
                  }}
                >
                  {children}
                </a>
              );
            }
            return (
              <a href={href ?? "#"} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {pre}
      </ReactMarkdown>
    </div>
  );
}
