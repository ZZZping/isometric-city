'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  duration?: number; // Auto-dismiss after this many ms (0 = no auto-dismiss)
}

export function Toast({ message, actionLabel, onAction, onDismiss, duration = 0 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 200);
  }, [onDismiss]);

  const handleAction = () => {
    onAction?.();
    handleDismiss();
  };

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(handleDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, handleDismiss]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ${
        isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl px-4 py-3 flex items-center gap-4">
        <span className="text-slate-100 text-sm">{message}</span>
        {actionLabel && onAction && (
          <Button
            size="sm"
            onClick={handleAction}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1 h-7"
          >
            {actionLabel}
          </Button>
        )}
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-200 transition-colors ml-1"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
