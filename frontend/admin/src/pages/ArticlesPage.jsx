import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { articlesAPI } from '../api/client';
import { useNotificationStore } from '../store';
import {
  Plus,
  Edit3,
  Trash2,
  X,
  FileText,
  Eye,
  Calendar,
  Tag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const mockArticles = [
  {
    id: 1,
    title: 'آموزش تحلیل تکنیکال پیشرفته',
    category: 'آموزش',
    status: 'published',
    views: 1250,
    createdAt: '۱۴۰۴/۱۱/۰۵',
    content: 'در این مقاله به بررسی الگوهای پیشرفته تحلیل تکنیکال می‌پردازیم...',
  },
  {
    id: 2,
    title: 'مدیریت ریسک در فارکس',
    category: 'مدیریت سرمایه',
    status: 'published',
    views: 890,
    createdAt: '۱۴۰۴/۱۱/۰۳',
    content: 'مدیریت ریسک یکی از مهمترین عوامل موفقیت در بازار فارکس است...',
  },
  {
    id: 3,
    title: 'استراتژی اسکالپ با RSI',
    category: 'استراتژی',
    status: 'draft',
    views: 0,
    createdAt: '۱۴۰۴/۱۱/۰۷',
    content: 'در این مقاله یک استراتژی اسکالپ کاربردی با استفاده از اندیکاتور RSI...',
  },
  {
    id: 4,
    title: 'تحلیل هفتگی بازار فارکس',
    category: 'تحلیل',
    status: 'published',
    views: 2100,
    createdAt: '۱۴۰۴/۱۱/۰۸',
    content: 'بررسی جامع رویدادهای اقتصادی هفته آینده و تاثیر آن بر جفت ارزها...',
  },
  {
    id: 5,
    title: 'معرفی الگوی هارمونیک',
    category: 'آموزش',
    status: 'published',
    views: 670,
    createdAt: '۱۴۰۴/۱۰/۲۸',
    content: 'الگوهای هارمونیک یکی از ابزارهای قدرتمند تحلیل تکنیکال هستند...',
  },
];

const articleSchema = z.object({
  title: z.string().min(1, 'عنوان الزامی است').max(200, 'عنوان بیش از حد طولانی است'),
  category: z.string().min(1, 'دسته‌بندی الزامی است'),
  content: z.string().min(10, 'محتوا باید حداقل ۱۰ کاراکتر باشد'),
  status: z.enum(['draft', 'published']),
});

const categories = ['آموزش', 'استراتژی', 'تحلیل', 'مدیریت سرمایه', 'اخبار', 'عمومی'];

export default function ArticlesPage() {
  const queryClient = useQueryClient();
  const notify = useNotificationStore();
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [page, setPage] = useState(1);

  const { data: articlesData } = useQuery({
    queryKey: ['articles', page],
    queryFn: () => articlesAPI.getAll({ page, limit: 20 }).then((r) => r.data),
    placeholderData: { items: mockArticles, total: 5, pages: 1 },
  });

  const createMutation = useMutation({
    mutationFn: (data) => articlesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      notify.success('مقاله با موفقیت ایجاد شد');
      setShowForm(false);
    },
    onError: () => notify.error('خطا در ایجاد مقاله'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => articlesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      notify.success('مقاله با موفقیت بروزرسانی شد');
      setShowForm(false);
      setEditingArticle(null);
    },
    onError: () => notify.error('خطا در بروزرسانی مقاله'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => articlesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      notify.success('مقاله با موفقیت حذف شد');
      setDeleteConfirm(null);
    },
    onError: () => notify.error('خطا در حذف مقاله'),
  });

  const articles = articlesData?.items || mockArticles;
  const totalPages = articlesData?.pages || 1;

  const handleEdit = (article) => {
    setEditingArticle(article);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingArticle(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">مدیریت مقالات</h1>
        <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          <span>مقاله جدید</span>
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>عنوان</th>
                <th>دسته‌بندی</th>
                <th>وضعیت</th>
                <th>بازدید</th>
                <th>تاریخ</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <FileText size={16} className="text-text-muted shrink-0" />
                      <span className="text-sm font-medium text-text-primary max-w-[300px] truncate">
                        {article.title}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-blue gap-1">
                      <Tag size={10} />
                      {article.category}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        article.status === 'published' ? 'badge-green' : 'bg-surface-elevated text-text-muted'
                      }`}
                    >
                      {article.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <Eye size={13} />
                      <span className="text-xs">{article.views.toLocaleString('fa-IR')}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <Calendar size={12} />
                      <span className="text-xs">{article.createdAt}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(article)}
                        className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-brand-blue transition-colors"
                        title="ویرایش"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(article)}
                        className="p-1.5 rounded-md hover:bg-brand-red/10 text-text-muted hover:text-brand-red transition-colors"
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {showForm && (
        <ArticleFormModal
          article={editingArticle}
          onClose={() => {
            setShowForm(false);
            setEditingArticle(null);
          }}
          onSubmit={(data) => {
            if (editingArticle) {
              updateMutation.mutate({ id: editingArticle.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-3">حذف مقاله</h3>
            <p className="text-sm text-text-secondary mb-5">
              آیا از حذف مقاله "{deleteConfirm.title}" اطمینان دارید؟ این عمل غیرقابل بازگشت است.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="btn-danger flex-1"
              >
                {deleteMutation.isPending ? 'در حال حذف...' : 'حذف'}
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-ghost flex-1">
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ArticleFormModal({ article, onClose, onSubmit, isLoading }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(articleSchema),
    defaultValues: article
      ? {
          title: article.title,
          category: article.category,
          content: article.content,
          status: article.status,
        }
      : {
          title: '',
          category: '',
          content: '',
          status: 'draft',
        },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">
            {article ? 'ویرایش مقاله' : 'مقاله جدید'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">عنوان</label>
            <input
              {...register('title')}
              placeholder="عنوان مقاله"
              className="w-full text-sm"
            />
            {errors.title && (
              <p className="text-[10px] text-brand-red">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">دسته‌بندی</label>
              <select {...register('category')} className="w-full text-sm">
                <option value="">انتخاب کنید</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-[10px] text-brand-red">{errors.category.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">وضعیت</label>
              <select {...register('status')} className="w-full text-sm">
                <option value="draft">پیش‌نویس</option>
                <option value="published">منتشر شده</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">محتوا</label>
            <textarea
              {...register('content')}
              rows={10}
              placeholder="محتوای مقاله را وارد کنید..."
              className="w-full text-sm resize-none leading-7"
            />
            {errors.content && (
              <p className="text-[10px] text-brand-red">{errors.content.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>{article ? 'بروزرسانی' : 'ایجاد مقاله'}</span>
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
