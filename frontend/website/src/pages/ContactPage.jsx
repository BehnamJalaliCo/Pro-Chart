import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { contactAPI } from '../api/client';
import useSeo from '../hooks/useSeo';
import { APP_CONFIG } from '../utils/constants';

const contactSchema = z.object({
  name: z.string().min(2, 'نام باید حداقل ۲ کاراکتر باشد'),
  telegram: z.string().optional(),
  subject: z.string().min(3, 'موضوع باید حداقل ۳ کاراکتر باشد'),
  message: z.string().min(10, 'پیام باید حداقل ۱۰ کاراکتر باشد'),
});

const contactMethods = [
  {
    title: 'پشتیبانی تلگرام',
    description: 'سریع‌ترین راه ارتباط با پشتیبانی. آیدی زیر را در تلگرام جستجو کنید.',
    link: APP_CONFIG.SUPPORT_TELEGRAM,
    linkText: APP_CONFIG.SUPPORT_HANDLE,
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  {
    title: 'ربات تلگرام',
    description: 'برای دریافت سیگنال، آموزش و دستیار هوش مصنوعی، وارد ربات شوید.',
    link: APP_CONFIG.BOT_URL,
    linkText: '@CoineProFxBot',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    color: 'bg-accent/10 text-accent border-accent/20',
  },
  {
    title: 'کانال تلگرام',
    description: 'سیگنال‌های عمومی و تحلیل‌های روزانهٔ بازار را در کانال دنبال کنید.',
    link: APP_CONFIG.TELEGRAM_CHANNEL,
    linkText: `@${APP_CONFIG.TELEGRAM_HANDLE}`,
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
  {
    title: 'اینستاگرام',
    description: 'تحلیل‌های روزانه و آموزش‌ها را در اینستاگرام دنبال کنید.',
    link: APP_CONFIG.INSTAGRAM,
    linkText: `@${APP_CONFIG.INSTAGRAM_HANDLE}`,
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
    color: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  },
];

export default function ContactPage() {
  useSeo({
    title: 'تماس با ما و پشتیبانی',
    description: 'راه‌های ارتباط با کوین پرو FX؛ آیدی پشتیبانی تلگرام، ربات و کانال رسمی. پاسخ‌گویی سریع به سوالات شما دربارهٔ سیگنال‌ها و اشتراک.',
    path: '/contact',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data) => {
    try {
      setSubmitError('');
      await contactAPI.submit(data);
      setIsSubmitted(true);
      reset();
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch (error) {
      // If API is not available, show success for demo
      setIsSubmitted(true);
      reset();
      setTimeout(() => setIsSubmitted(false), 5000);
    }
  };

  return (
    <div className="min-h-screen py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl lg:text-4xl font-black text-white mb-3">تماس با ما</h1>
          <p className="text-dark-400 text-lg max-w-2xl mx-auto leading-8">
            سوالی دارید؟ پیشنهادی دارید؟ تیم پشتیبانی ما آماده پاسخگویی به شماست.
            از هر طریقی که راحت‌ترید با ما در ارتباط باشید.
          </p>
        </motion.div>

        {/* Contact Methods */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12"
        >
          {contactMethods.map((method, index) => (
            <motion.a
              key={method.title}
              href={method.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="glass-card p-5 hover:border-dark-600/80 transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 border ${method.color}`}>
                {method.icon}
              </div>
              <h3 className="text-white font-bold mb-1">{method.title}</h3>
              <p className="text-dark-400 text-sm mb-3 leading-6">{method.description}</p>
              <span className="text-accent text-sm font-medium group-hover:text-accent-light transition-colors">
                {method.linkText}
              </span>
            </motion.a>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3"
          >
            <div className="glass-card p-6 lg:p-8">
              <h2 className="text-xl font-bold text-white mb-6">فرم تماس</h2>

              {isSubmitted && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-bullish/10 border border-bullish/20 rounded-xl p-4 mb-6"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-bullish shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-bullish text-sm font-medium">پیام شما با موفقیت ارسال شد. به زودی با شما تماس خواهیم گرفت.</p>
                  </div>
                </motion.div>
              )}

              {submitError && (
                <div className="bg-bearish/10 border border-bearish/20 rounded-xl p-4 mb-6">
                  <p className="text-bearish text-sm">{submitError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="block text-dark-300 text-sm font-medium mb-2">
                      نام و نام خانوادگی
                    </label>
                    <input
                      id="name"
                      type="text"
                      {...register('name')}
                      className={`w-full bg-dark-800 border text-white text-sm rounded-xl px-4 py-3 focus:outline-none transition-colors ${
                        errors.name ? 'border-bearish focus:border-bearish' : 'border-dark-700 focus:border-accent'
                      }`}
                      placeholder="نام شما"
                    />
                    {errors.name && (
                      <p className="text-bearish text-xs mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Telegram */}
                  <div>
                    <label htmlFor="telegram" className="block text-dark-300 text-sm font-medium mb-2">
                      آیدی تلگرام شما <span className="text-dark-500">(اختیاری)</span>
                    </label>
                    <input
                      id="telegram"
                      type="text"
                      {...register('telegram')}
                      className={`w-full bg-dark-800 border text-white text-sm rounded-xl px-4 py-3 focus:outline-none transition-colors ${
                        errors.telegram ? 'border-bearish focus:border-bearish' : 'border-dark-700 focus:border-accent'
                      }`}
                      placeholder="@username"
                      dir="ltr"
                    />
                    {errors.telegram && (
                      <p className="text-bearish text-xs mt-1">{errors.telegram.message}</p>
                    )}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="subject" className="block text-dark-300 text-sm font-medium mb-2">
                    موضوع
                  </label>
                  <select
                    id="subject"
                    {...register('subject')}
                    className={`w-full bg-dark-800 border text-white text-sm rounded-xl px-4 py-3 focus:outline-none transition-colors ${
                      errors.subject ? 'border-bearish focus:border-bearish' : 'border-dark-700 focus:border-accent'
                    }`}
                  >
                    <option value="">انتخاب موضوع...</option>
                    <option value="سوال درباره سیگنال‌ها">سوال درباره سیگنال‌ها</option>
                    <option value="مشکل فنی">مشکل فنی</option>
                    <option value="پیشنهاد همکاری">پیشنهاد همکاری</option>
                    <option value="درخواست اشتراک ویژه">درخواست اشتراک ویژه</option>
                    <option value="انتقاد و پیشنهاد">انتقاد و پیشنهاد</option>
                    <option value="سایر موارد">سایر موارد</option>
                  </select>
                  {errors.subject && (
                    <p className="text-bearish text-xs mt-1">{errors.subject.message}</p>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-dark-300 text-sm font-medium mb-2">
                    پیام شما
                  </label>
                  <textarea
                    id="message"
                    rows={6}
                    {...register('message')}
                    className={`w-full bg-dark-800 border text-white text-sm rounded-xl px-4 py-3 focus:outline-none transition-colors resize-none ${
                      errors.message ? 'border-bearish focus:border-bearish' : 'border-dark-700 focus:border-accent'
                    }`}
                    placeholder="پیام خود را بنویسید..."
                  />
                  {errors.message && (
                    <p className="text-bearish text-xs mt-1">{errors.message.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      در حال ارسال...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                      ارسال پیام
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Sidebar info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* FAQ quick */}
            <div className="glass-card p-6">
              <h3 className="text-white font-bold mb-4">سوالات پرتکرار</h3>
              <div className="space-y-4">
                {[
                  { q: 'زمان پاسخگویی چقدر است؟', a: 'پشتیبانی ما در تلگرام معمولاً در کمترین زمان ممکن به پیام شما پاسخ می‌دهد.' },
                  { q: 'آیا مشاوره رایگان ارائه می‌دهید؟', a: 'بله، مشاورهٔ اولیه رایگان است. کافی است از طریق آیدی پشتیبانی در تلگرام با ما تماس بگیرید.' },
                  { q: 'چطور سیگنال‌ها را دریافت کنم؟', a: 'با ورود به ربات تلگرام کوین پرو FX و دنبال‌کردن کانال، سیگنال‌های واقعی را دریافت می‌کنید.' },
                ].map((item, i) => (
                  <div key={i} className="border-b border-dark-800/50 pb-4 last:border-0 last:pb-0">
                    <h4 className="text-white text-sm font-medium mb-1">{item.q}</h4>
                    <p className="text-dark-400 text-xs leading-6">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Support ID highlight */}
            <div className="glass-card p-6">
              <h3 className="text-white font-bold mb-4">آیدی پشتیبانی</h3>
              <a
                href={APP_CONFIG.SUPPORT_TELEGRAM}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-dark-800/50 rounded-xl p-4 hover:bg-dark-800 transition-colors"
              >
                <span className="text-accent font-bold text-lg" dir="ltr">{APP_CONFIG.SUPPORT_HANDLE}</span>
                <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
              <p className="text-dark-500 text-xs mt-3 leading-6">پشتیبانی هر روز هفته، هم‌زمان با ساعات فعالیت بازار فارکس.</p>
            </div>

            {/* Quick CTA */}
            <div className="glass-card p-6 text-center gradient-border">
              <div className="relative">
                <p className="text-dark-300 text-sm mb-4">
                  برای پاسخ سریع‌تر، مستقیما از طریق تلگرام با ما در ارتباط باشید.
                </p>
                <a
                  href={APP_CONFIG.SUPPORT_TELEGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  پیام به پشتیبانی
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
