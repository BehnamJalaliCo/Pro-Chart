import { useState } from 'react';
import { Lightbulb, ChevronDown } from 'lucide-react';

// راهنمای کوتاهِ انسانی برای هر بخش — کاربر می‌داند باید چه کند.
export default function Guide({ title = 'راهنما', children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-brand-blue/8 border border-brand-blue/25 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-right">
        <Lightbulb size={18} className="text-brand-blue shrink-0" />
        <span className="text-sm font-bold text-brand-blue flex-1">{title}</span>
        <ChevronDown size={16} className={`text-brand-blue transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-text-secondary leading-7">{children}</div>
      )}
    </div>
  );
}
