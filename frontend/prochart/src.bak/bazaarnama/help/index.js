// بازارنما — ایندکسِ راهنمای «؟»: همهٔ دسته‌ها را در یک lookup ادغام می‌کند.
import annotations from './annotations.js';
import channels from './channels.js';
import charttypes from './charttypes.js';
import elliott from './elliott.js';
import fib from './fib.js';
import gann from './gann.js';
import ind_momentum from './ind_momentum.js';
import ind_trend from './ind_trend.js';
import ind_volatility from './ind_volatility.js';
import ind_volume from './ind_volume.js';
import lines from './lines.js';
import namascript from './namascript.js';
import patterns from './patterns.js';
import projection from './projection.js';
import shapes from './shapes.js';
import workflow from './workflow.js';

const HELP = {
  ...lines, ...channels, ...fib, ...gann, ...patterns, ...elliott, ...shapes,
  ...annotations, ...projection, ...ind_trend, ...ind_momentum, ...ind_volume,
  ...ind_volatility, ...charttypes, ...workflow, ...namascript,
};

// نگاشتِ نام‌های مترادف/کلیدهای جایگزین → idِ راهنما (برای پوششِ بیشتر)
const ALIAS = { cursor: 'trend', select: 'trend' };

export function getHelp(id) {
  if (!id) return null;
  return HELP[id] || HELP[ALIAS[id]] || null;
}
export function hasHelp(id) { return !!getHelp(id); }
export default HELP;
