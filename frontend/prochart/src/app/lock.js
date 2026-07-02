// قفلِ اپ — PIN محلی (هشِ ساده، برای گیتِ محلی؛ نه رمزنگاریِ حساس).
const KEY = 'pc_pin_v1';
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return 'p' + h.toString(36); }
export function hasPin() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
export function setPin(p) { try { localStorage.setItem(KEY, hash(String(p))); } catch (e) { /* noop */ } }
export function clearPin() { try { localStorage.removeItem(KEY); } catch (e) { /* noop */ } }
export function verifyPin(p) { try { return localStorage.getItem(KEY) === hash(String(p)); } catch (e) { return false; } }
