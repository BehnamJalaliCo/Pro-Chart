import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import { clsx } from 'clsx';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const typeConfig = {
  success: {
    icon: CheckCircle,
    iconColor: 'text-brand-green',
    border: 'border-brand-green/30',
    bg: 'bg-brand-green/10',
  },
  error: {
    icon: XCircle,
    iconColor: 'text-brand-red',
    border: 'border-brand-red/30',
    bg: 'bg-brand-red/10',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/10',
  },
  info: {
    icon: Info,
    iconColor: 'text-brand-blue',
    border: 'border-brand-blue/30',
    bg: 'bg-brand-blue/10',
  },
};

function ToastItem({ toast, onRemove }) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef(null);
  const config = typeConfig[toast.type] || typeConfig.info;
  const Icon = config.icon;

  useEffect(() => {
    if (toast.duration > 0) {
      timerRef.current = setTimeout(() => {
        handleClose();
      }, toast.duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 200);
  };

  return (
    <div
      className={clsx(
        'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-200',
        config.border,
        config.bg,
        isExiting
          ? 'opacity-0 translate-x-4 scale-95'
          : 'opacity-100 translate-x-0 scale-100'
      )}
      style={{
        animation: isExiting ? 'none' : 'slideInFromLeft 0.3s ease-out',
      }}
    >
      <Icon size={18} className={clsx(config.iconColor, 'shrink-0 mt-0.5')} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold text-text-primary mb-0.5">
            {toast.title}
          </p>
        )}
        <p className="text-sm text-text-primary leading-relaxed">{toast.message}</p>
      </div>
      <button
        onClick={handleClose}
        className="text-text-muted hover:text-text-primary transition-colors shrink-0 mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const addToast = useCallback((options) => {
    const id = ++counterRef.current;
    const toast = {
      id,
      type: 'info',
      duration: 4000,
      ...options,
    };

    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message, options = {}) =>
      addToast({ type: 'success', message, duration: 4000, ...options }),
    [addToast]
  );

  const error = useCallback(
    (message, options = {}) =>
      addToast({ type: 'error', message, duration: 5000, ...options }),
    [addToast]
  );

  const warning = useCallback(
    (message, options = {}) =>
      addToast({ type: 'warning', message, duration: 4500, ...options }),
    [addToast]
  );

  const info = useCallback(
    (message, options = {}) =>
      addToast({ type: 'info', message, duration: 4000, ...options }),
    [addToast]
  );

  const contextValue = {
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed top-4 left-4 z-[100] space-y-2 w-80 pointer-events-none">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onRemove={removeToast} />
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(16px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast باید درون ToastProvider استفاده شود');
  }
  return context;
}

export default { ToastProvider, useToast };
