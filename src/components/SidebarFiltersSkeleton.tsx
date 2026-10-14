'use client';

import React from 'react';

export default function SidebarFiltersSkeleton() {
  return (
    <div className="sidebar-skeleton-wrapper">
      {/* 1. Class / Standard Pills Skeleton */}
      <div className="sidebar-skeleton-group">
        <div className="shimmer-element sidebar-skel-title"></div>
        <div className="sidebar-skel-pills">
          <div className="shimmer-element sidebar-skel-pill w-35"></div>
          <div className="shimmer-element sidebar-skel-pill w-55"></div>
          <div className="shimmer-element sidebar-skel-pill w-60"></div>
          <div className="shimmer-element sidebar-skel-pill w-60"></div>
          <div className="shimmer-element sidebar-skel-pill w-40"></div>
          <div className="shimmer-element sidebar-skel-pill w-45"></div>
          <div className="shimmer-element sidebar-skel-pill w-75"></div>
        </div>
      </div>

      {/* 2. Subject Pills Skeleton */}
      <div className="sidebar-skeleton-group">
        <div className="shimmer-element sidebar-skel-title"></div>
        <div className="sidebar-skel-pills">
          <div className="shimmer-element sidebar-skel-pill w-35"></div>
          <div className="shimmer-element sidebar-skel-pill w-60"></div>
          <div className="shimmer-element sidebar-skel-pill w-70"></div>
          <div className="shimmer-element sidebar-skel-pill w-80"></div>
          <div className="shimmer-element sidebar-skel-pill w-55"></div>
          <div className="shimmer-element sidebar-skel-pill w-70"></div>
        </div>
      </div>

      {/* 3. Difficulty Tier Skeleton */}
      <div className="sidebar-skeleton-group">
        <div className="shimmer-element sidebar-skel-title"></div>
        <div className="sidebar-skel-pills">
          <div className="shimmer-element sidebar-skel-pill w-35"></div>
          <div className="shimmer-element sidebar-skel-pill w-80"></div>
          <div className="shimmer-element sidebar-skel-pill w-75"></div>
          <div className="shimmer-element sidebar-skel-pill w-85"></div>
          <div className="shimmer-element sidebar-skel-pill w-75"></div>
        </div>
      </div>

      {/* 4. Exam Year Dropdown Skeleton */}
      <div className="sidebar-skeleton-group">
        <div className="shimmer-element sidebar-skel-title"></div>
        <div className="shimmer-element sidebar-skel-input"></div>
      </div>

      {/* 5. Chapter Dropdown Skeleton */}
      <div className="sidebar-skeleton-group">
        <div className="shimmer-element sidebar-skel-title"></div>
        <div className="shimmer-element sidebar-skel-input"></div>
      </div>

      {/* 6. Sub-topic Dropdown Skeleton */}
      <div className="sidebar-skeleton-group">
        <div className="shimmer-element sidebar-skel-title"></div>
        <div className="shimmer-element sidebar-skel-input"></div>
      </div>

      {/* 7. Language Switch Skeleton */}
      <div className="sidebar-skeleton-group">
        <div className="shimmer-element sidebar-skel-title"></div>
        <div className="shimmer-element sidebar-skel-switch"></div>
      </div>

      {/* 8. Diagram Toggle Skeleton */}
      <div className="sidebar-skeleton-toggle-row">
        <div className="shimmer-element sidebar-skel-label"></div>
        <div className="shimmer-element sidebar-skel-checkbox"></div>
      </div>
    </div>
  );
}
