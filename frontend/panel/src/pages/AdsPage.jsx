import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone,
  Plus,
  Save,
  Trash2,
  ExternalLink,
  Image as ImageIcon,
  Link as LinkIcon,
  Type,
  Power,
  Eye,
  CheckCircle2,
  Info,
} from 'lucide-react';

import { bnAPI } from '../api/client';
import { useNotificationStore } from '../store';

import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { CardSkeleton } from '../components/common/Skeleton';

import { toPersianDigits } from '../utils/formatters';

// ─────────────────────────────────────────────────────────────
// تبلیغات — ویرایشگرِ جایگاه‌های تبلیغاتیِ منو (bn:ads در Redis)
// هر «جایگاه» یک کلیدِ نام‌دار با فیلدهای logo/text/link/active است.
// getAds → { slots: { name: {logo,text,link,active} } }
// setAd({slot,logo,text,link,active})  — active=false ⇒ حذفِ جایگاه.
// ─────────────────────────────────────────────────────────────

// ── پیش‌نمایشِ یک جایگاه، همان‌گونه که در سایت دیده می‌شود ──
function AdPreview({ logo, text, link, active }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [logo]);

  const hasContent = (logo && !imgError) || text;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-text-muted">
        <Eye size={12} />
        پیش‌نمایش
      </div>

      {!hasContent ? (
        <div className="flex h-14 items-center justify-center rounded-lg border border-dashed border-surface-border text-xs text-text-muted">
          محتوایی برای نمایش وجود ندارد
        </div>
      ) : (
        <div
          className={`flex items-center gap-3 rounded-lg border border-surface-border bg-surface-card px-3 py-2.5 transition-opacity ${
            active ? 'opacity-100' : 'opacity-50'
          }`}
        >
          {logo && !imgError ? (
            <img
              src={logo}
              alt={text || 'logo'}
              onError={() => setImgError(true)}
              className="h-9 w-9 shrink-0 rounded-md object-contain"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-hover">
              <ImageIcon size={16} className="text-text-muted" />
            </div>
          )}

          <span className="flex-1 truncate text-sm font-medium text-text-primary">
            {text || 'بدون متن'}
          </span>

          {link && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-brand-blue" dir="ltr">
              <ExternalLink size={12} />
              لینک
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── ویرایشگرِ یک جایگاه با فرمِ ذخیرهٔ مستقل ──
function SlotEditor({ slot, initial, onSave, onDelete, saving, deleting }) {
  const [logo, setLogo] = useState(initial.logo || '');
  const [text, setText] = useState(initial.text || '');
  const [link, setLink] = useState(initial.link || '');
  const [active, setActive] = useState(initial.active !== false);

  // هم‌گام‌سازی با داده‌های تازه پس از ذخیره/رفرش
  useEffect(() => {
    setLogo(initial.logo || '');
    setText(initial.text || '');
    setLink(initial.link || '');
    setActive(initial.active !== false);
  }, [initial.logo, initial.text, initial.link, initial.active]);

  const dirty =
    logo !== (initial.logo || '') ||
    text !== (initial.text || '') ||
    link !== (initial.link || '') ||
    active !== (initial.active !== false);

  const busy = saving || deleting;

  return (
    <div className="card space-y-4">
      {/* سرِ جایگاه */}
      <div className="flex items-center justify-between gap-2 border-b border-surface-border pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue/10">
            <Megaphone size={15} className="text-brand-blue" />
          </span>
          <div className="flex flex-col">
            <span className="font-mono text-sm font-semibold text-text-primary" dir="ltr">
              {slot}
            </span>
            <span className="text-[11px] text-text-muted">نام جایگاه</span>
          </div>
        </div>
        {active ? (
          <span className="badge badge-green">فعال</span>
        ) : (
          <span className="badge">غیرفعال</span>
        )}
      </div>

      {/* فیلدها */}
      <div className="space-y-3">
        <Field label="آدرس لوگو (URL)" icon={ImageIcon}>
          <input
            type="text"
            dir="ltr"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://…/logo.png"
            className="w-full"
            disabled={busy}
          />
        </Field>

        <Field label="متن" icon={Type}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="متنِ نمایشیِ تبلیغ"
            className="w-full"
            disabled={busy}
          />
        </Field>

        <Field label="لینک مقصد (URL)" icon={LinkIcon}>
          <input
            type="text"
            dir="ltr"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
            className="w-full"
            disabled={busy}
          />
        </Field>

        {/* سوییچِ فعال بودن */}
        <label className="flex cursor-pointer items-center justify-between rounded-lg bg-surface-elevated px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm text-text-secondary">
            <Power size={15} className="text-text-muted" />
            نمایش این جایگاه فعال باشد
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            disabled={busy}
            onClick={() => setActive((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
              active ? 'bg-brand-green' : 'bg-surface-hover'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                active ? 'translate-x-[-4px]' : 'translate-x-[-24px]'
              }`}
            />
          </button>
        </label>
      </div>

      {/* پیش‌نمایش */}
      <AdPreview logo={logo} text={text} link={link} active={active} />

      {!active && (
        <div className="flex items-start gap-2 rounded-lg border border-brand-red/20 bg-brand-red/5 p-2.5 text-[11px] leading-relaxed text-text-secondary">
          <Info size={13} className="mt-0.5 shrink-0 text-brand-red" />
          با ذخیرهٔ جایگاهِ «غیرفعال»، این جایگاه از منو حذف می‌شود.
        </div>
      )}

      {/* اکشن‌ها */}
      <div className="flex items-center justify-between gap-2 border-t border-surface-border pt-3">
        <button
          type="button"
          onClick={() => onDelete(slot)}
          disabled={busy}
          className="btn-ghost flex items-center gap-1.5 text-brand-red hover:bg-brand-red/10"
        >
          <Trash2 size={15} />
          حذف
        </button>

        <button
          type="button"
          onClick={() => onSave({ slot, logo, text, link, active })}
          disabled={busy || !dirty}
          className="btn-primary flex items-center gap-1.5"
        >
          <Save size={15} />
          {saving ? 'در حال ذخیره…' : dirty ? 'ذخیرهٔ تغییرات' : 'ذخیره شد'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        {Icon && <Icon size={13} className="text-text-muted" />}
        {label}
      </label>
      {children}
    </div>
  );
}

export default function AdsPage() {
  const queryClient = useQueryClient();
  const notify = useNotificationStore();

  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // slot name

  const [pendingSlot, setPendingSlot] = useState(null); // slotِ در حالِ ذخیره
  const [pendingDelete, setPendingDelete] = useState(null); // slotِ در حالِ حذف

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['bn-ads'],
    queryFn: () => bnAPI.getAds(),
  });

  const slots = useMemo(() => {
    const raw = data?.slots && typeof data.slots === 'object' ? data.slots : {};
    return Object.entries(raw)
      .map(([name, cfg]) => ({
        slot: name,
        logo: cfg?.logo || '',
        text: cfg?.text || '',
        link: cfg?.link || '',
        active: cfg?.active !== false,
      }))
      .sort((a, b) => a.slot.localeCompare(b.slot));
  }, [data]);

  const stats = useMemo(
    () => ({
      total: slots.length,
      active: slots.filter((s) => s.active).length,
      withLink: slots.filter((s) => s.link).length,
    }),
    [slots]
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['bn-ads'] });

  const saveMutation = useMutation({
    mutationFn: (payload) => bnAPI.setAd(payload),
    onMutate: (payload) => setPendingSlot(payload.slot),
    onSuccess: (_res, payload) => {
      invalidate();
      notify.success(
        payload.active
          ? `جایگاهِ «${payload.slot}» ذخیره شد.`
          : `جایگاهِ «${payload.slot}» غیرفعال و حذف شد.`
      );
    },
    onError: () => notify.error('ذخیرهٔ جایگاه ناموفق بود.'),
    onSettled: () => setPendingSlot(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (slot) => bnAPI.setAd({ slot, active: false }),
    onMutate: (slot) => setPendingDelete(slot),
    onSuccess: (_res, slot) => {
      invalidate();
      notify.success(`جایگاهِ «${slot}» حذف شد.`);
    },
    onError: () => notify.error('حذفِ جایگاه ناموفق بود.'),
    onSettled: () => setPendingDelete(null),
  });

  const handleSave = (payload) => saveMutation.mutate(payload);

  const handleCreate = (payload) => {
    saveMutation.mutate(payload, {
      onSuccess: () => setAddOpen(false),
    });
  };

  const runDelete = async () => {
    if (!confirmDelete) return;
    await deleteMutation.mutateAsync(confirmDelete);
    setConfirmDelete(null);
  };

  const existingNames = slots.map((s) => s.slot);

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-text-primary">
          <Megaphone size={22} className="text-brand-blue" />
          تبلیغات
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          ویرایشِ جایگاه‌های تبلیغاتیِ منو (لوگو، متن، لینک و وضعیت) با پیش‌نمایشِ زنده.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        disabled={isLoading || isError}
        className="btn-primary flex items-center justify-center gap-1.5"
      >
        <Plus size={16} />
        جایگاه جدید
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {header}

      {/* کارت‌های آماری */}
      {isLoading ? (
        <CardSkeleton count={3} />
      ) : isError ? null : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard
            icon={Megaphone}
            title="کل جایگاه‌ها"
            value={toPersianDigits(stats.total)}
            variant="info"
          />
          <StatCard
            icon={CheckCircle2}
            title="جایگاه فعال"
            value={toPersianDigits(stats.active)}
            variant="success"
          />
          <StatCard
            icon={LinkIcon}
            title="دارای لینک"
            value={toPersianDigits(stats.withLink)}
            variant="default"
          />
        </div>
      )}

      {/* بدنه */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card space-y-4">
              <div className="h-10 rounded bg-surface-hover motion-safe:animate-pulse" />
              <div className="h-9 rounded bg-surface-hover motion-safe:animate-pulse" />
              <div className="h-9 rounded bg-surface-hover motion-safe:animate-pulse" />
              <div className="h-9 rounded bg-surface-hover motion-safe:animate-pulse" />
              <div className="h-16 rounded bg-surface-hover motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="card p-0 overflow-hidden">
          <ErrorState
            description="دریافتِ جایگاه‌های تبلیغاتی ناموفق بود."
            onRetry={refetch}
          />
        </div>
      ) : slots.length === 0 ? (
        <div className="card p-0 overflow-hidden">
          <EmptyState
            icon={Megaphone}
            title="هنوز جایگاهی تعریف نشده"
            description="اولین جایگاهِ تبلیغاتیِ منو را بسازید تا لوگو، متن و لینکِ آن را مدیریت کنید."
            action={
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="btn-primary flex items-center gap-1.5"
              >
                <Plus size={16} />
                ساختِ جایگاه
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {slots.map((s) => (
            <SlotEditor
              key={s.slot}
              slot={s.slot}
              initial={s}
              onSave={handleSave}
              onDelete={(slot) => setConfirmDelete(slot)}
              saving={pendingSlot === s.slot && saveMutation.isPending}
              deleting={pendingDelete === s.slot && deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {isFetching && !isLoading && (
        <p className="text-center text-xs text-text-muted">در حال به‌روزرسانی…</p>
      )}

      {/* مُدالِ افزودنِ جایگاه جدید */}
      <AddSlotModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={handleCreate}
        creating={saveMutation.isPending && !!pendingSlot}
        existingNames={existingNames}
      />

      {/* تأییدِ حذف */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={runDelete}
        loading={deleteMutation.isPending}
        variant="danger"
        title="حذفِ جایگاه"
        confirmText="حذف کن"
        message={
          confirmDelete
            ? `آیا جایگاهِ «${confirmDelete}» حذف شود؟ این جایگاه از منو برداشته می‌شود.`
            : ''
        }
      />
    </div>
  );
}

// ── مُدالِ ساختِ جایگاه جدید ──
function AddSlotModal({ isOpen, onClose, onCreate, creating, existingNames }) {
  const [slot, setSlot] = useState('');
  const [logo, setLogo] = useState('');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSlot('');
      setLogo('');
      setText('');
      setLink('');
    }
  }, [isOpen]);

  const trimmed = slot.trim();
  const duplicate = existingNames.includes(trimmed);
  const valid = trimmed.length > 0 && !duplicate;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onCreate({ slot: trimmed, logo, text, link, active: true });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="جایگاهِ تبلیغاتی جدید"
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            انصراف
          </button>
          <button
            type="submit"
            form="add-slot-form"
            disabled={!valid || creating}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus size={15} />
            {creating ? 'در حال ساخت…' : 'ساخت جایگاه'}
          </button>
        </>
      }
    >
      <form id="add-slot-form" onSubmit={submit} className="space-y-4">
        <Field label="نام جایگاه (کلید یکتا)" icon={Megaphone}>
          <input
            type="text"
            dir="ltr"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            placeholder="مثلاً header یا sidebar-top"
            className="w-full"
            autoFocus
          />
          {duplicate && (
            <p className="text-[11px] text-brand-red">
              جایگاهی با این نام از قبل وجود دارد.
            </p>
          )}
        </Field>

        <Field label="آدرس لوگو (URL)" icon={ImageIcon}>
          <input
            type="text"
            dir="ltr"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://…/logo.png"
            className="w-full"
          />
        </Field>

        <Field label="متن" icon={Type}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="متنِ نمایشیِ تبلیغ"
            className="w-full"
          />
        </Field>

        <Field label="لینک مقصد (URL)" icon={LinkIcon}>
          <input
            type="text"
            dir="ltr"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
            className="w-full"
          />
        </Field>

        <AdPreview logo={logo} text={text} link={link} active />
      </form>
    </Modal>
  );
}
