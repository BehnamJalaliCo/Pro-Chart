import { useState, useCallback, useRef } from 'react';

export function useConfirm() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    confirmText: '',
    cancelText: '',
  });
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef(null);

  const confirm = useCallback(
    (title, message, options = {}) => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setState({
          isOpen: true,
          title: title || 'تایید عملیات',
          message: message || 'آیا از انجام این عملیات اطمینان دارید؟',
          variant: options.variant || 'danger',
          confirmText: options.confirmText || '',
          cancelText: options.cancelText || '',
        });
      });
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      if (resolveRef.current) {
        resolveRef.current(true);
        resolveRef.current = null;
      }
    } finally {
      setLoading(false);
      setState((prev) => ({ ...prev, isOpen: false }));
    }
  }, []);

  const handleClose = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    setLoading(false);
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    confirm,
    confirmState: {
      isOpen: state.isOpen,
      title: state.title,
      message: state.message,
      variant: state.variant,
      confirmText: state.confirmText,
      cancelText: state.cancelText,
      loading,
      onConfirm: handleConfirm,
      onClose: handleClose,
    },
  };
}

export default useConfirm;
