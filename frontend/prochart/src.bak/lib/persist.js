// نگه‌داریِ سادهٔ حالتِ کاربر در مرورگر (localStorage) تا رفرش یا خروج از صفحه
// کارِ نیمه‌تمامِ کاربر — پیکربندیِ استراتژی/الگو، سشنِ تمرین، چارت — را پاک نکند.
// الگوی هم‌خانوادهٔ BazaarNama؛ هر صفحه یک کلیدِ یکتا می‌گیرد.
export function makeStore(key) {
  const load = () => {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; }
  };
  const save = (patch) => {
    try { localStorage.setItem(key, JSON.stringify({ ...load(), ...patch })); } catch (e) { /* noop */ }
  };
  const clear = () => {
    try { localStorage.removeItem(key); } catch (e) { /* noop */ }
  };
  return { load, save, clear };
}
