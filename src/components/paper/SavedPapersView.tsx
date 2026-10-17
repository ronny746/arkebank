'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SavedPaper } from '@/types/paper';
import { 
  FolderOpen, 
  Trash2, 
  FileText, 
  Calendar, 
  RotateCw,
  ExternalLink,
  Plus,
  Search,
  X
} from 'lucide-react';
import ExamCreatorModal from '@/components/exams/ExamCreatorModal';

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paperForExam, setPaperForExam] = useState<SavedPaper | null>(null);

  const fetchSavedPapers = async () => {
    setLoading(true);
    let loadedList: SavedPaper[] = [];

    // 1. Try fetching from MongoDB API (Redis-backed)
    try {
      const token = localStorage.getItem('arke_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/paper/saved?limit=200', {
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
      console.warn('Could not fetch saved papers from the database', e);
    }

    setPapers(loadedList);
    setLoading(false);
  };

  useEffect(() => {
    fetchSavedPapers();
  }, []);

  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return papers;
    const q = searchQuery.toLowerCase();
    return papers.filter((p) => {
      return (
        p.title?.toLowerCase().includes(q) ||
        p.subject?.toLowerCase().includes(q) ||
        p.class_std?.toLowerCase().includes(q) ||
        p.instituteName?.toLowerCase().includes(q)
      );
    });
  }, [papers, searchQuery]);

  const handleOpenPaper = async (paper: SavedPaper) => {
    // If questions array is already loaded, open immediately
    if (paper.questions && paper.questions.length > 0) {
      onLoadPaper(paper);
      return;
    }

    // Otherwise fetch the full document instantly from Redis/MongoDB cache
    try {
      const token = localStorage.getItem('arke_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/paper/saved/${paper.id}`, {
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.paper) {
          onLoadPaper(data.paper);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load full paper', e);
    }

    onLoadPaper(paper);
  };

  const handleDelete = async (paperId: string) => {
    if (!confirm('Are you sure you want to delete this saved paper?')) return;

    // Remove via the database API.
    try {
      const token = localStorage.getItem('arke_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/paper/saved/${paperId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Could not delete the paper from the database.');
      }
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
      showToast('Paper deleted from library.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not delete the paper from the database.');
    }
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
            Ultra-fast indexed library. Search and manage any number of question papers with zero lag.
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

      {/* Fast Search & Stats Filter Row */}
      <div className="saved-papers-search-bar">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search papers by title, subject, class, or institute..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="saved-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="btn-clear-search"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="saved-count-pill">
          Showing {filteredPapers.length} of {papers.length} Papers
        </div>
      </div>

      {/* Grid of Saved Papers */}
      {loading ? (
        <div className="saved-loading-state">
          <div className="spinner"></div>
          <span>Loading question papers from high-speed cache...</span>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="saved-empty-state">
          <FileText size={48} className="empty-icon text-muted" />
          <h3>{searchQuery ? 'No Matching Papers Found' : 'No Saved Question Papers Yet'}</h3>
          <p>
            {searchQuery
              ? `No saved papers matched your search "${searchQuery}". Try another keyword or clear the search.`
              : "You haven't saved any question papers yet. Go to the Paper Generator to create your first examination paper!"}
          </p>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="btn-empty-create"
            >
              <span>Clear Search Filter</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onNavigateToGenerator}
              className="btn-empty-create"
            >
              <Plus size={15} />
              <span>Generate Examination Paper</span>
            </button>
          )}
        </div>
      ) : (
        <div className="saved-papers-grid">
          {filteredPapers.map((paper) => {
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
                    onClick={() => handleOpenPaper(paper)}
                    className="btn-open-paper"
                  >
                    <ExternalLink size={13} />
                    <span>Open in Studio</span>
                  </button>
                  <button type="button" onClick={() => setPaperForExam(paper)} className="btn-create-exam">
                    <span>Create Exam</span>
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
      {paperForExam && <ExamCreatorModal paper={paperForExam} onClose={() => setPaperForExam(null)} showToast={showToast} />}
    </div>
  );
}
