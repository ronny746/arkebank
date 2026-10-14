'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  content?: string | null;
  className?: string;
  inline?: boolean;
}

export default function MathRenderer({ content, className = '', inline = false }: MathRendererProps) {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    let text = String(content);

    // Normalize escaped backslashes and HTML entities commonly stored in scraped JSON
    text = text
      .replace(/\\\\([a-zA-Z]+)/g, '\\$1')
      .replace(/\\\\;/g, '\\;')
      .replace(/\\ /g, ' ')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // 1. Process display block math: $$...$$ or \[...\]
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
          strict: false,
        });
      } catch {
        return `$$${math}$$`;
      }
    });

    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
          strict: false,
        });
      } catch {
        return `\\[${math}\\]`;
      }
    });

    // 2. Process inline math: $...$ or \(...\)
    text = text.replace(/\$([^\$\n\r]+?)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
          strict: false,
        });
      } catch {
        return `$${math}$`;
      }
    });

    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
          strict: false,
        });
      } catch {
        return `\\(${math}\\)`;
      }
    });

    return text;
  }, [content]);

  if (inline) {
    return (
      <span
        className={`prose-math-inline ${className}`}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    );
  }

  return (
    <div
      className={`prose-math ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
