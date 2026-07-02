import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import {
  User as UserIcon,
  Lock,
  Mail,
  Phone,
  Crown,
  CalendarDays,
  FileText,
  Loader2,
  UserPlus,
  Save,
} from 'lucide-react';
import Modal from '../common/Modal';
import { useToast } from '../common/Toast';
import { bnAPI } from '../../api/client';
import { toPersianDigits } from '../../utils/formatters';

const TIERS = [
  { value: 'free', label: 'رایگان' },
  { value: 'vip', label: 'ویژه' },
  { value: 'premium', label: 'حرفه‌ای' },
];

const DAY_PRESETS = [30, 90, 180, 365];

// Empty-string → undefined so optional fields don't fail email/regex checks.
const emptyToUndef = (v) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const createSchema = z.object({
  username: z
    .string({ required_error: 'نام کاربری الزامی است' })
    .trim()
    .min(3, 'نام کاربری حداقل ۳ کاراکتر')
    .max(64, 'نام کاربری حداکثر ۶۴ کاراکتر')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'فقط حروف و اعداد انگلیسی، نقطه، خط تیره و آندرلاین'),
  password: z
    .string({ required_error: 'گذرواژه الزامی است' })
    .min(8, 'گذرواژه حداقل ۸ کاراکتر'),
  email: z.preprocess(
    emptyToUndef,
    z.string().email('ایمیل معتبر نیست').optional()
  ),
  fullName: z.preprocess(
    emptyToUndef,
    z.string().max(120, 'نام حداکثر ۱۲۰ کاراکتر').optional()
  ),
  tier: z.enum(['free', 'vip', 'premium']),
  days: z.coerce
    .number({ invalid_type_error: 'تعداد روز نامعتبر است' })
    .int('عدد صحیح وارد کنید')
    .min(0, 'نمی‌تواند منفی باشد')
    .max(3650, 'حداکثر ۳۶۵۰ روز'),
});

const editSchema = z.object({
  fullName: z.preprocess(
    emptyToUndef,
    z.string().max(120, 'نام حداکثر ۱۲۰ کاراکتر').optional()
  ),
  email: z.preprocess(
    emptyToUndef,
    z.string().email('ایمیل معتبر نیست').optional()
  ),
  phoneNumber: z.preprocess(
    emptyToUndef,
    z
      .string()
      .regex(/^[+]?[0-9\s-]{5,20}$/, 'شماره تماس معتبر نیست')
      .optional()
  ),
  notes: z.preprocess(
    emptyToUndef,
    z.string().max(1000, 'یادداشت حداکثر ۱۰۰۰ کاراکتر').optional()
  ),
});

const fieldBase =
  'w-full bg-surface-elevated border border-surface-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-[border,box-shadow] duration-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20';

function Field({ label, icon: Icon, error, required, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
        {Icon && <Icon size={14} className="text-text-muted" />}
        <span>{label}</span>
        {required && <span className="text-brand-red">*</span>}
      </label>
      {children}
      {error ? (
        <span className="text-xs text-brand-red">{error}</span>
      ) : hint ? (
        <span className="text-xs text-text-muted">{hint}</span>
      ) : null}
    </div>
  );
}

