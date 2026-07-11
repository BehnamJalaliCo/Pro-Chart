import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, Info, X, Trash2 } from 'lucide-react';

const variantConfig = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-brand-red/15',
    iconColor: 'text-brand-red',
    confirmBtn: 'btn-danger',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-yellow-500/15',
    iconColor: 'text-yellow-500',
    confirmBtn: 'bg-yellow-600 hover:bg-yellow-600/90 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed',
  },
  info: {
    icon: Info,
    iconBg: 'bg-brand-blue/15',
    iconColor: 'text-brand-blue',
    confirmBtn: 'btn-primary',
  },
};

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'تایید عملیات',
  message = 'آیا از انجام این عملیات اطمینان دارید؟',
  variant = 'danger',
  loading = false,
  confirmText,
  cancelText,
}) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const overlayRef = useRef(null);

  const config = variantConfig[variant] || variantConfig.danger;
  const Icon = config.icon;

  const defaultConfirmTexts = {
    danger: 'حذف',
    warning: 'ادامه',
    info: 'تایید',
  };

  const resolvedConfirmText = confirmText || defaultConfirmTexts[variant] || 'تایید';
  const resolvedCancelText = cancelText || 'انصراف';

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimating(true);
        });
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, loading]);

  const handleBackdropClick = (e) => {
    if (e.target === overlayRef.current && !loading) {
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className={clsx(
        'fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200 px-4',
        animating ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div
        className={clsx(
          'bg-surface-card border border-surface-border rounded-2xl w-full max-w-md shadow-2xl transition-all duration-200 p-6',
          animating
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4'
        )}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className={clsx(
              'w-14 h-14 rounded-full flex items-center justify-center mb-4',
              config.iconBg
            )}
          >
            <Icon size={24} className={config.iconColor} />
          </div>

          <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
          <p className="text-sm text-text-secondary leading-relaxed mb-6">
            {message}
          </p>

          <div className="flex items-center gap-3 w-full">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2',
                config.confirmBtn
              )}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                resolvedConfirmText
              )}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="btn-ghost flex-1"
            >
              {resolvedCancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
