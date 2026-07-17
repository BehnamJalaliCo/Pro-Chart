import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Trash2, Power } from 'lucide-react';
import { api } from '../api/client';
import { PageHeader, Empty, Spinner, Modal, useToast } from '../components/ui';
import { useAuth } from '../store';

export default function Forms() {
  const { account } = useAuth();
  const qc = useQueryClient();
  const [show, node] = useToast();
  const [open, setOpen] = useState(false);
  const aid = account?.id;
  const { data, isLoading } = useQuery({ queryKey: ['ig-forms', aid], queryFn: () => api.forms(aid), enabled: !!aid });
  const [f, setF] = useState({ title: '', start_trigger: '', questions: '', end_message: '' });

  const create = async () => {
    try {
      await api.createForm({ account_id: aid, title: f.title, start_trigger: f.start_trigger,
        questions: f.questions.split('\n').map((q) => q.trim()).filter(Boolean), end_message: f.end_message, enabled: true });
      show('فرم ساخته شد ✓'); setOpen(false); setF({ title: '', start_trigger: '', questions: '', end_message: '' });
      qc.invalidateQueries({ queryKey: ['ig-forms', aid] });
    } catch (e) { show(e.message, 'err'); }
  };
  if (!aid) return <Empty icon={ClipboardList} title="ابتدا یک اکانت انتخاب کنید" />;
  return (
    <div>
      {node}
      <PageHeader title="فرم‌ساز" sub={`فرم‌های گفتگوییِ @${account.username}`} icon={ClipboardList}
        action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={17} /> فرم جدید</button>} />
      {isLoading ? <Spinner /> : (data?.length ? (
        <div className="space-y-3">
          {data.map((x) => (
            <div key={x.id} className="card p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-black text-ink">{x.title}</div>
                <div className="text-xs text-ink-muted mt-0.5">شروع با: «{x.start_trigger}» · {(x.questions || []).length} سؤال</div>
              </div>
              <button onClick={() => api.toggleForm(x.id).then(() => qc.invalidateQueries({ queryKey: ['ig-forms', aid] }))} className={`btn text-xs ${x.enabled ? 'btn-soft' : 'btn-ghost'}`}><Power size={14} />{x.enabled ? 'فعال' : 'غیرفعال'}</button>
              <button onClick={() => confirm('حذف؟') && api.deleteForm(x.id).then(() => qc.invalidateQueries({ queryKey: ['ig-forms', aid] }))} className="btn-ghost px-2.5 text-accent-red"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      ) : <Empty icon={ClipboardList} title="هنوز فرمی ندارید" action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={17} /> فرم جدید</button>} />)}
      <Modal open={open} onClose={() => setOpen(false)} title="فرم گفتگویی">
        <div className="space-y-3">
          <div><label className="label">عنوان</label><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><label className="label">کلیدواژهٔ شروع</label><input className="input" value={f.start_trigger} onChange={(e) => setF({ ...f, start_trigger: e.target.value })} placeholder="مثلاً: ثبت‌نام" /></div>
          <div><label className="label">سؤالات (هر خط یک سؤال)</label><textarea className="input min-h-[110px]" value={f.questions} onChange={(e) => setF({ ...f, questions: e.target.value })} placeholder={'نام شما؟\nشماره تماس؟'} /></div>
          <div><label className="label">پیامِ پایان</label><input className="input" value={f.end_message} onChange={(e) => setF({ ...f, end_message: e.target.value })} placeholder="ممنون! به‌زودی تماس می‌گیریم." /></div>
          <button className="btn-primary w-full py-3" disabled={!f.title || !f.start_trigger} onClick={create}>ساختِ فرم</button>
        </div>
      </Modal>
    </div>
  );
}
