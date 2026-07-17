import React from 'react';
import * as Lucide from 'lucide-react';

// ── یکدست‌سازیِ آیکون‌ها (فاز ۴) ───────────────────────────────────────────────
// دو سیستمِ ناهماهنگ داشتیم: lucide (استروکِ ۲px گرد، گریدِ ۲۴×۲۴) و ۲۳ آیکونِ
// TradingView (۱px توپر، ۲۸×۲۸). به‌جای بازکشیدنِ ۶۰ آیکونِ lucide، آن‌ها را با یک
// wrapper به سبکِ اسپک هم‌تراز می‌کنیم — یک نقطهٔ کنترل:
//   strokeWidth 1.5 (نه ۲) · butt cap (نه round) · نگه‌داشتنِ viewBoxِ ۲۴ اما با
//   وزنِ مویی‌ترِ نزدیک به آیکون‌های توپرِ TV.
// `export *`ِ کنترل‌نشده حذف شد؛ حالا فقط آیکون‌های عملاً استفاده‌شده export می‌شوند.
const LUCIDE_STYLE = { strokeWidth: 1.5, absoluteStrokeWidth: true };
const tuneLucide = (Comp) => {
  const Tuned = ({ strokeWidth, ...props }) => React.createElement(Comp, {
    ...LUCIDE_STYLE,
    ...(strokeWidth != null ? { strokeWidth } : {}),
    ...props,
  });
  Tuned.displayName = `tv(${Comp.displayName || Comp.name || 'icon'})`;
  return Tuned;
};

