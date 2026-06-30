import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signalsAPI } from '../api/client';
import { useNotificationStore } from '../store';
import {
  Search,
  Filter,
  Plus,
  X,
  Eye,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const mockSignals = [
  {
    id: 1,
    symbol: 'EUR/USD',
    type: 'BUY',
    entry: 1.0852,
    tp1: 1.089,
    tp2: 1.092,
    tp3: 1.095,
    sl: 1.081,
    status: 'active',
    score: 87,
    pnl: +45,
    createdAt: '۱۴۰۴/۱۱/۰۸ ۱۰:۳۲',
    source: 'auto',
  },
  {
    id: 2,
    symbol: 'GBP/JPY',
    type: 'SELL',
    entry: 190.45,
    tp1: 189.8,
    tp2: 189.2,
    tp3: 188.5,
    sl: 191.0,
    status: 'tp1_hit',
    score: 72,
    pnl: +65,
    createdAt: '۱۴۰۴/۱۱/۰۸ ۱۱:۱۵',
    source: 'auto',
  },
  {
    id: 3,
    symbol: 'XAU/USD',
    type: 'BUY',
    entry: 2035.5,
    tp1: 2045.0,
    tp2: 2055.0,
    tp3: 2070.0,
    sl: 2025.0,
    status: 'sl_hit',
    score: 65,
    pnl: -105,
    createdAt: '۱۴۰۴/۱۱/۰۷ ۰۹:۴۵',
    source: 'manual',
  },
  {
    id: 4,
    symbol: 'USD/JPY',
    type: 'SELL',
    entry: 149.32,
    tp1: 148.5,
    tp2: 147.8,
    tp3: 147.0,
    sl: 149.9,
    status: 'closed',
    score: 91,
    pnl: +82,
    createdAt: '۱۴۰۴/۱۱/۰۷ ۱۲:۰۰',
    source: 'auto',
  },
  {
    id: 5,
    symbol: 'BTC/USD',
    type: 'BUY',
    entry: 43250,
    tp1: 43800,
    tp2: 44500,
    tp3: 45200,
    sl: 42800,
    status: 'active',
    score: 78,
    pnl: +156,
    createdAt: '۱۴۰۴/۱۱/۰۸ ۰۸:۲۰',
    source: 'auto',
  },
  {
    id: 6,
    symbol: 'AUD/USD',
    type: 'BUY',
    entry: 0.6532,
    tp1: 0.656,
    tp2: 0.659,
    tp3: 0.662,
    sl: 0.6505,
    status: 'tp2_hit',
    score: 83,
    pnl: +58,
    createdAt: '۱۴۰۴/۱۱/۰۶ ۱۴:۱۰',
    source: 'auto',
  },
];

const signalFormSchema = z.object({
  symbol: z.string().min(1, 'نماد الزامی است'),
  type: z.enum(['BUY', 'SELL']),
  entry: z.string().min(1, 'قیمت ورود الزامی است'),
  tp1: z.string().min(1, 'TP1 الزامی است'),
  tp2: z.string().optional(),
  tp3: z.string().optional(),
  sl: z.string().min(1, 'حد ضرر الزامی است'),
  description: z.string().optional(),
});

const statusLabels = {
  active: { text: 'فعال', class: 'badge-blue' },
  tp1_hit: { text: 'TP1 فعال', class: 'badge-green' },
  tp2_hit: { text: 'TP2 فعال', class: 'badge-green' },
  tp3_hit: { text: 'TP3 فعال', class: 'badge-green' },
  sl_hit: { text: 'حد ضرر', class: 'badge-red' },
  closed: { text: 'بسته شده', class: 'bg-surface-elevated text-text-muted' },
};

export default function SignalsPage() {
  const queryClient = useQueryClient();
  const notify = useNotificationStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [page, setPage] = useState(1);

  const { data: signalsData, isLoading } = useQuery({
    queryKey: ['signals', { search, statusFilter, typeFilter, page }],
    queryFn: () =>
      signalsAPI
        .getAll({ search, status: statusFilter, type: typeFilter, page, limit: 20 })
        .then((r) => r.data),
    placeholderData: { items: mockSignals, total: 6, pages: 1 },
    refetchInterval: 10000,
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, data }) => signalsAPI.close(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals'] });
      notify.success('سیگنال با موفقیت بسته شد');
      setSelectedSignal(null);
    },
    onError: () => notify.error('خطا در بستن سیگنال'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => signalsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals'] });
      notify.success('سیگنال با موفقیت ایجاد شد');
      setShowCreateModal(false);
    },
    onError: () => notify.error('خطا در ایجاد سیگنال'),
  });

  const signals = signalsData?.items || mockSignals;
  const totalPages = signalsData?.pages || 1;

  const filteredSignals = signals.filter((s) => {
    if (search && !s.symbol.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">مدیریت سیگنال‌ها</h1>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          <span>سیگنال جدید</span>
        </button>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="جستجوی نماد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 text-sm"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm min-w-[130px]"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">فعال</option>
            <option value="tp1_hit">TP1 فعال</option>
            <option value="tp2_hit">TP2 فعال</option>
            <option value="tp3_hit">TP3 فعال</option>
            <option value="sl_hit">حد ضرر</option>
            <option value="closed">بسته شده</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm min-w-[100px]"
          >
            <option value="all">همه</option>
            <option value="BUY">خرید</option>
            <option value="SELL">فروش</option>
          </select>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>نماد</th>
                <th>نوع</th>
                <th>ورود</th>
                <th>TP1</th>
                <th>SL</th>
                <th>وضعیت</th>
                <th>امتیاز</th>
                <th>سود/ضرر</th>
                <th>منبع</th>
                <th>تاریخ</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filteredSignals.map((sig) => {
                const st = statusLabels[sig.status] || statusLabels.closed;
                return (
                  <tr key={sig.id}>
                    <td className="font-medium text-text-primary">{sig.symbol}</td>
                    <td>
                      <span className={`badge ${sig.type === 'BUY' ? 'badge-green' : 'badge-red'}`}>
                        {sig.type === 'BUY' ? 'خرید' : 'فروش'}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{sig.entry}</td>
                    <td className="font-mono text-xs text-brand-green">{sig.tp1}</td>
                    <td className="font-mono text-xs text-brand-red">{sig.sl}</td>
                    <td>
                      <span className={`badge ${st.class}`}>{st.text}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="w-8 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand-blue"
                            style={{ width: `${sig.score}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted">{sig.score}</span>
                      </div>
                    </td>
                    <td>
                      {sig.status === 'active' && sig.pnlPercent != null ? (
                        <span
                          className={`inline-flex items-center gap-1.5 font-bold text-sm ${
                            sig.pnlPercent >= 0 ? 'text-brand-green' : 'text-brand-red'
                          }`}
                          title="سود/زیانِ لحظه‌ای"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          {sig.pnlPercent >= 0 ? '+' : ''}{sig.pnlPercent}٪
                        </span>
                      ) : (
                        <span
                          className={`font-medium text-sm ${
                            sig.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'
                          }`}
                        >
                          {sig.pnl >= 0 ? '+' : ''}{sig.pnl}
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-text-muted">
                      {sig.source === 'auto' ? 'خودکار' : 'دستی'}
                    </td>
                    <td className="text-xs text-text-muted">{sig.createdAt}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedSignal(sig)}
                          className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-brand-blue transition-colors"
                          title="جزئیات"
                        >
                          <Eye size={15} />
                        </button>
                        {sig.status === 'active' && (
                          <button
                            onClick={() => closeMutation.mutate({ id: sig.id, data: { reason: 'manual' } })}
                            className="p-1.5 rounded-md hover:bg-brand-red/10 text-text-muted hover:text-brand-red transition-colors"
                            title="بستن"
                          >
                            <XCircle size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost p-2 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
            <span className="text-sm text-text-muted">
              صفحه {page} از {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-ghost p-2 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        )}
      </div>

      {selectedSignal && (
        <SignalDetailModal
          signal={selectedSignal}
          onClose={() => setSelectedSignal(null)}
          onCloseSignal={(id) => closeMutation.mutate({ id, data: { reason: 'manual' } })}
        />
      )}

      {showCreateModal && (
        <CreateSignalModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  );
}

function SignalDetailModal({ signal, onClose, onCloseSignal }) {
  const st = statusLabels[signal.status] || statusLabels.closed;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">جزئیات سیگنال</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-text-primary">{signal.symbol}</span>
              <span className={`badge ${signal.type === 'BUY' ? 'badge-green' : 'badge-red'}`}>
                {signal.type === 'BUY' ? 'خرید' : 'فروش'}
              </span>
            </div>
            <span className={`badge ${st.class}`}>{st.text}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="قیمت ورود" value={signal.entry} />
            <InfoRow label="حد ضرر" value={signal.sl} valueClass="text-brand-red" />
            <InfoRow label="TP1" value={signal.tp1} valueClass="text-brand-green" />
            <InfoRow label="TP2" value={signal.tp2 || '-'} valueClass="text-brand-green" />
            <InfoRow label="TP3" value={signal.tp3 || '-'} valueClass="text-brand-green" />
            <InfoRow label="امتیاز" value={`${signal.score}/100`} />
            <InfoRow
              label="سود/ضرر (پیپ)"
              value={`${signal.pnl >= 0 ? '+' : ''}${signal.pnl}`}
              valueClass={signal.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}
            />
            <InfoRow label="منبع" value={signal.source === 'auto' ? 'خودکار' : 'دستی'} />
            <InfoRow label="تاریخ ایجاد" value={signal.createdAt} />
          </div>

          {signal.status === 'active' && (
            <button
              onClick={() => onCloseSignal(signal.id)}
              className="btn-danger w-full flex items-center justify-center gap-2 mt-4"
            >
              <XCircle size={16} />
              <span>بستن سیگنال</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, valueClass = 'text-text-primary' }) {
  return (
    <div className="bg-surface-elevated rounded-lg px-3 py-2.5">
      <p className="text-[11px] text-text-muted mb-0.5">{label}</p>
      <p className={`text-sm font-medium font-mono ${valueClass}`}>{value}</p>
    </div>
  );
}

function CreateSignalModal({ onClose, onSubmit, isLoading }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signalFormSchema),
    defaultValues: { type: 'BUY' },
  });

  const handleCreate = (data) => {
    onSubmit({
      ...data,
      entry: parseFloat(data.entry),
      tp1: parseFloat(data.tp1),
      tp2: data.tp2 ? parseFloat(data.tp2) : null,
      tp3: data.tp3 ? parseFloat(data.tp3) : null,
      sl: parseFloat(data.sl),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">ایجاد سیگنال دستی</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">نماد</label>
              <input {...register('symbol')} placeholder="EUR/USD" className="w-full text-sm" />
              {errors.symbol && <p className="text-[10px] text-brand-red">{errors.symbol.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">نوع</label>
              <select {...register('type')} className="w-full text-sm">
                <option value="BUY">خرید (BUY)</option>
                <option value="SELL">فروش (SELL)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">قیمت ورود</label>
            <input {...register('entry')} placeholder="1.0852" className="w-full text-sm font-mono" />
            {errors.entry && <p className="text-[10px] text-brand-red">{errors.entry.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">TP1</label>
              <input {...register('tp1')} placeholder="1.0890" className="w-full text-sm font-mono" />
              {errors.tp1 && <p className="text-[10px] text-brand-red">{errors.tp1.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">TP2</label>
              <input {...register('tp2')} placeholder="1.0920" className="w-full text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">TP3</label>
              <input {...register('tp3')} placeholder="1.0950" className="w-full text-sm font-mono" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">حد ضرر (SL)</label>
            <input {...register('sl')} placeholder="1.0810" className="w-full text-sm font-mono" />
            {errors.sl && <p className="text-[10px] text-brand-red">{errors.sl.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">توضیحات</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="توضیحات اختیاری..."
              className="w-full text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isLoading} className="btn-success flex-1 flex items-center justify-center gap-2">
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus size={16} />
                  <span>ایجاد سیگنال</span>
                </>
              )}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
