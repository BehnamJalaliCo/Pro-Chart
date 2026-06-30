import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * NotFoundPage - صفحه ۴۰۴ با انیمیشن و متن فارسی
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-lg w-full text-center">
        {/* انیمیشن تصویری ۴۰۴ */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative mb-8"
        >
          {/* پس‌زمینه دایره‌ای */}
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-64 h-64 rounded-full bg-accent/5 blur-2xl" />
          </motion.div>

          {/* عدد ۴۰۴ */}
          <div className="relative flex items-center justify-center gap-4">
            <motion.span
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-8xl sm:text-9xl font-black text-dark-800"
            >
              4
            </motion.span>

            {/* آیکون وسط - نماد نمودار شکسته */}
            <motion.div
              animate={{
                y: [0, -12, 0],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-dark-900 border border-dark-700/50 flex items-center justify-center">
                <svg
                  className="w-10 h-10 sm:w-12 sm:h-12 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2 16l4-4 3 3 4-6 3 3 4-6"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18 4l2 2-2 2"
                    className="text-bearish"
                    stroke="#FF1744"
                  />
                </svg>
                {/* نقطه چشمک‌زن */}
                <motion.div
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'steps(2)',
                  }}
                  className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-bearish"
                />
              </div>
            </motion.div>

            <motion.span
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-8xl sm:text-9xl font-black text-dark-800"
            >
              4
            </motion.span>
          </div>

          {/* خطوط تزئینی شبیه نمودار */}
          <motion.svg
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.2 }}
            transition={{ duration: 2, delay: 0.6 }}
            className="absolute bottom-0 left-0 right-0 h-16 w-full"
            viewBox="0 0 400 60"
            fill="none"
            preserveAspectRatio="none"
          >
            <motion.path
              d="M0 50 Q50 30, 100 40 T200 25 T300 35 T400 15"
              stroke="#2979FF"
              strokeWidth="1.5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: 0.8 }}
            />
            <motion.path
              d="M0 55 Q80 45, 150 50 T250 40 T350 45 T400 30"
              stroke="#FF1744"
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray="4 4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: 1 }}
            />
          </motion.svg>
        </motion.div>

        {/* متن فارسی */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-4">
            صفحه مورد نظر یافت نشد
          </h1>
          <p className="text-dark-400 text-base leading-7 mb-8 max-w-sm mx-auto">
            صفحه‌ای که به دنبال آن هستید وجود ندارد یا به آدرس دیگری منتقل شده است.
          </p>
        </motion.div>

        {/* دکمه‌ها */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            to="/"
            className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
            بازگشت به صفحه اصلی
          </Link>
          <Link
            to="/signals"
            className="btn-outline flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
            مشاهده سیگنال‌ها
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
