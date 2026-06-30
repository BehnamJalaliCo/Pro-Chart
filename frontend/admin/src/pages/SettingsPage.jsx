import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { settingsAPI } from '../api/client';
import { useNotificationStore } from '../store';
import {
  Save,
  Settings,
  Target,
  Shield,
  Key,
  Hash,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
} from 'lucide-react';

const mockSettings = {
  signal: {
    minScore: 70,
    maxDailySignals: 15,
    symbols: [
      'EUR/USD',
      'GBP/USD',
      'USD/JPY',
      'GBP/JPY',
      'AUD/USD',
      'EUR/GBP',
      'XAU/USD',
      'BTC/USD',
    ],
    timeframes: ['M15', 'M30', 'H1', 'H4', 'D1'],
    autoPublish: true,
    requireConfirmation: false,
  },
  tpsl: {
    defaultTpPips: 50,
    defaultSlPips: 30,
    riskRewardRatio: 1.5,
    trailingStop: true,
    trailingStopPips: 20,
    tp1Percentage: 50,
    tp2Percentage: 30,
    tp3Percentage: 20,
    breakEvenAfterTp1: true,
  },
  apiKeys: [
    {
      id: 'mt5',
      name: 'MetaTrader 5',
      key: 'mt5_api_***********',
      status: 'active',
      lastUsed: '۲ دقیقه پیش',
    },
    {
      id: 'tradingview',
      name: 'TradingView',
      key: 'tv_webhook_***********',
      status: 'active',
      lastUsed: '۵ دقیقه پیش',
    },
    {
      id: 'oanda',
      name: 'OANDA',
      key: 'oanda_***********',
      status: 'active',
      lastUsed: '۱۰ دقیقه پیش',
    },
    {
      id: 'binance',
      name: 'Binance',
      key: 'binance_***********',
      status: 'warning',
      lastUsed: '۴۵ دقیقه پیش',
    },
  ],
  telegram: {
    channelId: '@forex_signal_pro',
    botToken: '***********',
    adminChatId: '123456789',
    notifyOnNewSignal: true,
    notifyOnTpHit: true,
    notifyOnSlHit: true,
    notifyOnNewUser: true,
  },
};

const signalSettingsSchema = z.object({
  minScore: z.number().min(0).max(100),
  maxDailySignals: z.number().min(1).max(100),
  symbols: z.string().min(1),
  timeframes: z.string().min(1),
  autoPublish: z.boolean(),
  requireConfirmation: z.boolean(),
});

