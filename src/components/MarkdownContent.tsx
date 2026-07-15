import ReactMarkdown from 'react-markdown';

// Shared Markdown rendering used both in the blog editor's live preview
// (MarkdownEditor.tsx) and on the public post page (BlogPostPage.tsx), so
// what an editor sees while writing matches what visitors see. Styled by
// hand with Tailwind utility classes on each element — the project doesn't
// have the @tailwindcss/typography ("prose") plugin installed, so `prose`
// classes would silently do nothing.
export default function MarkdownContent({ markdown, className = '' }: { markdown: string; className?: string }) {
  return (
    <div className={`text-gray-700 leading-relaxed ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-3xl font-display font-bold text-ink mt-8 mb-4 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-display font-bold text-ink mt-8 mb-3 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-display font-bold text-ink mt-6 mb-2 first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="mb-4">{children}</p>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-terracotta font-medium underline hover:no-underline">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-terracotta/30 pl-4 italic text-gray-500 my-4">{children}</blockquote>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt || ''} className="w-full rounded-2xl my-6 shadow-sm" />
          ),
          code: ({ children }) => <code className="bg-gray-100 text-terracotta px-1.5 py-0.5 rounded text-sm">{children}</code>,
          strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
          hr: () => <hr className="my-8 border-gray-100" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
