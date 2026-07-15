import React, { useRef, useState } from 'react';
import MarkdownContent from './MarkdownContent';
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  Link2,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
  Eye,
  Pencil
} from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

// A lightweight rich-text-style editor: a formatting toolbar that wraps the
// current textarea selection in Markdown syntax (bold, italic, headings,
// links, lists, quotes, images), plus a live Preview toggle rendered with
// `react-markdown` — already a project dependency, so this needs no new
// npm packages. Body content is stored as plain Markdown text.
export default function MarkdownEditor({ value, onChange, placeholder, minHeight = 320 }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  const applyWrap = (before: string, after: string = before, placeholderText = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || placeholderText;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + selected.length;
      ta.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const applyLinePrefix = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    // Find the start of the line containing the selection.
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  };

  const insertLink = () => applyWrap('[', '](https://)', 'link text');
  const insertImage = () => applyWrap('![', '](https://)', 'alt text');

  const buttons: { icon: React.ReactNode; title: string; onClick: () => void }[] = [
    { icon: <Bold size={16} />, title: 'Bold', onClick: () => applyWrap('**', '**', 'bold text') },
    { icon: <Italic size={16} />, title: 'Italic', onClick: () => applyWrap('*', '*', 'italic text') },
    { icon: <Heading2 size={16} />, title: 'Heading', onClick: () => applyLinePrefix('## ') },
    { icon: <Heading3 size={16} />, title: 'Subheading', onClick: () => applyLinePrefix('### ') },
    { icon: <Quote size={16} />, title: 'Quote', onClick: () => applyLinePrefix('> ') },
    { icon: <List size={16} />, title: 'Bullet list', onClick: () => applyLinePrefix('- ') },
    { icon: <ListOrdered size={16} />, title: 'Numbered list', onClick: () => applyLinePrefix('1. ') },
    { icon: <Link2 size={16} />, title: 'Link', onClick: insertLink },
    { icon: <ImageIcon size={16} />, title: 'Image', onClick: insertImage },
  ];

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      <div className="flex items-center justify-between bg-gray-50 border-b border-gray-100 px-2 py-1.5">
        <div className="flex items-center gap-0.5 flex-wrap">
          {buttons.map((btn, i) => (
            <button
              key={i}
              type="button"
              title={btn.title}
              onClick={btn.onClick}
              disabled={mode === 'preview'}
              className="p-2 rounded-lg text-gray-500 hover:bg-white hover:text-terracotta transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {btn.icon}
            </button>
          ))}
        </div>
        <div className="flex bg-white rounded-lg p-0.5 border border-gray-200">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${mode === 'write' ? 'bg-terracotta text-white' : 'text-gray-400'}`}
          >
            <Pencil size={12} /> Write
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${mode === 'preview' ? 'bg-terracotta text-white' : 'text-gray-400'}`}
          >
            <Eye size={12} /> Preview
          </button>
        </div>
      </div>

      {mode === 'write' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight }}
          className="w-full p-5 outline-none resize-y font-mono text-sm leading-relaxed text-ink"
        />
      ) : (
        <div style={{ minHeight }} className="p-5 overflow-y-auto">
          {value.trim() ? (
            <MarkdownContent markdown={value} />
          ) : (
            <p className="text-gray-400 italic">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
