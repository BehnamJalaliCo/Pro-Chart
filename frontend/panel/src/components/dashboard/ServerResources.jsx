import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  Clock,
  ArrowUp,
  ArrowDown,
  Database,
  Server,
  Zap,
} from 'lucide-react';
import { bnAPI } from '../../api/client';
import Gauge from '../common/Gauge';
import Sparkline from '../common/Sparkline';
import AnimatedCounter from '../common/AnimatedCounter';
import LiveDot from '../common/LiveDot';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { SkeletonBox } from '../common/Skeleton';
import { toPersianDigits } from '../../utils/formatters';

const REFETCH_MS = 5000;
const HISTORY_MAX = 30; // ~۲.۵ دقیقه تاریخچه‌ی زنده

/** فرمت ثانیه → «Xروز Yساعت Zدقیقه» فارسی */
function formatUptime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${toPersianDigits(d)} روز`);
  if (h > 0) parts.push(`${toPersianDigits(h)} ساعت`);
  parts.push(`${toPersianDigits(m)} دقیقه`);
  return parts.join(' و ');
}

/** رنگ آستانه‌ای برای درصد‌ها */
function thresholdColor(pct) {
  const v = Number(pct) || 0;
  if (v >= 88) return '#FF1744';
  if (v >= 70) return '#FFB300';
  return '#00C853';
}

/** کارت پایه با ظاهر Grafana/Datadog */
function Panel({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`card p-4 ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-3">
          {Icon && (
            <span className="w-7 h-7 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
              <Icon size={15} />
            </span>
          )}
          <h3 className="text-sm font-semibold text-text-secondary">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

/** کاشی متریک کوچک: برچسب → مقدار → اسپارک‌لاین اختیاری */
function MetricTile({ icon: Icon, label, value, sub, spark, sparkColor = '#2979FF' }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-elevated/60 p-3 flex flex-col gap-1.5 transition-colors duration-200 hover:border-surface-hover">
      <div className="flex items-center gap-1.5 text-text-muted">
        {Icon && <Icon size={13} />}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg font-bold text-text-primary tabular-nums leading-tight">
        {value}
      </div>
      {sub && <div className="text-[11px] text-text-muted tabular-nums">{sub}</div>}
      {Array.isArray(spark) && spark.length > 0 && (
        <Sparkline points={spark} color={sparkColor} height={28} fill strokeWidth={1.5} />
      )}
    </div>
  );
}

/** کاشی گیج (CPU/RAM/Disk) با اسپارک‌لاین تاریخچه */
function GaugeTile({ icon: Icon, title, percent, sub, history }) {
  const color = thresholdColor(percent);
  return (
    <Panel title={title} icon={Icon}>
      <div className="flex flex-col items-center">
        <Gauge percent={Number(percent) || 0} size={108} />
        {sub && (
          <div className="mt-1 text-xs text-text-muted tabular-nums text-center">{sub}</div>
        )}
        {Array.isArray(history) && history.length > 1 && (
          <div className="w-full mt-2">
            <Sparkline points={history} color={color} height={30} fill strokeWidth={1.5} />
          </div>
        )}
      </div>
    </Panel>
  );
}

/** ردیف سلامت سرویس (DB/Redis) */
function ServiceHealth({ icon: Icon, name, up, children }) {
  return (
    <Panel title={name} icon={Icon}>
      <div className="flex items-center gap-2 mb-3">
        <LiveDot active={!!up} color={up ? 'green' : 'red'} size={9} />
        <span
          className={`badge ${up ? 'badge-green' : 'badge-red'} text-xs`}
        >
          {up ? 'متصل' : 'قطع'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </Panel>
  );
}

function StatCell({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-surface-elevated/50 border border-surface-border/60 px-2.5 py-2">
      <div className="text-[11px] text-text-muted mb-0.5">{label}</div>
      <div className="text-sm font-bold text-text-primary tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-text-muted tabular-nums">{sub}</div>}
    </div>
  );
}

