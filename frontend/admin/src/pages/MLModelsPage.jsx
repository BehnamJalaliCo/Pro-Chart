import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { mlAPI } from '../api/client';
import { useNotificationStore } from '../store';
import { Brain, RefreshCw, Activity, Target, Crosshair, Zap } from 'lucide-react';

const mockModels = [
  {
    id: 'lstm_v3',
    name: 'LSTM v3',
    type: 'Deep Learning',
    accuracy: 78.5,
    precision: 76.2,
    recall: 81.3,
    f1Score: 78.7,
    status: 'active',
    lastTrained: '۱۴۰۴/۱۱/۰۵ ۱۴:۳۰',
    trainingDuration: '۴۵ دقیقه',
    dataPoints: 125000,
  },
  {
    id: 'xgboost_v2',
    name: 'XGBoost v2',
    type: 'Gradient Boosting',
    accuracy: 75.8,
    precision: 74.1,
    recall: 77.5,
    f1Score: 75.8,
    status: 'active',
    lastTrained: '۱۴۰۴/۱۱/۰۶ ۰۸:۱۵',
    trainingDuration: '۱۲ دقیقه',
    dataPoints: 125000,
  },
  {
    id: 'random_forest_v2',
    name: 'Random Forest v2',
    type: 'Ensemble',
    accuracy: 73.2,
    precision: 72.5,
    recall: 74.8,
    f1Score: 73.6,
    status: 'active',
    lastTrained: '۱۴۰۴/۱۱/۰۶ ۰۸:۲۰',
    trainingDuration: '۸ دقیقه',
    dataPoints: 125000,
  },
  {
    id: 'transformer_v1',
    name: 'Transformer v1',
    type: 'Attention',
    accuracy: 80.1,
    precision: 79.3,
    recall: 82.0,
    f1Score: 80.6,
    status: 'training',
    lastTrained: '۱۴۰۴/۱۱/۰۴ ۲۰:۰۰',
    trainingDuration: '۲ ساعت',
    dataPoints: 125000,
  },
];

const mockFeatureImportance = [
  { name: 'RSI', importance: 0.18 },
  { name: 'MACD', importance: 0.15 },
  { name: 'EMA_Cross', importance: 0.14 },
  { name: 'Volume', importance: 0.12 },
  { name: 'ATR', importance: 0.1 },
  { name: 'Bollinger', importance: 0.09 },
  { name: 'Stochastic', importance: 0.08 },
  { name: 'ADX', importance: 0.07 },
  { name: 'Ichimoku', importance: 0.04 },
  { name: 'Pivot', importance: 0.03 },
];

const mockEnsembleWeights = [
  { model: 'LSTM v3', weight: 0.35 },
  { model: 'Transformer v1', weight: 0.3 },
  { model: 'XGBoost v2', weight: 0.2 },
  { model: 'Random Forest v2', weight: 0.15 },
];

function ModelCard({ model, onRetrain, isRetraining }) {
  const statusMap = {
    active: { text: 'فعال', class: 'badge-green' },
    training: { text: 'در حال آموزش', class: 'badge-blue' },
    error: { text: 'خطا', class: 'badge-red' },
    inactive: { text: 'غیرفعال', class: 'bg-surface-elevated text-text-muted' },
  };

  const st = statusMap[model.status] || statusMap.inactive;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-blue/15 flex items-center justify-center text-brand-blue">
            <Brain size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">{model.name}</h3>
            <p className="text-[11px] text-text-muted">{model.type}</p>
          </div>
        </div>
        <span className={`badge ${st.class}`}>{st.text}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricBox icon={Target} label="دقت" value={`${model.accuracy}٪`} color="blue" />
        <MetricBox icon={Crosshair} label="Precision" value={`${model.precision}٪`} color="green" />
        <MetricBox icon={Activity} label="Recall" value={`${model.recall}٪`} color="green" />
        <MetricBox icon={Zap} label="F1 Score" value={`${model.f1Score}٪`} color="blue" />
      </div>

      <div className="space-y-2 text-xs text-text-muted mb-4">
        <div className="flex justify-between">
          <span>آخرین آموزش:</span>
          <span className="text-text-secondary">{model.lastTrained}</span>
        </div>
        <div className="flex justify-between">
          <span>مدت آموزش:</span>
          <span className="text-text-secondary">{model.trainingDuration}</span>
        </div>
        <div className="flex justify-between">
          <span>تعداد داده:</span>
          <span className="text-text-secondary">{model.dataPoints.toLocaleString('fa-IR')}</span>
        </div>
      </div>

      <button
        onClick={() => onRetrain(model.id)}
        disabled={model.status === 'training' || isRetraining}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
      >
        {model.status === 'training' || isRetraining ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            <span>در حال آموزش...</span>
          </>
        ) : (
          <>
            <RefreshCw size={14} />
            <span>آموزش مجدد</span>
          </>
        )}
      </button>
    </div>
  );
}

