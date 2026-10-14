'use client';

import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface ImageModalProps {
  url: string | null;
  title?: string;
  onClose: () => void;
}

export default function ImageModal({ url, title, onClose }: ImageModalProps) {
  if (!url) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box modal-image-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title || 'High-Resolution Diagram Preview'}</div>
          <div className="flex-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-icon"
              title="Open full image in new tab"
            >
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} className="btn-icon" title="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="modal-image-body">
          <img src={url} alt={title || 'Zoomed diagram'} className="modal-zoomed-img" />
        </div>
        <div className="modal-footer">
          <small className="text-muted">Cloud Hosted Asset: {url}</small>
        </div>
      </div>
    </div>
  );
}
