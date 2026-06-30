import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { monitoringAPI } from '../api/client';
import { Cpu, HardDrive, MemoryStick, Container, Wifi, WifiOff, RefreshCw, Clock } from 'lucide-react';

const mockSystemMetrics = {
  cpu: 34,
  ram: 62,
  disk: 45,
  cpuCores: 4,
  ramTotal: '16 GB',
  ramUsed: '9.9 GB',
  diskTotal: '100 GB',
  diskUsed: '45 GB',
  uptime: '۴۵ روز',
  loadAvg: '1.2, 0.9, 0.8',
};

const mockContainers = [
  { name: 'signal-engine', status: 'running', cpu: '12%', memory: '256 MB', uptime: '45d 12h' },
  { name: 'telegram-bot', status: 'running', cpu: '5%', memory: '128 MB', uptime: '45d 12h' },
  { name: 'ml-service', status: 'running', cpu: '28%', memory: '1.2 GB', uptime: '45d 12h' },
  { name: 'postgres', status: 'running', cpu: '8%', memory: '512 MB', uptime: '45d 12h' },
  { name: 'redis', status: 'running', cpu: '2%', memory: '64 MB', uptime: '45d 12h' },
  { name: 'nginx', status: 'running', cpu: '1%', memory: '32 MB', uptime: '45d 12h' },
  { name: 'celery-worker', status: 'running', cpu: '15%', memory: '384 MB', uptime: '44d 8h' },
  { name: 'celery-beat', status: 'stopped', cpu: '0%', memory: '0 MB', uptime: '-' },
];

const mockDataFeeds = [
  {
    name: 'MetaTrader 5',
    status: 'connected',
    latency: '12ms',
    lastUpdate: '۲ ثانیه پیش',
    symbols: 28,
  },
  {
    name: 'TradingView',
    status: 'connected',
    latency: '45ms',
    lastUpdate: '۵ ثانیه پیش',
    symbols: 35,
  },
  {
    name: 'OANDA API',
    status: 'connected',
    latency: '89ms',
    lastUpdate: '۱۰ ثانیه پیش',
    symbols: 22,
  },
  {
    name: 'Binance',
    status: 'degraded',
    latency: '320ms',
    lastUpdate: '۴۵ ثانیه پیش',
    symbols: 15,
  },
];

const mockLogs = [
  {
    id: 1,
    level: 'info',
    message: 'سیگنال جدید EUR/USD تولید شد - امتیاز: 87',
    timestamp: '۱۴:۳۲:۱۵',
    service: 'signal-engine',
  },
  {
    id: 2,
    level: 'info',
    message: 'پیام سیگنال به کانال تلگرام ارسال شد',
    timestamp: '۱۴:۳۲:۱۶',
    service: 'telegram-bot',
  },
  {
    id: 3,
    level: 'warning',
    message: 'تاخیر در دریافت داده از Binance - latency: 320ms',
    timestamp: '۱۴:۳۰:۴۵',
    service: 'data-feed',
  },
  {
    id: 4,
    level: 'info',
    message: 'مدل LSTM v3 پیش‌بینی انجام داد - confidence: 0.82',
    timestamp: '۱۴:۳۰:۱۲',
    service: 'ml-service',
  },
  {
    id: 5,
    level: 'error',
    message: 'خطا در اتصال به celery-beat - تلاش مجدد در ۳۰ ثانیه',
    timestamp: '۱۴:۲۸:۰۰',
    service: 'celery-beat',
  },
  {
    id: 6,
    level: 'info',
    message: 'TP1 سیگنال GBP/JPY فعال شد',
    timestamp: '۱۴:۲۵:۳۳',
    service: 'signal-engine',
  },
  {
    id: 7,
    level: 'info',
    message: 'بکاپ دیتابیس با موفقیت انجام شد',
    timestamp: '۱۴:۰۰:۰۰',
    service: 'postgres',
  },
  {
    id: 8,
    level: 'warning',
    message: 'مصرف RAM بالای ۶۰٪ - سرویس ml-service',
    timestamp: '۱۳:۵۵:۲۰',
    service: 'monitoring',
  },
  {
    id: 9,
    level: 'info',
    message: 'کاربر جدید ثبت‌نام کرد - ID: 654321789',
    timestamp: '۱۳:۴۵:۱۰',
    service: 'telegram-bot',
  },
  {
    id: 10,
    level: 'info',
    message: 'بروزرسانی کش Redis - 1250 کلید',
    timestamp: '۱۳:۳۰:۰۰',
    service: 'redis',
  },
];

function GaugeChart({ value, label, icon: Icon, max = 100, colorThresholds }) {
  const percentage = (value / max) * 100;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (colorThresholds) {
      if (value >= colorThresholds.danger) return '#FF1744';
      if (value >= colorThresholds.warning) return '#FFC107';
      return '#00C853';
    }
    return '#2979FF';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="gauge-ring">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1c2030" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={getColor()}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-text-primary">{value}٪</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <Icon size={14} className="text-text-muted" />
        <span className="text-xs text-text-muted">{label}</span>
      </div>
    </div>
  );
}

