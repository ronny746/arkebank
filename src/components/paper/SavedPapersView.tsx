'use client';

import React, { useState, useEffect } from 'react';
import { SavedPaper } from '@/types/paper';
import { 
  FolderOpen, 
  Printer, 
  Trash2, 
  FileText, 
  Calendar, 
  Clock, 
  Award, 
  Layers, 
  RotateCw,
  ExternalLink,
  Plus
} from 'lucide-react';

interface SavedPapersViewProps {
  onLoadPaper: (paper: SavedPaper) => void;
  onNavigateToGenerator: () => void;
  showToast: (msg: string) => void;
}

export default function SavedPapersView({
  onLoadPaper,
  onNavigateToGenerator,
  showToast,
}: SavedPapersViewProps) {
  const [papers, setPapers] = useState<SavedPaper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSavedPapers = async () => {
    setLoading(true);
    let loadedList: SavedPaper[] = [];

    // 1. Try fetching from MongoDB API
    try {
      const token = localStorage.getItem('arke_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/paper/saved', {
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.papers)) {
          loadedList = data.papers;
        }
      }
    } catch (e) {
      console.warn('API fetch failed, falling back to localStorage', e);
    }

    // 2. Merge with LocalStorage papers
    try {
      const local = JSON.parse(localStorage.getItem('arke_saved_papers') || '[]');
      if (Array.isArray(local) && local.length > 0) {
        const existingIds = new Set(loadedList.map((p) => p.id));
        local.forEach((p: SavedPaper) => {
          if (!existingIds.has(p.id)) {
            loadedList.push(p);
          }
        });
      }
    } catch (e) {
      console.warn('Failed to parse localStorage saved papers', e);
    }

    setPapers(loadedList);
    setLoading(false);
  };

  useEffect(() => {
    fetchSavedPapers();
  }, []);

  const handleDelete = async (paperId: string) => {
    if (!confirm('Are you sure you want to delete this saved paper?')) return;

    // 1. Remove from LocalStorage
    try {
      const local = JSON.parse(localStorage.getItem('arke_saved_papers') || '[]');
      const filtered = local.filter((p: any) => p.id !== paperId);
      localStorage.setItem('arke_saved_papers', JSON.stringify(filtered));
    } catch (e) {
      // ignore
    }

    // 2. Remove via API
    try {
      const token = localStorage.getItem('arke_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`/api/paper/saved/${paperId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
    } catch (e) {
      // ignore
    }

    setPapers((prev) => prev.filter((p) => p.id !== paperId));
    showToast('Paper deleted from library.');
  };

  return (
    <div className="saved-papers-container">
      {/* Header */}
      <div className="saved-papers-header">
        <div className="header-left-col">
          <h2 className="saved-title">
            <FolderOpen size={20} className="text-emerald" />
            <span>Saved Question Papers Library</span>
          </h2>
          <p className="saved-desc">
            All previously generated and customized question papers stored in your institutional workspace.
          </p>
        </div>

        <div className="header-right-actions">
          <button
            type="button"
            onClick={fetchSavedPapers}
            className="btn-refresh-saved"
            title="Refresh saved papers"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToGenerator}
            className="btn-create-new-paper"
          >
            <Plus size={14} />
            <span>Create New Paper</span>
          </button>
        </div>
      </div>

      {/* Grid of Saved Papers */}
      {loading ? (
        <div className="saved-loading-state">
          <div className="spinner"></div>
          <span>Loading your question papers...</span>
        </div>
      ) : papers.length === 0 ? (
        <div className="saved-empty-state">
          <FileText size={48} className="empty-icon text-muted" />
          <h3>No Saved Question Papers Yet</h3>
          <p>
            You haven&apos;t saved any question papers yet. Go to the Paper Generator to create your first examination paper!
          </p>
          <button
            type="button"
            onClick={onNavigateToGenerator}
            className="btn-empty-create"
          >
            <Plus size={15} />
            <span>Generate Examination Paper</span>
          </button>
        </div>
      ) : (
        <div className="saved-papers-grid">
          {papers.map((paper) => {
            const dateStr = paper.createdAt
              ? new Date(paper.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Recent';

            return (
              <div key={paper.id} className="saved-paper-card">
                <div className="card-badge-row">
                  <span className="class-subject-badge">
                    {paper.class_std || 'Class 12'} • {paper.subject || 'General'}
                  </span>
                  <span className="paper-date-badge">
                    <Calendar size={12} />
                    <span>{dateStr}</span>
                  </span>
                </div>

                <h3 className="paper-card-title">{paper.title}</h3>
                <div className="paper-institute-sub">{paper.instituteName || 'ARKE SCHOLARS'}</div>

                <div className="paper-card-stats">
                  <div className="stat-item">
                    <span className="stat-label">Questions:</span>
                    <span className="stat-val">{paper.totalQuestions || paper.questions?.length || 0} Qs</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Marks:</span>
                    <span className="stat-val">{paper.totalMarks || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Time:</span>
                    <span className="stat-val">{paper.timeAllowed || '60 Mins'}</span>
                  </div>
                </div>

                <div className="paper-card-actions">
                  <button
                    type="button"
                    onClick={() => onLoadPaper(paper)}
                    className="btn-open-paper"
                  >
                    <ExternalLink size={13} />
                    <span>Open in Studio</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(paper.id)}
                    className="btn-del-paper"
                    title="Delete saved paper"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
