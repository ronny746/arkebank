'use client';

import React, { useState } from 'react';
import { QuestionItem } from '@/types/paper';
import { 
  ShoppingBag, 
  ChevronUp, 
  ChevronDown, 
  X, 
  Trash2, 
  Sparkles, 
  ArrowRight,
  BookOpen
} from 'lucide-react';
import MathRenderer from '../MathRenderer';

interface PaperBasketDrawerProps {
  basketQuestions: QuestionItem[];
  onRemoveQuestion: (id: string | number) => void;
  onClearBasket: () => void;
  onOpenGenerator: () => void;
}

export default function PaperBasketDrawer({
  basketQuestions,
  onRemoveQuestion,
  onClearBasket,
  onOpenGenerator,
}: PaperBasketDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (basketQuestions.length === 0) return null;

  const totalQuestions = basketQuestions.length;
  const totalMarks = totalQuestions * 4;

  return (
    <div className="paper-basket-floating-container hide-print">
      {/* Floating Header Pill */}
      <div className="basket-pill-bar">
        <div 
          className="basket-pill-left"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="basket-icon-badge">
            <ShoppingBag size={15} />
            <span className="basket-count-bubble">{totalQuestions}</span>
          </div>
          <div className="basket-text-col">
            <span className="basket-main-text">Paper Draft Basket</span>
            <span className="basket-sub-text">{totalQuestions} Questions • {totalMarks} Marks</span>
          </div>
          <button type="button" className="btn-toggle-basket" aria-label={isOpen ? 'Close paper draft basket' : 'Open paper draft basket'} onClick={(event) => { event.stopPropagation(); setIsOpen(!isOpen); }}>
            {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        <div className="basket-pill-actions">
          <button
            type="button"
            onClick={onOpenGenerator}
            className="btn-launch-generator"
          >
            <Sparkles size={14} />
            <span>Open in Paper Studio</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Expanded Drawer */}
      {isOpen && (
        <div className="basket-expanded-drawer">
          <div className="drawer-header-row">
            <span className="drawer-title">Questions in Paper Draft ({totalQuestions})</span>
            <div className="drawer-actions-right">
              <button
                type="button"
                onClick={onClearBasket}
                className="btn-clear-all-basket"
              >
                <Trash2 size={12} />
                <span>Clear Draft</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn-close-drawer"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="drawer-questions-scroll">
            {basketQuestions.map((q, idx) => (
              <div key={q._id || q.id || idx} className="basket-item-row">
                <span className="item-num">Q{idx + 1}</span>
                <div className="item-content-preview">
                  <span className="item-meta">{q.class_std} • {q.subject} {q.topic ? `• ${q.topic}` : ''}</span>
                  <div className="item-snippet">
                    <MathRenderer content={q.question?.substring(0, 120) + (q.question?.length > 120 ? '...' : '')} inline />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveQuestion(q._id || q.id)}
                  className="btn-remove-basket-item"
                  title="Remove from paper"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="drawer-footer-row">
            <button
              type="button"
              onClick={onOpenGenerator}
              className="btn-full-width-studio"
            >
              <span>⚡ Generate & Print Paper with these {totalQuestions} Questions</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
