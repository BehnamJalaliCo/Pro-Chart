import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../store';
import { authAPI } from '../api/client';
import { Eye, EyeOff, Lock, User } from 'lucide-react';

const loginSchema = z.object({
  username: z.string().min(1, 'نام کاربری الزامی است'),
  password: z.string().min(1, 'رمز عبور الزامی است'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (data) => {
    setServerError('');
    try {
      const response = await authAPI.login(data);
      const { access_token, refresh_token, user } = response.data;
      login(access_token, refresh_token, user);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error.response?.status === 401) {
        setServerError('نام کاربری یا رمز عبور اشتباه است');
      } else if (error.response?.status === 403) {
        setServerError('دسترسی شما مسدود شده است');
      } else {
        setServerError('خطا در برقراری ارتباط با سرور');
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-green/20 flex items-center justify-center text-brand-green text-xs font-bold mx-auto mb-4">
            بازارنما
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">پنل مدیریت بازارنما</h1>
          <p className="text-sm text-text-muted">ورود به پنل مدیریت</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
          {serverError && (
            <div className="bg-brand-red/10 border border-brand-red/20 text-brand-red text-sm px-4 py-3 rounded-lg">
              {serverError}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">نام کاربری</label>
            <div className="relative">
              <User
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                {...register('username')}
                type="text"
                placeholder="نام کاربری خود را وارد کنید"
                className="w-full pr-10"
                autoFocus
                autoComplete="username"
              />
            </div>
            {errors.username && (
              <p className="text-xs text-brand-red">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">رمز عبور</label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="رمز عبور خود را وارد کنید"
                className="w-full pr-10 pl-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-brand-red">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>در حال ورود...</span>
              </>
            ) : (
              <span>ورود به پنل</span>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-text-muted mt-6">
          نسخه ۱.۰.۰ | تمامی حقوق محفوظ است
        </p>
      </div>
    </div>
  );
}