export default function UserFormModal({ mode = 'add', user, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = mode === 'edit';

  const schema = isEdit ? editSchema : createSchema;

  const defaultValues = useMemo(() => {
    if (isEdit) {
      return {
        fullName: user?.fullName || '',
        email: user?.email || '',
        phoneNumber: user?.phoneNumber || '',
        notes: user?.notes || '',
      };
    }
    return {
      username: '',
      password: '',
      email: '',
      fullName: '',
      tier: 'free',
      days: 30,
    };
  }, [isEdit, user]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
  });

  const tier = watch('tier');
  const days = watch('days');

  const mutation = useMutation({
    mutationFn: async (values) => {
      if (isEdit) {
        if (!user?.id) throw new Error('شناسه کاربر یافت نشد');
        return bnAPI.updateUser(user.id, {
          fullName: values.fullName ?? null,
          email: values.email ?? null,
          phoneNumber: values.phoneNumber ?? null,
          notes: values.notes ?? null,
        });
      }
      return bnAPI.createUser({
        username: values.username,
        password: values.password,
        email: values.email || undefined,
        fullName: values.fullName || undefined,
        tier: values.tier,
        days: values.days,
      });
    },
    onSuccess: () => {
      toast.success(
        isEdit ? 'اطلاعات کاربر به‌روزرسانی شد.' : 'کاربر جدید با موفقیت ساخته شد.'
      );
      onSaved?.();
      onClose?.();
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'عملیات ناموفق بود. دوباره تلاش کنید.';
      toast.error(typeof msg === 'string' ? msg : 'خطای ناشناخته رخ داد.');
    },
  });

  const onSubmit = (values) => mutation.mutate(values);

  const busy = isSubmitting || mutation.isPending;
  const title = isEdit ? 'ویرایش کاربر' : 'افزودن کاربر جدید';

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        className="btn-ghost disabled:opacity-50"
      >
        انصراف
      </button>
      <button
        type="submit"
        form="user-form"
        disabled={busy}
        className="btn-primary flex items-center gap-2 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isEdit ? (
          <Save size={16} />
        ) : (
          <UserPlus size={16} />
        )}
        <span>{isEdit ? 'ذخیره تغییرات' : 'ساخت کاربر'}</span>
      </button>
    </>
  );

  return (
    <Modal isOpen onClose={onClose} title={title} size="md" footer={footer}>
      {isEdit && user && (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-surface-elevated border border-surface-border px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue/15 text-brand-blue font-bold">
            {(user.fullName || user.username || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-text-primary">
              {user.fullName || user.username}
            </div>
            <div dir="ltr" className="truncate text-xs text-text-muted text-right">
              @{user.username}
              {user.id != null && (
                <span className="mr-2">· #{toPersianDigits(user.id)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <form
        id="user-form"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        {!isEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="نام کاربری"
              icon={UserIcon}
              required
              error={errors.username?.message}
            >
              <input
                dir="ltr"
                autoComplete="off"
                className={`${fieldBase} text-left`}
                placeholder="username"
                {...register('username')}
              />
            </Field>
            <Field
              label="گذرواژه"
              icon={Lock}
              required
              error={errors.password?.message}
            >
              <input
                dir="ltr"
                type="password"
                autoComplete="new-password"
                className={`${fieldBase} text-left`}
                placeholder="••••••••"
                {...register('password')}
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="نام کامل" icon={UserIcon} error={errors.fullName?.message}>
            <input
              className={fieldBase}
              placeholder="نام و نام خانوادگی"
              {...register('fullName')}
            />
          </Field>
          <Field label="ایمیل" icon={Mail} error={errors.email?.message}>
            <input
              dir="ltr"
              type="email"
              autoComplete="off"
              className={`${fieldBase} text-left`}
              placeholder="name@example.com"
              {...register('email')}
            />
          </Field>
        </div>

        {isEdit ? (
          <>
            <Field
              label="شماره تماس"
              icon={Phone}
              error={errors.phoneNumber?.message}
            >
              <input
                dir="ltr"
                type="tel"
                autoComplete="off"
                className={`${fieldBase} text-left`}
                placeholder="+98..."
                {...register('phoneNumber')}
              />
            </Field>
            <Field label="یادداشت مدیر" icon={FileText} error={errors.notes?.message}>
              <textarea
                rows={3}
                className={`${fieldBase} resize-none`}
                placeholder="یادداشت داخلی درباره این کاربر..."
                {...register('notes')}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="سطح اشتراک" icon={Crown} error={errors.tier?.message}>
              <div className="grid grid-cols-3 gap-2">
                {TIERS.map((t) => {
                  const active = tier === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() =>
                        setValue('tier', t.value, { shouldValidate: true })
                      }
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-[background,border,color] duration-200 ${
                        active
                          ? 'border-brand-blue bg-brand-blue/15 text-brand-blue'
                          : 'border-surface-border bg-surface-elevated text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field
              label="مدت اعتبار (روز)"
              icon={CalendarDays}
              error={errors.days?.message}
              hint={
                tier === 'free'
                  ? 'برای اشتراک رایگان می‌توانید ۰ روز بگذارید.'
                  : `اعتبار به مدت ${toPersianDigits(days || 0)} روز فعال می‌شود.`
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  dir="ltr"
                  type="number"
                  min={0}
                  max={3650}
                  className={`${fieldBase} w-28 text-left`}
                  {...register('days')}
                />
                <div className="flex flex-wrap gap-2">
                  {DAY_PRESETS.map((d) => {
                    const active = Number(days) === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          setValue('days', d, { shouldValidate: true })
                        }
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-[background,border,color] duration-200 ${
                          active
                            ? 'border-brand-blue bg-brand-blue/15 text-brand-blue'
                            : 'border-surface-border bg-surface-elevated text-text-muted hover:bg-surface-hover'
                        }`}
                      >
                        {toPersianDigits(d)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