const tpslSchema = z.object({
  defaultTpPips: z.number().min(1),
  defaultSlPips: z.number().min(1),
  riskRewardRatio: z.number().min(0.5),
  trailingStop: z.boolean(),
  trailingStopPips: z.number().min(1),
  tp1Percentage: z.number().min(0).max(100),
  tp2Percentage: z.number().min(0).max(100),
  tp3Percentage: z.number().min(0).max(100),
  breakEvenAfterTp1: z.boolean(),
});

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const notify = useNotificationStore();
  const [activeTab, setActiveTab] = useState('signal');
  const [showApiKey, setShowApiKey] = useState({});

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsAPI.getAll().then((r) => r.data),
    placeholderData: mockSettings,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => settingsAPI.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      notify.success('تنظیمات با موفقیت ذخیره شد');
    },
    onError: () => notify.error('خطا در ذخیره تنظیمات'),
  });

  const settings = settingsData || mockSettings;

  const tabs = [
    { id: 'signal', label: 'سیگنال', icon: Target },
    { id: 'tpsl', label: 'TP/SL', icon: Shield },
    { id: 'api', label: 'کلیدهای API', icon: Key },
    { id: 'telegram', label: 'تلگرام', icon: Hash },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-text-primary">تنظیمات</h1>

      <div className="flex gap-2 border-b border-surface-border pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                activeTab === tab.id
                  ? 'text-brand-blue border-brand-blue'
                  : 'text-text-muted border-transparent hover:text-text-secondary'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'signal' && (
        <SignalSettings
          settings={settings.signal}
          onSave={(data) => updateMutation.mutate({ signal: data })}
          isLoading={updateMutation.isPending}
        />
      )}

      {activeTab === 'tpsl' && (
        <TpSlSettings
          settings={settings.tpsl}
          onSave={(data) => updateMutation.mutate({ tpsl: data })}
          isLoading={updateMutation.isPending}
        />
      )}

      {activeTab === 'api' && (
        <ApiKeysSettings
          apiKeys={settings.apiKeys}
          showApiKey={showApiKey}
          setShowApiKey={setShowApiKey}
        />
      )}

      {activeTab === 'telegram' && (
        <TelegramSettings
          settings={settings.telegram}
          onSave={(data) => updateMutation.mutate({ telegram: data })}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function SignalSettings({ settings, onSave, isLoading }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(signalSettingsSchema),
    defaultValues: {
      minScore: settings.minScore,
      maxDailySignals: settings.maxDailySignals,
      symbols: settings.symbols.join(', '),
      timeframes: settings.timeframes.join(', '),
      autoPublish: settings.autoPublish,
      requireConfirmation: settings.requireConfirmation,
    },
  });

  const onSubmit = (data) => {
    onSave({
      ...data,
      symbols: data.symbols.split(',').map((s) => s.trim()),
      timeframes: data.timeframes.split(',').map((t) => t.trim()),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Target size={16} className="text-brand-blue" />
        تنظیمات سیگنال
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">حداقل امتیاز سیگنال</label>
          <input
            {...register('minScore', { valueAsNumber: true })}
            type="number"
            min="0"
            max="100"
            className="w-full text-sm"
          />
          {errors.minScore && (
            <p className="text-[10px] text-brand-red">{errors.minScore.message}</p>
          )}
          <p className="text-[10px] text-text-muted">
            سیگنال‌های با امتیاز کمتر از این مقدار نادیده گرفته می‌شوند
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">
            حداکثر سیگنال روزانه
          </label>
          <input
            {...register('maxDailySignals', { valueAsNumber: true })}
            type="number"
            min="1"
            max="100"
            className="w-full text-sm"
          />
          {errors.maxDailySignals && (
            <p className="text-[10px] text-brand-red">{errors.maxDailySignals.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">نمادها (با کاما جدا کنید)</label>
        <input {...register('symbols')} className="w-full text-sm font-mono" />
        {errors.symbols && (
          <p className="text-[10px] text-brand-red">{errors.symbols.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">
          تایم‌فریم‌ها (با کاما جدا کنید)
        </label>
        <input {...register('timeframes')} className="w-full text-sm font-mono" />
        {errors.timeframes && (
          <p className="text-[10px] text-brand-red">{errors.timeframes.message}</p>
        )}
      </div>

      <div className="space-y-3">
        <ToggleRow
          register={register}
          name="autoPublish"
          label="انتشار خودکار"
          description="سیگنال‌ها به صورت خودکار در کانال منتشر شوند"
        />
        <ToggleRow
          register={register}
          name="requireConfirmation"
          label="نیاز به تایید"
          description="سیگنال‌ها قبل از انتشار نیاز به تایید ادمین دارند"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isLoading || !isDirty}
          className="btn-primary flex items-center gap-2"
        >
          {isLoading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          <span>ذخیره تنظیمات</span>
        </button>
      </div>
    </form>
  );
}

function TpSlSettings({ settings, onSave, isLoading }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(tpslSchema),
    defaultValues: settings,
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="card space-y-5">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Shield size={16} className="text-brand-green" />
        تنظیمات حد سود و حد ضرر
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">حد سود پیش‌فرض (پیپ)</label>
          <input
            {...register('defaultTpPips', { valueAsNumber: true })}
            type="number"
            min="1"
            className="w-full text-sm"
          />
          {errors.defaultTpPips && (
            <p className="text-[10px] text-brand-red">{errors.defaultTpPips.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">حد ضرر پیش‌فرض (پیپ)</label>
          <input
            {...register('defaultSlPips', { valueAsNumber: true })}
            type="number"
            min="1"
            className="w-full text-sm"
          />
          {errors.defaultSlPips && (
            <p className="text-[10px] text-brand-red">{errors.defaultSlPips.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">نسبت ریسک به ریوارد</label>
          <input
            {...register('riskRewardRatio', { valueAsNumber: true })}
            type="number"
            step="0.1"
            min="0.5"
            className="w-full text-sm"
          />
          {errors.riskRewardRatio && (
            <p className="text-[10px] text-brand-red">{errors.riskRewardRatio.message}</p>
          )}
        </div>
      </div>

      <div className="p-4 bg-surface-elevated rounded-lg space-y-3">
        <h4 className="text-xs font-semibold text-text-primary">تقسیم‌بندی حد سود</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] text-text-muted">TP1 (٪ حجم)</label>
            <input
              {...register('tp1Percentage', { valueAsNumber: true })}
              type="number"
              min="0"
              max="100"
              className="w-full text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-text-muted">TP2 (٪ حجم)</label>
            <input
              {...register('tp2Percentage', { valueAsNumber: true })}
              type="number"
              min="0"
              max="100"
              className="w-full text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-text-muted">TP3 (٪ حجم)</label>
            <input
              {...register('tp3Percentage', { valueAsNumber: true })}
              type="number"
              min="0"
              max="100"
              className="w-full text-sm"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <ToggleRow
          register={register}
          name="trailingStop"
          label="تریلینگ استاپ"
          description="فعال‌سازی حد ضرر متحرک"
        />
        <div className="space-y-1.5 pr-6">
          <label className="text-xs font-medium text-text-secondary">
            فاصله تریلینگ (پیپ)
          </label>
          <input
            {...register('trailingStopPips', { valueAsNumber: true })}
            type="number"
            min="1"
            className="w-full text-sm max-w-[200px]"
          />
        </div>
        <ToggleRow
          register={register}
          name="breakEvenAfterTp1"
          label="Break Even بعد از TP1"
          description="حد ضرر به نقطه ورود منتقل شود بعد از فعال شدن TP1"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isLoading || !isDirty}
          className="btn-primary flex items-center gap-2"
        >
          {isLoading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          <span>ذخیره تنظیمات</span>
        </button>
      </div>
    </form>
  );
}

function ApiKeysSettings({ apiKeys, showApiKey, setShowApiKey }) {
  const toggleKey = (id) => {
    setShowApiKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="card space-y-5">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Key size={16} className="text-yellow-400" />
        مدیریت کلیدهای API
      </h3>

      <div className="space-y-3">
        {apiKeys.map((apiKey) => (
          <div
            key={apiKey.id}
            className="flex items-center justify-between p-4 bg-surface-elevated rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  apiKey.status === 'active'
                    ? 'bg-brand-green shadow-[0_0_6px_rgba(0,200,83,0.5)]'
                    : 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]'
                }`}
              />
              <div>
                <p className="text-sm font-medium text-text-primary">{apiKey.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs text-text-muted font-mono bg-surface rounded px-2 py-0.5">
                    {showApiKey[apiKey.id] ? apiKey.key.replace(/\*/g, 'x') : apiKey.key}
                  </code>
                  <button
                    onClick={() => toggleKey(apiKey.id)}
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showApiKey[apiKey.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="text-left">
              <span
                className={`badge ${
                  apiKey.status === 'active' ? 'badge-green' : 'bg-yellow-500/15 text-yellow-400'
                }`}
              >
                {apiKey.status === 'active' ? 'فعال' : 'هشدار'}
              </span>
              <p className="text-[10px] text-text-muted mt-1">
                آخرین استفاده: {apiKey.lastUsed}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-400/80 leading-5">
          کلیدهای API حساس هستند. هرگز آنها را با افراد غیرمجاز به اشتراک نگذارید. برای تغییر کلید، از بخش تنظیمات سرویس مربوطه اقدام کنید.
        </p>
      </div>
    </div>
  );
}

function TelegramSettings({ settings, onSave, isLoading }) {
  const [channelId, setChannelId] = useState(settings.channelId);
  const [adminChatId, setAdminChatId] = useState(settings.adminChatId);
  const [notifyOnNewSignal, setNotifyOnNewSignal] = useState(settings.notifyOnNewSignal);
  const [notifyOnTpHit, setNotifyOnTpHit] = useState(settings.notifyOnTpHit);
  const [notifyOnSlHit, setNotifyOnSlHit] = useState(settings.notifyOnSlHit);
  const [notifyOnNewUser, setNotifyOnNewUser] = useState(settings.notifyOnNewUser);

  const handleSave = () => {
    onSave({
      channelId,
      adminChatId,
      botToken: settings.botToken,
      notifyOnNewSignal,
      notifyOnTpHit,
      notifyOnSlHit,
      notifyOnNewUser,
    });
  };

  return (
    <div className="card space-y-5">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Hash size={16} className="text-brand-blue" />
        تنظیمات تلگرام
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">شناسه کانال</label>
          <input
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="@channel_name"
            className="w-full text-sm font-mono"
          />
          <p className="text-[10px] text-text-muted">
            نام یا شناسه عددی کانال تلگرام
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">شناسه چت ادمین</label>
          <input
            value={adminChatId}
            onChange={(e) => setAdminChatId(e.target.value)}
            placeholder="123456789"
            className="w-full text-sm font-mono"
          />
          <p className="text-[10px] text-text-muted">
            شناسه عددی چت ادمین برای دریافت نوتیفیکیشن‌ها
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">توکن ربات</label>
        <div className="flex items-center gap-2">
          <input
            value={settings.botToken}
            disabled
            className="w-full text-sm font-mono opacity-60"
          />
          <span className="badge badge-green gap-1">
            <Check size={10} />
            متصل
          </span>
        </div>
      </div>

      <div className="p-4 bg-surface-elevated rounded-lg space-y-3">
        <h4 className="text-xs font-semibold text-text-primary">نوتیفیکیشن‌ها</h4>
        <div className="space-y-3">
          <ToggleRowState
            checked={notifyOnNewSignal}
            onChange={setNotifyOnNewSignal}
            label="سیگنال جدید"
            description="اطلاع‌رسانی هنگام ایجاد سیگنال جدید"
          />
          <ToggleRowState
            checked={notifyOnTpHit}
            onChange={setNotifyOnTpHit}
            label="فعال شدن TP"
            description="اطلاع‌رسانی هنگام فعال شدن حد سود"
          />
          <ToggleRowState
            checked={notifyOnSlHit}
            onChange={setNotifyOnSlHit}
            label="فعال شدن SL"
            description="اطلاع‌رسانی هنگام فعال شدن حد ضرر"
          />
          <ToggleRowState
            checked={notifyOnNewUser}
            onChange={setNotifyOnNewUser}
            label="کاربر جدید"
            description="اطلاع‌رسانی هنگام ثبت‌نام کاربر جدید"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="btn-primary flex items-center gap-2"
        >
          {isLoading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          <span>ذخیره تنظیمات</span>
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ register, name, label, description }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <div>
        <p className="text-sm text-text-primary group-hover:text-brand-blue transition-colors">
          {label}
        </p>
        {description && <p className="text-[11px] text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="relative">
        <input type="checkbox" {...register(name)} className="sr-only peer" />
        <div className="w-10 h-5 bg-surface-border rounded-full peer-checked:bg-brand-blue transition-colors" />
        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:-translate-x-5 shadow-sm" />
      </div>
    </label>
  );
}

function ToggleRowState({ checked, onChange, label, description }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <div>
        <p className="text-sm text-text-primary group-hover:text-brand-blue transition-colors">
          {label}
        </p>
        {description && <p className="text-[11px] text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="relative" onClick={() => onChange(!checked)}>
        <div
          className={`w-10 h-5 rounded-full transition-colors ${
            checked ? 'bg-brand-blue' : 'bg-surface-border'
          }`}
        />
        <div
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${
            checked ? 'right-[22px]' : 'right-0.5'
          }`}
        />
      </div>
    </label>
  );
}
