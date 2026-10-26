'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface OwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function OwnerModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: OwnerModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
      style={{ margin: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full ${maxWidth} max-h-[92vh] flex flex-col bg-white rounded-[28px] border border-[#073533]/[0.08] shadow-[0_25px_60px_-15px_rgba(6,51,49,0.25)] relative overflow-hidden animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        {title && (
          <div className="px-6 py-4 sm:px-7 sm:py-5 border-b border-[#073533]/[0.06] flex items-center justify-between gap-3 shrink-0 bg-white">
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#063331] tracking-tight">{title}</h3>
              {subtitle && <p className="text-xs text-[#063331]/60 mt-0.5 font-medium">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#f3faf7] hover:bg-[#e2f1ec] text-[#063331]/70 hover:text-[#063331] flex items-center justify-center text-sm font-bold transition cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-7 overflow-y-auto flex-1 no-scrollbar space-y-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