function MetricBox({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-surface-elevated rounded-lg px-3 py-2.5 flex items-center gap-2.5">
      <Icon
        size={14}
        className={color === 'blue' ? 'text-brand-blue' : 'text-brand-green'}
      />
      <div>
        <p className="text-[10px] text-text-muted">{label}</p>
        <p className="text-sm font-bold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {typeof entry.value === 'number' ? (entry.value * 100).toFixed(1) + '٪' : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function MLModelsPage() {
  const queryClient = useQueryClient();
  const notify = useNotificationStore();
  const [selectedModel, setSelectedModel] = useState('lstm_v3');

  const { data: modelsData } = useQuery({
    queryKey: ['ml-models'],
    queryFn: () => mlAPI.getModels().then((r) => r.data),
    placeholderData: mockModels,
  });

  const { data: featureData } = useQuery({
    queryKey: ['ml-features', selectedModel],
    queryFn: () => mlAPI.getFeatureImportance(selectedModel).then((r) => r.data),
    placeholderData: mockFeatureImportance,
  });

  const { data: ensembleData } = useQuery({
    queryKey: ['ml-ensemble'],
    queryFn: () => mlAPI.getEnsembleWeights().then((r) => r.data),
    placeholderData: mockEnsembleWeights,
  });

  const retrainMutation = useMutation({
    mutationFn: (modelId) => mlAPI.retrain(modelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ml-models'] });
      notify.success('آموزش مجدد مدل شروع شد');
    },
    onError: () => notify.error('خطا در شروع آموزش مجدد'),
  });

  const models = modelsData || mockModels;
  const features = featureData || mockFeatureImportance;
  const ensemble = ensembleData || mockEnsembleWeights;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-text-primary">مدل‌های یادگیری ماشین</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            onRetrain={(id) => retrainMutation.mutate(id)}
            isRetraining={retrainMutation.isPending}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">اهمیت ویژگی‌ها</h3>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-xs min-w-[120px]"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={features} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 0.25]}
                tick={{ fill: '#636882', fontSize: 10 }}
                axisLine={{ stroke: '#2a2e3d' }}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}٪`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#9499ae', fontSize: 11 }}
                axisLine={{ stroke: '#2a2e3d' }}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="importance" fill="#2979FF" name="اهمیت" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">وزن‌های Ensemble</h3>
          <p className="text-xs text-text-muted mb-6">
            وزن هر مدل در تصمیم‌گیری نهایی سیستم ترکیبی
          </p>

          <div className="space-y-5">
            {ensemble.map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{item.model}</span>
                  <span className="text-sm font-bold text-brand-blue">
                    {(item.weight * 100).toFixed(0)}٪
                  </span>
                </div>
                <div className="w-full h-3 bg-surface-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.weight * 100}%`,
                      background: `linear-gradient(90deg, #2979FF, ${
                        item.weight > 0.25 ? '#00C853' : '#2979FF'
                      })`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-3 bg-surface-elevated rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={14} className="text-brand-blue" />
              <span className="text-xs font-medium text-text-primary">روش ترکیب: Weighted Average</span>
            </div>
            <p className="text-[11px] text-text-muted leading-5">
              سیگنال نهایی از میانگین وزن‌دار خروجی تمام مدل‌های فعال تولید می‌شود. مدل‌های با عملکرد بهتر وزن بیشتری دریافت می‌کنند.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
