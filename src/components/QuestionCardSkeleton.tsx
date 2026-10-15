'use client';

import React from 'react';

export default function QuestionCardSkeleton() {
  return (
    <article className="skeleton-question-card">
      {/* Top Meta Bar */}
      <div className="skeleton-top-bar">
        <div className="skeleton-badges-row">
          <div className="shimmer-element skeleton-pill-index"></div>
          <div className="shimmer-element skeleton-badge"></div>
          <div className="shimmer-element skeleton-badge"></div>
          <div className="shimmer-element skeleton-badge w-diff"></div>
          <div className="shimmer-element skeleton-badge"></div>
        </div>
        <div className="skeleton-right-actions">
          <div className="shimmer-element skeleton-id-pill"></div>
          <div className="shimmer-element skeleton-action-btn"></div>
        </div>
      </div>

      {/* Breadcrumb line */}
      <div className="shimmer-element skeleton-breadcrumb"></div>

      {/* Question Text Lines */}
      <div className="skeleton-question-body">
        <div className="shimmer-element skeleton-text-line w-full"></div>
        <div className="shimmer-element skeleton-text-line w-85"></div>
        <div className="shimmer-element skeleton-text-line w-60"></div>
      </div>

      {/* Options 2x2 Grid */}
      <div className="skeleton-options-grid">
        {[1, 2, 3, 4].map((opt) => (
          <div key={opt} className="skeleton-option-card">
            <div className="shimmer-element skeleton-option-circle"></div>
            <div className="shimmer-element skeleton-option-text"></div>
          </div>
        ))}
      </div>

      {/* Solution Toggle Bar */}
      <div className="shimmer-element skeleton-solution-bar"></div>
    </article>
  );
}
