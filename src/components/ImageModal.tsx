'use client';

import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageModalProps {
  url: string | null;
  title?: string;
  onClose: () => void;
}

export default function ImageModal({ url, title, onClose }: ImageModalProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Reset zoom level whenever a new image is opened
  useEffect(() => {
    setZoomLevel(1);
  }, [url]);

  // Support Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!url) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container modal-image-container" onClick={(e) => e.stopPropagation()}>
        {/* Header with Title and Zoom Controls */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">{title || 'High-Resolution Diagram Preview'}</h3>
            <span className="modal-subtitle">Vector Graphic & Technical Diagram Inspection</span>
          </div>

          <div className="modal-header-actions">
            <div className="zoom-controls-group">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="btn-zoom-control"
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <span className="zoom-percentage">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="btn-zoom-control"
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
              {zoomLevel !== 1 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="btn-zoom-control"
                  title="Reset Zoom"
                >
                  <RotateCcw size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-modal-close"
              title="Close Preview (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Constrained Image Canvas (Never overflows or pops out) */}
        <div className="modal-image-viewport">
          <div className="modal-image-canvas">
            <img
              src={url}
              alt={title || 'Zoomed diagram'}
              className="modal-zoomed-img"
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.15s ease-out'
              }}
            />
          </div>
        </div>

        {/* Clean Footer WITHOUT the URL */}
        <div className="modal-image-footer">
          <span className="text-muted-tip">Scroll or use controls to inspect • Press Esc to close</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-modal-secondary"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