export default function MonitoringPage() {
  const [logFilter, setLogFilter] = useState('all');

  const { data: systemData } = useQuery({
    queryKey: ['monitoring-system'],
    queryFn: () => monitoringAPI.getSystemMetrics().then((r) => r.data),
    placeholderData: mockSystemMetrics,
    refetchInterval: 10000,
  });

  const { data: containersData } = useQuery({
    queryKey: ['monitoring-containers'],
    queryFn: () => monitoringAPI.getContainers().then((r) => r.data),
    placeholderData: mockContainers,
    refetchInterval: 15000,
  });

  const { data: dataFeedsData } = useQuery({
    queryKey: ['monitoring-feeds'],
    queryFn: () => monitoringAPI.getDataFeeds().then((r) => r.data),
    placeholderData: mockDataFeeds,
    refetchInterval: 10000,
  });

  const { data: logsData } = useQuery({
    queryKey: ['monitoring-logs', logFilter],
    queryFn: () => monitoringAPI.getLogs({ level: logFilter }).then((r) => r.data),
    placeholderData: mockLogs,
    refetchInterval: 5000,
  });

  const system = systemData || mockSystemMetrics;
  const containers = containersData || mockContainers;
  const dataFeeds = dataFeedsData || mockDataFeeds;
  const logs = logsData || mockLogs;

  const filteredLogs =
    logFilter === 'all' ? logs : logs.filter((l) => l.level === logFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">مانیتورینگ</h1>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Clock size={14} />
          <span>آپتایم: {system.uptime}</span>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-6">منابع سیستم</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="flex flex-col items-center">
            <GaugeChart
              value={system.cpu}
              label="CPU"
              icon={Cpu}
              colorThresholds={{ warning: 70, danger: 90 }}
            />
            <p className="text-[10px] text-text-muted mt-1">{system.cpuCores} هسته | Load: {system.loadAvg}</p>
          </div>
          <div className="flex flex-col items-center">
            <GaugeChart
              value={system.ram}
              label="RAM"
              icon={MemoryStick}
              colorThresholds={{ warning: 75, danger: 90 }}
            />
            <p className="text-[10px] text-text-muted mt-1">{system.ramUsed} / {system.ramTotal}</p>
          </div>
          <div className="flex flex-col items-center">
            <GaugeChart
              value={system.disk}
              label="دیسک"
              icon={HardDrive}
              colorThresholds={{ warning: 80, danger: 95 }}
            />
            <p className="text-[10px] text-text-muted mt-1">{system.diskUsed} / {system.diskTotal}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">کانتینرهای Docker</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>نام</th>
                  <th>وضعیت</th>
                  <th>CPU</th>
                  <th>حافظه</th>
                  <th>آپتایم</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Container size={14} className="text-text-muted shrink-0" />
                        <span className="text-sm font-medium text-text-primary font-mono">
                          {c.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          c.status === 'running' ? 'badge-green' : 'badge-red'
                        }`}
                      >
                        {c.status === 'running' ? 'فعال' : 'متوقف'}
                      </span>
                    </td>
                    <td className="text-xs font-mono text-text-muted">{c.cpu}</td>
                    <td className="text-xs font-mono text-text-muted">{c.memory}</td>
                    <td className="text-xs text-text-muted">{c.uptime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">وضعیت دیتافیدها</h3>
          <div className="space-y-3">
            {dataFeeds.map((feed, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {feed.status === 'connected' ? (
                    <Wifi size={16} className="text-brand-green" />
                  ) : feed.status === 'degraded' ? (
                    <Wifi size={16} className="text-yellow-400" />
                  ) : (
                    <WifiOff size={16} className="text-brand-red" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-text-primary">{feed.name}</p>
                    <p className="text-[10px] text-text-muted">{feed.symbols} نماد | آخرین بروزرسانی: {feed.lastUpdate}</p>
                  </div>
                </div>
                <div className="text-left">
                  <span
                    className={`badge ${
                      feed.status === 'connected'
                        ? 'badge-green'
                        : feed.status === 'degraded'
                        ? 'bg-yellow-500/15 text-yellow-400'
                        : 'badge-red'
                    }`}
                  >
                    {feed.status === 'connected'
                      ? 'متصل'
                      : feed.status === 'degraded'
                      ? 'کند'
                      : 'قطع'}
                  </span>
                  <p className="text-[10px] text-text-muted mt-1 font-mono">{feed.latency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">لاگ‌های اخیر</h3>
          <div className="flex items-center gap-2">
            <select
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="text-xs min-w-[100px]"
            >
              <option value="all">همه</option>
              <option value="info">اطلاعات</option>
              <option value="warning">هشدار</option>
              <option value="error">خطا</option>
            </select>
            <button className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover text-xs transition-colors"
            >
              <span className="text-text-muted font-mono shrink-0 mt-0.5 w-16">
                {log.timestamp}
              </span>
              <span
                className={`shrink-0 mt-0.5 w-12 font-medium ${
                  log.level === 'error'
                    ? 'text-brand-red'
                    : log.level === 'warning'
                    ? 'text-yellow-400'
                    : 'text-brand-green'
                }`}
              >
                {log.level === 'error' ? 'خطا' : log.level === 'warning' ? 'هشدار' : 'اطلاع'}
              </span>
              <span className="text-text-muted font-mono shrink-0 w-24">[{log.service}]</span>
              <span className="text-text-secondary">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
