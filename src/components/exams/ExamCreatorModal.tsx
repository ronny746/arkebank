'use client';

import { useState } from 'react';
import { Copy, Link2, ShieldCheck, X, Globe, ExternalLink, Laptop } from 'lucide-react';
import type { SavedPaper } from '@/types/paper';
import { getPublicExamUrl, getLocalExamUrl } from '@/lib/public-url';

export default function ExamCreatorModal({
  paper,
  onClose,
  showToast,
}: {
  paper: SavedPaper;
  onClose: () => void;
  showToast: (message: string) => void;
}) {
  const [title, setTitle] = useState(paper.title);
  const [duration, setDuration] = useState(Number.parseInt(paper.timeAllowed || '60', 10) || 60);
  const [creating, setCreating] = useState(false);
  const [liveLink, setLiveLink] = useState('');
  const [localLink, setLocalLink] = useState<string | null>(null);
  const [security, setSecurity] = useState({
    requireFullScreen: true,
    disableCopyPaste: true,
    maxTabSwitchesAllowed: 3,
  });

  const create = async () => {
    setCreating(true);
    try {
      const token = localStorage.getItem('arke_token');
      const r = await fetch('/api/exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          title,
          paper,
          durationMinutes: duration,
          status: 'published',
          security,
          endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);

      const examSlug = data.exam?.slug || data.publicUrl?.replace(/^\/e\//, '');
      const resolvedLive = data.liveUrl || getPublicExamUrl(examSlug);
      const resolvedLocal = getLocalExamUrl(examSlug);

      setLiveLink(resolvedLive);
      setLocalLink(resolvedLocal);
      showToast('Live student exam link generated successfully!');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not create the exam.');
    } finally {
      setCreating(false);
    }
  };

  const copyLive = async () => {
    if (!liveLink) return;
    await navigator.clipboard.writeText(liveLink);
    showToast(`Live student link copied: ${liveLink}`);
  };

  const copyLocal = async () => {
    if (!localLink) return;
    await navigator.clipboard.writeText(localLink);
    showToast(`Local dev link copied: ${localLink}`);
  };

  return (
    <div className="exam-modal-backdrop" role="presentation">
      <section className="exam-creator-modal" role="dialog" aria-modal="true" aria-labelledby="exam-create-title">
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="exam-security-mark">
          <ShieldCheck size={20} /> Secure online exam
        </div>
        <h2 id="exam-create-title">Turn this paper into a live test</h2>

        {liveLink ? (
          <div className="exam-link-ready">
            <Link2 size={28} className="text-emerald" />
            <h3>Student Exam Link is Ready!</h3>
            <p className="exam-ready-sub">
              Students can open this link on mobile, tablet, or desktop to enter their name & roll number and start the timed test.
            </p>

            <div className="exam-link-box-container">
              <div className="link-box-header">
                <span className="live-pill">
                  <Globe size={13} /> LIVE PRODUCTION LINK (SHARE WITH STUDENTS)
                </span>
              </div>
              <div className="link-input-action-row">
                <input readOnly value={liveLink} className="exam-link-input" onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button type="button" onClick={copyLive} className="btn-copy-exam-link">
                  <Copy size={15} /> Copy Live Link
                </button>
                <a href={liveLink} target="_blank" rel="noreferrer" className="btn-open-exam-link" title="Open live exam in new tab">
                  <ExternalLink size={15} />
                </a>
              </div>
            </div>

            {localLink && (
              <div className="exam-link-box-container dev-container">
                <div className="link-box-header">
                  <span className="dev-pill">
                    <Laptop size={13} /> LOCAL DEV PREVIEW (HOST MACHINE ONLY)
                  </span>
                </div>
                <div className="link-input-action-row">
                  <input readOnly value={localLink} className="exam-link-input dev-input" onClick={(e) => (e.target as HTMLInputElement).select()} />
                  <button type="button" onClick={copyLocal} className="btn-copy-dev-link">
                    <Copy size={14} /> Copy Local
                  </button>
                </div>
              </div>
            )}

            <button type="button" className="exam-secondary" onClick={onClose}>
              Done & Return
            </button>
          </div>
        ) : (
          <>
            <label>
              Exam title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. JEE Main Mock Test - Paper 1" />
            </label>
            <label>
              Duration (minutes)
              <input type="number" min="1" max="360" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </label>
            <div className="exam-modal-summary">
              <span>{paper.questions?.length || 0} questions</span>
              <span>{paper.totalMarks || 0} marks</span>
              <span>{paper.class_std} · {paper.subject}</span>
            </div>
            <fieldset>
              <legend>Security controls</legend>
              <label>
                <input type="checkbox" checked={security.requireFullScreen} onChange={(e) => setSecurity({ ...security, requireFullScreen: e.target.checked })} />
                Require fullscreen mode during test
              </label>
              <label>
                <input type="checkbox" checked={security.disableCopyPaste} onChange={(e) => setSecurity({ ...security, disableCopyPaste: e.target.checked })} />
                Disable copy, paste, inspect, and right-click
              </label>
              <label>
                Auto-submit after{' '}
                <select value={security.maxTabSwitchesAllowed} onChange={(e) => setSecurity({ ...security, maxTabSwitchesAllowed: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} tab switch{n > 1 ? 'es' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <button className="exam-primary" disabled={creating || !title.trim()} onClick={create}>
              {creating ? 'Creating secure exam…' : 'Create exam and generate live student link'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