function ServerResourcesSkeleton() {
  return (
    <div className="space-y-4" aria-label="در حال بارگذاری منابع سرور" role="status">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4">
            <SkeletonBox className="h-3 w-1/2 mb-4" />
            <SkeletonBox className="h-28 w-28 rounded-full mx-auto" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <SkeletonBox className="h-3 w-1/3 mb-3" />
          <SkeletonBox className="h-20 w-full" />
        </div>
        <div className="card p-4">
          <SkeletonBox className="h-3 w-1/3 mb-3" />
          <SkeletonBox className="h-20 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function ServerResources() {
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['bn', 'server-metrics'],
    queryFn: () => bnAPI.getServerMetrics(),
    refetchInterval: REFETCH_MS,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  // بافر تاریخچه‌ی زنده برای اسپارک‌لاین‌ها (فقط داده‌ی واقعی سرور)
  const [history, setHistory] = useState({ cpu: [], ram: [], disk: [], ops: [] });
  const lastAtRef = useRef(0);

  useEffect(() => {
    if (!data || !dataUpdatedAt || dataUpdatedAt === lastAtRef.current) return;
    lastAtRef.current = dataUpdatedAt;
    const cpuP = Number(data?.cpu?.percent);
    const ramP = Number(data?.memory?.percent);
    const diskP = Number(data?.disk?.percent);
    const ops = Number(data?.redis?.opsPerSec);
    setHistory((prev) => {
      const push = (arr, v) =>
        (Number.isFinite(v) ? [...arr, v] : arr).slice(-HISTORY_MAX);
      return {
        cpu: push(prev.cpu, cpuP),
        ram: push(prev.ram, ramP),
        disk: push(prev.disk, diskP),
        ops: push(prev.ops, ops),
      };
    });
  }, [data, dataUpdatedAt]);

  if (isLoading) return <ServerResourcesSkeleton />;

  if (isError) {
    return (
      <ErrorState
        description="دریافت متریک‌های سرور ناموفق بود. دوباره تلاش کنید."
        onRetry={refetch}
      />
    );
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <EmptyState
        icon={Server}
        title="داده‌ای از سرور در دسترس نیست"
        description="متریک‌های منابع سرور در حال حاضر قابل دریافت نیستند."
      />
    );
  }

  const cpu = data.cpu || {};
  const memory = data.memory || {};
  const disk = data.disk || {};
  const network = data.network || {};
  const redis = data.redis || {};
  const database = data.database || {};
  const load = Array.isArray(cpu.load) ? cpu.load : [];

  return (
    <div className="space-y-4">
      {/* نوار وضعیت */}
      <div className="card px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <LiveDot active color="green" size={9} />
          <span className="text-sm font-semibold text-text-primary">وضعیت سیستم: عملیاتی</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Clock size={14} className="text-text-muted" />
          <span>آپ‌تایم:</span>
          <span className="tabular-nums text-text-primary">{formatUptime(data.uptimeSec)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-muted mr-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-soft-pulse" />
          به‌روزرسانی هر {toPersianDigits(REFETCH_MS / 1000)} ثانیه
        </div>
      </div>

      {/* گیج‌های اصلی */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GaugeTile
          icon={Cpu}
          title="پردازنده"
          percent={cpu.percent}
          history={history.cpu}
          sub={
            Number(cpu.cores) > 0
              ? `${toPersianDigits(cpu.cores)} هسته`
              : undefined
          }
        />
        <GaugeTile
          icon={MemoryStick}
          title="حافظه (RAM)"
          percent={memory.percent}
          history={history.ram}
          sub={
            Number(memory.totalGb) > 0
              ? `${toPersianDigits(Number(memory.usedGb || 0).toFixed(1))} / ${toPersianDigits(
                  Number(memory.totalGb).toFixed(0)
                )} گیگ`
              : undefined
          }
        />
        <GaugeTile
          icon={HardDrive}
          title="دیسک"
          percent={disk.percent}
          history={history.disk}
          sub={
            Number(disk.totalGb) > 0
              ? `${toPersianDigits(Number(disk.usedGb || 0).toFixed(1))} / ${toPersianDigits(
                  Number(disk.totalGb).toFixed(0)
                )} گیگ`
              : undefined
          }
        />

        {/* بار پردازنده + شبکه */}
        <Panel title="بار سیستم و شبکه" icon={Activity}>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-text-muted mb-1.5">میانگین بار (Load Average)</div>
              <div className="grid grid-cols-3 gap-2">
                {['۱ دقیقه', '۵ دقیقه', '۱۵ دقیقه'].map((lbl, i) => (
                  <div
                    key={lbl}
                    className="rounded-lg bg-surface-elevated/60 border border-surface-border/60 px-2 py-1.5 text-center"
                  >
                    <div className="text-sm font-bold text-text-primary tabular-nums">
                      {load[i] !== undefined && load[i] !== null
                        ? toPersianDigits(Number(load[i]).toFixed(2))
                        : '—'}
                    </div>
                    <div className="text-[10px] text-text-muted">{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MetricTile
                icon={ArrowDown}
                label="دریافت شبکه"
                value={
                  <span>
                    <AnimatedCounter value={Number(network.recvGb) || 0} decimals={2} />
                    <span className="text-xs text-text-muted mr-1">گیگ</span>
                  </span>
                }
                sparkColor="#00C853"
              />
              <MetricTile
                icon={ArrowUp}
                label="ارسال شبکه"
                value={
                  <span>
                    <AnimatedCounter value={Number(network.sentGb) || 0} decimals={2} />
                    <span className="text-xs text-text-muted mr-1">گیگ</span>
                  </span>
                }
                sparkColor="#2979FF"
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* سرویس‌ها: Redis + Database */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ServiceHealth icon={Zap} name="Redis" up={redis.up}>
          <StatCell
            label="حافظه مصرفی"
            value={`${toPersianDigits(Number(redis.usedMemoryMb || 0).toFixed(1))} م‌ب`}
          />
          <StatCell label="کلاینت‌ها" value={toPersianDigits(Number(redis.clients) || 0)} />
          <StatCell
            label="عملیات بر ثانیه"
            value={toPersianDigits(Number(redis.opsPerSec) || 0)}
          />
          <StatCell
            label="Hit / Miss"
            value={`${toPersianDigits(Number(redis.hits) || 0)} / ${toPersianDigits(
              Number(redis.misses) || 0
            )}`}
          />
          {history.ops.length > 1 && (
            <div className="col-span-2 mt-0.5">
              <div className="text-[11px] text-text-muted mb-1">روند عملیات بر ثانیه</div>
              <Sparkline points={history.ops} color="#2979FF" height={32} fill strokeWidth={1.5} />
            </div>
          )}
        </ServiceHealth>

        <ServiceHealth icon={Database} name="پایگاه داده (PostgreSQL)" up={database.up}>
          <StatCell
            label="حجم پایگاه داده"
            value={`${toPersianDigits(Number(database.sizeMb || 0).toFixed(1))} م‌ب`}
          />
          <StatCell
            label="اتصالات فعال"
            value={toPersianDigits(Number(database.connections) || 0)}
          />
        </ServiceHealth>
      </div>
    </div>
  );
}
