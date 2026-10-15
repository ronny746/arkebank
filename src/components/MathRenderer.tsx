'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  content?: string | null;
  className?: string;
  inline?: boolean;
}

function cleanMath(str: string): string {
  if (!str) return '';
  let m = str.trim();

  // 1. Replace HTML non-breaking spaces and line breaks inside LaTeX
  m = m.replace(/<br\s*\/?>/gi, ' \\\\ ');
  m = m.replace(/&nbsp;/gi, ' ');

  // 2. Decode HTML entities that break KaTeX
  m = m.replace(/&gt;/gi, '>');
  m = m.replace(/&lt;/gi, '<');
  m = m.replace(/&quot;/gi, '"');
  m = m.replace(/&#39;/gi, "'");
  m = m.replace(/&plusmn;/gi, '\\pm ');
  m = m.replace(/&times;/gi, '\\times ');
  m = m.replace(/&divide;/gi, '\\div ');
  m = m.replace(/&le;/gi, '\\le ');
  m = m.replace(/&ge;/gi, '\\ge ');
  m = m.replace(/&ne;/gi, '\\ne ');
  m = m.replace(/&deg;/gi, '^\\circ ');
  m = m.replace(/&infin;/gi, '\\infty ');

  // 3. Handle & inside \text{...} so it doesn't cause alignment parse errors
  m = m.replace(/(\\text\s*\{[^}]*?)(&)([^}]*?\})/g, '$1\\\\&$3');
  m = m.replace(/&amp;/gi, '&');

  return m;
}

export default function MathRenderer({ content, className = '', inline = false }: MathRendererProps) {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    let text = String(content);

    // Normalize escaped backslashes and HTML entities commonly stored in scraped JSON
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&gt;/gi, '>')
      .replace(/&lt;/gi, '<')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/\\\\([a-zA-Z]+)/g, '\\$1')
      .replace(/\\\\;/g, '\\;')
      .replace(/\\ /g, ' ');

    // 1. Process display block math: $$...$$ or \[...\]
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      try {
        return katex.renderToString(cleanMath(math), {
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
        return katex.renderToString(cleanMath(math), {
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
        return katex.renderToString(cleanMath(math), {
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
        return katex.renderToString(cleanMath(math), {
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