// آیکون‌های lucideِ استفاده‌شده در اپ — هماهنگ‌شده با سبکِ اسپک.
const _LUCIDE_NAMES = ["Activity", "AlertTriangle", "AlignLeft", "AreaChart", "ArrowUpDown", "Award", "BarChart3", "BellOff", "BrainCircuit", "Briefcase", "CandlestickChart", "Check", "ChevronDown", "ChevronLeft", "ChevronRight", "ChevronUp", "Clock", "Coins", "Columns3", "Copy", "Crown", "Delete", "Download", "Droplet", "FileCode2", "Filter", "Fingerprint", "Flag", "Flame", "FlaskConical", "FolderOpen", "FolderPlus", "Globe", "History", "Info", "Keyboard", "Layers", "Lightbulb", "LineChart", "Link", "Link2", "List", "ListChecks", "Loader2", "LockOpen", "MessageSquare", "Minimize2", "Minus", "Moon", "MoreVertical", "Newspaper", "Palette", "PenLine", "Plus", "Redo2", "Repeat", "RotateCcw", "Rows3", "Save", "Scaling", "Send", "Settings", "ShieldCheck", "ShoppingCart", "SlidersHorizontal", "Sparkles", "Sun", "Table", "Table2", "TrendingDown", "TrendingUp", "Type", "Undo2", "User", "Volume2", "Webhook", "X"];
const _tuned = {};
for (const n of _LUCIDE_NAMES) { if (Lucide[n]) _tuned[n] = tuneLucide(Lucide[n]); }
export const {
  Activity, AlertTriangle, AlignLeft, AreaChart, ArrowUpDown, Award, BarChart3, BellOff, BrainCircuit, Briefcase, CandlestickChart, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Coins, Columns3, Copy, Crown, Delete, Download, Droplet, FileCode2, Filter, Fingerprint, Flag, Flame, FlaskConical, FolderOpen, FolderPlus, Globe, History, Info, Keyboard, Layers, Lightbulb, LineChart, Link, Link2, List, ListChecks, Loader2, LockOpen, MessageSquare, Minimize2, Minus, Moon, MoreVertical, Newspaper, Palette, PenLine, Plus, Redo2, Repeat, RotateCcw, Rows3, Save, Scaling, Send, Settings, ShieldCheck, ShoppingCart, SlidersHorizontal, Sparkles, Sun, Table, Table2, TrendingDown, TrendingUp, Type, Undo2, User, Volume2, Webhook, X,
} = _tuned;
// آیکونِ رابط‌کاربری — استخراجِ مستقیم از TradingView (fill=currentColor). override روی lucide.
const D = {
  Camera: { vb: '0 0 28 28', inner: '<path fill-rule="evenodd" clip-rule="evenodd" d="M11.118 6a.5.5 0 0 0-.447.276L9.809 8H5.5A1.5 1.5 0 0 0 4 9.5v10A1.5 1.5 0 0 0 5.5 21h16a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 21.5 8h-4.309l-.862-1.724A.5.5 0 0 0 15.882 6h-4.764zm-1.342-.17A1.5 1.5 0 0 1 11.118 5h4.764a1.5 1.5 0 0 1 1.342.83L17.809 7H21.5A2.5 2.5 0 0 1 24 9.5v10a2.5 2.5 0 0 1-2.5 2.5h-16A2.5 2.5 0 0 1 3 19.5v-10A2.5 2.5 0 0 1 5.5 7h3.691l.585-1.17z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M13.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0 1a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z"></path>' },
  Settings2: { vb: '0 0 28 28', inner: '<path fill-rule="evenodd" d="M18 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-1 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path><path fill-rule="evenodd" d="M8.5 5h11l5 9-5 9h-11l-5-9 5-9Zm-3.86 9L9.1 6h9.82l4.45 8-4.45 8H9.1l-4.45-8Z"></path>' },
  Bell: { vb: '0 0 28 28', inner: '<path fill="currentColor" d="m19.54 4.5 3.96 4.32-.74.68-3.96-4.32.74-.68ZM7.46 4.5 3.5 8.82l.74.68L8.2 5.18l-.74-.68ZM19.74 10.33A7.5 7.5 0 0 1 21 14.5v.5h1v-.5a8.5 8.5 0 1 0-8.5 8.5h.5v-1h-.5a7.5 7.5 0 1 1 6.24-11.67Z"></path><path fill="currentColor" d="M13 9v5h-3v1h4V9h-1ZM19 20v-4h1v4h4v1h-4v4h-1v-4h-4v-1h4Z"></path>' },
  BellRing: { vb: '0 0 28 28', inner: '<path fill="currentColor" d="m19.54 4.5 3.96 4.32-.74.68-3.96-4.32.74-.68ZM7.46 4.5 3.5 8.82l.74.68L8.2 5.18l-.74-.68ZM19.74 10.33A7.5 7.5 0 0 1 21 14.5v.5h1v-.5a8.5 8.5 0 1 0-8.5 8.5h.5v-1h-.5a7.5 7.5 0 1 1 6.24-11.67Z"></path><path fill="currentColor" d="M13 9v5h-3v1h4V9h-1ZM19 20v-4h1v4h4v1h-4v4h-1v-4h-4v-1h4Z"></path>' },
  // بازکشیده‌شده (باگ: یک مسیرِ رعدوبرقِ سرگردان داشت). ذره‌بینِ ساده.
  Search: { vb: '0 0 28 28', inner: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" d="m17 17 6 6"/>' },
  Play: { vb: '0 0 28 28', inner: '<path fill="none" stroke="currentColor" d="M13.5 20V9l-6 5.5 6 5.5zM21.5 20V9l-6 5.5 6 5.5z"></path>' },
  LayoutGrid: { vb: '-1 -1 21 19', inner: '<path fill="currentColor" d="M2.5 1C1.67 1 1 1.67 1 2.5v12c0 .83.67 1.5 1.5 1.5h14c.83 0 1.5-.67 1.5-1.5v-12c0-.83-.67-1.5-1.5-1.5h-14ZM0 2.5A2.5 2.5 0 0 1 2.5 0h14A2.5 2.5 0 0 1 19 2.5v12a2.5 2.5 0 0 1-2.5 2.5h-14A2.5 2.5 0 0 1 0 14.5v-12Z"></path>' },
  Maximize2: { vb: '0 0 28 28', inner: '<path fill="currentColor" d="M7 18.5A2.5 2.5 0 0 0 9.5 21H12v1H9.5A3.5 3.5 0 0 1 6 18.5V16h1zm15 0a3.5 3.5 0 0 1-3.5 3.5H16v-1h2.5a2.5 2.5 0 0 0 2.5-2.5V16h1zM12 7H9.5A2.5 2.5 0 0 0 7 9.5V12H6V9.5A3.5 3.5 0 0 1 9.5 6H12zm6.5-1A3.5 3.5 0 0 1 22 9.5V12h-1V9.5A2.5 2.5 0 0 0 18.5 7H16V6z"></path>' },
  Lock: { vb: '0 0 28 28', inner: '<path fill="currentColor" fill-rule="evenodd" d="M14 6a3 3 0 0 0-3 3v3h8.5a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 6 21.5v-7A2.5 2.5 0 0 1 8.5 12H10V9a4 4 0 0 1 8 0h-1a3 3 0 0 0-3-3zm-1 11a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0v-2zm-6-2.5c0-.83.67-1.5 1.5-1.5h11c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-11A1.5 1.5 0 0 1 7 21.5v-7z"></path>' },
  Unlock: { vb: '0 0 28 28', inner: '<path fill="currentColor" fill-rule="evenodd" d="M14 6a3 3 0 0 0-3 3v3h8.5a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 6 21.5v-7A2.5 2.5 0 0 1 8.5 12H10V9a4 4 0 0 1 8 0h-1a3 3 0 0 0-3-3zm-1 11a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0v-2zm-6-2.5c0-.83.67-1.5 1.5-1.5h11c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-11A1.5 1.5 0 0 1 7 21.5v-7z"></path>' },
  // بازکشیده‌شده (باگ: قبلاً یک شِوران بود در فضای ۱۸ واحدی). چشمِ بادامی + مردمک، مرکزِ ۱۴.
  Eye: { vb: '0 0 28 28', inner: '<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="round" d="M3 14s4-6.5 11-6.5S25 14 25 14s-4 6.5-11 6.5S3 14 3 14Z"/><circle cx="14" cy="14" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
  EyeOff: { vb: '0 0 28 28', inner: '<path fill="currentColor" fill-rule="evenodd" d="M5 10.76l-.41-.72-.03-.04.03-.04a15 15 0 012.09-2.9c1.47-1.6 3.6-3.12 6.32-3.12 2.73 0 4.85 1.53 6.33 3.12a15.01 15.01 0 012.08 2.9l.03.04-.03.04a15 15 0 01-2.09 2.9c-1.47 1.6-3.6 3.12-6.32 3.12-2.73 0-4.85-1.53-6.33-3.12a15 15 0 01-1.66-2.18zm17.45-.98L22 10l.45.22-.01.02a5.04 5.04 0 01-.15.28 16.01 16.01 0 01-2.23 3.1c-1.56 1.69-3.94 3.44-7.06 3.44-3.12 0-5.5-1.75-7.06-3.44a16 16 0 01-2.38-3.38v-.02h-.01L4 10l-.45-.22.01-.02a5.4 5.4 0 01.15-.28 16 16 0 012.23-3.1C7.5 4.69 9.88 2.94 13 2.94c3.12 0 5.5 1.75 7.06 3.44a16.01 16.01 0 012.38 3.38v.02h.01zM22 10l.45-.22.1.22-.1.22L22 10zM3.55 9.78L4 10l-.45.22-.1-.22.1-.22zm6.8.22A2.6 2.6 0 0113 7.44 2.6 2.6 0 0115.65 10 2.6 2.6 0 0113 12.56 2.6 2.6 0 0110.35 10zM13 6.44A3.6 3.6 0 009.35 10 3.6 3.6 0 0013 13.56c2 0 3.65-1.58 3.65-3.56A3.6 3.6 0 0013 6.44zm7.85 12l.8-.8.7.71-.79.8a.5.5 0 000 .7l.59.59c.2.2.5.2.7 0l1.8-1.8.7.71-1.79 1.8a1.5 1.5 0 01-2.12 0l-.59-.59a1.5 1.5 0 010-2.12zM16.5 21.5l-.35-.35a.5.5 0 00-.07.07l-1 1.5-1 1.5a.5.5 0 00.42.78h4a2.5 2.5 0 001.73-.77A2.5 2.5 0 0021 22.5a2.5 2.5 0 00-.77-1.73A2.5 2.5 0 0018.5 20a3.1 3.1 0 00-1.65.58 5.28 5.28 0 00-.69.55v.01h-.01l.35.36zm.39.32l-.97 1.46-.49.72h3.07c.34 0 .72-.17 1.02-.48.3-.3.48-.68.48-1.02 0-.34-.17-.72-.48-1.02-.3-.3-.68-.48-1.02-.48-.35 0-.75.18-1.1.42a4.27 4.27 0 00-.51.4z"></path>' },
  Trash2: { vb: '0 0 28 28', inner: '<path fill="currentColor" d="M18 7h5v1h-2.01l-1.33 14.64a1.5 1.5 0 0 1-1.5 1.36H9.84a1.5 1.5 0 0 1-1.49-1.36L7.01 8H5V7h5V6c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v1Zm-6-2a1 1 0 0 0-1 1v1h6V6a1 1 0 0 0-1-1h-4ZM8.02 8l1.32 14.54a.5.5 0 0 0 .5.46h8.33a.5.5 0 0 0 .5-.46L19.99 8H8.02Z"></path>' },
  Ruler: { vb: '0 0 28 28', inner: '<path fill="currentColor" d="M2 9.75a1.5 1.5 0 0 0-1.5 1.5v5.5a1.5 1.5 0 0 0 1.5 1.5h24a1.5 1.5 0 0 0 1.5-1.5v-5.5a1.5 1.5 0 0 0-1.5-1.5zm0 1h3v2.5h1v-2.5h3.25v3.9h1v-3.9h3.25v2.5h1v-2.5h3.25v3.9h1v-3.9H22v2.5h1v-2.5h3a.5.5 0 0 1 .5.5v5.5a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5v-5.5a.5.5 0 0 1 .5-.5z" transform="rotate(-45 14 14)"></path>' },
  Magnet: { vb: '0 0 28 28', inner: '<g fill="currentColor" fill-rule="evenodd"><path fill-rule="nonzero" d="M14 10a2 2 0 0 0-2 2v11H6V12c0-4.416 3.584-8 8-8s8 3.584 8 8v11h-6V12a2 2 0 0 0-2-2zm-3 2a3 3 0 0 1 6 0v10h4V12c0-3.864-3.136-7-7-7s-7 3.136-7 7v10h4V12z"></path><path d="M6.5 18h5v1h-5zm10 0h5v1h-5z"></path></g>' },
  Crosshair: { vb: '0 0 28 28', inner: '<g fill="currentColor"><path d="M18 15h8v-1h-8z"></path><path d="M14 18v8h1v-8zM14 3v8h1v-8zM3 15h8v-1h-8z"></path></g>' },
  ScanLine: { vb: '0 0 44 44', inner: '<g clip-path="url(#a)"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M22 8a14 14 0 1 0 0 28 14 14 0 0 0 0-28ZM9 22a13 13 0 0 1 22.03-9.35L27.5 16.2a8 8 0 1 0 .68.73l3.55-3.55A13 13 0 1 1 9 22Zm17.79-5.1a7 7 0 1 0 .68.74l-3.62 3.6A2 2 0 0 1 22 24a2 2 0 1 1 1.25-3.56l3.54-3.54Z"></path></g><defs><clipPath id="a"><path fill="currentColor" d="M0 0h44v44H0z"></path></clipPath></defs>' },
  CalendarDays: { vb: '0 0 44 44', inner: '<path fill="currentColor" fill-rule="evenodd" d="M15 11h2v4h-2v-4Zm-1 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1h8v-1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1h1a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3h1v-1Zm4 2h8v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2h1a2 2 0 0 1 2 2v4H11v-4c0-1.1.9-2 2-2h1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2Zm-7 7v11c0 1.1.9 2 2 2h18a2 2 0 0 0 2-2V20H11Zm18-9h-2v4h2v-4Z"></path>' },
  Star: { vb: '0 0 18 18', inner: '<path stroke="currentColor" d="M9 2.13l1.903 3.855.116.236.26.038 4.255.618-3.079 3.001-.188.184.044.259.727 4.237-3.805-2L9 12.434l-.233.122-3.805 2.001.727-4.237.044-.26-.188-.183-3.079-3.001 4.255-.618.26-.038.116-.236L9 2.13z"></path>' },
  Code2: { vb: '0 0 18 18', inner: '<path fill="currentColor" d="M7 14H5.5A1.5 1.5 0 0 1 4 12.5v-1A2.9 2.9 0 0 0 2.66 9l.18-.13A2.9 2.9 0 0 0 4 6.5V5.5C4 4.67 4.67 4 5.5 4H7V3H5.5A2.5 2.5 0 0 0 3 5.5V6.5a1.9 1.9 0 0 1-.77 1.58c-.42.32-.84.43-.85.44C1.3 8.54 1 8.65 1 9s.3.46.38.48c0 0 .43.12.85.44.4.3.77.8.77 1.58v1A2.5 2.5 0 0 0 5.5 15H7v-1Zm4-10h1.5c.83 0 1.5.67 1.5 1.5v1A2.9 2.9 0 0 0 15.34 9l-.18.13A2.9 2.9 0 0 0 14 11.5V12.5c0 .83-.67 1.5-1.5 1.5H11v1h1.5a2.5 2.5 0 0 0 2.5-2.5V11.5c0-.79.38-1.27.77-1.58.42-.32.84-.43.85-.44.08-.02.38-.13.38-.48s-.3-.46-.38-.48c0 0-.43-.12-.85-.44-.4-.3-.77-.8-.77-1.58v-1A2.5 2.5 0 0 0 12.5 3H11v1Z"></path>' },
  MoreHorizontal: { vb: '0 0 18 18', inner: '<path fill="currentColor" fill-rule="evenodd" d="M3 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 1a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6-1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 1a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm7-2a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm1 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"></path>' },
  Pencil: { vb: '0 0 28 28', inner: '<path fill="currentColor" d="M15 6H7.5C6.67 6 6 6.67 6 7.5v13c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5V16h1v4.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 5 20.5v-13A2.5 2.5 0 0 1 7.5 5H15v1Z"></path><path fill="currentColor" d="M22.41 5.7a2 2 0 0 0-2.82 0L11 14.3V18h3.7l8.6-8.59a2 2 0 0 0 0-2.82l-.89-.88Zm-2.12.71a1 1 0 0 1 1.42 0l.88.88a1 1 0 0 1 0 1.42l-.59.58L19.7 7l.6-.59Zm1 3.59-7 7H12v-2.3l7-7 2.3 2.3Z"></path>' },
  HelpCircle: { vb: '0 0 44 44', inner: '<path fill="currentColor" d="M22 8c7.732 0 14 6.268 14 14s-6.268 14-14 14S8 29.732 8 22 14.268 8 22 8m0 1C14.82 9 9 14.82 9 22s5.82 13 13 13 13-5.82 13-13S29.18 9 22 9m.201 18.01A2.016 2.016 0 0 1 24 29l-.01.204A2.017 2.017 0 0 1 22 31l-.201-.01a2.02 2.02 0 0 1-1.788-1.785L20 29c0-1.104.917-2 2-2zM22 28c-.537 0-1 .455-1 1s.462 1 1 1 1-.455 1-1-.462-1-1-1m.31-15C24.9 13 27 15.1 27 17.69a4.31 4.31 0 0 1-2.195 3.754l-.872.492a2.81 2.81 0 0 0-1.433 2.45V25h-1v-.614c0-1.377.743-2.647 1.942-3.322l.872-.49A3.31 3.31 0 0 0 26 17.688 3.69 3.69 0 0 0 22.31 14H22a4 4 0 0 0-4 4h-1a5 5 0 0 1 5-5z"></path>' },
};
function mk(dd) { return ({ size = 24, className, style, color, ...rest }) => (
  <svg width={size} height={size} viewBox={dd.vb} className={className} style={color ? { color, ...style } : style} xmlns="http://www.w3.org/2000/svg" fill="currentColor" dangerouslySetInnerHTML={{ __html: dd.inner }} />
); }
export const Camera = mk(D.Camera);
export const Settings2 = mk(D.Settings2);
export const Bell = mk(D.Bell);
export const BellRing = mk(D.BellRing);
export const Search = mk(D.Search);
export const Play = mk(D.Play);
export const LayoutGrid = mk(D.LayoutGrid);
export const Maximize2 = mk(D.Maximize2);
export const Lock = mk(D.Lock);
export const Unlock = mk(D.Unlock);
export const Eye = mk(D.Eye);
export const EyeOff = mk(D.EyeOff);
export const Trash2 = mk(D.Trash2);
export const Ruler = mk(D.Ruler);
export const Magnet = mk(D.Magnet);
export const Crosshair = mk(D.Crosshair);
export const ScanLine = mk(D.ScanLine);
export const CalendarDays = mk(D.CalendarDays);
export const Star = mk(D.Star);
export const Code2 = mk(D.Code2);
export const MoreHorizontal = mk(D.MoreHorizontal);
export const Pencil = mk(D.Pencil);
export const HelpCircle = mk(D.HelpCircle);
