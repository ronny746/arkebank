'use client';

import React, { useMemo } from 'react';
import { renderContentToHtml } from '@/lib/math-html';

interface MathRendererProps {
  content?: string | null;
  className?: string;
  inline?: boolean;
}

export default function MathRenderer({ content, className = '', inline = false }: MathRendererProps) {
  const renderedHtml = useMemo(() => renderContentToHtml(content), [content]);

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
