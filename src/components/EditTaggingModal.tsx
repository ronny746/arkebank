'use client';

import React, { useState } from 'react';
import { X, Save, AlertCircle, Tag, Sparkles, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import MathRenderer from './MathRenderer';

interface EditTaggingModalProps {
  question: any | null;
  onClose: () => void;
  onSaved: (updatedQuestion: any) => void;
  availableClasses?: string[];
  availableSubjects?: string[];
}

export default function EditTaggingModal({
  question,
  onClose,
  onSaved,
  availableClasses = ['Class 9', 'Class 10', 'Class 11', 'Class 12', 'JM', 'JA', 'NEET', 'Competitive Exam'],
  availableSubjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Science', 'Reasoning', 'Quantitative Aptitude', 'Verbal']
}: EditTaggingModalProps) {
  if (!question) return null;

  const [activeTab, setActiveTab] = useState<'meta' | 'content'>('meta');

  const [formData, setFormData] = useState({
    class_std: question.class_std || '',
    subject: question.subject || '',
    subject_id: question.subject_id !== null && question.subject_id !== undefined ? String(question.subject_id) : '',
    topic: question.topic || '',
    topic_id: question.topic_id !== null && question.topic_id !== undefined ? String(question.topic_id) : '',
    sub_topic: question.sub_topic || '',
    sub_topic_id: question.sub_topic_id !== null && question.sub_topic_id !== undefined ? String(question.sub_topic_id) : '',
    difficulty: String(question.difficulty !== undefined && question.difficulty !== null ? question.difficulty : '2'),
    lang: question.lang || 'en',
    year: question.year ? String(question.year) : '',
    paper: question.paper || '',
    question_exams: Array.isArray(question.question_exams) 
      ? question.question_exams.map((e: any) => typeof e === 'object' ? (e.que_year ? `${e.que_year.name} ${e.que_year.year}` : e.name || '') : String(e)).join(', ')
      : (question.question_exams || ''),
    correct_option: question.correct_option || '',
    correct_answer: question.correct_answer || '',
    
    // Content fields
    question: question.question || '',
    opt_a: question.options?.[0]?.text || '',
    opt_b: question.options?.[1]?.text || '',
    opt_c: question.options?.[2]?.text || '',
    opt_d: question.options?.[3]?.text || '',
    solution: question.solution || '',
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const qId = question._id || question.id;

      // Construct options array preserving images
      const existingOpts = question.options || [];
      const updatedOptions = [
        { key: 'a', text: formData.opt_a, image: existingOpts[0]?.image || '' },
        { key: 'b', text: formData.opt_b, image: existingOpts[1]?.image || '' },
        { key: 'c', text: formData.opt_c, image: existingOpts[2]?.image || '' },
        { key: 'd', text: formData.opt_d, image: existingOpts[3]?.image || '' },
      ];

      const token = typeof window !== 'undefined' ? localStorage.getItem('arke_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/questions/${qId}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          class_std: formData.class_std,
          subject: formData.subject,
          subject_id: formData.subject_id ? Number(formData.subject_id) : null,
          topic: formData.topic,
          topic_id: formData.topic_id ? Number(formData.topic_id) : null,
          sub_topic: formData.sub_topic,
          sub_topic_id: formData.sub_topic_id ? Number(formData.sub_topic_id) : null,
          difficulty: formData.difficulty,
          lang: formData.lang,
          year: formData.year ? Number(formData.year) : 0,
          paper: formData.paper,
          question_exams: formData.question_exams ? formData.question_exams.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          correct_option: formData.correct_option,
          correct_answer: formData.correct_answer,
          question: formData.question,
          options: updatedOptions,
          solution: formData.solution,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update tagging');
      }

      onSaved(data.question);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating question');
    } finally {
      setSaving(false);
    }
  };

  const diffTiers = [
    { val: '0', label: 'Basic', badge: 'Tier 0' },
    { val: '1', label: 'Easy', badge: 'Tier 1' },
    { val: '2', label: 'Medium', badge: 'Tier 2' },
    { val: '3', label: 'Hard', badge: 'Tier 3' },
    { val: '4', label: 'Expert', badge: 'Tier 4' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container edit-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="edit-modal-badge">
              <Tag size={14} />
              <span>Question Editor</span>
              <span className="dot-sep">•</span>
              <span className="text-muted">ID: #{question.id}</span>
            </div>
            <h2 className="modal-heading">Edit Question Metadata & Content</h2>
          </div>

          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Modal Tabs Bar */}
        <div className="modal-tabs-bar">
          <button
            type="button"
            onClick={() => setActiveTab('meta')}
            className={`modal-tab-btn ${activeTab === 'meta' ? 'active' : ''}`}
          >
            <Tag size={14} />
            <span>Taxonomy, Subject & Tags</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`modal-tab-btn ${activeTab === 'content' ? 'active' : ''}`}
          >
            <FileText size={14} />
            <span>Question, Options & Solution Text</span>
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSave} className="edit-modal-form-wrapper">
          <div className="edit-modal-scroll-area">
            {errorMsg && (
              <div className="alert-box alert-error">
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}

            {activeTab === 'meta' ? (
              <div className="edit-form-inner">
                {/* Difficulty Selector Row */}
                <div className="form-group full-width-group">
                  <label className="form-label">Difficulty Level / Tier</label>
                  <div className="diff-tier-pills">
                    {diffTiers.map((dt) => (
                      <button
                        key={dt.val}
                        type="button"
                        onClick={() => handleChange('difficulty', dt.val)}
                        className={`diff-tier-btn diff-${dt.val} ${formData.difficulty === dt.val ? 'active' : ''}`}
                      >
                        <span className="dt-label">{dt.label}</span>
                        <span className="dt-badge">({dt.badge})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="edit-grid">
                  {/* Subject */}
                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => handleChange('subject', e.target.value)}
                      className="form-input"
                    >
                      <option value="">-- Select Subject --</option>
                      {availableSubjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Class / Standard */}
                  <div className="form-group">
                    <label className="form-label">Class / Examination Target</label>
                    <select
                      value={formData.class_std}
                      onChange={(e) => handleChange('class_std', e.target.value)}
                      className="form-input"
                    >
                      <option value="">-- Select Class --</option>
                      {availableClasses.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Chapter / Topic */}
                  <div className="form-group">
                    <label className="form-label">Chapter / Topic</label>
                    <input
                      type="text"
                      value={formData.topic}
                      onChange={(e) => handleChange('topic', e.target.value)}
                      placeholder="e.g. Atomic Structure, Rotational Motion"
                      className="form-input"
                    />
                  </div>

                  {/* Sub-Topic / Concept */}
                  <div className="form-group">
                    <label className="form-label">Sub-Topic / Concept Name</label>
                    <input
                      type="text"
                      value={formData.sub_topic}
                      onChange={(e) => handleChange('sub_topic', e.target.value)}
                      placeholder="e.g. Hydrogen Spectrum, Moment of Inertia"
                      className="form-input"
                    />
                  </div>

                  {/* Exam Year */}
                  <div className="form-group">
                    <label className="form-label">Exam Year (e.g. 2007, 2021)</label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => handleChange('year', e.target.value)}
                      placeholder="e.g. 2021"
                      className="form-input"
                    />
                  </div>

                  {/* Paper / Shift */}
                  <div className="form-group">
                    <label className="form-label">Paper / Shift</label>
                    <input
                      type="text"
                      value={formData.paper}
                      onChange={(e) => handleChange('paper', e.target.value)}
                      placeholder="e.g. Paper 1, Shift 2"
                      className="form-input"
                    />
                  </div>

                  {/* Target Exams */}
                  <div className="form-group full-width-group">
                    <label className="form-label">Associated Examination Tags (Comma Separated)</label>
                    <input
                      type="text"
                      value={formData.question_exams}
                      onChange={(e) => handleChange('question_exams', e.target.value)}
                      placeholder="e.g. JA 2007 Paper 1, NEET 2020"
                      className="form-input"
                    />
                  </div>

                  {/* Language */}
                  <div className="form-group">
                    <label className="form-label">Language</label>
                    <select
                      value={formData.lang}
                      onChange={(e) => handleChange('lang', e.target.value)}
                      className="form-input"
                    >
                      <option value="en">English (en)</option>
                      <option value="hi">Hindi (hi)</option>
                    </select>
                  </div>

                  {/* Correct Option */}
                  <div className="form-group">
                    <label className="form-label">Correct Option (for MCQs)</label>
                    <select
                      value={formData.correct_option?.toLowerCase()}
                      onChange={(e) => handleChange('correct_option', e.target.value)}
                      className="form-input"
                    >
                      <option value="">-- None / Numerical Question --</option>
                      <option value="a">Option A</option>
                      <option value="b">Option B</option>
                      <option value="c">Option C</option>
                      <option value="d">Option D</option>
                      <option value="ab">Options A, B</option>
                      <option value="ac">Options A, C</option>
                      <option value="ad">Options A, D</option>
                      <option value="bc">Options B, C</option>
                      <option value="bd">Options B, D</option>
                      <option value="cd">Options C, D</option>
                    </select>
                  </div>
                </div>

                {/* Numerical / Formula Answer with Live KaTeX Preview */}
                <div className="form-group full-width-group">
                  <label className="form-label">
                    <span>Numerical / Integer Answer Value (LaTeX Math supported)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.correct_answer}
                    onChange={(e) => handleChange('correct_answer', e.target.value)}
                    placeholder="e.g. $10^{-12} \text{ s}$ or 823"
                    className="form-input"
                  />
                  {formData.correct_answer && (
                    <div className="live-preview-box">
                      <span className="live-preview-tag">
                        <Sparkles size={11} />
                        <span>Live Preview:</span>
                      </span>
                      <MathRenderer content={formData.correct_answer} inline />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="edit-form-inner">
                {/* Question Statement Text */}
                <div className="form-group full-width-group">
                  <label className="form-label">Question Statement (Supports HTML & $...$ LaTeX)</label>
                  <textarea
                    rows={4}
                    value={formData.question}
                    onChange={(e) => handleChange('question', e.target.value)}
                    className="form-input form-textarea"
                  />
                </div>

                {/* Options A, B, C, D */}
                <div className="edit-grid">
                  <div className="form-group">
                    <label className="form-label">Option A</label>
                    <input
                      type="text"
                      value={formData.opt_a}
                      onChange={(e) => handleChange('opt_a', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Option B</label>
                    <input
                      type="text"
                      value={formData.opt_b}
                      onChange={(e) => handleChange('opt_b', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Option C</label>
                    <input
                      type="text"
                      value={formData.opt_c}
                      onChange={(e) => handleChange('opt_c', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Option D</label>
                    <input
                      type="text"
                      value={formData.opt_d}
                      onChange={(e) => handleChange('opt_d', e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Solution Text */}
                <div className="form-group full-width-group">
                  <label className="form-label">Verified Editorial Solution (Explanation & Proof)</label>
                  <textarea
                    rows={5}
                    value={formData.solution}
                    onChange={(e) => handleChange('solution', e.target.value)}
                    className="form-input form-textarea"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sticky Modal Footer (Guaranteed Visible) */}
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-modal-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-modal-primary"
            >
              {saving ? (
                <>
                  <RefreshCw size={14} className="spin-icon" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Question Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
