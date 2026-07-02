import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X } from 'lucide-react';

export default function SearchInput({
  value: externalValue,
  onChange,
  placeholder = 'جستجو...',
  debounceMs = 300,
  className = '',
}) {
  const [internalValue, setInternalValue] = useState(externalValue || '');
  const timerRef = useRef(null);
  const isControlled = externalValue !== undefined;

  useEffect(() => {
    if (isControlled && externalValue !== internalValue) {
      setInternalValue(externalValue);
    }
  }, [externalValue]);

  const debouncedChange = useCallback(
    (val) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        if (onChange) {
          onChange(val);
        }
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setInternalValue(val);
    debouncedChange(val);
  };

  const handleClear = () => {
    setInternalValue('');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (onChange) {
      onChange('');
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Search
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
      <input
        type="text"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pr-9 pl-9 text-sm"
        dir="rtl"
      />
      {internalValue && (
        <button
          onClick={handleClear}
          type="button"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
